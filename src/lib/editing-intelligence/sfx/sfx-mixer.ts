/**
 * sfx-mixer.ts — multi-track audio mixing for the editing intelligence layer.
 *
 * Architecture (matching HyperFrames concept):
 * - Voice track: original recording, never modified except for one gain change
 * - SFX track: generated from SFX decisions with ducking automation
 * - Music track: background music (optional)
 * - Ambience track: room tone (optional)
 *
 * Each track is a Float32Array at 44100 Hz.
 * The mixer produces a single output buffer.
 *
 * Key features:
 * - Speech-gap-aware ducking (SFX gets louder during voice gaps)
 * - High-pass filtering per SFX asset
 * - Soft clipping
 * - Submix support (group multiple SFX under one bus)
 */

import type { SfxDecision } from "./sfx-decision";
import { SfxAsset } from "./sfx-registry";
import { generateSfx } from "./sfx-generators";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MixConfig {
  /** Output sample rate (Hz). Default: 44100 */
  sampleRate: number;
  /** Master volume (0-1). Default: 1.0 */
  masterVolume: number;
  /** Voice track volume (0-1). Default: 1.0 */
  voiceVolume: number;
  /** SFX track volume (0-1). Default: 0.8 */
  sfxVolume: number;
  /** Music track volume (0-1). Default: 0.3 */
  musicVolume: number;
  /** Ambience track volume (0-1). Default: 0.15 */
  ambienceVolume: number;
  /** Voice duck amount when SFX plays (dB). Negative = reduce voice. */
  voiceDuckDb: number;
  /** Clamp output to this peak level (0-1). Default: 0.95 */
  peakLimit: number;
}

export interface MixResult {
  /** Final mixed audio (mono, 44100 Hz) */
  output: Float32Array;
  /** Duration in seconds */
  duration: number;
  /** Sample rate */
  sampleRate: number;
  /** Number of samples */
  sampleCount: number;
  /** SFX events that were actually mixed in */
  sfxMixed: number;
  /** SFX events that were skipped (out of range, etc.) */
  sfxSkipped: number;
}

// ─── Default Config ───────────────────────────────────────────────────────────

export const DEFAULT_MIX_CONFIG: MixConfig = {
  sampleRate: 44100,
  masterVolume: 1.0,
  voiceVolume: 1.0,
  sfxVolume: 0.8,
  musicVolume: 0.3,
  ambienceVolume: 0.15,
  voiceDuckDb: -4,
  peakLimit: 0.95,
};

// ─── Mixer ────────────────────────────────────────────────────────────────────

export class SfxMixer {
  private config: MixConfig;
  private voiceTrack: Float32Array | null = null;
  private musicTrack: Float32Array | null = null;
  private ambienceTrack: Float32Array | null = null;
  private sfxTrack: Float32Array | null = null;
  private voiceGaps: { start: number; end: number }[] = [];

  constructor(config: Partial<MixConfig> = {}) {
    this.config = { ...DEFAULT_MIX_CONFIG, ...config };
  }

  // ─── Track Loading ─────────────────────────────────────────────────────────

  /**
   * Load the voice track.
   * This is the original recording — never modified except for volume.
   */
  loadVoice(samples: Float32Array): void {
    this.voiceTrack = new Float32Array(samples);
  }

  /**
   * Load the music track (optional).
   */
  loadMusic(samples: Float32Array): void {
    this.musicTrack = new Float32Array(samples);
  }

  /**
   * Load the ambience track (optional).
   */
  loadAmbience(samples: Float32Array): void {
    this.ambienceTrack = new Float32Array(samples);
  }

  // ─── Voice Gap Detection ────────────────────────────────────────────────────

  /**
   * Detect speech gaps in the voice track using a simple energy threshold.
   * Used for gap-aware ducking — SFX gets louder during voice gaps.
   */
  detectVoiceGaps(threshold = 0.01, minGapSec = 0.1): void {
    if (!this.voiceTrack) return;

    const sr = this.config.sampleRate;
    const minGapSamples = Math.round(minGapSec * sr);
    const windowSize = Math.round(0.02 * sr); // 20ms windows
    const gaps: { start: number; end: number }[] = [];

    let inGap = false;
    let gapStart = 0;
    let gapWindowCount = 0;

    for (let i = 0; i < this.voiceTrack.length; i += windowSize) {
      // Calculate RMS of this window
      let sum = 0;
      const end = Math.min(i + windowSize, this.voiceTrack.length);
      for (let j = i; j < end; j++) {
        sum += this.voiceTrack[j] * this.voiceTrack[j];
      }
      const rms = Math.sqrt(sum / (end - i));
      const isSilent = rms < threshold;

      if (isSilent) {
        gapWindowCount++;
        if (!inGap) {
          gapStart = i;
          inGap = true;
        }
      } else {
        if (inGap && gapWindowCount >= minGapSec * sr / windowSize) {
          gaps.push({
            start: gapStart / sr,
            end: i / sr,
          });
        }
        inGap = false;
        gapWindowCount = 0;
      }
    }

    // Close any trailing gap
    if (inGap && gapWindowCount >= minGapSec * sr / windowSize) {
      gaps.push({
        start: gapStart / sr,
        end: this.voiceTrack.length / sr,
      });
    }

    this.voiceGaps = gaps;
  }

  /**
   * Check if a given time (seconds) falls within a voice gap.
   */
  isInVoiceGap(timeSec: number): boolean {
    return this.voiceGaps.some(
      (gap) => timeSec >= gap.start && timeSec <= gap.end
    );
  }

  // ─── SFX Track Building ─────────────────────────────────────────────────────

  /**
   * Build the SFX track from decisions.
   * Generates SFX audio for each decision and mixes into the SFX track.
   * During voice speech: SFX is ducked.
   * During voice gaps: SFX is at full volume.
   */
  buildSfxTrack(decisions: SfxDecision[]): void {
    const duration = this.getTotalDuration();
    const sr = this.config.sampleRate;
    const totalSamples = Math.round(duration * sr);
    this.sfxTrack = new Float32Array(totalSamples);

    let mixed = 0;
    let skipped = 0;

    for (const decision of decisions) {
      const asset = decision.asset;

      // Generate SFX audio
      let sfxBuffer: Float32Array;
      try {
        const generated = generateSfx(decision.sfxId, decision.durationMs);
        if (!generated) {
          skipped++;
          continue;
        }
        sfxBuffer = generated.samples;
      } catch (e) {
        console.warn(`[SFX Mixer] Failed to generate SFX: ${decision.sfxId}`, e);
        skipped++;
        continue;
      }

      // Apply high-pass filter
      if (asset.highPassHz > 0) {
        applyHighPass(sfxBuffer, asset.highPassHz, sr);
      }

      // Calculate start sample
      const startSample = Math.round(decision.timestamp * sr);
      if (startSample < 0 || startSample >= totalSamples) {
        skipped++;
        continue;
      }

      // Determine duck gain
      let duckGain = 1.0;
      if (this.voiceTrack) {
        // Check if SFX overlaps with voice speech
        const sfxStartSec = decision.timestamp;
        const sfxEndSec = decision.timestamp + decision.durationMs / 1000;
        let overlapsVoice = false;

        for (let t = sfxStartSec; t < sfxEndSec; t += 0.02) {
          if (!this.isInVoiceGap(t)) {
            overlapsVoice = true;
            break;
          }
        }

        if (overlapsVoice) {
          duckGain = Math.pow(10, decision.duckDb / 20);
        }
      }

      // Apply volume + duck gain
      const finalGain = decision.volume * this.config.sfxVolume * duckGain;

      // Mix into SFX track
      for (let i = 0; i < sfxBuffer.length; i++) {
        const idx = startSample + i;
        if (idx < totalSamples) {
          this.sfxTrack[idx] += sfxBuffer[i] * finalGain;
        }
      }

      mixed++;
    }

    // Store counts for reporting
    this.sfxMixed = mixed;
    this.sfxSkipped = skipped;
  }

  private sfxMixed = 0;
  private sfxSkipped = 0;

  // ─── Master Mix ─────────────────────────────────────────────────────────────

  /**
   * Produce the final mixed output.
   * Applies: voice volume, music volume, ambience volume, master volume, soft clipping.
   */
  mix(): MixResult {
    const duration = this.getTotalDuration();
    const sr = this.config.sampleRate;
    const totalSamples = Math.round(duration * sr);
    const output = new Float32Array(totalSamples);

    // Mix voice
    if (this.voiceTrack) {
      for (let i = 0; i < Math.min(this.voiceTrack.length, totalSamples); i++) {
        output[i] += this.voiceTrack[i] * this.config.voiceVolume;
      }
    }

    // Mix music
    if (this.musicTrack) {
      for (let i = 0; i < Math.min(this.musicTrack.length, totalSamples); i++) {
        output[i] += this.musicTrack[i] * this.config.musicVolume;
      }
    }

    // Mix ambience
    if (this.ambienceTrack) {
      for (let i = 0; i < Math.min(this.ambienceTrack.length, totalSamples); i++) {
        output[i] += this.ambienceTrack[i] * this.config.ambienceVolume;
      }
    }

    // Mix SFX
    if (this.sfxTrack) {
      for (let i = 0; i < Math.min(this.sfxTrack.length, totalSamples); i++) {
        output[i] += this.sfxTrack[i];
      }
    }

    // Apply master volume
    for (let i = 0; i < output.length; i++) {
      output[i] *= this.config.masterVolume;
    }

    // Soft clip
    for (let i = 0; i < output.length; i++) {
      output[i] = Math.max(-this.config.peakLimit, Math.min(this.config.peakLimit, output[i]));
    }

    return {
      output,
      duration,
      sampleRate: sr,
      sampleCount: totalSamples,
      sfxMixed: this.sfxMixed,
      sfxSkipped: this.sfxSkipped,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private getTotalDuration(): number {
    const tracks = [
      this.voiceTrack,
      this.musicTrack,
      this.ambienceTrack,
      this.sfxTrack,
    ].filter((t) => t !== null) as Float32Array[];

    if (tracks.length === 0) return 0;

    let maxSamples = 0;
    for (const track of tracks) {
      maxSamples = Math.max(maxSamples, track.length);
    }
    return maxSamples / this.config.sampleRate;
  }

  /**
   * Get current stats.
   */
  getStats(): { voiceGaps: number; sfxMixed: number; sfxSkipped: number } {
    return {
      voiceGaps: this.voiceGaps.length,
      sfxMixed: this.sfxMixed,
      sfxSkipped: this.sfxSkipped,
    };
  }
}

// ─── Low-level DSP Helpers ────────────────────────────────────────────────────

/**
 * Apply a first-order high-pass filter in-place.
 */
function applyHighPass(samples: Float32Array, cutoffHz: number, sampleRate: number): void {
  const rc = 1.0 / (2 * Math.PI * cutoffHz);
  const dt = 1.0 / sampleRate;
  const alpha = rc / (rc + dt);
  let prev = samples[0];
  for (let i = 1; i < samples.length; i++) {
    const current = samples[i];
    samples[i] = alpha * (prev + current - samples[i - 1]);
    prev = current;
  }
}

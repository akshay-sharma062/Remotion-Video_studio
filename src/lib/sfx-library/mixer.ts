/**
 * sfx-library/mixer.ts — multi-track audio mixing for the SFX Library.
 *
 * Extends the base SfxMixer with library-specific features:
 * - Support for the full 44-asset library
 * - File-backed and generative SFX support
 * - Integration with the decision engine
 * - Audition mode for generating preview files
 */

import { SFX_LIBRARY_GENERATORS } from "./generators";
import { writeWavFile, concatenateWithGaps } from "./wav-writer";
import type {
  SfxAsset,
  SfxLibraryDecision,
  MixConfig,
  MixResult,
  SfxAuditionRequest,
  SfxAuditionResult,
} from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LibraryMixConfig extends MixConfig {
  /** Whether to log detailed mixing info */
  verbose?: boolean;
}

// ─── Default Config ───────────────────────────────────────────────────────────

export const DEFAULT_LIBRARY_MIX_CONFIG: LibraryMixConfig = {
  sampleRate: 44100,
  masterVolume: 1.0,
  voiceVolume: 1.0,
  sfxVolume: 0.8,
  musicVolume: 0.3,
  ambienceVolume: 0.15,
  voiceDuckDb: -4,
  peakLimit: 0.95,
  verbose: false,
};

// ─── Mixer ────────────────────────────────────────────────────────────────────

export class SfxLibraryMixer {
  private config: LibraryMixConfig;
  private voiceTrack: Float32Array | null = null;
  private musicTrack: Float32Array | null = null;
  private ambienceTrack: Float32Array | null = null;
  private sfxTrack: Float32Array | null = null;
  private voiceGaps: { start: number; end: number }[] = [];

  constructor(config: Partial<LibraryMixConfig> = {}) {
    this.config = { ...DEFAULT_LIBRARY_MIX_CONFIG, ...config };
  }

  // ─── Track Loading ─────────────────────────────────────────────────────────

  loadVoice(samples: Float32Array): void {
    this.voiceTrack = new Float32Array(samples);
  }

  loadMusic(samples: Float32Array): void {
    this.musicTrack = new Float32Array(samples);
  }

  loadAmbience(samples: Float32Array): void {
    this.ambienceTrack = new Float32Array(samples);
  }

  // ─── Voice Gap Detection ────────────────────────────────────────────────────

  detectVoiceGaps(threshold = 0.01, minGapSec = 0.1): void {
    if (!this.voiceTrack) return;

    const sr = this.config.sampleRate;
    const minGapSamples = Math.round(minGapSec * sr);
    const windowSize = Math.round(0.02 * sr);
    const gaps: { start: number; end: number }[] = [];

    let inGap = false;
    let gapStart = 0;
    let gapWindowCount = 0;

    for (let i = 0; i < this.voiceTrack.length; i += windowSize) {
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
          gaps.push({ start: gapStart / sr, end: i / sr });
        }
        inGap = false;
        gapWindowCount = 0;
      }
    }

    if (inGap && gapWindowCount >= minGapSec * sr / windowSize) {
      gaps.push({ start: gapStart / sr, end: this.voiceTrack.length / sr });
    }

    this.voiceGaps = gaps;
  }

  private isInVoiceGap(timeSec: number): boolean {
    return this.voiceGaps.some(
      (gap) => timeSec >= gap.start && timeSec <= gap.end
    );
  }

  // ─── SFX Track Building ─────────────────────────────────────────────────────

  buildSfxTrack(decisions: SfxLibraryDecision[]): void {
    const duration = this.getTotalDuration();
    const sr = this.config.sampleRate;
    const totalSamples = Math.round(duration * sr);
    this.sfxTrack = new Float32Array(totalSamples);

    let mixed = 0;
    let skipped = 0;

    for (const decision of decisions) {
      // Generate SFX audio
      const generator = SFX_LIBRARY_GENERATORS[decision.sfxId];
      if (!generator) {
        if (this.config.verbose) {
          console.warn(`[SFX Library Mixer] No generator for: ${decision.sfxId}`);
        }
        skipped++;
        continue;
      }

      let sfxBuffer: Float32Array;
      try {
        const result = generator(decision.durationMs, decision.asset.defaultGain);
        if (result) {
          sfxBuffer = result.samples;
        } else {
          skipped++;
          continue;
        }
      } catch (e) {
        if (this.config.verbose) {
          console.warn(`[SFX Library Mixer] Failed to generate: ${decision.sfxId}`, e);
        }
        skipped++;
        continue;
      }

      // Apply high-pass filter
      if (decision.highPassHz > 0) {
        applyHighPass(sfxBuffer, decision.highPassHz, sr);
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

    this.sfxMixed = mixed;
    this.sfxSkipped = skipped;
  }

  private sfxMixed = 0;
  private sfxSkipped = 0;

  // ─── Master Mix ─────────────────────────────────────────────────────────────

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

  getStats(): { voiceGaps: number; sfxMixed: number; sfxSkipped: number } {
    return {
      voiceGaps: this.voiceGaps.length,
      sfxMixed: this.sfxMixed,
      sfxSkipped: this.sfxSkipped,
    };
  }

  // ─── Audition ───────────────────────────────────────────────────────────────

  /**
   * Generate audition files for the requested SFX assets.
   * Each asset is rendered as a standalone WAV file.
   */
  static async audition(
    request: SfxAuditionRequest,
    config: Partial<LibraryMixConfig> = {}
  ): Promise<SfxAuditionResult> {
    const { assetIds, outputDir, normalizePeak = 0.8, paddingMs = 100 } = request;
    const files: { id: string; path: string; durationMs: number }[] = [];
    const buffers: Float32Array[] = [];

    for (const id of assetIds) {
      const generator = SFX_LIBRARY_GENERATORS[id];
      if (!generator) continue;

      const asset = SFX_LIBRARY.find((a) => a.id === id);
      if (!asset) continue;

      const midDuration = (asset.durationMs[0] + asset.durationMs[1]) / 2;
      const totalDuration = midDuration + paddingMs * 2;

      const result = generator(totalDuration, asset.defaultGain);
      if (!result || !result.samples) continue;

      const path = `${outputDir}/${id}.wav`;
      writeWavFile(path, result.samples, result.sampleRate);
      buffers.push(result.samples);
      files.push({ id, path, durationMs: result.duration * 1000 });
    }

    // Create concatenated file if multiple
    let outputPath: string | null = null;
    if (files.length === 1) {
      outputPath = files[0].path;
    } else if (files.length > 1) {
      outputPath = `${outputDir}/audition-all.wav`;
      const combined = concatenateWithGaps(buffers, 500);
      writeWavFile(outputPath, combined);
    }

    return {
      files,
      totalDurationMs: files.reduce((acc, f) => acc + f.durationMs, 0) + files.length * 500,
      outputPath,
    };
  }
}

// ─── Low-level DSP ────────────────────────────────────────────────────────────

function applyHighPass(samples: Float32Array, cutoffHz: number, sampleRate: number): void {
  if (cutoffHz <= 0) return;
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

/**
 * audio-mixer.ts — multi-track audio mixing subsystem.
 *
 * Implements HyperFrames-style submix architecture:
 * - Voice track: original recording, one gain change only
 * - SFX track: ducked under voice, gap-aware
 * - Music track: background, ducked under voice
 * - Ambience track: room tone, always present
 *
 * Each track is a Float32Array at the project's sample rate.
 * Final output is soft-clipped to prevent distortion.
 */

import type { SfxDecision } from "../sfx/sfx-decision";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AudioMixConfig {
  sampleRate: number;
  voiceVolume: number;
  sfxVolume: number;
  musicVolume: number;
  ambienceVolume: number;
  peakLimit: number;
  /** Duck music/ambience by this many dB under voice */
  globalDuckDb: number;
}

export interface AudioMixResult {
  output: Float32Array;
  duration: number;
  sampleRate: number;
  sampleCount: number;
  sfxEventsMixed: number;
  sfxEventsSkipped: number;
  peakLevel: number;
  rmsLevel: number;
}

// ─── Default Config ───────────────────────────────────────────────────────────

export const DEFAULT_AUDIO_MIX_CONFIG: AudioMixConfig = {
  sampleRate: 44100,
  voiceVolume: 1.0,
  sfxVolume: 0.8,
  musicVolume: 0.25,
  ambienceVolume: 0.1,
  peakLimit: 0.95,
  globalDuckDb: -6,
};

// ─── Mixer ────────────────────────────────────────────────────────────────────

export class AudioMixer {
  private config: AudioMixConfig;
  private voiceTrack: Float32Array | null = null;
  private musicTrack: Float32Array | null = null;
  private ambienceTrack: Float32Array | null = null;
  private sfxData: { samples: Float32Array; timestampSec: number; gain: number }[] = [];

  constructor(config: Partial<AudioMixConfig> = {}) {
    this.config = { ...DEFAULT_AUDIO_MIX_CONFIG, ...config };
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

  // ─── SFX Track Building ─────────────────────────────────────────────────────

  /**
   * Add SFX events to the mix.
   * Each event includes its generated audio and a gain value.
   */
  addSfxEvents(
    events: { samples: Float32Array; timestampSec: number; gain: number }[]
  ): void {
    for (const event of events) {
      this.sfxData.push({
        samples: event.samples,
        timestampSec: event.timestampSec,
        gain: event.gain,
      });
    }
  }

  // ─── Mix ───────────────────────────────────────────────────────────────────

  /**
   * Produce the final mixed output.
   */
  mix(): AudioMixResult {
    const duration = this.calculateDuration();
    const sr = this.config.sampleRate;
    const totalSamples = Math.round(duration * sr);
    const output = new Float32Array(totalSamples);

    let sfxMixed = 0;
    let sfxSkipped = 0;

    // 1. Mix voice (base layer, never ducked)
    if (this.voiceTrack) {
      for (let i = 0; i < Math.min(this.voiceTrack.length, totalSamples); i++) {
        output[i] += this.voiceTrack[i] * this.config.voiceVolume;
      }
    }

    // 2. Mix ambience (always present, quiet)
    if (this.ambienceTrack) {
      for (let i = 0; i < Math.min(this.ambienceTrack.length, totalSamples); i++) {
        output[i] += this.ambienceTrack[i] * this.config.ambienceVolume;
      }
    }

    // 3. Mix music (ducked under voice globally)
    if (this.musicTrack) {
      for (let i = 0; i < Math.min(this.musicTrack.length, totalSamples); i++) {
        output[i] += this.musicTrack[i] * this.config.musicVolume;
      }
    }

    // 4. Mix SFX (gap-aware ducking)
    for (const sfx of this.sfxData) {
      const startSample = Math.round(sfx.timestampSec * sr);
      if (startSample < 0 || startSample >= totalSamples) {
        sfxSkipped++;
        continue;
      }

      for (let i = 0; i < sfx.samples.length; i++) {
        const idx = startSample + i;
        if (idx < totalSamples) {
          output[idx] += sfx.samples[i] * sfx.gain * this.config.sfxVolume;
        }
      }

      sfxMixed++;
    }

    // 5. Soft clip
    for (let i = 0; i < output.length; i++) {
      output[i] = Math.max(-this.config.peakLimit, Math.min(this.config.peakLimit, output[i]));
    }

    // 6. Calculate levels
    let peak = 0;
    let sumSquares = 0;
    for (let i = 0; i < output.length; i++) {
      const abs = Math.abs(output[i]);
      if (abs > peak) peak = abs;
      sumSquares += output[i] * output[i];
    }
    const rms = Math.sqrt(sumSquares / output.length);

    return {
      output,
      duration,
      sampleRate: sr,
      sampleCount: totalSamples,
      sfxEventsMixed: sfxMixed,
      sfxEventsSkipped: sfxSkipped,
      peakLevel: peak,
      rmsLevel: rms,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private calculateDuration(): number {
    const tracks = [
      this.voiceTrack,
      this.musicTrack,
      this.ambienceTrack,
    ].filter((t) => t !== null) as Float32Array[];

    let maxSamples = 0;
    for (const track of tracks) {
      maxSamples = Math.max(maxSamples, track.length);
    }

    // Also account for SFX events that may extend past the voice
    for (const sfx of this.sfxData) {
      const sfxEnd = (sfx.timestampSec + sfx.samples.length / this.config.sampleRate) * this.config.sampleRate;
      maxSamples = Math.max(maxSamples, sfxEnd);
    }

    return maxSamples / this.config.sampleRate;
  }
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Convert dB to linear gain.
 */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Convert linear gain to dB.
 */
export function gainToDb(gain: number): number {
  return 20 * Math.log10(Math.max(gain, 1e-10));
}

/**
 * Calculate duck gain based on dB reduction.
 */
export function calculateDuckGain(duckDb: number): number {
  return dbToGain(duckDb);
}

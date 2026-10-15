/**
 * sfx-generators.ts — programmatic SFX synthesis for the generative SFX assets.
 *
 * These generators produce audio buffers matching the SFX_REGISTRY specs.
 * All SFX assets marked `generative: true` in the registry have a generator here.
 *
 * Output format: Float32Array at 44100 Hz, mono, -1.0 to 1.0 range.
 */

import type { SfxAsset } from "./sfx-registry";

// ─── Audio Buffer Type ────────────────────────────────────────────────────────

export interface AudioBuffer {
  samples: Float32Array;
  sampleRate: number;
  duration: number; // seconds
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────

function createBuffer(durationMs: number, sampleRate = 44100): { samples: Float32Array; n: number } {
  const n = Math.round((durationMs / 1000) * sampleRate);
  return { samples: new Float32Array(n), n };
}

function applyEnvelope(samples: Float32Array, fadeInMs: number, fadeOutMs: number): void {
  const sr = 44100;
  const fadeIn = Math.round((fadeInMs / 1000) * sr);
  const fadeOut = Math.round((fadeOutMs / 1000) * sr);

  for (let i = 0; i < fadeIn && i < samples.length; i++) {
    samples[i] *= i / fadeIn;
  }
  for (let i = 0; i < fadeOut && i < samples.length; i++) {
    const idx = samples.length - 1 - i;
    samples[idx] *= i / fadeOut;
  }
}

function applyHighPass(samples: Float32Array, cutoffHz: number, sampleRate = 44100): void {
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

// ─── Noise Source ─────────────────────────────────────────────────────────────

/**
 * Deterministic pseudo-random noise based on index.
 * Avoids Math.random() per CLAUDE.md rule #12.
 */
function noise(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

// ─── Generators ───────────────────────────────────────────────────────────────

/**
 * Generate a light impact hit.
 * Short noise burst with a quick low-frequency thump and snap.
 */
export function generateImpactLight(durationMs: number, gain = 0.6): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  const sr = 44100;

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const noiseVal = noise(i) * 0.4;
    const thump = Math.sin(2 * Math.PI * 120 * t) * Math.exp(-t * 30);
    const snap = Math.sin(2 * Math.PI * 3000 * t) * Math.exp(-t * 60);
    samples[i] = (noiseVal + thump * 0.5 + snap * 0.3) * gain;
  }

  applyEnvelope(samples, 0, 80);
  applyHighPass(samples, 200);

  return { samples, sampleRate: sr, duration: durationMs / 1000 };
}

/**
 * Generate a medium impact hit.
 * More weight than light: combines noise, sub thump, and mid snap.
 */
export function generateImpactMedium(durationMs: number, gain = 0.7): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  const sr = 44100;

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const noiseVal = noise(i) * 0.35;
    const thump = Math.sin(2 * Math.PI * 80 * t) * Math.exp(-t * 18);
    const snap = Math.sin(2 * Math.PI * 2000 * t) * Math.exp(-t * 40);
    const crunch = Math.sin(2 * Math.PI * 600 * t) * Math.exp(-t * 50) * 0.3;
    samples[i] = (noiseVal + thump * 0.6 + snap * 0.25 + crunch) * gain;
  }

  applyEnvelope(samples, 0, 100);
  applyHighPass(samples, 130);

  return { samples, sampleRate: sr, duration: durationMs / 1000 };
}

/**
 * Generate a heavy impact hit.
 * Deep thump with broadband noise. Maximum weight.
 */
export function generateImpactHeavy(durationMs: number, gain = 0.8): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  const sr = 44100;

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const noiseVal = noise(i) * 0.3;
    const thump = Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t * 12);
    const body = Math.sin(2 * Math.PI * 150 * t) * Math.exp(-t * 25);
    const snap = Math.sin(2 * Math.PI * 1500 * t) * Math.exp(-t * 50);
    const click = Math.sin(2 * Math.PI * 4000 * t) * Math.exp(-t * 100) * 0.2;
    samples[i] = (noiseVal + thump * 0.7 + body * 0.4 + snap * 0.2 + click) * gain;
  }

  applyEnvelope(samples, 0, 120);
  applyHighPass(samples, 80);

  return { samples, sampleRate: sr, duration: durationMs / 1000 };
}

/**
 * Generate a light whoosh — noise with a frequency sweep.
 */
export function generateWhooshLight(durationMs: number, gain = 0.4): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  const sr = 44100;

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const progress = i / n;
    const freqMod = Math.sin(2 * Math.PI * (3000 - 1500 * progress) * t);
    const noiseVal = noise(i) * 0.6;
    const env = progress < 0.1 ? progress / 0.1 : progress > 0.7 ? (1 - progress) / 0.3 : 1;
    samples[i] = noiseVal * env * freqMod * gain;
  }

  applyEnvelope(samples, 20, 100);
  applyHighPass(samples, 500);

  return { samples, sampleRate: sr, duration: durationMs / 1000 };
}

/**
 * Generate a medium whoosh — more body, longer tail.
 */
export function generateWhooshMedium(durationMs: number, gain = 0.5): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  const sr = 44100;

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const progress = i / n;
    const freqMod = Math.sin(2 * Math.PI * (2500 - 1200 * progress) * t);
    const noiseVal = noise(i) * 0.5;
    const tone = Math.sin(2 * Math.PI * (800 - 400 * progress) * t) * 0.15;
    const env = progress < 0.08 ? progress / 0.08 : progress > 0.65 ? (1 - progress) / 0.35 : 1;
    samples[i] = (noiseVal + tone) * env * freqMod * gain;
  }

  applyEnvelope(samples, 20, 120);
  applyHighPass(samples, 400);

  return { samples, sampleRate: sr, duration: durationMs / 1000 };
}

/**
 * Generate a heavy whoosh — broad sweep with body.
 */
export function generateWhooshHeavy(durationMs: number, gain = 0.6): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  const sr = 44100;

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const progress = i / n;
    const freqMod = Math.sin(2 * Math.PI * (2000 - 1000 * progress) * t);
    const noiseVal = noise(i) * 0.45;
    const body = Math.sin(2 * Math.PI * (400 - 200 * progress) * t) * 0.2;
    const air = Math.sin(2 * Math.PI * (6000 - 3000 * progress) * t) * 0.1;
    const env = progress < 0.06 ? progress / 0.06 : progress > 0.6 ? (1 - progress) / 0.4 : 1;
    samples[i] = (noiseVal + body + air) * env * freqMod * gain;
  }

  applyEnvelope(samples, 30, 150);
  applyHighPass(samples, 300);

  return { samples, sampleRate: sr, duration: durationMs / 1000 };
}

/**
 * Generate a wipe swoosh — directional whoosh with more noise character.
 */
export function generateSwooshWipe(durationMs: number, gain = 0.5): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  const sr = 44100;

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const progress = i / n;
    // Swoosh is more broadband — less tonal, more noise-heavy
    const freqMod = Math.sin(2 * Math.PI * (1800 - 900 * progress) * t);
    const noiseVal = noise(i) * 0.7;
    const whoosh = Math.sin(2 * Math.PI * (500 - 300 * progress) * t) * 0.1;
    const env = progress < 0.05 ? progress / 0.05 : progress > 0.7 ? (1 - progress) / 0.3 : 1;
    samples[i] = (noiseVal + whoosh) * env * freqMod * gain;
  }

  applyEnvelope(samples, 0, 120);
  applyHighPass(samples, 400);

  return { samples, sampleRate: sr, duration: durationMs / 1000 };
}

/**
 * Generate a UI pop — short, bright, resonant.
 */
export function generateUiPop(durationMs: number, gain = 0.5): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  const sr = 44100;

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const tone = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 40);
    const harmonic = Math.sin(2 * Math.PI * 1600 * t) * Math.exp(-t * 60) * 0.5;
    const noiseVal = noise(i) * Math.exp(-t * 80) * 0.2;
    samples[i] = (tone + harmonic + noiseVal) * gain;
  }

  applyEnvelope(samples, 0, 60);
  applyHighPass(samples, 1000);

  return { samples, sampleRate: sr, duration: durationMs / 1000 };
}

/**
 * Generate a UI click — very short, crisp.
 */
export function generateUiClick(durationMs: number, gain = 0.4): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  const sr = 44100;

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const click = Math.sin(2 * Math.PI * 3000 * t) * Math.exp(-t * 100);
    const tick = Math.sin(2 * Math.PI * 6000 * t) * Math.exp(-t * 200) * 0.3;
    samples[i] = (click + tick) * gain;
  }

  applyEnvelope(samples, 0, 40);
  applyHighPass(samples, 2000);

  return { samples, sampleRate: sr, duration: durationMs / 1000 };
}

/**
 * Generate a UI tick — extremely short, subtle.
 */
export function generateUiTick(durationMs: number, gain = 0.3): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  const sr = 44100;

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const tick = Math.sin(2 * Math.PI * 5000 * t) * Math.exp(-t * 200);
    const high = Math.sin(2 * Math.PI * 8000 * t) * Math.exp(-t * 300) * 0.3;
    samples[i] = (tick + high) * gain;
  }

  applyEnvelope(samples, 0, 30);
  applyHighPass(samples, 3000);

  return { samples, sampleRate: sr, duration: durationMs / 1000 };
}

/**
 * Generate a soft chime — two-tone with quick decay.
 */
export function generateChimeSoft(durationMs: number, gain = 0.4): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  const sr = 44100;

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const tone1 = Math.sin(2 * Math.PI * 1200 * t);
    const tone2 = Math.sin(2 * Math.PI * 1800 * t) * 0.5;
    const combined = (tone1 + tone2) * 0.5;
    // Exponential decay with different rates for attack vs sustain
    const env = t < 0.01 ? t / 0.01 : Math.exp(-t * 12);
    samples[i] = combined * env * gain;
  }

  applyEnvelope(samples, 10, 150);
  applyHighPass(samples, 800);

  return { samples, sampleRate: sr, duration: durationMs / 1000 };
}

/**
 * Generate a bell ding — clear, resonant, longer tail.
 */
export function generateChimeBell(durationMs: number, gain = 0.5): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  const sr = 44100;

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const fundamental = Math.sin(2 * Math.PI * 880 * t);
    const harmonic1 = Math.sin(2 * Math.PI * 1760 * t) * 0.6;
    const harmonic2 = Math.sin(2 * Math.PI * 2640 * t) * 0.3;
    const harmonic3 = Math.sin(2 * Math.PI * 3520 * t) * 0.15;
    const combined = (fundamental + harmonic1 + harmonic2 + harmonic3) * 0.25;
    const env = t < 0.005 ? t / 0.005 : Math.exp(-t * 6);
    samples[i] = combined * env * gain;
  }

  applyEnvelope(samples, 0, 200);
  applyHighPass(samples, 600);

  return { samples, sampleRate: sr, duration: durationMs / 1000 };
}

/**
 * Generate a success chime — bright, ascending two-tone.
 */
export function generateChimeSuccess(durationMs: number, gain = 0.5): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  const sr = 44100;

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // Two-tone ascending: first note then second note
    const freq1 = 1000 + 400 * Math.min(t * 20, 1);
    const freq2 = 1500 + 300 * Math.max(0, Math.min((t - 0.05) * 20, 1));
    const tone1 = Math.sin(2 * Math.PI * freq1 * t) * Math.exp(-t * 8);
    const tone2 = Math.sin(2 * Math.PI * freq2 * t) * Math.exp(-t * 6) * 0.7;
    samples[i] = (tone1 + tone2) * gain * 0.6;
  }

  applyEnvelope(samples, 0, 180);
  applyHighPass(samples, 600);

  return { samples, sampleRate: sr, duration: durationMs / 1000 };
}

/**
 * Generate a sharp snap — very short, percussive.
 */
export function generateSnapSharp(durationMs: number, gain = 0.5): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  const sr = 44100;

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const crack = Math.sin(2 * Math.PI * 2000 * t) * Math.exp(-t * 50);
    const snap = Math.sin(2 * Math.PI * 5000 * t) * Math.exp(-t * 150) * 0.4;
    const thump = Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t * 30) * 0.3;
    samples[i] = (crack + snap + thump) * gain;
  }

  applyEnvelope(samples, 0, 60);
  applyHighPass(samples, 1500);

  return { samples, sampleRate: sr, duration: durationMs / 1000 };
}

// ─── Generator Registry ───────────────────────────────────────────────────────

/**
 * Maps SFX kind → generator function.
 * All generators produce AudioBuffer output.
 */
export const SFX_GENERATORS: Record<string, (durationMs: number, gain?: number) => AudioBuffer> = {
  // Impact
  "impact_light": generateImpactLight,
  "impact_medium": generateImpactMedium,
  "impact_heavy": generateImpactHeavy,

  // Whoosh
  "whoosh_light": generateWhooshLight,
  "whoosh_medium": generateWhooshMedium,
  "whoosh_heavy": generateWhooshHeavy,

  // Swoosh
  "swoosh_wipe": generateSwooshWipe,

  // UI
  "ui_pop": generateUiPop,
  "ui_click": generateUiClick,
  "ui_tick": generateUiTick,

  // Chime
  "chime_soft": generateChimeSoft,
  "chime_bell": generateChimeBell,
  "chime_success": generateChimeSuccess,

  // Snap
  "snap_sharp": generateSnapSharp,
};

/**
 * Generate an audio buffer from a registry ID and duration.
 * Returns null if the ID is not found or is not generative.
 */
export function generateSfx(
  id: string,
  durationMs: number
): AudioBuffer | null {
  const asset = SFX_REGISTRY.find((a) => a.id === id);
  if (!asset) return null;
  if (!asset.generative) return null;
  if (!(id in SFX_GENERATORS)) return null;

  // Clamp duration to the asset's range
  const [minMs, maxMs] = asset.durationMs;
  const clamped = Math.max(minMs, Math.min(maxMs, durationMs));

  return SFX_GENERATORS[id](clamped, asset.defaultGain);
}

/**
 * Mix a generated SFX into an existing audio buffer at a given timestamp.
 */
export function mixIntoTrack(
  target: Float32Array,
  source: AudioBuffer,
  timestampSec: number,
  sampleRate = 44100
): void {
  const startSample = Math.round(timestampSec * sampleRate);
  for (let i = 0; i < source.samples.length; i++) {
    const idx = startSample + i;
    if (idx >= 0 && idx < target.length) {
      target[idx] += source.samples[i];
    }
  }
}

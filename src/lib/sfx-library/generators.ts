/**
 * sfx-library/generators.ts — programmatic SFX synthesis for the SFX Library.
 *
 * Extends the existing sfx-generators.ts with generators for new categories:
 * risers, data sounds, cinematic accents, reverse whooshes, notifications, accents, reveals.
 *
 * Output format: Float32Array at 44100 Hz, mono, -1.0 to 1.0 range.
 * All generators accept (durationMs, gain) for consistency.
 */

import type { AudioBuffer } from "../editing-intelligence/sfx/sfx-generators";

// ─── Shared Helpers ────────────────────────────────────────────────────────────

const SR = 44100;

function createBuffer(durationMs: number): { samples: Float32Array; n: number } {
  const n = Math.round((durationMs / 1000) * SR);
  return { samples: new Float32Array(n), n };
}

function applyEnvelope(samples: Float32Array, fadeInMs: number, fadeOutMs: number): void {
  const fadeIn = Math.round((fadeInMs / 1000) * SR);
  const fadeOut = Math.round((fadeOutMs / 1000) * SR);
  for (let i = 0; i < fadeIn && i < samples.length; i++) {
    samples[i] *= i / Math.max(1, fadeIn);
  }
  for (let i = 0; i < fadeOut && i < samples.length; i++) {
    const idx = samples.length - 1 - i;
    samples[idx] *= i / Math.max(1, fadeOut);
  }
}

function applyHighPass(samples: Float32Array, cutoffHz: number): void {
  if (cutoffHz <= 0) return;
  const rc = 1.0 / (2 * Math.PI * cutoffHz);
  const dt = 1.0 / SR;
  const alpha = rc / (rc + dt);
  let prev = samples[0];
  for (let i = 1; i < samples.length; i++) {
    const current = samples[i];
    samples[i] = alpha * (prev + current - samples[i - 1]);
    prev = current;
  }
}

function noise(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function clamp(samples: Float32Array): void {
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.max(-1, Math.min(1, samples[i]));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WHOOSH GENERATORS (extended)
// ═══════════════════════════════════════════════════════════════════════════════

export function generateWhooshSoft(durationMs: number, gain = 0.3): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const freqMod = Math.sin(2 * Math.PI * (1500 - 800 * progress) * t);
    const noiseVal = noise(i) * 0.5;
    const tone = Math.sin(2 * Math.PI * (400 - 200 * progress) * t) * 0.12;
    const env = progress < 0.1 ? progress / 0.1 : progress > 0.8 ? (1 - progress) / 0.2 : 1;
    samples[i] = (noiseVal * 0.7 + tone) * env * freqMod * gain;
  }
  applyEnvelope(samples, 30, 200);
  applyHighPass(samples, 400);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateWhooshRising(durationMs: number, gain = 0.4): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const progressFreq = 1500 + 1500 * progress;
    const freqMod = Math.sin(2 * Math.PI * progressFreq * t);
    const noiseVal = noise(i) * 0.45;
    const tone = Math.sin(2 * Math.PI * (300 + 700 * progress) * t) * 0.1;
    const env = progress < 0.05 ? progress / 0.05 : progress > 0.7 ? (1 - progress) / 0.3 : 1;
    samples[i] = (noiseVal + tone) * env * freqMod * gain;
  }
  applyEnvelope(samples, 20, 150);
  applyHighPass(samples, 400);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateWhooshHeavy(durationMs: number, gain = 0.35): AudioBuffer {
  // Heavy cinematic whoosh — deep sub rumble + mid-range air + bright edge
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;

    // Low-frequency rumble for weight
    const subFreq = 120 + 60 * progress;
    const sub = Math.sin(2 * Math.PI * subFreq * t) * Math.exp(-t * 3) * 0.4;
    // Main whoosh body: slower frequency sweep
    const mainFreq = 800 + 1200 * progress;
    const mainMod = Math.sin(2 * Math.PI * mainFreq * t);
    const noiseVal = noise(i) * 0.45;
    // Bright edge for articulation
    const brightFreq = 3000 + 2000 * progress;
    const bright = Math.sin(2 * Math.PI * brightFreq * t) * 0.06;
    // Body tone
    const body = Math.sin(2 * Math.PI * (250 + 400 * progress) * t) * 0.08;
    // Envelope: quick attack, sustained middle, gradual tail
    const env =
      progress < 0.05 ? progress / 0.05 :
      progress > 0.75 ? Math.pow((1 - progress) / 0.25, 0.8) : 1;

    samples[i] = (sub * 0.5 + noiseVal + bright + body) * env * mainMod * gain;
  }
  applyEnvelope(samples, 60, 200);
  applyHighPass(samples, 200);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

// ── Alternative: Heavy Whoosh "06" (flatter sweep, more mid-weight) ───────────

export function generateWhooshHeavy06(durationMs: number, gain = 0.35): AudioBuffer {
  // Alternative "06": flatter frequency sweep, more mid-weight, less bright edge
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;

    // Heavier sub for weight
    const subFreq = 100 + 50 * progress;
    const sub = Math.sin(2 * Math.PI * subFreq * t) * Math.exp(-t * 4) * 0.35;
    // Flatter main sweep (starts mid, doesn't climb as high)
    const mainFreq = 1000 + 800 * progress;
    const mainMod = Math.sin(2 * Math.PI * mainFreq * t);
    const noiseVal = noise(i) * 0.4;
    // More pronounced mid body
    const midBody = Math.sin(2 * Math.PI * (400 + 300 * progress) * t) * 0.1;
    const body = Math.sin(2 * Math.PI * (200 + 200 * progress) * t) * 0.06;
    const env =
      progress < 0.08 ? progress / 0.08 :
      progress > 0.7 ? Math.pow((1 - progress) / 0.3, 0.7) : 1;

    samples[i] = (sub * 0.55 + noiseVal * 0.85 + midBody + body) * env * mainMod * gain;
  }
  applyEnvelope(samples, 50, 250);
  applyHighPass(samples, 250);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPACT GENERATORS (extended)
// ═══════════════════════════════════════════════════════════════════════════════

export function generateImpactSoft(durationMs: number, gain = 0.5): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const noiseVal = noise(i) * 0.2;
    const thump = Math.sin(2 * Math.PI * 150 * t) * Math.exp(-t * 25);
    const body = Math.sin(2 * Math.PI * 300 * t) * Math.exp(-t * 45) * 0.3;
    samples[i] = (noiseVal + thump * 0.6 + body) * gain;
  }
  applyEnvelope(samples, 0, 100);
  applyHighPass(samples, 150);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateImpactPremium(durationMs: number, gain = 0.75): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const noiseVal = noise(i) * 0.2;
    const sub = Math.sin(2 * Math.PI * 60 * t) * Math.exp(-t * 15) * 0.5;
    const thump = Math.sin(2 * Math.PI * 120 * t) * Math.exp(-t * 25);
    const mid = Math.sin(2 * Math.PI * 500 * t) * Math.exp(-t * 50) * 0.2;
    const snap = Math.sin(2 * Math.PI * 3000 * t) * Math.exp(-t * 80) * 0.15;
    samples[i] = (noiseVal + sub + thump * 0.6 + mid + snap) * gain;
  }
  applyEnvelope(samples, 0, 120);
  applyHighPass(samples, 100);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI GENERATORS (extended)
// ═══════════════════════════════════════════════════════════════════════════════

export function generateUiTap(durationMs: number, gain = 0.35): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const tick = Math.sin(2 * Math.PI * 2500 * t) * Math.exp(-t * 120);
    const tap = Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 60) * 0.4;
    const body = Math.sin(2 * Math.PI * 400 * t) * Math.exp(-t * 40) * 0.2;
    samples[i] = (tap + tick * 0.5 + body) * gain;
  }
  applyEnvelope(samples, 0, 50);
  applyHighPass(samples, 2000);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateUiNotification(durationMs: number, gain = 0.45): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const tone1 = Math.sin(2 * Math.PI * 1400 * t) * Math.exp(-t * 20);
    const tone2 = Math.sin(2 * Math.PI * 2100 * t) * Math.exp(-t * 35) * 0.5;
    const pop = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 50) * 0.3;
    samples[i] = (tone1 + tone2 + pop) * gain;
  }
  applyEnvelope(samples, 5, 100);
  applyHighPass(samples, 1500);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HIGHLIGHT GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

export function generateHighlightMarker(durationMs: number, gain = 0.4): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const tone1 = Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 40);
    const tone2 = Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 60) * 0.4;
    const click = Math.sin(2 * Math.PI * 4000 * t) * Math.exp(-t * 100) * 0.2;
    samples[i] = (tone1 + tone2 + click) * gain;
  }
  applyEnvelope(samples, 0, 80);
  applyHighPass(samples, 1500);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateHighlightUnderline(durationMs: number, gain = 0.35): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const sweepFreq = 2000 + 1000 * (1 - progress);
    const sweep = Math.sin(2 * Math.PI * sweepFreq * t) * Math.exp(-t * 8) * 0.3;
    const noiseVal = noise(i) * Math.exp(-t * 12) * 0.15;
    samples[i] = (sweep + noiseVal) * gain;
  }
  applyEnvelope(samples, 0, 120);
  applyHighPass(samples, 1000);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RISER GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

export function generateRiserSubtle(durationMs: number, gain = 0.25): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const freq = 200 + 600 * progress;
    const tone = Math.sin(2 * Math.PI * freq * t) * (0.2 + 0.3 * progress);
    const noiseVal = noise(i) * 0.15 * (0.3 + 0.4 * progress);
    const env = Math.min(1, progress * 3) * (1 - Math.pow(progress, 3) * 0.5);
    samples[i] = (tone + noiseVal) * env * gain;
  }
  applyEnvelope(samples, 100, 300);
  applyHighPass(samples, 300);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateRiserBright(durationMs: number, gain = 0.3): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const freq = 400 + 1200 * progress;
    const tone1 = Math.sin(2 * Math.PI * freq * t) * (0.15 + 0.25 * progress);
    const tone2 = Math.sin(2 * Math.PI * freq * 1.5 * t) * (0.05 + 0.1 * progress);
    const noiseVal = noise(i) * 0.08;
    const env = Math.min(1, progress * 2.5) * (1 - Math.pow(progress, 2) * 0.6);
    samples[i] = (tone1 + tone2 + noiseVal) * env * gain;
  }
  applyEnvelope(samples, 80, 250);
  applyHighPass(samples, 400);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateRiserTension(durationMs: number, gain = 0.25): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const freq = 80 + 200 * progress;
    const drone = Math.sin(2 * Math.PI * freq * t) * (0.2 + 0.3 * progress);
    const harmonic = Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.15;
    const noiseVal = noise(i) * 0.1;
    const env = Math.min(1, progress * 2) * (1 - Math.pow(progress, 4) * 0.4);
    samples[i] = (drone + harmonic + noiseVal) * env * gain;
  }
  applyEnvelope(samples, 150, 400);
  applyHighPass(samples, 200);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateRiserClick(durationMs: number, gain = 0.3): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const freq = 300 + 800 * progress;
    const tone = Math.sin(2 * Math.PI * freq * t) * (0.15 + 0.2 * progress);
    const clickPhase = Math.max(0, (progress - 0.7) / 0.3);
    const click = Math.sin(2 * Math.PI * 3500 * t) * Math.exp(-(1 - clickPhase) * 5) * 0.2 * clickPhase;
    const env = Math.min(1, progress * 3) * 0.7;
    samples[i] = (tone * 0.7 + click) * env * gain;
  }
  applyEnvelope(samples, 50, 150);
  applyHighPass(samples, 500);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA / COUNTER GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

export function generateDataCount(durationMs: number, gain = 0.4): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const click = Math.sin(2 * Math.PI * 5000 * t) * Math.exp(-t * 150);
    const tick = Math.sin(2 * Math.PI * 2000 * t) * Math.exp(-t * 80) * 0.3;
    const thud = Math.sin(2 * Math.PI * 300 * t) * Math.exp(-t * 40) * 0.15;
    samples[i] = (click + tick + thud) * gain;
  }
  applyEnvelope(samples, 0, 60);
  applyHighPass(samples, 1500);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateDataReveal(durationMs: number, gain = 0.4): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const freq = 1200 + 400 * (1 - progress);
    const sparkle = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 10) * (1 - progress * 0.5);
    const harmonic = Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.3 * Math.exp(-t * 8);
    const noiseVal = noise(i) * Math.exp(-t * 20) * 0.1;
    samples[i] = (sparkle + harmonic + noiseVal) * gain;
  }
  applyEnvelope(samples, 5, 150);
  applyHighPass(samples, 1000);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateDataWhoosh(durationMs: number, gain = 0.35): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const freqMod = Math.sin(2 * Math.PI * (2500 - 1200 * progress) * t);
    const noiseVal = noise(i) * 0.4;
    const tone = Math.sin(2 * Math.PI * (600 - 300 * progress) * t) * 0.08;
    const env = progress < 0.1 ? progress / 0.1 : progress > 0.6 ? (1 - progress) / 0.4 : 1;
    samples[i] = (noiseVal + tone) * env * freqMod * gain;
  }
  applyEnvelope(samples, 20, 120);
  applyHighPass(samples, 500);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateDataEmphasis(durationMs: number, gain = 0.6): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const noiseVal = noise(i) * 0.15;
    const thump = Math.sin(2 * Math.PI * 100 * t) * Math.exp(-t * 22);
    const mid = Math.sin(2 * Math.PI * 500 * t) * Math.exp(-t * 45) * 0.2;
    const snap = Math.sin(2 * Math.PI * 2500 * t) * Math.exp(-t * 55) * 0.15;
    samples[i] = (noiseVal + thump * 0.6 + mid + snap) * gain;
  }
  applyEnvelope(samples, 0, 100);
  applyHighPass(samples, 130);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSITION GENERATORS (extended)
// ═══════════════════════════════════════════════════════════════════════════════

export function generateTransitionSoft(durationMs: number, gain = 0.3): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const noiseVal = noise(i) * 0.3;
    const tone = Math.sin(2 * Math.PI * (800 - 400 * progress) * t) * 0.08;
    const env = progress < 0.15 ? progress / 0.15 : progress > 0.7 ? (1 - progress) / 0.3 : 1;
    samples[i] = (noiseVal + tone) * env * gain;
  }
  applyEnvelope(samples, 40, 200);
  applyHighPass(samples, 400);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateTransitionPunch(durationMs: number, gain = 0.45): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const midPoint = Math.abs(progress - 0.4) < 0.15 ? 1.5 : 1.0;
    const freqMod = Math.sin(2 * Math.PI * (3000 - 1500 * progress) * t);
    const noiseVal = noise(i) * 0.4 * midPoint;
    const tone = Math.sin(2 * Math.PI * (500 - 200 * progress) * t) * 0.1;
    const env = progress < 0.08 ? progress / 0.08 : progress > 0.75 ? (1 - progress) / 0.25 : 1;
    samples[i] = (noiseVal + tone) * env * freqMod * gain;
  }
  applyEnvelope(samples, 10, 100);
  applyHighPass(samples, 400);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateTransitionCut(durationMs: number, gain = 0.35): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const click = Math.sin(2 * Math.PI * 4000 * t) * Math.exp(-t * 120);
    const snap = Math.sin(2 * Math.PI * 6000 * t) * Math.exp(-t * 200) * 0.3;
    const pop = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 50) * 0.2;
    samples[i] = (click + snap + pop) * gain;
  }
  applyEnvelope(samples, 0, 50);
  applyHighPass(samples, 2000);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVEAL GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

export function generateRevealDiagram(durationMs: number, gain = 0.35): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const sweepFreq = 1000 + 800 * progress;
    const sweep = Math.sin(2 * Math.PI * sweepFreq * t) * (0.15 + 0.1 * progress);
    const harmonic = Math.sin(2 * Math.PI * sweepFreq * 2 * t) * 0.08;
    const noiseVal = noise(i) * 0.08 * Math.exp(-progress * 2);
    const env = progress < 0.2 ? progress / 0.2 : Math.min(1, 1.2 - progress);
    samples[i] = (sweep + harmonic + noiseVal) * env * gain;
  }
  applyEnvelope(samples, 20, 150);
  applyHighPass(samples, 800);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateRevealStep(durationMs: number, gain = 0.35): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const pop = Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-t * 30);
    const tick = Math.sin(2 * Math.PI * 3000 * t) * Math.exp(-t * 80) * 0.25;
    const tone = Math.sin(2 * Math.PI * 600 * t) * Math.exp(-t * 20) * 0.15;
    samples[i] = (pop + tick + tone) * gain;
  }
  applyEnvelope(samples, 0, 80);
  applyHighPass(samples, 1000);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateRevealMagnifier(durationMs: number, gain = 0.4): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const freq = 2000 - 1000 * (1 - progress);
    const sweep = Math.sin(2 * Math.PI * freq * t) * (0.1 + 0.15 * progress);
    const noiseVal = noise(i) * 0.1 * Math.exp(-progress * 3);
    const env = progress < 0.1 ? progress / 0.1 : progress > 0.8 ? (1 - progress) / 0.2 : 1;
    samples[i] = (sweep + noiseVal) * env * gain;
  }
  applyEnvelope(samples, 10, 120);
  applyHighPass(samples, 800);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CTA GENERATORS (extended)
// ═══════════════════════════════════════════════════════════════════════════════

export function generateCtaSuccess(durationMs: number, gain = 0.5): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const note1 = Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-t * 10) * 0.4;
    const note2 = Math.sin(2 * Math.PI * 1500 * t) * Math.exp(-t * 8) * 0.4;
    const delay = Math.max(0, t - 0.06);
    const note3 = Math.sin(2 * Math.PI * 2000 * delay) * Math.exp(-delay * 12) * 0.2;
    samples[i] = (note1 + note2 + note3) * gain;
  }
  applyEnvelope(samples, 0, 180);
  applyHighPass(samples, 600);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateCtaLogo(durationMs: number, gain = 0.55): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const whooshEnv = progress < 0.3 ? progress / 0.3 : Math.max(0, 1 - (progress - 0.3) / 0.4);
    const whooshFreq = Math.sin(2 * Math.PI * (2500 - 1000 * progress) * t);
    const noiseVal = noise(i) * 0.3 * whooshEnv;
    const impact = Math.sin(2 * Math.PI * 80 * t) * Math.exp(-Math.max(0, progress - 0.3) * 15) * 0.5;
    const shimmer = Math.sin(2 * Math.PI * 3000 * t) * Math.exp(-t * 6) * 0.1;
    samples[i] = (noiseVal * whooshFreq + impact + shimmer) * gain;
  }
  applyEnvelope(samples, 20, 300);
  applyHighPass(samples, 400);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateCtaAttention(durationMs: number, gain = 0.45): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const freq = 800 + 600 * Math.min(progress * 4, 1);
    const tone = Math.sin(2 * Math.PI * freq * t) * (0.2 + 0.2 * Math.min(progress * 3, 1));
    const peak = progress > 0.3 && progress < 0.5
      ? Math.sin(2 * Math.PI * 2000 * t) * 0.2
      : 0;
    const noiseVal = noise(i) * 0.05;
    samples[i] = (tone + peak + noiseVal) * gain;
  }
  applyEnvelope(samples, 10, 100);
  applyHighPass(samples, 1000);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CINEMATIC GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

export function generateCinematicRise(durationMs: number, gain = 0.2): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const freq = 60 + 150 * progress;
    const drone = Math.sin(2 * Math.PI * freq * t) * (0.15 + 0.25 * progress);
    const harmonic = Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.1;
    const shimmer = Math.sin(2 * Math.PI * 3000 * t) * Math.exp(-t * 6) * 0.05 * progress;
    const env = Math.min(1, progress * 2) * (1 - Math.pow(progress, 4) * 0.4);
    samples[i] = (drone + harmonic + shimmer) * env * gain;
  }
  applyEnvelope(samples, 150, 400);
  applyHighPass(samples, 80);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateCinematicEmote(durationMs: number, gain = 0.5): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const noiseVal = noise(i) * 0.15;
    const sub = Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t * 14) * 0.4;
    const thump = Math.sin(2 * Math.PI * 150 * t) * Math.exp(-t * 22) * 0.3;
    const mid = Math.sin(2 * Math.PI * 400 * t) * Math.exp(-t * 40) * 0.15;
    const air = Math.sin(2 * Math.PI * 5000 * t) * Math.exp(-t * 100) * 0.05;
    samples[i] = (noiseVal + sub + thump + mid + air) * gain;
  }
  applyEnvelope(samples, 0, 150);
  applyHighPass(samples, 80);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateCinematicDrift(durationMs: number, gain = 0.12): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const freq = 150 + 80 * Math.sin(progress * Math.PI);
    const drone = Math.sin(2 * Math.PI * freq * t) * 0.2;
    const harmonic = Math.sin(2 * Math.PI * freq * 1.33 * t) * 0.08;
    const noiseVal = noise(i) * 0.06;
    const env = Math.sin(progress * Math.PI) * 1.2;
    samples[i] = (drone + harmonic + noiseVal) * env * gain;
  }
  applyEnvelope(samples, 200, 400);
  applyHighPass(samples, 80);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateCinematicSting(durationMs: number, gain = 0.5): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const noiseVal = noise(i) * 0.2;
    const sub = Math.sin(2 * Math.PI * 100 * t) * Math.exp(-t * 20) * 0.4;
    const mid = Math.sin(2 * Math.PI * 600 * t) * Math.exp(-t * 40) * 0.2;
    const snap = Math.sin(2 * Math.PI * 4000 * t) * Math.exp(-t * 80) * 0.15;
    samples[i] = (noiseVal + sub + mid + snap) * gain;
  }
  applyEnvelope(samples, 0, 80);
  applyHighPass(samples, 300);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVERSE GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

export function generateReverseWhoosh(durationMs: number, gain = 0.4): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const baseFreq = 3000 - 1500 * progress;
    const freqMod = Math.sin(2 * Math.PI * baseFreq * t);
    const noiseVal = noise(i) * 0.4;
    const tone = Math.sin(2 * Math.PI * (600 - 300 * progress) * t) * 0.1;
    const env = progress < 0.05 ? progress / 0.05 : progress > 0.85 ? (1 - progress) / 0.15 : 1;
    samples[i] = (noiseVal + tone) * env * freqMod * gain;
  }
  applyEnvelope(samples, 30, 100);
  applyHighPass(samples, 400);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateReverseSwoosh(durationMs: number, gain = 0.45): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const baseFreq = 2000 - 800 * progress;
    const freqMod = Math.sin(2 * Math.PI * baseFreq * t);
    const noiseVal = noise(i) * 0.5;
    const tone = Math.sin(2 * Math.PI * (400 - 200 * progress) * t) * 0.08;
    const env = progress < 0.05 ? progress / 0.05 : progress > 0.85 ? (1 - progress) / 0.15 : 1;
    samples[i] = (noiseVal + tone) * env * freqMod * gain;
  }
  applyEnvelope(samples, 30, 150);
  applyHighPass(samples, 300);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateReverseTail(durationMs: number, gain = 0.3): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const baseFreq = 1500 - 800 * progress;
    const freqMod = Math.sin(2 * Math.PI * baseFreq * t);
    const noiseVal = noise(i) * 0.25;
    const tone = Math.sin(2 * Math.PI * (300 - 150 * progress) * t) * 0.06;
    const env = progress < 0.1 ? progress / 0.1 : progress > 0.8 ? (1 - progress) / 0.2 : 1;
    samples[i] = (noiseVal + tone) * env * freqMod * gain;
  }
  applyEnvelope(samples, 40, 150);
  applyHighPass(samples, 400);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCENT GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

export function generateAccentPlayful(durationMs: number, gain = 0.35): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const note1 = Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 20) * 0.4;
    const delay = Math.max(0, t - 0.08);
    const note2 = Math.sin(2 * Math.PI * 1800 * delay) * Math.exp(-delay * 25) * 0.3;
    const noiseVal = noise(i) * Math.exp(-t * 30) * 0.08;
    samples[i] = (note1 + note2 + noiseVal) * gain;
  }
  applyEnvelope(samples, 0, 100);
  applyHighPass(samples, 1000);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateAccentRise(durationMs: number, gain = 0.35): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const progress = i / n;
    const freq1 = 800 + 400 * progress;
    const freq2 = 1200 + 300 * progress;
    const note1 = Math.sin(2 * Math.PI * freq1 * t) * Math.exp(-t * 10) * 0.3;
    const delay = Math.max(0, t - 0.05);
    const note2 = Math.sin(2 * Math.PI * freq2 * delay) * Math.exp(-delay * 12) * 0.25;
    const noiseVal = noise(i) * Math.exp(-t * 20) * 0.05;
    samples[i] = (note1 + note2 + noiseVal) * gain;
  }
  applyEnvelope(samples, 0, 120);
  applyHighPass(samples, 800);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateAccentChime(durationMs: number, gain = 0.35): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const tone1 = Math.sin(2 * Math.PI * 1100 * t) * Math.exp(-t * 9) * 0.4;
    const tone2 = Math.sin(2 * Math.PI * 1600 * t) * Math.exp(-t * 11) * 0.3;
    const harmonic = Math.sin(2 * Math.PI * 2200 * t) * Math.exp(-t * 15) * 0.1;
    samples[i] = (tone1 + tone2 + harmonic) * gain;
  }
  applyEnvelope(samples, 10, 150);
  applyHighPass(samples, 800);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

export function generateNotificationSoft(durationMs: number, gain = 0.35): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const tone1 = Math.sin(2 * Math.PI * 1100 * t) * Math.exp(-t * 12);
    const tone2 = Math.sin(2 * Math.PI * 1650 * t) * Math.exp(-t * 16) * 0.5;
    const soft = Math.sin(2 * Math.PI * 700 * t) * Math.exp(-t * 8) * 0.2;
    samples[i] = (tone1 + tone2 + soft) * gain;
  }
  applyEnvelope(samples, 10, 120);
  applyHighPass(samples, 1000);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateNotificationConfirm(durationMs: number, gain = 0.4): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const fundamental = Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 8) * 0.4;
    const fifth = Math.sin(2 * Math.PI * 1320 * t) * Math.exp(-t * 10) * 0.3;
    const octave = Math.sin(2 * Math.PI * 1760 * t) * Math.exp(-t * 12) * 0.15;
    const warmth = Math.sin(2 * Math.PI * 440 * t) * Math.exp(-t * 6) * 0.1;
    samples[i] = (fundamental + fifth + octave + warmth) * gain;
  }
  applyEnvelope(samples, 5, 150);
  applyHighPass(samples, 800);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateNotificationDing(durationMs: number, gain = 0.4): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const fundamental = Math.sin(2 * Math.PI * 1500 * t) * Math.exp(-t * 14);
    const harmonic = Math.sin(2 * Math.PI * 3000 * t) * Math.exp(-t * 22) * 0.3;
    const pop = Math.sin(2 * Math.PI * 600 * t) * Math.exp(-t * 30) * 0.15;
    samples[i] = (fundamental + harmonic + pop) * gain;
  }
  applyEnvelope(samples, 0, 80);
  applyHighPass(samples, 1000);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

export function generateNotificationSubtle(durationMs: number, gain = 0.25): AudioBuffer {
  const { samples, n } = createBuffer(durationMs);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const tone = Math.sin(2 * Math.PI * 2000 * t) * Math.exp(-t * 60) * 0.4;
    const harmonic = Math.sin(2 * Math.PI * 3000 * t) * Math.exp(-t * 100) * 0.2;
    samples[i] = (tone + harmonic) * gain;
  }
  applyEnvelope(samples, 0, 40);
  applyHighPass(samples, 2000);
  clamp(samples);
  return { samples, sampleRate: SR, duration: durationMs / 1000 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETE GENERATOR MAP — All 44 SFX IDs
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Maps every SFX library ID to its generator function.
 * Uses re-exports from the base sfx-generators.ts where applicable.
 */
import { generateImpactLight, generateImpactMedium, generateImpactHeavy } from "../editing-intelligence/sfx/sfx-generators";
import { generateWhooshLight, generateWhooshMedium, generateWhooshHeavy } from "../editing-intelligence/sfx/sfx-generators";
import { generateSwooshWipe } from "../editing-intelligence/sfx/sfx-generators";
import { generateUiPop, generateUiClick, generateUiTick } from "../editing-intelligence/sfx/sfx-generators";
import { generateChimeSoft, generateChimeBell, generateChimeSuccess } from "../editing-intelligence/sfx/sfx-generators";
import { generateSnapSharp } from "../editing-intelligence/sfx/sfx-generators";

export const SFX_LIBRARY_GENERATORS: Record<string, (durationMs: number, gain?: number) => AudioBuffer> = {
  // Whoosh
  whoosh_light: generateWhooshLight,
  whoosh_medium: generateWhooshMedium,
  whoosh_heavy: generateWhooshHeavy,
  whoosh_heavy_06: generateWhooshHeavy06,
  whoosh_soft: generateWhooshSoft,
  whoosh_rising: generateWhooshRising,

  // Impact
  impact_light: generateImpactLight,
  impact_medium: generateImpactMedium,
  impact_soft: generateImpactSoft,
  impact_premium: generateImpactPremium,

  // UI
  ui_pop: generateUiPop,
  ui_click: generateUiClick,
  ui_tick: generateUiTick,
  ui_tap: generateUiTap,
  ui_notification: generateUiNotification,

  // Highlight
  highlight_soft: generateChimeSoft,
  highlight_marker: generateHighlightMarker,
  highlight_underline: generateHighlightUnderline,

  // Riser
  riser_subtle: generateRiserSubtle,
  riser_bright: generateRiserBright,
  riser_tension: generateRiserTension,
  riser_click: generateRiserClick,

  // Data
  data_count: generateDataCount,
  data_reveal: generateDataReveal,
  data_whoosh: generateDataWhoosh,
  data_emphasis: generateDataEmphasis,

  // Transition
  transition_wipe: generateSwooshWipe,
  transition_soft: generateTransitionSoft,
  transition_punch: generateTransitionPunch,
  transition_cut: generateTransitionCut,

  // Reveal
  reveal_icon: generateUiPop,
  reveal_diagram: generateRevealDiagram,
  reveal_step: generateRevealStep,
  reveal_magnifier: generateRevealMagnifier,

  // CTA
  cta_bell: generateChimeBell,
  cta_success: generateCtaSuccess,
  cta_logo: generateCtaLogo,
  cta_attention: generateCtaAttention,

  // Cinematic
  cinematic_rise: generateCinematicRise,
  cinematic_emote: generateCinematicEmote,
  cinematic_drift: generateCinematicDrift,
  cinematic_sting: generateCinematicSting,

  // Reverse
  reverse_whoosh: generateReverseWhoosh,
  reverse_swoosh: generateReverseSwoosh,
  reverse_tail: generateReverseTail,

  // Notification
  notification_soft: generateNotificationSoft,
  notification_confirm: generateNotificationConfirm,
  notification_ding: generateNotificationDing,
  notification_subtle: generateNotificationSubtle,

  // Legacy aliases (for backward compatibility with existing code)
  impact_heavy: generateImpactHeavy,
  chime_success: generateChimeSuccess,
  snap_sharp: generateSnapSharp,
};

/**
 * Generate an audio buffer from a library SFX ID and duration.
 * Returns null if the ID is not found or is not generative.
 *
 * NOTE: This function does NOT look up the registry (avoids circular dependency).
 * Pass the asset's defaultGain as the gain parameter, or just pass 0.5.
 */
export function generateLibrarySfx(
  id: string,
  durationMs: number,
  gain: number
): AudioBuffer | null {
  const generator = SFX_LIBRARY_GENERATORS[id];
  if (!generator) return null;

  return generator(durationMs, gain);
}

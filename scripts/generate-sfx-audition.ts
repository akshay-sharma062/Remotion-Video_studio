/**
 * generate-sfx-audition.ts — Generate a curated SFX audition pack.
 *
 * Produces one WAV per sound, plus a JSON catalog, into:
 *   work/sfx-audition/
 *
 * All files normalized to -12 dBFS peak for fair comparison.
 * Selection curated for: airy whooshes, soft entrances, subtle UI,
 * warm muted impacts, gentle risers, smooth sweeps, tonal accents,
 * polished ending. NO gunshot-like, aggressive, or harsh sounds.
 *
 * Run: npx tsx scripts/generate-sfx-audition.ts
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Resolve project root (scripts/ is at <root>/scripts/) ─────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// ─── Import generators & WAV writer ────────────────────────────────────────────

import {
  // whoosh — airy, smooth
  generateWhooshSoft,
  generateWhooshRising,
  // impact — warm, muted (NOT premium/aggressive)
  generateImpactSoft,
  // ui — subtle pops and ticks
  generateUiTap,
  generateUiNotification,
  // highlight — light tonal accents
  generateHighlightMarker,
  generateHighlightUnderline,
  // riser — gentle, smooth
  generateRiserSubtle,
  generateRiserBright,
  generateRiserClick,
  // transition — smooth sweeps
  generateTransitionSoft,
  generateReverseSwoosh,
  generateReverseTail,
  // reveal — sparkle for keywords
  generateRevealMagnifier,
  generateRevealStep,
  // accent — light tonal accents
  generateAccentChime,
  generateAccentRise,
  // notification — polished ending
  generateNotificationConfirm,
  generateNotificationSubtle,
  // cinematic — subtle ending
  generateCinematicRise,
} from "../src/lib/sfx-library/generators";

import { encodeWav, writeWavFile, readWavFile } from "../src/lib/sfx-library/wav-writer";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AuditionEntry {
  id: string;
  name: string;
  category: string;
  generator: string;
  durationMs: number;
  gain: number;
  peakDb: number;
  normalizedPeakDb: number;
  useFor: string;
  notes: string;
}

// ─── Curation ──────────────────────────────────────────────────────────────────
//
// Selection criteria (user requirements):
//   ✅ Airy, smooth whooshes
//   ✅ Soft text-entrance sounds
//   ✅ Subtle UI pops and ticks
//   ✅ Warm, muted impacts (NOT aggressive thumps)
//   ✅ Gentle risers
//   ✅ Smooth transition sweeps
//   ✅ Light tonal accents for keywords
//   ✅ Polished, subtle ending
//   ❌ NO gunshot-like impacts
//   ❌ NO aggressive thumps (impact_premium excluded)
//   ❌ NO harsh bangs
//   ❌ NO repetitive synthetic effects
//   ❌ NO background ambience

const AUDITION_LIST: {
  id: string;
  name: string;
  category: string;
  generator: (ms: number, g: number) => { samples: Float32Array; sampleRate: number; duration: number };
  durationMs: number;
  gain: number;
  useFor: string;
  notes: string;
}[] = [
  // ── 1. Airy Whooshes ─────────────────────────────────────────────────────────
  {
    id: "whoosh_soft",
    name: "Soft Airy Whoosh",
    category: "whoosh",
    generator: generateWhooshSoft,
    durationMs: 600,
    gain: 0.25,
    useFor: "Scene transitions, element entrances",
    notes: "Gentle air sweep, fades naturally",
  },
  {
    id: "whoosh_rising",
    name: "Rising Air Whoosh",
    category: "whoosh",
    generator: generateWhooshRising,
    durationMs: 600,
    gain: 0.25,
    useFor: "Forward motion, zoom-through",
    notes: "Pitch rises with the whoosh, feels like moving forward",
  },

  // ── 2. Text Entrance Sounds ──────────────────────────────────────────────────
  {
    id: "text_enter_sweep",
    name: "Text Sweep Entrance",
    category: "riser",
    generator: generateRiserSubtle,
    durationMs: 400,
    gain: 0.2,
    useFor: "Headline word entrance",
    notes: "Soft tonal rise, pairs with kinetic text entrance",
  },
  {
    id: "text_enter_pulse",
    name: "Text Pulse Entrance",
    category: "ui",
    generator: generateUiTap,
    durationMs: 150,
    gain: 0.25,
    useFor: "Individual word pop-in",
    notes: "Short tap-pulse, very subtle, use per-word or per-phrase",
  },

  // ── 3. UI Pops & Ticks ──────────────────────────────────────────────────────
  {
    id: "ui_tap",
    name: "UI Tap",
    category: "ui",
    generator: generateUiTap,
    durationMs: 150,
    gain: 0.3,
    useFor: "UI elements, subtle clicks",
    notes: "Clean tap, short and precise",
  },
  {
    id: "ui_notify",
    name: "UI Notification",
    category: "ui",
    generator: generateUiNotification,
    durationMs: 200,
    gain: 0.3,
    useFor: "Subtle confirmations, checkmarks",
    notes: "Two-tone pop, friendly and light",
  },

  // ── 4. Warm Muted Impacts ───────────────────────────────────────────────────
  {
    id: "impact_warm",
    name: "Warm Muted Impact",
    category: "impact",
    generator: generateImpactSoft,
    durationMs: 300,
    gain: 0.35,
    useFor: "Headline slam, emphasis moments",
    notes: "Warm sub + body, no snap or harshness. Lower gain keeps it muted.",
  },

  // ── 5. Gentle Risers ────────────────────────────────────────────────────────
  {
    id: "riser_gentle",
    name: "Gentle Long Riser",
    category: "riser",
    generator: generateRiserSubtle,
    durationMs: 800,
    gain: 0.2,
    useFor: "Build-up before headline slam (800ms lead)",
    notes: "Long smooth rise, sits under voice without competing",
  },
  {
    id: "riser_bright_soft",
    name: "Bright Soft Riser",
    category: "riser",
    generator: generateRiserBright,
    durationMs: 600,
    gain: 0.2,
    useFor: "Short build-up before reveal",
    notes: "Higher tone than gentle riser, still smooth",
  },
  {
    id: "riser_click",
    name: "Riser with Click",
    category: "riser",
    generator: generateRiserClick,
    durationMs: 500,
    gain: 0.2,
    useFor: "Build-up with terminal click (pre-count)",
    notes: "Rising tone that resolves into a click at the end",
  },

  // ── 6. Transition Sweeps ────────────────────────────────────────────────────
  {
    id: "sweep_smooth",
    name: "Smooth Transition Sweep",
    category: "transition",
    generator: generateTransitionSoft,
    durationMs: 500,
    gain: 0.25,
    useFor: "Scene changes, wipe transitions",
    notes: "Gentle sweep with tonal character",
  },
  {
    id: "sweep_reverse",
    name: "Reverse Whoosh Tail",
    category: "reverse",
    generator: generateReverseTail,
    durationMs: 400,
    gain: 0.25,
    useFor: "Exit tails, reverse motion",
    notes: "Descending air, good for leaving a scene",
  },

  // ── 7. Tonal Accents for Keywords ───────────────────────────────────────────
  {
    id: "accent_chime",
    name: "Chime Accent",
    category: "accent",
    generator: generateAccentChime,
    durationMs: 300,
    gain: 0.3,
    useFor: "Keyword highlight (e.g. 'salary')",
    notes: "Bright but soft chime, ear-catching without being harsh",
  },
  {
    id: "accent_rise",
    name: "Rising Tonal Accent",
    category: "accent",
    generator: generateAccentRise,
    durationMs: 300,
    gain: 0.3,
    useFor: "Keyword emphasis, data reveal",
    notes: "Tone rises to a point, clean and modern",
  },
  {
    id: "highlight_sparkle",
    name: "Sparkle Highlight",
    category: "reveal",
    generator: generateRevealMagnifier,
    durationMs: 250,
    gain: 0.3,
    useFor: "Keyword highlight, icon appear",
    notes: "Short sweep + shimmer, very light",
  },

  // ── 8. Polished Ending ──────────────────────────────────────────────────────
  {
    id: "ending_confirm",
    name: "Subtle Confirmation",
    category: "notification",
    generator: generateNotificationConfirm,
    durationMs: 400,
    gain: 0.25,
    useFor: "Ending, CTA, successful completion",
    notes: "Two-note confirm, warm and satisfying",
  },
  {
    id: "ending_drift",
    name: "Cinematic Drift Out",
    category: "cinematic",
    generator: generateCinematicRise,
    durationMs: 600,
    gain: 0.15,
    useFor: "Fade-out, reflective ending",
    notes: "Very quiet drone rise, ambient texture",
  },
];

// ─── Normalization ─────────────────────────────────────────────────────────────

const TARGET_PEAK = 0.25; // −12 dBFS for fair comparison

function normalize(samples: Float32Array, targetPeak: number): Float32Array {
  let maxAbs = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > maxAbs) maxAbs = abs;
  }
  if (maxAbs < 0.0001) return samples; // silent, skip
  const scale = targetPeak / maxAbs;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = samples[i] * scale;
  }
  return out;
}

function peakDb(samples: Float32Array): number {
  let maxAbs = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > maxAbs) maxAbs = abs;
  }
  if (maxAbs < 0.0001) return -Infinity;
  return 20 * Math.log10(maxAbs);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const OUTPUT_DIR = join(PROJECT_ROOT, "work", "sfx-audition");

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const catalog: AuditionEntry[] = [];

console.log(`\n🎵 SFX Audition Pack Generator\n`);
console.log(`   Output: ${OUTPUT_DIR}\n`);

for (const entry of AUDITION_LIST) {
  // Generate raw buffer
  const raw = entry.generator(entry.durationMs, entry.gain);

  // Measure original peak
  const originalPeak = peakDb(raw.samples);

  // Normalize to target peak
  const normalized = normalize(raw.samples, TARGET_PEAK);
  const normalizedPeak = peakDb(normalized);

  // Write WAV
  const filename = `${entry.id}.wav`;
  const filepath = join(OUTPUT_DIR, filename);
  writeWavFile(filepath, normalized, raw.sampleRate);

  // Verify file exists and has content
  const stats = statSync(filepath);
  const fileSizeKb = (stats.size / 1024).toFixed(1);

  if (stats.size < 44) {
    console.log(`  ❌ ${filename} — FILE TOO SMALL (${stats.size} bytes), likely silent`);
    continue;
  }

  catalog.push({
    id: entry.id,
    name: entry.name,
    category: entry.category,
    generator: entry.generator.toString().includes("generateWhoosh") ? "generateWhooshSoft" : entry.generator.toString().includes("generateImpact") ? "generateImpactSoft" : entry.generator.toString().includes("generateUiTap") ? "generateUiTap" : entry.generator.toString().includes("generateUiNotification") ? "generateUiNotification" : entry.generator.toString().includes("generateRiserSubtle") ? "generateRiserSubtle" : entry.generator.toString().includes("generateRiserBright") ? "generateRiserBright" : entry.generator.toString().includes("generateRiserClick") ? "generateRiserClick" : entry.generator.toString().includes("generateTransitionSoft") ? "generateTransitionSoft" : entry.generator.toString().includes("generateReverse") ? "generateReverseTail" : entry.generator.toString().includes("generateAccentChime") ? "generateAccentChime" : entry.generator.toString().includes("generateAccentRise") ? "generateAccentRise" : entry.generator.toString().includes("generateReveal") ? "generateRevealMagnifier" : entry.generator.toString().includes("generateHighlightMarker") ? "generateHighlightMarker" : entry.generator.toString().includes("generateNotificationConfirm") ? "generateNotificationConfirm" : "generateCinematicRise",
    durationMs: entry.durationMs,
    gain: entry.gain,
    peakDb: originalPeak.toFixed(1),
    normalizedPeakDb: normalizedPeak.toFixed(1),
    useFor: entry.useFor,
    notes: entry.notes,
  });

  console.log(`  ✅ ${filename}`);
  console.log(`     ${entry.name} | ${entry.durationMs}ms | orig ${originalPeak.toFixed(0)} dB → norm ${normalizedPeak.toFixed(0)} dB | ${fileSizeKb} KB`);
}

// ─── Write catalog JSON ────────────────────────────────────────────────────────

const catalogPath = join(OUTPUT_DIR, "catalog.json");
writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
console.log(`\n📋 Catalog: ${catalogPath}`);

// ─── Write human-readable contact sheet ────────────────────────────────────────

const contactPath = join(OUTPUT_DIR, "CONTACT-SHEET.txt");
const lines: string[] = [];
lines.push("=".repeat(80));
lines.push("SFX AUDITION PACK — CONTACT SHEET");
lines.push("=".repeat(80));
lines.push("");
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push(`Total sounds: ${catalog.length}`);
lines.push(`Normalization: ${TARGET_PEAK} peak (${20 * Math.log10(TARGET_PEAK).toFixed(0)} dBFS)`);
lines.push("");
lines.push("-".repeat(80));

// Group by category
const byCategory = catalog.reduce<Record<string, AuditionEntry[]>>((acc, e) => {
  (acc[e.category] ??= []).push(e);
  return acc;
}, {});

for (const [cat, entries] of Object.entries(byCategory)) {
  lines.push("");
  lines.push(`[${cat.toUpperCase()}] — ${entries.length} sound(s)`);
  lines.push("");
  for (const e of entries) {
    lines.push(`  #${e.id}`);
    lines.push(`     Name:      ${e.name}`);
    lines.push(`     File:      ${e.id}.wav`);
    lines.push(`     Duration:  ${e.durationMs}ms`);
    lines.push(`     Gain used: ${e.gain}`);
    lines.push(`     Peak:      ${e.normalizedPeakDb} dBFS (normalized from ${e.peakDb} dBFS)`);
    lines.push(`     Use for:   ${e.useFor}`);
    lines.push(`     Notes:     ${e.notes}`);
    lines.push("");
  }
}

lines.push("-".repeat(80));
lines.push("");
lines.push("HOW TO LISTEN:");
lines.push("  1. Open work/sfx-audition/ in Windows Explorer");
lines.push("  2. Double-click any .wav file to play in Windows Media Player or Groove");
lines.push("  3. Or drag the entire folder into Audacity / Adobe Audition for comparison");
lines.push("  4. All files are normalized to −12 dBFS peak — fair comparison level");
lines.push("");
lines.push("SELECTION NOTES:");
lines.push("  • impact_premium was EXCLUDED (gunshot-like, aggressive sub + snap)");
lines.push("  • Only impact_warm (generateImpactSoft) was included — warm body, no snap");
lines.push("  • No ambience / background textures (user requested none by default)");
lines.push("  • No repeated impact sounds across different headline moments");
lines.push("");
lines.push("=".repeat(80));

writeFileSync(contactPath, lines.join("\n"));
console.log(`📄 Contact sheet: ${contactPath}`);

// ─── Write concatenated audition (all sounds with 1s gap) ──────────────────────

console.log(`\n🔗 Creating concatenated audition file...`);

const buffers: Float32Array[] = [];
for (const entry of catalog) {
  const { samples } = readWavFile(join(OUTPUT_DIR, `${entry.id}.wav`));
  buffers.push(samples);
}

// 1 second gap between sounds
const gapSamples = Math.round((1000 / 1000) * 44100);
const silence = new Float32Array(gapSamples);
const totalLength = buffers.reduce((acc, b) => acc + b.length, 0) + silence.length * (buffers.length - 1);
const concatenated = new Float32Array(totalLength);

let offset = 0;
for (let i = 0; i < buffers.length; i++) {
  concatenated.set(buffers[i], offset);
  offset += buffers[i].length;
  if (i < buffers.length - 1) {
    concatenated.set(silence, offset);
    offset += silence.length;
  }
}

const concatPath = join(OUTPUT_DIR, "audition-all.wav");
writeWavFile(concatPath, concatenated, 44100);
const concatStats = statSync(concatPath);
const concatDuration = (concatenated.length / 44100).toFixed(1);
console.log(`  ✅ audition-all.wav — ${concatDuration}s, ${(concatStats.size / 1024).toFixed(0)} KB`);

// ─── Verification ──────────────────────────────────────────────────────────────

console.log(`\n🔍 Verifying generated files...`);
let allVerified = true;
for (const entry of catalog) {
  const fp = join(OUTPUT_DIR, `${entry.id}.wav`);
  const s = statSync(fp);
  if (s.size <= 44) {
    console.log(`  ❌ ${entry.id}.wav — empty or too small`);
    allVerified = false;
  }
}
if (allVerified) {
  console.log(`  ✅ All ${catalog.length} files verified — contain audio data`);
}

console.log(`\n✅ Done! ${catalog.length} sounds in ${OUTPUT_DIR}`);
console.log(`   Open work/sfx-audition/ to listen\n`);

/**
 * scripts/build-sfx-library.ts — Build the SFX Library WAV files.
 *
 * Generates:
 * 1. Individual WAV files for each of the 44 SFX assets
 * 2. An audition manifest (audition-manifest.json)
 * 3. A concatenated audition file for all categories
 *
 * Usage:
 *   npx tsx scripts/build-sfx-library.ts
 */

import { SFX_LIBRARY, CATEGORY_META } from "../src/lib/sfx-library/registry";
import { SFX_LIBRARY_GENERATORS } from "../src/lib/sfx-library/generators";
import { writeWavFile, concatenateWithGaps } from "../src/lib/sfx-library/wav-writer";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "fs";

const OUTPUT_DIR = "public/sfx-library";
const SAMPLE_RATE = 44100;

interface BuildReport {
  totalAssets: number;
  generated: string[];
  skipped: string[];
  failed: string[];
  totalDurationMs: number;
}

async function main() {
  console.log("═".repeat(60));
  console.log("BUILDING SFX LIBRARY");
  console.log("═".repeat(60));
  console.log(`Output: ${OUTPUT_DIR}/`);
  console.log(`Assets: ${SFX_LIBRARY.length}`);
  console.log();

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Create category directories
  const categories = new Set<string>();
  for (const asset of SFX_LIBRARY) {
    categories.add(asset.category);
  }
  for (const cat of categories) {
    const dir = `${OUTPUT_DIR}/${cat}`;
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  const report: BuildReport = {
    totalAssets: SFX_LIBRARY.length,
    generated: [],
    skipped: [],
    failed: [],
    totalDurationMs: 0,
  };

  const categoryBuffers: Record<string, { buffers: Float32Array[]; names: string[] }> = {};

  // Generate each asset
  for (const asset of SFX_LIBRARY) {
    const generator = SFX_LIBRARY_GENERATORS[asset.id];
    if (!generator) {
      report.skipped.push(`${asset.id} — no generator`);
      continue;
    }

    try {
      const midDuration = Math.round((asset.durationMs[0] + asset.durationMs[1]) / 2);
      const result = generator(midDuration, asset.defaultGain);

      if (!result || !result.samples || result.samples.length === 0) {
        report.failed.push(`${asset.id} — empty output`);
        continue;
      }

      // Check for silence
      let peak = 0;
      for (let i = 0; i < Math.min(result.samples.length, SAMPLE_RATE); i++) {
        peak = Math.max(peak, Math.abs(result.samples[i]));
      }

      if (peak < 0.001) {
        report.failed.push(`${asset.id} — silent output (peak: ${peak.toExponential(2)})`);
        continue;
      }

      // Write file
      const filePath = `${OUTPUT_DIR}/${asset.category}/${asset.id}.wav`;
      writeWavFile(filePath, result.samples, result.sampleRate);

      report.generated.push(asset.id);
      report.totalDurationMs += result.duration * 1000;

      // Collect for category audition files
      if (!categoryBuffers[asset.category]) {
        categoryBuffers[asset.category] = { buffers: [], names: [] };
      }
      categoryBuffers[asset.category].buffers.push(result.samples);
      categoryBuffers[asset.category].names.push(asset.id);
    } catch (e) {
      report.failed.push(`${asset.id} — error: ${e}`);
    }
  }

  // Generate per-category audition files
  console.log("\n── Per-Category Audition Files ──");
  for (const [cat, { buffers, names }] of Object.entries(categoryBuffers)) {
    if (buffers.length === 0) continue;

    const combined = concatenateWithGaps(buffers, 500);
    const filePath = `${OUTPUT_DIR}/${cat}/audition-${cat}.wav`;
    writeWavFile(filePath, combined);
    console.log(`  ✓ ${cat}: ${buffers.length} assets, ${(combined.length / SAMPLE_RATE).toFixed(1)}s`);
  }

  // Generate full library audition file
  if (report.generated.length > 0) {
    const allBuffers = report.generated.map(id => {
      const generator = SFX_LIBRARY_GENERATORS[id];
      const asset = SFX_LIBRARY.find(a => a.id === id)!;
      const mid = Math.round((asset.durationMs[0] + asset.durationMs[1]) / 2);
      const r = generator(mid, asset.defaultGain);
      return r!.samples;
    }).filter(Boolean) as Float32Array[];

    const fullCombined = concatenateWithGaps(allBuffers, 500);
    writeWavFile(`${OUTPUT_DIR}/audition-full.wav`, fullCombined);
    console.log(`\n  ✓ Full library audition: ${(fullCombined.length / SAMPLE_RATE).toFixed(1)}s`);
  }

  // Generate audition manifest
  const manifest = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    totalAssets: report.totalAssets,
    generated: report.generated.length,
    skipped: report.skipped.length,
    failed: report.failed.length,
    totalDurationMs: report.totalDurationMs,
    assets: SFX_LIBRARY.map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      durationMs: a.durationMs,
      intensity: a.intensity,
      tonal: a.tonal,
      path: `${a.category}/${a.id}.wav`,
      generative: a.generative,
      provenance: a.provenance,
    })),
    build: report,
  };

  writeFileSync(`${OUTPUT_DIR}/audition-manifest.json`, JSON.stringify(manifest, null, 2));

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("BUILD COMPLETE");
  console.log("═".repeat(60));
  console.log(`  Generated: ${report.generated.length}/${report.totalAssets}`);
  console.log(`  Skipped:   ${report.skipped.length}`);
  console.log(`  Failed:    ${report.failed.length}`);
  console.log(`  Total:     ${(report.totalDurationMs / 1000).toFixed(1)}s of audio`);

  if (report.failed.length > 0) {
    console.log("\n── Failures ──");
    report.failed.forEach((f) => console.log(`  ✗ ${f}`));
  }

  if (report.skipped.length > 0) {
    console.log("\n── Skipped ──");
    report.skipped.forEach((s) => console.log(`  ⚠ ${s}`));
  }

  console.log(`\nOutput: ${OUTPUT_DIR}/`);
  console.log(`Manifest: ${OUTPUT_DIR}/audition-manifest.json`);
}

main().catch((e) => {
  console.error("Build failed:", e);
  process.exit(1);
});

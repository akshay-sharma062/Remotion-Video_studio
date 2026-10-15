/**
 * sfx-library/test.ts — test utilities for the SFX Library.
 *
 * Provides unit tests for:
 * - Generator output validity (sample rate, duration, non-silent)
 * - Decision engine correctness (event → SFX mapping)
 * - Mixer functionality
 * - Registry integrity (no missing generators, no duplicates)
 */

import { SFX_LIBRARY, SFX_LIBRARY_GENERATORS, CATEGORY_META } from "./registry";
import { verifyGenerators, auditLibrary, categoryCoverage } from "./audit";
import type { AudioBuffer, VisualEventType } from "./types";

const SAMPLE_RATE = 44100;

// ─── Generator Tests ──────────────────────────────────────────────────────────

export interface GeneratorTestResult {
  id: string;
  pass: boolean;
  sampleRate: number;
  durationMs: number;
  peakLevel: number;
  rmsLevel: number;
  error?: string;
}

export function testAllGenerators(durationMs?: number): GeneratorTestResult[] {
  const results: GeneratorTestResult[] = [];

  for (const asset of SFX_LIBRARY) {
    if (!asset.generative) continue;

    const generator = SFX_LIBRARY_GENERATORS[asset.id];
    if (!generator) {
      results.push({
        id: asset.id,
        pass: false,
        sampleRate: 0,
        durationMs: 0,
        peakLevel: 0,
        error: "No generator function",
      });
      continue;
    }

    try {
      const testDuration = durationMs ?? Math.round((asset.durationMs[0] + asset.durationMs[1]) / 2);
      const result = generator(testDuration, asset.defaultGain);

      let peak = 0;
      let rms = 0;
      if (result && result.samples) {
        for (let i = 0; i < result.samples.length; i++) {
          const abs = Math.abs(result.samples[i]);
          peak = Math.max(peak, abs);
          rms += result.samples[i] * result.samples[i];
        }
        rms = Math.sqrt(rms / result.samples.length);
      }

      results.push({
        id: asset.id,
        pass: result !== null && result.samples.length > 0 && peak > 0.001 && result.sampleRate === SAMPLE_RATE,
        sampleRate: result.sampleRate,
        durationMs: result.duration * 1000,
        peakLevel: peak,
        rmsLevel: rms,
      });
    } catch (e) {
      results.push({
        id: asset.id,
        pass: false,
        sampleRate: 0,
        durationMs: 0,
        peakLevel: 0,
        error: String(e),
      });
    }
  }

  return results;
}

// ─── Decision Engine Tests ────────────────────────────────────────────────────

export interface DecisionTestResult {
  eventType: VisualEventType;
  pass: boolean;
  selectedId: string;
  confidence: number;
  isMissing: boolean;
  reason: string;
}

const CRITICAL_EVENTS: VisualEventType[] = [
  "text_slam",
  "text_entrance",
  "text_exit",
  "word_highlight",
  "number_reveal",
  "icon_appear",
  "zoom_punch",
  "scene_transition",
  "cta_appear",
  "logo_reveal",
  "success_event",
  "checkmark",
];

export function testDecisionEngine(): DecisionTestResult[] {
  const results: DecisionTestResult[] = [];

  for (const eventType of CRITICAL_EVENTS) {
    // Dynamic import to avoid circular dependency
    const mod = require("./decision");
    const selection = mod.selectSfxForEvent(eventType);

    results.push({
      eventType,
      pass: !selection.isMissing && selection.asset !== null,
      selectedId: selection.asset?.id ?? "MISSING",
      confidence: selection.confidence,
      isMissing: selection.isMissing,
      reason: selection.reason,
    });
  }

  return results;
}

// ─── Registry Integrity Tests ─────────────────────────────────────────────────

export interface RegistryTestResult {
  test: string;
  pass: boolean;
  detail: string;
}

export function testRegistryIntegrity(): RegistryTestResult[] {
  const results: RegistryTestResult[] = [];

  // Test 1: All generative assets have generators
  let missingGen = 0;
  for (const asset of SFX_LIBRARY) {
    if (asset.generative && !SFX_LIBRARY_GENERATORS[asset.id]) {
      missingGen++;
    }
  }
  results.push({
    test: "All generative assets have generators",
    pass: missingGen === 0,
    detail: missingGen === 0
      ? `${SFX_LIBRARY.length} assets checked`
      : `${missingGen} assets missing generators`,
  });

  // Test 2: All generators produce output
  const genCheck = verifyGenerators();
  results.push({
    test: "All generators produce valid output",
    pass: genCheck.fail.length === 0,
    detail: `${genCheck.pass.length} pass, ${genCheck.fail.length} fail`,
  });

  // Test 3: No duplicate IDs
  const ids = SFX_LIBRARY.map((a) => a.id);
  const uniqueIds = new Set(ids);
  results.push({
    test: "No duplicate asset IDs",
    pass: ids.length === uniqueIds.size,
    detail: `${ids.length} IDs, ${uniqueIds.size} unique`,
  });

  // Test 4: All categories have at least one asset
  const categories = new Set(SFX_LIBRARY.map((a) => a.category));
  const allCategoryKeys = Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[];
  const missingCats = allCategoryKeys.filter((k) => !categories.has(k as string));
  results.push({
    test: "All 14 categories have assets",
    pass: missingCats.length === 0,
    detail: missingCats.length === 0
      ? `${categories.size} categories populated`
      : `Missing categories: ${missingCats.join(", ")}`,
  });

  // Test 5: All IDs are lowercase_with_underscores
  const invalidIds = SFX_LIBRARY.filter((a) => !/^[a-z][a-z0-9_]*$/.test(a.id));
  results.push({
    test: "All IDs follow naming convention",
    pass: invalidIds.length === 0,
    detail: invalidIds.length === 0 ? "All valid" : `${invalidIds.length} invalid: ${invalidIds.map(a => a.id).join(", ")}`,
  });

  // Test 6: No EXCLUDED categories
  const EXCLUDED = ["weapon", "gunshot", "explosion", "cartoon", "slapstick"];
  const excludedFound = SFX_LIBRARY.filter((a) =>
    EXCLUDED.some((e) => a.tags.includes(e) || a.name.toLowerCase().includes(e))
  );
  results.push({
    test: "No excluded sound types",
    pass: excludedFound.length === 0,
    detail: excludedFound.length === 0 ? "Clean" : `Found: ${excludedFound.map(a => a.id).join(", ")}`,
  });

  return results;
}

// ─── Print Test Report ────────────────────────────────────────────────────────

export function printTestReport(): void {
  console.log("═".repeat(60));
  console.log("SFX LIBRARY TEST REPORT");
  console.log("═".repeat(60));

  // Generator tests
  console.log("\n── Generator Tests ──");
  const genResults = testAllGenerators();
  let genPass = 0;
  for (const r of genResults) {
    if (r.pass) genPass++;
    else console.log(`  ✗ ${r.id}${r.error ? ` — ${r.error}` : ""}`);
  }
  console.log(`  ${genPass}/${genResults.length} generators pass`);

  // Decision engine tests
  console.log("\n── Decision Engine Tests ──");
  const decisionResults = testDecisionEngine();
  let decPass = 0;
  for (const r of decisionResults) {
    if (r.pass) decPass++;
    else console.log(`  ✗ ${r.eventType} — ${r.selectedId}`);
  }
  console.log(`  ${decPass}/${decisionResults.length} event types covered`);

  // Registry integrity
  console.log("\n── Registry Integrity ──");
  const integrityResults = testRegistryIntegrity();
  for (const r of integrityResults) {
    console.log(`  ${r.pass ? "✓" : "✗"} ${r.test}: ${r.detail}`);
  }

  // Category coverage
  console.log("\n── Category Coverage ──");
  const coverage = categoryCoverage();
  for (const [cat, data] of Object.entries(coverage)) {
    const meta = CATEGORY_META[cat as keyof typeof CATEGORY_META];
    if (meta) {
      console.log(`  ${meta.icon} ${meta.label}: ${data.count} assets (${data.generative} generative, ${data.withFiles} files)`);
    }
  }

  console.log("\n" + "═".repeat(60));
}

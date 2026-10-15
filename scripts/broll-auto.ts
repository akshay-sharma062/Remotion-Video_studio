#!/usr/bin/env node
/**
 * broll-auto.ts — main CLI for the automatic B-roll pipeline.
 *
 * Usage:
 *   npm run broll [project] [--plan-only] [--overwrite]
 *                   [--manifest-path <file>] [--download-dir <path>]
 *
 * Options:
 *   --plan-only           Only generate the plan, don't download
 *   --overwrite           Overwrite existing downloaded assets
 *   --manifest-path <f>   Write broll-manifest.ts to <f> instead of the
 *                        default src/videos/[project]/broll-manifest.ts.
 *                        Use this when the target composition is NOT named
 *                        after [project] (e.g. a "-premium-916" variant).
 *   --download-dir <p>    Save clips under public/<p> instead of
 *                        public/projects/[project]/b-roll.
 *
 * Credentials (set in .env, which is gitignored — never pass keys as args):
 *   PEXELS_API_KEY   Get one at: https://www.pexels.com/api/
 *   PIXABAY_API_KEY  Get one at: https://pixabay.com/api/docs/
 *   MIXKIT_API_KEY   Get one at: https://mixkit.co
 *
 * Pipeline steps:
 *   1. Read transcript.json from work/[project]/prep/audio/
 *   2. Read scene timeline from composition
 *   3. Plan visual segments per phrase
 *   4. Search providers for B-roll
 *   5. Download and validate assets
 *   6. Generate broll-manifest.ts for Remotion
 */

import fs from "fs";
import path from "path";

import {
  loadBrollConfig,
  printProviderStatus,
  hasAnyProvider,
} from "../src/lib/broll/config";
import { runPipeline, planBroll } from "../src/lib/broll/pipeline";

// ─── Argument Parsing ────────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
  projectName: string;
  planOnly: boolean;
  overwrite: boolean;
  manifestPath?: string;
  downloadDir?: string;
} {
  const args = argv.slice(2);
  let projectName = "";
  let planOnly = false;
  let overwrite = false;
  let manifestPath: string | undefined;
  let downloadDir: string | undefined;

  const takeValue = (i: number, flag: string): string => {
    const next = args[i + 1];
    if (!next || next.startsWith("-")) {
      console.error(`Missing value for ${flag}`);
      process.exit(1);
    }
    return next;
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--plan-only" || arg === "--dry-run") {
      planOnly = true;
    } else if (arg === "--overwrite") {
      overwrite = true;
    } else if (arg === "--manifest-path") {
      manifestPath = takeValue(i, arg);
      i++;
    } else if (arg === "--download-dir") {
      downloadDir = takeValue(i, arg);
      i++;
    } else if (!arg.startsWith("-")) {
      // The LAST positional wins. Without the `--` separator, npm consumes the
      // script's own `--flags` and forwards every value as a bare positional, so
      // `npm run broll proj --manifest-path X --download-dir Y` arrives here as
      // three positionals and the script silently plans for "Y" instead of
      // "proj" — then fails with a confusing "No transcript.json found".
      //
      // Detect that shape and stop with the fix rather than a bogus lookup.
      if (projectName) {
        console.error(
          `ERROR: more than one project name was given ("${projectName}" and "${arg}").`
        );
        console.error("");
        console.error("If you passed options to npm, put them after a `--` separator:");
        console.error(
          "  npm run broll -- <project> --manifest-path <path> --download-dir <path>"
        );
        console.error("");
        console.error(
          "Without `--`, npm swallows this script's flags and forwards their"
        );
        console.error("values as extra project names.");
        process.exit(1);
      }
      projectName = arg;
    }
  }

  if (!projectName) {
    console.error("Usage: npm run broll -- [project] [options]");
    console.error("");
    console.error("Options:");
    console.error("  --plan-only              Plan only, no downloads");
    console.error("  --overwrite              Re-download existing assets");
    console.error("  --manifest-path <path>   Write broll-manifest.ts to this file");
    console.error("  --download-dir <path>    Save clips under public/<path>");
    console.error("");
    console.error("Examples:");
    console.error("  npm run broll -- corporate-career-growth-amana --plan-only");
    console.error("");
    console.error("  # Experimental Premium 9:16 variant (keeps its own manifest");
    console.error("  # and clips; the production composition is never written to):");
    console.error("  npm run broll -- corporate-career-growth-amana \\");
    console.error("    --manifest-path src/videos/corporate-career-growth-amana-premium-916/broll-manifest-derived.ts \\");
    console.error("    --download-dir projects/corporate-career-growth-amana-premium-916/b-roll");
    console.error("");
    console.error("Note the `--` before the project name — it is required when");
    console.error("passing options, otherwise npm consumes them.");
    console.error("");
    console.error("Set API keys in .env (never pass keys as arguments):");
    console.error("  PEXELS_API_KEY=xxx   see .env.example");
    process.exit(1);
  }

  return { projectName, planOnly, overwrite, manifestPath, downloadDir };
}

// ─── Transcript Loading ──────────────────────────────────────────────────────

interface TranscriptData {
  words: Array<{ word: string; start_ms: number; end_ms: number }>;
  fps: number;
  duration_ms: number;
}

function loadTranscript(projectName: string): TranscriptData {
  // Find transcript file — check multiple possible locations
  const possiblePaths = [
    path.join("work", projectName, "prep", "audio", "transcript.json"),
    path.join("assets", "projects", projectName, "transcript.json"),
    path.join("work", projectName, "transcript.json"),
  ];

  let transcriptPath: string | undefined;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      transcriptPath = p;
      break;
    }
  }

  if (!transcriptPath) {
    throw new Error(
      `No transcript.json found for "${projectName}". ` +
      `Searched:\n${possiblePaths.map((p) => `  - ${p}`).join("\n")}\n` +
      `Run the transcription step first (npm run prep ${projectName}).`
    );
  }

  console.log(`\nReading transcript: ${transcriptPath}`);

  const raw = JSON.parse(fs.readFileSync(transcriptPath, "utf-8"));

  if (raw.words && Array.isArray(raw.words)) {
    return {
      words: raw.words,
      fps: raw.fps ?? 23.976,
      duration_ms: raw.duration_ms ?? 0,
    };
  }

  if (raw.segments && Array.isArray(raw.segments)) {
    // Flatten segments into words
    const words: Array<{ word: string; start_ms: number; end_ms: number }> = [];
    for (const seg of raw.segments) {
      if (seg.words) {
        words.push(...seg.words);
      }
    }
    return {
      words,
      fps: raw.fps ?? 23.976,
      duration_ms: raw.duration_ms ?? 0,
    };
  }

  throw new Error(
    `Transcript format not recognized. Expected { words: [...] } or { segments: [...] }.`
  );
}

// ─── Total Frames Calculation ────────────────────────────────────────────────

function calculateTotalFrames(durationMs: number, fps: number): number {
  return Math.round((durationMs / 1000) * fps);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { projectName, planOnly, overwrite, manifestPath, downloadDir } =
    parseArgs(process.argv);

  console.log("=".repeat(60));
  console.log("AUTOMATIC B-ROLL PIPELINE");
  console.log("=".repeat(60));
  console.log(`Project:  ${projectName}`);
  console.log(`Mode:     ${planOnly ? "PLAN ONLY (no download)" : "Full pipeline"}`);

  // Load config. loadBrollConfig validates every output path and throws if a
  // run would write into a protected production composition directory.
  let config;
  try {
    config = loadBrollConfig(projectName, {
      planOnly,
      overwrite,
      output: manifestPath ? { manifestPath } : undefined,
      downloadDir: downloadDir ? `public/${downloadDir}` : undefined,
    });
  } catch (err) {
    console.error("");
    console.error(`ERROR: ${(err as Error).message}`);
    console.error("");
    console.error("No files were written. Nothing was downloaded.");
    process.exit(1);
  }

  // Check providers
  printProviderStatus(config);

  if (!hasAnyProvider(config)) {
    console.error("ERROR: No providers configured.");
    console.error("Set at least one API key in .env (never as a command argument):");
    console.error("  PEXELS_API_KEY — https://www.pexels.com/api/");
    console.error("  PIXABAY_API_KEY — https://pixabay.com/api/docs/");
    console.error("  MIXKIT_API_KEY — https://mixkit.co");
    console.error("");
    console.error("Run with --plan-only to generate the plan without downloading.");
    process.exit(1);
  }

  // Show the resolved destinations BEFORE any download happens, so a
  // Premium-targeted run can be confirmed against its intended directory.
  console.log("\nResolved output destinations:");
  console.log("─".repeat(60));
  console.log(`  Manifest: ${config.output.manifestPath}`);
  console.log(`  Plan:     ${config.output.planPath}`);
  console.log(`  Clips:    ${config.downloadDir}`);
  console.log("─".repeat(60));

  // Load transcript
  const transcript = loadTranscript(projectName);
  console.log(`           Words: ${transcript.words.length}`);
  console.log(`           FPS: ${transcript.fps}`);

  const totalFrames = calculateTotalFrames(
    transcript.duration_ms,
    transcript.fps
  );
  console.log(`           Total frames: ${totalFrames}`);

  // Plan-only mode
  if (planOnly) {
    console.log("\nRunning in plan-only mode...\n");

    const { segments, stats } = await planBroll(
      transcript.words,
      totalFrames,
      transcript.fps
    );

    // Print plan summary
    console.log("\nPLAN SUMMARY");
    console.log("─".repeat(40));
    console.log(`  Total segments:      ${stats.totalSegments}`);
    console.log(`  B-roll segments:     ${stats.brollSegments}`);
    console.log(`  Talking-head:        ${stats.talkingHeadSegments}`);
    console.log(`  Animated / graphic:  ${stats.animatedSegments}`);

    console.log("\nSEGMENTS:");
    for (const seg of segments) {
      const treatment = seg.treatment.toUpperCase();
      const query = seg.searchQuery || "(none)";
      console.log(`  ${seg.id} | ${treatment.padEnd(20)} | "${query}"`);
      if (seg.entities.length > 0) {
        console.log(`    entities: ${seg.entities.join(", ")}`);
      }
    }

    console.log("\nTo download assets, run without --plan-only:");
    console.log(`  npm run broll ${projectName}`);
    console.log("\nMake sure you have API keys configured:");
    console.log("  PEXELS_API_KEY — https://www.pexels.com/api/");
    console.log("  PIXABAY_API_KEY — https://pixabay.com/api/docs/");
    console.log("  MIXKIT_API_KEY — https://mixkit.co");
    process.exit(0);
  }

  // Full pipeline
  console.log("\nStarting B-roll pipeline...\n");

  const plan = await runPipeline(
    transcript.words,
    totalFrames,
    transcript.fps,
    config,
    (step, detail) => {
      // Progress callback — could be extended for more verbose output
      if (step === "complete") {
        console.log(`  ✓ ${detail}`);
      }
    }
  );

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("RESULTS");
  console.log("=".repeat(60));
  console.log(`  Segments:      ${plan.stats.totalSegments}`);
  console.log(`  B-roll needed: ${plan.stats.brollSegments}`);
  console.log(`  Downloaded:    ${plan.stats.downloadedCount}`);
  console.log(`  Failed:        ${plan.stats.failedCount}`);
  console.log("");

  if (plan.downloadedAssets.length > 0) {
    console.log("Downloaded assets:");
    for (const asset of plan.downloadedAssets) {
      const sizeKB = (asset.fileSizeBytes / 1024).toFixed(1);
      console.log(`  ✓ ${asset.segmentId}: ${asset.creator} (${sizeKB}KB)`);
    }
  }

  if (plan.failedDownloads.length > 0) {
    console.log("\nFailed downloads:");
    for (const fail of plan.failedDownloads) {
      console.log(`  ✗ ${fail.segmentId}: ${fail.reason}`);
    }
    console.log("\nThese segments will use talking-head fallback.");
  }

  console.log("\nNext steps:");
  console.log(`  1. Review: work/${projectName}/broll/BROLL-CUES.txt`);
  console.log(`  2. Check:  work/${projectName}/broll/plan.json`);
  console.log(`  3. Update: src/videos/${projectName}/index.tsx`);
  console.log(`            Import BROLL_MANIFEST from './broll-manifest'`);
  console.log(`  4. Reload: Restart Remotion Studio (npm run studio)`);
  console.log("");
}

// Run
main().catch((error) => {
  console.error(`\nERROR: ${error.message}`);
  process.exit(1);
});

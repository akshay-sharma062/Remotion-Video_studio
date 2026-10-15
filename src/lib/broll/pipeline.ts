/**
 * pipeline.ts — the main B-roll automation pipeline.
 *
 * Orchestrates the full flow:
 *   1. Read transcript and scene data from project
 *   2. Plan visual segments (planner)
 *   3. Search providers for B-roll assets
 *   4. Download matching assets (downloader)
 *   5. Validate all assets (validator)
 *   6. Generate Remotion manifest (manifest-generator)
 *
 * Outputs:
 *   - work/[name]/broll/plan.json — full plan with segments + asset metadata
 *   - src/videos/[name]/broll-manifest.ts — Remotion manifest
 *   - work/[name]/broll/BROLL-CUES.txt — human-readable report
 *   - work/[name]/broll/broll-metadata.json — full metadata
 */

import fs from "fs";
import path from "path";

import type {
  BrollPlan,
  BrollPipelineConfig,
  ProviderVideoResult,
  VisualSegment,
} from "./types";
import type { ValidationResult } from "./validator";
import { DEFAULT_PIPELINE_CONFIG } from "./types";
import { DEFAULT_VALIDATOR_CONFIG } from "./validator";
import { planVisualSegments, buildTranscriptSegments, computeStats } from "./planner";
import { downloadBrollAssets, type DownloadResult } from "./downloader";
import { validateAllAssets } from "./validator";
import { writeManifestFiles } from "./manifest-generator";

// ─── Public Pipeline ─────────────────────────────────────────────────────────

/**
 * Run the full B-roll pipeline for a project.
 *
 * @param transcriptWords - Word-level transcript from transcript.json
 * @param totalFrames - Total frames in the video
 * @param fps - Frames per second
 * @param config - Pipeline configuration
 * @param onProgress - Optional progress callback
 */
export async function runPipeline(
  transcriptWords: Array<{ word: string; start_ms: number; end_ms: number }>,
  totalFrames: number,
  fps: number,
  config: BrollPipelineConfig,
  onProgress?: (step: string, detail?: string) => void
): Promise<BrollPlan> {
  const startTime = Date.now();
  console.log("[B-roll pipeline] Starting...");

  // ── Step 1: Build transcript segments ──────────────────────────────────────
  onProgress?.("planning", "Building transcript segments...");
  console.log("[1/5] Building transcript segments...");

  const transcriptSegments = buildTranscriptSegments(transcriptWords, fps);
  console.log(`       Found ${transcriptSegments.length} transcript segments`);

  // ── Step 2: Plan visual segments ───────────────────────────────────────────
  onProgress?.("planning", "Deciding B-roll treatment for each segment...");
  console.log("[2/5] Planning visual segments...");

  const visualSegments = planVisualSegments(transcriptSegments, fps);
  const stats = computeStats(visualSegments);

  console.log(`       B-roll: ${stats.brollSegments}, Talking-head: ${stats.talkingHeadSegments}, Animated: ${stats.animatedSegments}`);

  // ── Step 3: Download assets (or skip) ─────────────────────────────────────
  let downloadResult: DownloadResult = { downloaded: [], failed: [] };
  const providerResults = new Map<string, ProviderVideoResult[]>();

  if (!config.planOnly) {
    onProgress?.("searching", `Searching ${config.preferredProviders.length} providers...`);
    console.log(`[3/5] Searching providers for B-roll assets...`);

    downloadResult = await downloadBrollAssets(
      visualSegments.map((s) => ({
        id: s.id,
        searchQuery: s.searchQuery,
        treatment: s.treatment,
        brollConfidence: s.brollConfidence,
      })),
      config,
      (progress) => {
        onProgress?.(progress.status, `${progress.provider} - ${progress.segmentId}`);
      }
    );

    console.log(`       Downloaded: ${downloadResult.downloaded.length}, Failed: ${downloadResult.failed.length}`);
  } else {
    console.log("[3/5] Plan-only mode — skipping download");
  }

  // ── Step 4: Validate assets ────────────────────────────────────────────────
  onProgress?.("validating", "Validating downloaded assets...");
  console.log("[4/5] Validating assets...");

  const validations = validateAllAssets(
    downloadResult.downloaded,
    Array.from(providerResults.values()).flat(),
    config
  );

  const validCount = validations.filter((v) => v.passed).length;
  console.log(`       Valid: ${validCount}/${validations.length}`);

  // ── Step 5: Generate output files ─────────────────────────────────────────
  onProgress?.("generating", "Writing manifest and report...");
  console.log("[5/5] Generating output files...");

  writeManifestFiles(
    visualSegments,
    downloadResult.downloaded,
    validations,
    fps,
    config,
    config.phrases
  );

  // ── Build plan JSON ────────────────────────────────────────────────────────
  const plan: BrollPlan = {
    projectName: config.projectName,
    generatedAt: new Date().toISOString(),
    totalFrames,
    fps,
    segments: visualSegments,
    downloadedAssets: downloadResult.downloaded,
    failedDownloads: downloadResult.failed,
    stats: {
      ...stats,
      downloadedCount: downloadResult.downloaded.length,
      failedCount: downloadResult.failed.length,
      pendingCount: stats.brollSegments - downloadResult.downloaded.length,
    },
  };

  // Write plan.json
  fs.mkdirSync(path.dirname(config.output.planPath), { recursive: true });
  fs.writeFileSync(config.output.planPath, JSON.stringify(plan, null, 2));
  console.log(`       Plan written: ${config.output.planPath}`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[B-roll pipeline] Complete in ${elapsed}s`);
  console.log(`               Segments: ${plan.stats.totalSegments} | B-roll: ${plan.stats.brollSegments} | Downloaded: ${plan.stats.downloadedCount}`);

  return plan;
}

// ─── Dry Run (Plan Only) ──────────────────────────────────────────────────────

/**
 * Run just the planning phase without downloading.
 * Returns what WOULD be downloaded, without actually downloading.
 */
export async function planBroll(
  transcriptWords: Array<{ word: string; start_ms: number; end_ms: number }>,
  totalFrames: number,
  fps: number
): Promise<{ segments: VisualSegment[]; stats: ReturnType<typeof computeStats> }> {
  const transcriptSegments = buildTranscriptSegments(transcriptWords, fps);
  const visualSegments = planVisualSegments(transcriptSegments, fps);
  const stats = computeStats(visualSegments);

  return { segments: visualSegments, stats };
}

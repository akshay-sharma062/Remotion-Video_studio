/**
 * _broll-filename-integration.test.ts — proves the generated manifest references
 * the EXACT filename the downloader creates.
 *
 * The defect this guards against: the downloader wrote `path.join(downloadDir,
 * provider, segment.id + ".mp4")` inline while the manifest generator built its
 * own path — two independent copies of one rule. A curated manifest written by
 * hand (`team-meeting.mp4`) then disagreed with what the pipeline produced
 * (`seg-6.mp4`), leaving the composition pointing at files that do not exist.
 *
 * The fix: `asset-path.ts` is the single definition of the filename and path,
 * and both the downloader and the manifest generator import it.
 *
 * Run: npx tsx --test src/lib/broll/_broll-filename-integration.test.ts
 *
 * Read-only: no downloads, no network, no file writes, no renders.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";

import {
  brollAssetFilename,
  brollAssetLocalPath,
  brollAssetStaticPath,
} from "./asset-path";
import {
  generatePhraseAlignedManifest,
  generateRemotionManifest,
} from "./manifest-generator";
import { buildTranscriptSegments, planVisualSegments } from "./planner";
import { PROJECT_ROOT } from "./config";
import type { DownloadedAsset, VisualSegment } from "./types";

const DOWNLOAD_DIR =
  "public/projects/corporate-career-growth-amana-premium-916/b-roll";
const PROVIDER = "pexels" as const;

const PHRASES = [
  { phraseIndex: 0, words: ["EARNING", "SIGNIFICANTLY", "MORE"], from: 104, to: 175 },
  { phraseIndex: 1, words: ["MORE", "TALENTED"], from: 175, to: 253 },
  { phraseIndex: 2, words: ["13", "YEARS"], from: 253, to: 374 },
  { phraseIndex: 3, words: ["MOVE", "AHEAD", "MUCH", "FASTER"], from: 374, to: 456 },
  { phraseIndex: 4, words: ["TALENT", "OR", "SKILLS"], from: 456, to: 498 },
  { phraseIndex: 5, words: ["POSITIONING"], from: 498, to: 513 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a DownloadedAsset exactly as the downloader constructs one. */
function makeAsset(segmentId: string, provider: "pexels" = "pexels"): DownloadedAsset {
  return {
    id: segmentId,
    segmentId,
    provider,
    providerAssetId: `asset-${segmentId}`,
    // This is the line that must agree with brollAssetLocalPath(). The
    // downloader now calls that same function, so this mirrors it.
    localPath: brollAssetLocalPath(segmentId, provider, DOWNLOAD_DIR),
    sourceUrl: "https://example.invalid/clip.mp4",
    creator: "Test Creator",
    license: "pexels-license",
    attributionRequired: false,
    attribution: null,
    commercialUse: true,
    modificationPermitted: true,
    fileSizeBytes: 1_048_576,
    resolution: "1080x1920",
    durationSec: 15,
    fileHash: "0".repeat(64),
    downloadedAt: "2026-10-14T00:00:00.000Z",
  };
}

function makeSegment(
  id: string,
  from: number,
  to: number,
  treatment: VisualSegment["treatment"] = "broll"
): VisualSegment {
  return {
    id,
    from,
    to,
    startMs: 0,
    endMs: 0,
    transcriptText: "test",
    visualDescription: "test",
    searchQuery: "test query",
    treatment,
    brollConfidence: 0.8,
    entities: [],
    priority: 1,
  };
}

/** Extract the `file:` values from a generated manifest source string. */
function extractFileValues(source: string): string[] {
  return [...source.matchAll(/file:\s*"([^"]+)"/g)].map((m) => m[1]);
}

/** Extract `file:` values plus the entry's frame range from manifest source. */
function extractEntries(
  source: string
): Array<{ phraseIndex: number; file: string; from: number; to: number }> {
  const re =
    /phraseIndex:\s*(\d+),\s*file:\s*"([^"]+)",\s*from:\s*(\d+),\s*to:\s*(\d+)/g;
  return [...source.matchAll(re)].map((m) => ({
    phraseIndex: Number(m[1]),
    file: m[2],
    from: Number(m[3]),
    to: Number(m[4]),
  }));
}

function loadPlannerSegments(): VisualSegment[] {
  const transcriptPath = path.join(
    PROJECT_ROOT,
    "work/corporate-career-growth-amana/prep/audio/transcript.json"
  );
  const raw = JSON.parse(fs.readFileSync(transcriptPath, "utf-8"));
  const words = (raw.words || []).map((w: Record<string, unknown>) => ({
    word: w.word as string,
    start_ms: w.start_ms as number,
    end_ms: w.end_ms as number,
  }));
  return planVisualSegments(buildTranscriptSegments(words, raw.fps ?? 23.976), raw.fps ?? 23.976);
}

// ─── 1. The filename contract ────────────────────────────────────────────────

test("brollAssetFilename is segment-id based, with .mp4 extension", () => {
  assert.equal(brollAssetFilename("seg-6"), "seg-6.mp4");
  assert.equal(brollAssetFilename("seg-0"), "seg-0.mp4");
});

test("brollAssetLocalPath places the file under <downloadDir>/<provider>/", () => {
  const p = brollAssetLocalPath("seg-6", "pexels", DOWNLOAD_DIR);
  // Windows or POSIX separator, but always the three expected segments.
  const parts = p.split(path.sep);
  assert.equal(parts[parts.length - 3], "b-roll", "parent dir must be b-roll");
  assert.equal(parts[parts.length - 2], "pexels", "provider dir must be present");
  assert.equal(parts[parts.length - 1], "seg-6.mp4", "filename must be seg-6.mp4");
});

test("brollAssetStaticPath is public/-relative and never double-prefixes", () => {
  const p = brollAssetStaticPath("seg-6", "pexels", DOWNLOAD_DIR);
  assert.equal(
    p,
    "projects/corporate-career-growth-amana-premium-916/b-roll/pexels/seg-6.mp4"
  );
  assert.ok(!p.startsWith("public/"), "must not carry the public/ prefix");
  assert.ok(!p.includes("\\"), "must use forward slashes");
});

// ─── 2. THE CORE TEST: manifest file == downloader file ──────────────────────

test("manifest file value equals the downloader's destination path", () => {
  const segment = makeSegment("seg-6", 253, 305);
  const asset = makeAsset("seg-6");

  const source = generatePhraseAlignedManifest(PHRASES, [segment], [asset], 23.976);
  const files = extractFileValues(source);

  assert.equal(files.length, 1, "exactly one entry expected");
  assert.equal(files[0], brollAssetStaticPath("seg-6", PROVIDER, DOWNLOAD_DIR));
});

test("every manifest entry references a file the downloader would write", () => {
  const segments = loadPlannerSegments();
  const assets = segments
    .filter((s) => s.treatment === "broll")
    .map((s) => makeAsset(s.id));

  const source = generatePhraseAlignedManifest(PHRASES, segments, assets, 23.976);
  const files = extractFileValues(source);

  assert.ok(files.length > 0, "expected at least one B-roll entry");

  for (const file of files) {
    const basename = path.basename(file);
    // The filename must be the segment-id form, never a descriptive name.
    assert.match(
      basename,
      /^seg-\d+\.mp4$/,
      `manifest filename ${basename} is not the segment-id form the downloader writes`
    );
  }
});

test("flat manifest also uses the shared path contract", () => {
  // The legacy (unphrased) generator must agree too, or a non-Premium run
  // would still produce a mismatched manifest.
  const segment = makeSegment("seg-6", 253, 305);
  const asset = makeAsset("seg-6");

  const source = generateRemotionManifest([segment], [asset], 23.976);
  const files = extractFileValues(source);

  assert.equal(files.length, 1);
  assert.equal(files[0], brollAssetStaticPath("seg-6", PROVIDER, DOWNLOAD_DIR));
});

// ─── 3. Manifest rejects a mismatched asset (loud failure, not silence) ──────

test("manifest generation throws when the asset filename breaks convention", () => {
  const segment = makeSegment("seg-6", 253, 305);
  const asset = makeAsset("seg-6");
  // Simulate a curated/descriptive filename reaching the generator.
  const broken: DownloadedAsset = {
    ...asset,
    localPath: path.join(DOWNLOAD_DIR, "pexels", "team-meeting.mp4"),
  };

  assert.throws(
    () => generateRemotionManifest([segment], [broken], 23.976),
    /Manifest filename mismatch/,
    "a filename the downloader did not create must fail loudly"
  );
});

// ─── 4. Phrase-bounded ranges survive the filename integration ───────────────

test("phrase-aligned entries stay inside their phrase bounds", () => {
  const segments = loadPlannerSegments();
  const assets = segments
    .filter((s) => s.treatment === "broll")
    .map((s) => makeAsset(s.id));

  const source = generatePhraseAlignedManifest(PHRASES, segments, assets, 23.976);

  const entries = extractEntries(source);

  assert.ok(entries.length > 0, "expected at least one entry");

  for (const entry of entries) {
    const phrase = PHRASES.find((p) => p.phraseIndex === entry.phraseIndex)!;
    assert.ok(phrase, `phraseIndex ${entry.phraseIndex} must exist in PHRASES`);
    assert.ok(
      entry.from >= phrase.from && entry.to <= phrase.to,
      `entry P${entry.phraseIndex} (${entry.from}-${entry.to}) escapes ` +
        `phrase bounds ${phrase.from}-${phrase.to}`
    );
  }
});

test("boundary-crossing planner segment yields one clipped entry per phrase", () => {
  // seg-7 (305-386) crosses P2 (253-374) and P3 (374-456).
  const segments = [makeSegment("seg-7", 305, 386)];
  const assets = [makeAsset("seg-7")];

  const source = generatePhraseAlignedManifest(PHRASES, segments, assets, 23.976);
  const entries = extractEntries(source);

  // P2 keeps its full qualifying overlap; P3's 12-frame bleed is dropped.
  const p2 = entries.find((e) => e.phraseIndex === 2);
  assert.ok(p2, "seg-7 must map to P2");
  assert.equal(p2!.from, 305);
  assert.equal(p2!.to, 374);
  assert.equal(
    path.basename(p2!.file),
    "seg-7.mp4",
    "P2's entry must reference the seg-7 clip the downloader writes"
  );

  assert.equal(
    entries.find((e) => e.phraseIndex === 3),
    undefined,
    "the 12-frame bleed into P3 must be dropped"
  );
});

// ─── 5. Curated manifest is not touched by generation ────────────────────────

test("curated Premium manifest is unchanged by a generation pass", () => {
  const curatedPath = path.join(
    PROJECT_ROOT,
    "src/videos/corporate-career-growth-amana-premium-916/broll-manifest.ts"
  );
  const before = fs.readFileSync(curatedPath, "utf-8");

  // Run generation with assets that would produce different filenames.
  const segments = loadPlannerSegments();
  const assets = segments
    .filter((s) => s.treatment === "broll")
    .map((s) => makeAsset(s.id));
  generatePhraseAlignedManifest(PHRASES, segments, assets, 23.976);

  const after = fs.readFileSync(curatedPath, "utf-8");
  assert.equal(before, after, "generation must not modify the curated manifest");
});

test("curated manifest still carries its descriptive placeholder filenames", () => {
  // Documents the deliberate divergence: the curated manifest describes the
  // intended footage by name; the pipeline writes by segment id. The curated
  // file is the authority and is not rewritten by the pipeline.
  const curatedPath = path.join(
    PROJECT_ROOT,
    "src/videos/corporate-career-growth-amana-premium-916/broll-manifest.ts"
  );
  const source = fs.readFileSync(curatedPath, "utf-8");
  const files = extractFileValues(source);

  assert.equal(files.length, 5, "curated manifest should still have 5 entries");
  for (const f of files) {
    assert.ok(
      f.startsWith("projects/corporate-career-growth-amana-premium-916/b-roll/pexels/"),
      `curated entry ${f} should keep the premium + provider path shape`
    );
  }
});

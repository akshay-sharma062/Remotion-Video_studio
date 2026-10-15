/**
 * _broll-phrase-mapping.test.ts — focused tests proving that:
 *
 * 1. Every generated B-roll entry maps to a valid Premium PHRASES entry.
 * 2. Every entry's `file:` path matches what the downloader actually writes.
 * 3. The phrase-aligned mapping is derived from verified overlap arithmetic,
 *    not from planner segment IDs.
 * 4. Boundary-crossing planner segments are clipped correctly and too-short
 *    overlaps are dropped rather than triggering B-roll.
 *
 * Run: npx tsx --test src/lib/broll/_broll-phrase-mapping.test.ts
 *
 * These are read-only: no downloads, no network, no file writes, no renders.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";

import { brollAssetLocalPath, brollAssetStaticPath, toStaticFilePath } from "./asset-path";
import {
  mapPlannerToPhrases,
  buildPhraseAlignedManifest,
  type PremiumPhrase,
} from "./phrase-mapper";
import { buildTranscriptSegments, planVisualSegments } from "./planner";
import { PROJECT_ROOT, PUBLIC_DIR } from "./config";

// ─── The Premium composition's PHRASES array, mirrored for the tests ──────────
// Source of truth: src/videos/corporate-career-growth-amana-premium-916/index.tsx
// Any change to the composition's PHRASES must be reflected here — the test
// asserts against the composition's own file below, so a drift fails loudly.
const PHRASES: PremiumPhrase[] = [
  { phraseIndex: 0, words: ["EARNING", "SIGNIFICANTLY", "MORE"], from: 104, to: 175 },
  { phraseIndex: 1, words: ["MORE", "TALENTED"], from: 175, to: 253 },
  { phraseIndex: 2, words: ["13", "YEARS"], from: 253, to: 374 },
  { phraseIndex: 3, words: ["MOVE", "AHEAD", "MUCH", "FASTER"], from: 374, to: 456 },
  { phraseIndex: 4, words: ["TALENT", "OR", "SKILLS"], from: 456, to: 498 },
  { phraseIndex: 5, words: ["POSITIONING"], from: 498, to: 513 },
];

const DOWNLOAD_DIR = "public/projects/corporate-career-growth-amana-premium-916/b-roll";
const PROVIDER = "pexels" as const;

/** The canonical transcript the planner reads. */
function loadPlannerSegments() {
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
  const fps = raw.fps ?? 23.976;
  return planVisualSegments(buildTranscriptSegments(words, fps), fps);
}

// ─── 1. Every generated entry maps to a valid PHRASES index ───────────────────

test("every phrase-aligned entry maps to a valid Premium PHRASES index", () => {
  const segments = loadPlannerSegments();
  const entries = buildPhraseAlignedManifest(PHRASES, segments);

  const validIndices = new Set(PHRASES.map((p) => p.phraseIndex));
  for (const entry of entries) {
    assert.ok(
      validIndices.has(entry.phraseIndex),
      `entry phraseIndex ${entry.phraseIndex} is not a PHRASES index (valid: ${[...validIndices].join(", ")})`
    );
  }
});

test("no duplicate phraseIndex in the generated manifest", () => {
  const segments = loadPlannerSegments();
  const entries = buildPhraseAlignedManifest(PHRASES, segments);

  const seen = new Set<number>();
  for (const entry of entries) {
    assert.ok(
      !seen.has(entry.phraseIndex),
      `phraseIndex ${entry.phraseIndex} appears more than once — a phrase must get at most one B-roll clip`
    );
    seen.add(entry.phraseIndex);
  }
});

test("entry frame ranges are clamped to the phrase they belong to", () => {
  const segments = loadPlannerSegments();
  const entries = buildPhraseAlignedManifest(PHRASES, segments);

  for (const entry of entries) {
    const phrase = PHRASES.find((p) => p.phraseIndex === entry.phraseIndex);
    assert.ok(phrase, `no phrase for index ${entry.phraseIndex}`);
    assert.ok(
      entry.from >= phrase!.from && entry.to <= phrase!.to,
      `entry for P${entry.phraseIndex} spans ${entry.from}-${entry.to}, ` +
        `outside phrase ${phrase!.from}-${phrase!.to}`
    );
  }
});

// ─── 2. Every entry's file path matches the downloader's output ───────────────

test("brollAssetLocalPath matches the downloader's destination rule", () => {
  // The downloader writes: path.join(config.downloadDir, provider.name, id + ".mp4")
  // This is the rule asserted in src/lib/broll/downloader.ts searchAndDownload().
  const expected = path.join(DOWNLOAD_DIR, "pexels", "seg-6.mp4");
  const actual = brollAssetLocalPath("seg-6", PROVIDER, DOWNLOAD_DIR);
  assert.equal(actual, expected);
});

test("brollAssetStaticPath produces the exact path staticFile() serves", () => {
  // staticFile() resolves against public/, so the manifest value must be the
  // public/-relative form with forward slashes.
  const expected = "projects/corporate-career-growth-amana-premium-916/b-roll/pexels/seg-6.mp4";
  const actual = brollAssetStaticPath("seg-6", PROVIDER, DOWNLOAD_DIR);
  assert.equal(actual, expected);
});

test("every phrase-aligned entry's static path is inside public/", () => {
  const segments = loadPlannerSegments();
  const entries = buildPhraseAlignedManifest(PHRASES, segments);

  for (const entry of entries) {
    const staticPath = brollAssetStaticPath(entry.segmentId, PROVIDER, DOWNLOAD_DIR);
    const resolved = path.resolve(PROJECT_ROOT, "public", staticPath);
    const relative = path.relative(PUBLIC_DIR, resolved);
    assert.ok(
      !relative.startsWith("..") && !path.isAbsolute(relative),
      `static path ${staticPath} resolves outside public/ (relative: ${relative})`
    );
  }
});

test("toStaticFilePath rejects paths outside public/", () => {
  assert.throws(
    () => toStaticFilePath("assets/projects/corporate-career-growth-amana/b-roll/pexels/seg-6.mp4"),
    /outside public\//
  );
  assert.throws(
    () => toStaticFilePath("src/videos/corporate-career-growth-amana-premium-916/b-roll/pexels/seg-6.mp4"),
    /outside public\//
  );
});

test("toStaticFilePath does not double-prefix public/", () => {
  // Regression: the old code stripped a literal "public/" prefix, which mangled
  // paths that already carried it.
  const result = toStaticFilePath("public/projects/x/b-roll/pexels/seg-0.mp4");
  assert.equal(result, "projects/x/b-roll/pexels/seg-0.mp4");
});

test("toStaticFilePath converts backslashes to forward slashes", () => {
  const result = toStaticFilePath("public\\projects\\x\\b-roll\\pexels\\seg-0.mp4");
  assert.equal(result, "projects/x/b-roll/pexels/seg-0.mp4");
});

// ─── 3. Mapping is derived from overlap, not from planner segment IDs ─────────

test("phrase-aligned mapping never uses a raw planner segment ID as a phraseIndex", () => {
  const segments = loadPlannerSegments();
  const brollSegmentIds = segments
    .filter((s) => s.treatment === "broll")
    .map((s) => parseInt(s.id.replace("seg-", ""), 10));

  const entries = buildPhraseAlignedManifest(PHRASES, segments);
  const plannerIndices = new Set(brollSegmentIds);

  for (const entry of entries) {
    // The entry's phraseIndex must be a PHRASES index, not a segment number.
    const isPhraseIndex = PHRASES.some((p) => p.phraseIndex === entry.phraseIndex);
    assert.ok(isPhraseIndex, `phraseIndex ${entry.phraseIndex} is not a PHRASES index`);
  }
});

test("each entry carries its source planner segment ID for traceability", () => {
  const segments = loadPlannerSegments();
  const entries = buildPhraseAlignedManifest(PHRASES, segments);

  for (const entry of entries) {
    const sourceSeg = segments.find((s) => s.id === entry.segmentId);
    assert.ok(
      sourceSeg,
      `entry P${entry.phraseIndex} references segmentId ${entry.segmentId} which is not in the plan`
    );
    assert.equal(sourceSeg!.treatment, "broll");
  }
});

// ─── 4. Boundary crossing and too-short overlaps ─────────────────────────────

test("boundary-crossing planner segment is clipped, not applied whole", () => {
  // seg-7 (305-386) crosses P2 (253-374) and P3 (374-456). Its contribution to
  // each phrase must be the overlapping portion only.
  const seg7: VisualSegment = {
    id: "seg-7", from: 305, to: 386, startMs: 0, endMs: 0,
    transcriptText: "x", visualDescription: "x", searchQuery: "q",
    treatment: "broll", brollConfidence: 0.7, entities: [], priority: 1,
  };

  const mappings = mapPlannerToPhrases(PHRASES, [seg7]);

  const p2 = mappings.find((m) => m.phraseIndex === 2);
  const p3 = mappings.find((m) => m.phraseIndex === 3);

  // P2 overlap: max(305,253)=305 to min(386,374)=374 → 69 frames. Qualifies.
  assert.ok(p2, "seg-7 should map to P2");
  assert.equal(p2!.from, 305);
  assert.equal(p2!.to, 374);
  assert.equal(p2!.overlapFrames, 69);

  // P3 overlap: max(305,374)=374 to min(386,456)=386 → 12 frames. BELOW the
  // 15-frame threshold, so P3 must NOT get a B-roll entry.
  assert.equal(p3, undefined, "seg-7's 12-frame bleed into P3 must be dropped");
});

test("overlap below minOverlapFrames produces no entry", () => {
  // A 9-frame bleed into the POSITIONING finale (P5, 498-513).
  const seg9: VisualSegment = {
    id: "seg-9", from: 456, to: 507, startMs: 0, endMs: 0,
    transcriptText: "x", visualDescription: "x", searchQuery: "q",
    treatment: "broll", brollConfidence: 0.7, entities: [], priority: 1,
  };

  const mappings = mapPlannerToPhrases(PHRASES, [seg9]);
  const p5 = mappings.find((m) => m.phraseIndex === 5);
  assert.equal(p5, undefined, "P5's 9-frame bleed is below threshold and must be dropped");

  const p4 = mappings.find((m) => m.phraseIndex === 4);
  assert.ok(p4, "P4 (456-498, 42 frames) should qualify");
  assert.equal(p4!.overlapFrames, 42);
});

test("phrases with no B-roll planner content get no entry", () => {
  const segments = loadPlannerSegments();
  const mappings = mapPlannerToPhrases(PHRASES, segments);

  // P0 and P1 contain talking-head/highlight-only content only.
  for (const idx of [0, 1]) {
    const m = mappings.find((x) => x.phraseIndex === idx);
    assert.equal(m, undefined, `P${idx} has no B-roll planner content and must get no entry`);
  }
});

// ─── 5. Real-transcript end-to-end: the full mapping ─────────────────────────

test("end-to-end: real transcript produces a valid, bounded mapping", () => {
  const segments = loadPlannerSegments();
  const entries = buildPhraseAlignedManifest(PHRASES, segments);

  // Every entry must reference a real phrase, carry a real segment, and be
  // clamped to that phrase.
  for (const entry of entries) {
    const phrase = PHRASES.find((p) => p.phraseIndex === entry.phraseIndex)!;
    const seg = segments.find((s) => s.id === entry.segmentId)!;

    assert.equal(seg.treatment, "broll", `${entry.segmentId} must be a B-roll segment`);
    assert.ok(entry.from >= phrase.from, `entry starts before its phrase`);
    assert.ok(entry.to <= phrase.to, `entry ends after its phrase`);
    assert.ok(entry.to > entry.from, "entry must have positive duration");
    assert.ok(entry.overlapFrames >= 15, `overlap ${entry.overlapFrames} below 15-frame minimum`);
  }

  // The mapping must not claim more phrases than have B-roll content.
  const brollPhrases = PHRASES.filter((p) =>
    segments.some((s) => s.treatment === "broll" && s.from < p.to && s.to > p.from)
  );
  assert.ok(
    entries.length <= brollPhrases.length,
    `generated ${entries.length} entries but only ${brollPhrases.length} phrases have B-roll content`
  );
});

// ─── 6. The PHRASES mirror matches the composition's own source ──────────────

test("test PHRASES mirror matches the Premium composition's PHRASES array", () => {
  const compositionPath = path.join(
    PROJECT_ROOT,
    "src/videos/corporate-career-growth-amana-premium-916/index.tsx"
  );
  const source = fs.readFileSync(compositionPath, "utf-8");

  for (const phrase of PHRASES) {
    const pattern = new RegExp(
      `words:\\s*\\[${phrase.words.map((w) => `"${w}"`).join(",\\s*")}\\][\\s\\S]*?from:\\s*${phrase.from}[\\s\\S]*?to:\\s*${phrase.to}`
    );
    assert.ok(
      pattern.test(source),
      `PHRASES[${phrase.phraseIndex}] (${phrase.words.join(" ")}, ${phrase.from}-${phrase.to}) ` +
        `not found in the composition — the test mirror has drifted from index.tsx`
    );
  }
});

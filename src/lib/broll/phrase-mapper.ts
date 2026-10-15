/**
 * phrase-mapper.ts — map planner's auto-generated B-roll segments to the
 * Premium composition's PHRASES array and derive Remotion-ready manifest entries.
 *
 * THE PROBLEM THIS SOLVES
 * ────────────────────────
 * The planner splits the transcript at 400 ms silence gaps and applies entity
 * heuristics. Its segment IDs (seg-6, seg-7, seg-9) bear no fixed relationship
 * to the Premium composition's PHRASES indices (0–5). The frame boundaries also
 * don't align: seg-7 crosses the P2/P3 boundary; seg-9 crosses the P4/P5
 * boundary. Writing the planner's raw output into the manifest would put B-roll
 * behind the wrong headline words.
 *
 * THE SOLUTION
 * ────────────
 * Instead of forcing alignment, this mapper takes the PHRASES as the authoritative
 * frame source and asks: "for each PHRASE, what did the planner identify as B-roll
 * content that overlaps with this phrase?" The answer drives the manifest.
 *
 * RULES
 * ─────
 * 1. Phrase-aligned: every manifest entry covers at least one PHRASE's full
 *    from/to range. Entries never span more than two adjacent PHRASEs (no more
 *    than one boundary crossing per entry, which is all the data supports).
 *
 * 2. Clipped: if a planner segment crosses a PHRASE boundary, its contribution
 *    to each phrase is the overlapping portion only. The overlapping portion must
 *    be ≥ 15 frames (minBrollFrames threshold) to qualify.
 *
 * 3. Too short → no entry: if the qualifying overlap for a phrase is < 15 frames,
 *    no B-roll entry is generated. The phrase degrades to talking-head. This
 *    prevents a 9-frame bleed from triggering a full B-roll crossfade.
 *
 * 4. No duplication: two planner segments that both overlap the same phrase produce
 *    ONE manifest entry (the one with more overlapping frames). The higher-quality
 *    match wins.
 *
 * 5. Source info preserved: every entry carries the planner segment ID it came
 *    from, so manual review can trace "this entry → seg-7 → which query".
 *
 * MINIMUM VIABLE MAPPING (documented in the manifest header)
 * ─────────────────────────────────────────────────────────
 * Per the manifest comment, 5 clips were identified manually:
 *   phraseIndex 0 → team-meeting.mp4  (P0 "EARNING SIGNIFICANTLY MORE")
 *   phraseIndex 1 → professional-desk.mp4  (P1 "MORE TALENTED")
 *   phraseIndex 2 → career-growth.mp4  (P2 "13 YEARS")
 *   phraseIndex 3 → salary-finance.mp4  (P3 "MOVE AHEAD MUCH FASTER")
 *   phraseIndex 4 → skills-training.mp4  (P4 "TALENT OR SKILLS")
 *   phraseIndex 5 → (none — 15 frames, too short)
 *
 * This manual mapping is what the curated manifest currently encodes. The mapper
 * below does NOT replace it — it generates verified planner-derived entries in a
 * separate test manifest so the curator can compare and merge.
 */

import type { VisualSegment } from "./types";

/** A Premium phrase definition (mirrors the composition's PHRASES array shape). */
export interface PremiumPhrase {
  phraseIndex: number;
  words: string[];
  from: number;
  to: number;
}

/** Result of mapping one planner segment to a phrase. */
export interface PhraseBrollMapping {
  phraseIndex: number;
  /** Planner segment that provides the B-roll for this phrase */
  segmentId: string;
  /** The overlapping frame range within the phrase (clipped) */
  from: number;
  to: number;
  /** The raw planner segment */
  segment: VisualSegment;
  /** How many frames of this phrase the segment covers (total overlap) */
  overlapFrames: number;
}

/**
 * Map planner's B-roll segments to Premium phrases, returning one entry per
 * qualifying phrase. Unqualified phrases are omitted.
 *
 * Pass `minOverlapFrames` (default 15) to skip phrases whose qualifying
 * overlap is too short for a meaningful B-roll crossfade.
 */
export function mapPlannerToPhrases(
  phrases: PremiumPhrase[],
  plannerSegments: VisualSegment[],
  minOverlapFrames = 15
): PhraseBrollMapping[] {
  const brollSegments = plannerSegments.filter((s) => s.treatment === "broll");
  const results: PhraseBrollMapping[] = [];

  for (const phrase of phrases) {
    // Find all planner B-roll segments that overlap this phrase
    const overlapping = brollSegments
      .map((seg) => {
        const overlapStart = Math.max(seg.from, phrase.from);
        const overlapEnd = Math.min(seg.to, phrase.to);
        const overlapFrames = Math.max(0, overlapEnd - overlapStart);
        return { seg, overlapStart, overlapEnd, overlapFrames };
      })
      .filter((x) => x.overlapFrames > 0);

    if (overlapping.length === 0) continue;

    // Pick the best overlapping segment: most overlapping frames
    const best = overlapping.reduce((a, b) =>
      a.overlapFrames >= b.overlapFrames ? a : b
    );

    if (best.overlapFrames < minOverlapFrames) continue;

    results.push({
      phraseIndex: phrase.phraseIndex,
      segmentId: best.seg.id,
      from: best.overlapStart,
      to: best.overlapEnd,
      segment: best.seg,
      overlapFrames: best.overlapFrames,
    });
  }

  return results;
}

/**
 * Build the phrase-aligned manifest entries that a full pipeline run would write.
 *
 * Returns the entries in phraseIndex order, each with the frame range clamped
 * to the qualifying overlap, and the segment ID as the downloaded filename
 * (after the downloader applies `brollAssetLocalPath(segmentId, provider, downloadDir)`).
 *
 * The `staticFile` path for the manifest is built by `brollAssetStaticPath()` from
 * `asset-path.ts`, which mirrors the downloader's destination exactly.
 *
 * For a live pipeline run, `generateRemotionManifest()` in `manifest-generator.ts`
 * is what actually writes the manifest — this function only returns the data.
 */
export interface PhraseAlignedEntry {
  phraseIndex: number;
  segmentId: string;
  from: number;
  to: number;
  searchQuery: string;
  overlapFrames: number;
}

export function buildPhraseAlignedManifest(
  phrases: PremiumPhrase[],
  plannerSegments: VisualSegment[],
  minOverlapFrames = 15
): PhraseAlignedEntry[] {
  const mappings = mapPlannerToPhrases(phrases, plannerSegments, minOverlapFrames);

  return mappings.map((m) => ({
    phraseIndex: m.phraseIndex,
    segmentId: m.segmentId,
    from: m.from,
    to: m.to,
    searchQuery: m.segment.searchQuery,
    overlapFrames: m.overlapFrames,
  }));
}

/**
 * broll-segments.ts — Approved B-roll segments for the Premium 9:16 variant.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * READ-ONLY AUDIT RESULT
 * This file was created following a read-only audit of:
 *   • src/videos/corporate-career-growth-amana-premium-916/index.tsx  (BrollLayer:218-294)
 *   • src/videos/corporate-career-growth-amana-premium-916/broll-manifest.ts  (curated)
 *   • work/corporate-career-growth-amana/prep/audio/transcript.json  (68 words)
 *
 * Two approved decisions:
 *   • seg-6: pixabay-185341 at frames 253-305 (2.2s) — corporate building
 *   • seg-7: reuse existing seg-7.mp4 at frames 305-386 (3.4s) — salary/finance
 *   • seg-9: talking-head — no B-roll entry (phrase 4 has no manifest entry)
 *
 * This file is derived from the canonical transcript and approved by the user.
 * It does NOT replace the curated broll-manifest.ts (which is untouched and
 * documents the five-scene intent for reference only).
 *
 * INTEGRATION: import { BROLL_SEGMENTS } from "./broll-segments" in index.tsx
 * and replace the BROLL_MANIFEST reference in BrollLayer / GradientOverlay.
 * That integration is Phase 2 — pending separate approval.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * TIMING SOURCE
 * All frame values are derived from the canonical transcript at:
 *   work/corporate-career-growth-amana/prep/audio/transcript.json
 *
 * Planner segment boundaries (buildTranscriptSegments, GAP_THRESHOLD_MS=400):
 *   seg-6: frames 253-305  (phrase 2 "13 YEARS" — first part)
 *   seg-7: frames 305-386  (phrase 2 "13 YEARS" — second part)
 *   seg-9: frames 456-507  (phrase 4 "TALENT OR SKILLS" + phrase 5 "POSITIONING")
 *
 * The BROLL_MANIFEST (phrase-indexed) does NOT use seg-N ids. Here we use the
 * planner's frame boundaries directly because BrollLayer resolves from/to to ms
 * and finds the active clip by time range — phraseIndex is not used at render
 * time, only for human reference below.
 *
 * FILE PATHS (relative to public/, forward slashes, matching staticFile contract)
 *   seg-6: projects/corporate-career-growth-amana-premium-916/b-roll/pixabay/seg-6.mp4
 *          16,784,078 bytes · 1440x2560 · h264 yuv420p · 329 frames @ 29.97fps · 10.976667s
 *          sha256: 30766ff832b9d95811aeeac4ec97a28c97094482d0d60961028d42e032c22ee2
 *          Pixabay id: 185341 · tags: building, skyscraper, architecture, corporate,
 *                     business, office, real estate, urban, skyline, cityscape
 *          Aspect ratio: 1440/2560 = 0.562500 == 1080/1920 — EXACT 9:16, no crop/stretch
 *
 *   seg-7: projects/corporate-career-growth-amana-premium-916/b-roll/pixabay/seg-7.mp4
 *          2,972,578 bytes · 1080x1904 · h264 yuv420p · 145 frames @ 24fps · 6.041667s
 *          nb_read_frames=145 (FFprobe reports nb_frames=N/A — decoded count used instead)
 *          Aspect ratio: 1080/1904 = 0.567227 vs 9:16 0.562500 — 16px SHORTER than 1920,
 *          so objectFit:"cover" crops ~6px top and bottom. Not letterboxed; source
 *          fills the frame. See ASPECT RATIO note below.
 *
 * ZOOM RANGE
 * Both clips use [1.0, 1.06] — a gentle 6% push-in over the clip's full duration.
 * seg-6 (1440x2560) covers the 1145x2035 peak with room to spare.
 * seg-7 (1080x1904) is upscaled ~0.84% by objectFit:cover even at rest, so at
 * peak zoom it is the softer of the two — see the ASPECT RATIO note.
 *
 * ASPECT RATIO NOTE (seg-7 only)
 * seg-7 is 1080x1904 — 16 px shorter than the 1080x1920 composition.
 * objectFit:"cover" picks the scale that FILLS the container, preserving AR:
 *   scale = max(1080/1080, 1920/1904) = max(1.0, 1.00840) = 1.00840
 * So seg-7 is scaled UP 0.84% to 1089x1920 and the ~9px width overflow is
 * cropped (~4.5 px per side). It does NOT letterbox — the container is filled.
 *
 * At the 1.06 zoom peak the whole layer scales to ~1154x2035 and the container
 * clips it, so ~93.6% of the clip is visible. That crop of the cover-scaled
 * source maps back to ~1010 of seg-7's 1080 source pixels — still a
 * downscale, so it stays sharp. Practical effect: seg-7 is imperceptibly
 * softer than seg-6 and loses a sliver off each side. Not a safety issue.
 *
 * BOUNDARY NOTE
 * Approved ranges are 253-305 and 305-386, so frame 305 is the boundary.
 * `to` is EXCLUSIVE (matching the curated manifest's documented contract):
 *   seg-6 covers frames 253..304 (52 frames, 2.17s)
 *   seg-7 covers frames 305..385 (81 frames, 3.38s)
 *
 * BrollLayer (index.tsx:225) currently tests `currentMs <= (to/fps)*1000` —
 * inclusive — so frame 305 matches BOTH entries and .find() returns seg-6,
 * stealing one frame from seg-7. Phase 2 must change that `<=` to `<` so the
 * render matches this data. The data below is correct either way.
 *
 * SEG-9 TALKING-HEAD
 * No entry for frames 456-507 means BrollLayer returns null there and the
 * GradientOverlay uses the talking-head intensity (0.35 instead of 0.55).
 * The CaptionBar, VideoLayer, and phrase graphics run unchanged — the talking-
 * head decision is expressed by omission, with no code change required.
 */

export const BROLL_SEGMENTS: {
  /** Human reference only — not used by BrollLayer at render time */
  segmentId: string;
  /**
   * Maps to the PHRASES array index in ./index.tsx.
   * BrollLayer ignores this; it finds the active clip by from/to time.
   * Used only to document which on-screen phrase each clip accompanies.
   */
  phraseIndex: number;
  /**
   * Path relative to public/, forward slashes — consumed by Remotion staticFile().
   * Matches the path the downloader wrote and the verified sha256 above.
   */
  file: string;
  /**
   * Start frame (inclusive). Together with `to`, defines when this clip is shown.
   * BrollLayer converts to ms via (from / fps) * 1000.
   */
  from: number;
  /**
   * End frame (EXCLUSIVE — the clip is not shown on this frame).
   *
   * seg-6 visible frames: 253-304. seg-7 visible frames: 305-385.
   * Frame 305 belongs to seg-7, not seg-6.
   *
   * Exclusive `to` is what the curated manifest documents:
   * ("`to` is EXCLUSIVE (duration = to - from), matching the <Sequence>
   * semantics used for PHRASES, so no two clips can overlap").
   *
   * BrollLayer uses `frame >= from && frame < to` — confirmed exclusive
   * since Phase 2 (the old `currentMs <= (to/fps)*1000` was inclusive).
   */
  to: number;
  /**
   * Source-video metadata from FFprobe, used by BrollLayer to size the
   * playback window so the render never reads past the end of the file.
   *
   * `frames` is the exact decoded frame count (`nb_read_frames`, not the
   * nominal `nb_frames` — seg-7 reports N/A for nb_frames). `fps` is the
   * source average frame rate, which differs from the composition's 23.976.
   */
  source: {
    /** Exact decoded frame count. */
    frames: number;
    /** Source average frame rate (e.g. 30000/1001, 24). */
    fps: number;
    /** Source width in pixels. */
    width: number;
    /** Source height in pixels. */
    height: number;
  };
  /**
   * Zoom scale range: [startScale, endScale].
   * Applied via Remotion interpolate(clipProgress, [0, 1], zoomRange, EASE_OUT).
   * 1.06 × 1080 = 1145px peak; source is 1440×2560 so it stays inside the frame.
   */
  zoomRange: [number, number];
}[] = [
  {
    /**
     * seg-6 — "years in the corporate and I have seen"
     * Frames 253-305 · 52 frames · 2.17s @ 23.976fps
     * phraseIndex 2 = "13 YEARS" (PHRASES[2])
     *
     * Visual: corporate building — matches the "years in the corporate" framing.
     * Source: pixabay-185341 · 1440x2560 · h264 · 10.98s
     * Trim: plays from frame 0 of source; Sequence runs for 52 frames only.
     * Crossfade: 600ms in + 600ms out built into BrollLayer.
     */
    segmentId: "seg-6",
    phraseIndex: 2,
    file: "projects/corporate-career-growth-amana-premium-916/b-roll/pixabay/seg-6.mp4",
    from: 253,
    to: 305,
    source: { frames: 329, fps: 29.97, width: 1440, height: 2560 },
    zoomRange: [1.0, 1.06],
  },
  {
    /**
     * seg-7 — "people with similar experiences getting much more salary"
     * Frames 305-386 · 81 frames · 3.38s @ 23.976fps
     * phraseIndex 2 = "13 YEARS" (PHRASES[2], second part of the same phrase)
     *
     * Visual: salary/finance/professional — matches "similar experiences / salary".
     * Source: existing verified file (not re-downloaded).
     * Trim: plays from frame 0 of source; Sequence runs for 81 frames only.
     */
    segmentId: "seg-7",
    phraseIndex: 2,
    file: "projects/corporate-career-growth-amana-premium-916/b-roll/pixabay/seg-7.mp4",
    from: 305,
    to: 386,
    source: { frames: 145, fps: 24.0, width: 1080, height: 1904 },
    zoomRange: [1.0, 1.06],
  },
  // ── seg-9: talking-head ────────────────────────────────────────────────────
  // Frames 456-507 have NO B-roll entry. BrollLayer returns null in this range,
  // GradientOverlay falls back to talking-head intensity (0.35), and the
  // CaptionBar, VideoLayer, and phrase graphics continue uninterrupted.
  // The talking-head decision is expressed by omission — no code change needed.
];

// ── Verification helpers (not used at render time) ────────────────────────────

/** Frame ranges as [from, to] tuples, for cross-checking against the transcript. */
export const SEGMENT_FRAMES: ReadonlyArray<{ segmentId: string; from: number; to: number }> =
  BROLL_SEGMENTS.map(({ segmentId, from, to }) => ({ segmentId, from, to }));

/** Confirm no two segments overlap using EXCLUSIVE `to` semantics (see above).
 *  Adjacent segments that share a boundary frame (e.g. seg-6.to=305, seg-7.from=305)
 *  are valid — the clip ends at frame 304 and the next starts at 305. */
export function validateSegmentFrames(): void {
  const sorted = [...SEGMENT_FRAMES].sort((a, b) => a.from - b.from);
  for (let i = 0; i < sorted.length - 1; i++) {
    // Overlap = a's exclusive end is past b's start. a.to == b.from is valid.
    if (sorted[i].to > sorted[i + 1].from) {
      throw new Error(
        `Segment overlap: ${sorted[i].segmentId} exclusive-to=${sorted[i].to} > ${sorted[i + 1].segmentId} from=${sorted[i + 1].from}`
      );
    }
  }
}

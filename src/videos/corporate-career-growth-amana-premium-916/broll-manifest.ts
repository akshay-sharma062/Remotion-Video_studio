/**
 * B-roll manifest for corporate-career-growth-amana-premium-916.
 *
 * TIMING — every from/to is derived from the CANONICAL transcript:
 *   work/corporate-career-growth-amana/prep/audio/transcript.json
 * Verified phrase start frames: 104, 175, 253, 374, 456, 498.
 * `to` is EXCLUSIVE (duration = to - from), matching the <Sequence> semantics
 * used for PHRASES, so no two clips can overlap.
 *
 * NOTE: phraseIndex refers to the PHRASES array in ./index.tsx.
 *
 * CLIPS — none downloaded yet. The entries below are placeholders describing
 * the intended footage; the pipeline drops any clip whose file is absent (see
 * BROLL_AVAILABLE in ./index.tsx), so the render degrades to talking head
 * until real clips land. Do not treat these as downloaded assets.
 *
 * FILE PLACEMENT once clips are obtained (must match the pipeline exactly):
 *   --manifest-path src/videos/corporate-career-growth-amana-premium-916/broll-manifest.ts
 *   --download-dir projects/corporate-career-growth-amana-premium-916/b-roll
 *   public/projects/corporate-career-growth-amana-premium-916/b-roll/<provider>/
 *
 * The downloader writes each clip to <downloadDir>/<provider>/<seg-id>.mp4,
 * so the `file` values below carry BOTH the premium project folder and the
 * provider subfolder. Pointing them at
 * public/projects/corporate-career-growth-amana/... would reach into the
 * protected production composition's media, which the pipeline refuses to
 * write. Segment ids (seg-0, seg-3, ...) come from the planner; replace the
 * placeholder names when real clips land.
 *
 * Free source (no attribution required, commercial use permitted): Pexels.
 * Prefer 9:16 (1080x1920); 16:9 is centre-cropped. 10-20s of footage is ample.
 *
 * Scene 1 — "EARNING SIGNIFICANTLY MORE" (frames 104-175):
 *   Search: "corporate team meeting office"
 *   Save as: team-meeting.mp4
 *
 * Scene 2 — "MORE TALENTED" (frames 175-253):
 *   Search: "professional working desk laptop"
 *   Save as: professional-desk.mp4
 *
 * Scene 3 — "13 YEARS" (frames 253-374):
 *   Search: "business growth career promotion success"
 *   Save as: career-growth.mp4
 *
 * Scene 4 — "MOVE AHEAD MUCH FASTER" (frames 374-456):
 *   Search: "finance chart salary money"
 *   Save as: salary-finance.mp4
 *
 * Scene 5 — "TALENT OR SKILLS" (frames 456-498):
 *   Search: "skills training professional development"
 *   Save as: skills-training.mp4
 */

export const BROLL_MANIFEST: {
  phraseIndex: number;
  file: string;
  from: number;
  to: number;
  zoomRange: [number, number];
}[] = [
  {
    phraseIndex: 0, // EARNING SIGNIFICANTLY MORE
    file: "projects/corporate-career-growth-amana-premium-916/b-roll/pexels/team-meeting.mp4",
    from: 104,
    to: 175,
    zoomRange: [1.0, 1.06],
  },
  {
    phraseIndex: 1, // MORE TALENTED
    file: "projects/corporate-career-growth-amana-premium-916/b-roll/pexels/professional-desk.mp4",
    from: 175,
    to: 253,
    zoomRange: [1.0, 1.04],
  },
  {
    phraseIndex: 2, // 13 YEARS
    file: "projects/corporate-career-growth-amana-premium-916/b-roll/pexels/career-growth.mp4",
    from: 253,
    to: 374,
    zoomRange: [1.0, 1.05],
  },
  {
    phraseIndex: 3, // MOVE AHEAD MUCH FASTER
    file: "projects/corporate-career-growth-amana-premium-916/b-roll/pexels/salary-finance.mp4",
    from: 374,
    to: 456,
    zoomRange: [1.0, 1.04],
  },
  {
    phraseIndex: 4, // TALENT OR SKILLS
    file: "projects/corporate-career-growth-amana-premium-916/b-roll/pexels/skills-training.mp4",
    from: 456,
    to: 498,
    zoomRange: [1.0, 1.05],
  },
  // phraseIndex 5 (POSITIONING) — NO B-ROLL. 15 frames is too short for a clip.
  // The FinaleGlow graphic handles the visual accent for this brief ending.
];

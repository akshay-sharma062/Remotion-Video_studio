import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  staticFile,
  Video,
  Sequence,
  Audio,
} from "remotion";
import { EASE_IN, EASE_OUT, EASE_IN_OUT, tween } from "../../design/motion";
import { tokens } from "../../design/tokens";
import WORDS from "./words.generated";
import { BROLL_SEGMENTS } from "./broll-segments";

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_FRAMES = 513;
const FPS = 23.976;
const SAFE = { top: 250, bottom: 380, left: 80, right: 80 };
const HEADLINE_TOP = 36;
const AVAILABLE_WIDTH = 1080 - SAFE.left - SAFE.right;
const YELLOW = "#FFE500";
const RED = "#DC2626";

// ─── Vertical layout contract ────────────────────────────────────────────────
// One band per role, in fixed order, so no two elements can ever overlap.
//
//   band A  headline      36  → 340   (stacked, max 2 lines)
//   band B  graphic       368 → 700   (pill, timeline, bars)
//   band C  caption       1120→ 1540  (approved design, untouched)
//
// Band A ends at 340 regardless of font size: computeFontSize() is capped so
// two lines of stacked text always terminate above 340. Band B starts at 368,
// a guaranteed 28px gutter below the worst-case headline.
const HEADLINE_BAND_END = 340;
const GRAPHIC_BAND_TOP = 368;
const GRAPHIC_BAND_END = 700;

// Maximum headline block height (2 lines × lineHeight × fontSize + stroke).
// Solving 2 * fontSize * 1.1 <= HEADLINE_BAND_END - HEADLINE_TOP gives the
// cap below; it is passed as maxFontSize so computeFontSize never overshoots.
const HEADLINE_FONT_CAP = 130;

// ─── Phrase Definitions ──────────────────────────────────────────────────────
// Each entry has the scene graphic type to render alongside the headline.
//
// Word text comes from assets/projects/corporate-career-growth-amana/BRIEF.md
// (the approved brief) — NOT from the raw transcription. Per CLAUDE.md rule (h)
// the script is the truth for every word; the transcription supplies only timing.
// The transcription mis-hears two words: [15] "being"→"earning" and [52]
// "selfie."→"faster" (BRIEF.md line 20: "move ahead much faster").
//
// TIMING — every from/to below is derived from the CANONICAL transcript:
//   work/corporate-career-growth-amana/prep/audio/transcript.json
// Verified phrase start frames: 104, 175, 253, 374, 456, 498.
// Each scene runs [from, to) — exclusive end — so scenes never overlap.
// The shifts from the earlier draft were non-uniform (+17, +5, +10, +17, +7,
// −8), which is why each cue is mapped individually rather than by offset.

const PHRASES = [
  {
    words: ["EARNING", "SIGNIFICANTLY", "MORE"],
    from: 104,
    to: 175,
    emphasisWord: 0,
    stacked: true,
    graphic: "stat-pill" as const,
  },
  {
    words: ["MORE", "TALENTED"],
    from: 175,
    to: 253,
    emphasisWord: -1,
    stacked: true,
    graphic: "negation-line" as const,
  },
  {
    words: ["13", "YEARS"],
    from: 253,
    to: 374,
    emphasisWord: 0,
    stacked: true,
    graphic: "counter-timeline" as const,
  },
  {
    words: ["MOVE", "AHEAD", "MUCH", "FASTER"],
    from: 374,
    to: 456,
    emphasisWord: 3,
    stacked: true,
    graphic: "comparison-bars" as const,
  },
  {
    words: ["TALENT", "OR", "SKILLS"],
    from: 456,
    to: 498,
    emphasisWord: -1,
    stacked: true,
    graphic: "divider-line" as const,
  },
  {
    words: ["POSITIONING"],
    from: 498,
    to: 513,
    emphasisWord: 0,
    stacked: false,
    graphic: "finale-glow" as const,
  },
];

// ─── Phrase Context ──────────────────────────────────────────────────────────
// Provides local frame (frame - phraseFrom) to all phrase-scoped components.

const PhraseContext = React.createContext<{ phraseFrom: number; phraseTo: number } | null>(null);

function usePhraseFrame(): { frame: number; sceneDuration: number } {
  const ctx = React.useContext(PhraseContext);
  // useCurrentFrame() is already Sequence-relative: inside <Sequence from={phrase.from}>
  // it returns (globalFrame - phrase.from). Do NOT subtract phraseFrom again.
  const frame = useCurrentFrame();
  const sceneDuration = ctx ? ctx.phraseTo - ctx.phraseFrom : TOTAL_FRAMES;
  return { frame, sceneDuration };
}

function PhraseProvider({
  phraseFrom,
  phraseTo,
  children,
}: {
  phraseFrom: number;
  phraseTo: number;
  children: React.ReactNode;
}) {
  return (
    <PhraseContext.Provider value={{ phraseFrom, phraseTo }}>
      {children}
    </PhraseContext.Provider>
  );
}

// ─── Utility ────────────────────────────────────────────────────────────────

// Measures one rendered line of Inter Black at the given font size.
// charWidth 0.56 and letterSpacing 0.04em are the measured ratios for Inter
// Black on a 1080px canvas; see the sibling composition's notes.
function lineWidth(line: string[], fontSize: number): number {
  const charCount = line.join(" ").length;
  return charCount * fontSize * 0.56 + fontSize * 0.04 * (charCount - 1);
}

// Largest font size at which every line fits the safe width. Binary search.
function fontSizeForLines(lines: string[][], maxFontSize: number): number {
  let lo = 8;
  let hi = maxFontSize;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lines.every((line) => lineWidth(line, mid) <= AVAILABLE_WIDTH * 0.88)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// Chooses how to wrap a phrase across at most two lines, and the font size that
// fits. Among the candidate splits it picks the one that yields the LARGEST
// font size, so a long phrase renders as big as its width allows rather than
// collapsing to whatever the default split happens to cost.
function layoutHeadline(
  words: string[],
  stacked: boolean,
  maxFontSize: number
): { lines: string[][]; fontSize: number } {
  if (!stacked || words.length <= 2) {
    const lines = stacked ? [words.slice(0, 1), words.slice(1)] : [words];
    return { lines, fontSize: fontSizeForLines(lines, maxFontSize) };
  }

  let best = { lines: [words.slice(0, 2), words.slice(2)], fontSize: 8 };
  for (let split = 1; split < words.length; split++) {
    const lines = [words.slice(0, split), words.slice(split)];
    const fontSize = fontSizeForLines(lines, maxFontSize);
    if (fontSize > best.fontSize) best = { lines, fontSize };
  }
  return best;
}

// ─── B-roll Layer ────────────────────────────────────────────────────────────
// Crossfades B-roll footage into each phrase scene.
// Uses two-layer opacity crossfade: B-roll fades IN, talking head fades OUT
// (by darkening via the gradient), then reverses at scene end.
//
// When B-roll asset files are NOT present, the component renders nothing
// (the VideoLayer below continues showing the talking head).
//
// To add B-roll:
// 1. Download clips per broll-manifest.ts instructions
// 2. Place in assets/projects/corporate-career-growth-amana/b-roll/
// 3. This component will automatically pick them up

// Probed once at bundle time. A missing B-roll file must degrade to "no
// B-roll" instead of throwing MEDIA_ELEMENT_ERROR, which aborts the render.
const BROLL_AVAILABLE: Set<string> = new Set(
  BROLL_SEGMENTS.filter((clip) => {
    try {
      // Resolve the public/ path that staticFile() will serve.
      const fs = require("fs") as typeof import("fs");
      const path = require("path") as typeof import("path");
      return fs.existsSync(
        path.join(process.cwd(), "public", clip.file)
      );
    } catch {
      return false;
    }
  }).map((clip) => clip.file)
);

function BrollLayer() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  const crossfadeDurationMs = 600; // crossfade in/out duration

  // Frame-based comparison, EXCLUSIVE on the end frame (`< to`), matching the
  // documented `to` contract in ./broll-segments.ts and the curated manifest
  // ("`to` is EXCLUSIVE (duration = to - from)"). The previous time-based
  // `currentMs <= (to/fps)*1000` was inclusive, so a shared boundary frame
  // matched BOTH clips and `.find()` returned the first — stealing one frame
  // from the next segment. With 253-305 / 305-386 that cost seg-7 its frame 305.
  //
  // Frames are compared directly rather than through ms: `(frame/fps)*1000`
  // introduces float rounding that can land a boundary frame on either side.
  // seg-6 is therefore visible on 253..304 and seg-7 on 305..385.
  const activeClip = BROLL_SEGMENTS.find(
    (c) => frame >= c.from && frame < c.to
  );

  if (!activeClip) return null;

  const clipStartMs = (activeClip.from / fps) * 1000;
  const clipEndMs = (activeClip.to / fps) * 1000;
  const clipDurationMs = clipEndMs - clipStartMs;
  const clipElapsedMs = currentMs - clipStartMs;

  // Crossfade: fade in during first 600ms, fade out during last 600ms
  let brollOpacity = 1;
  if (clipElapsedMs < crossfadeDurationMs) {
    brollOpacity = tween(clipElapsedMs / crossfadeDurationMs, EASE_OUT);
  } else if (clipElapsedMs > clipDurationMs - crossfadeDurationMs) {
    brollOpacity = 1 - tween(
      (clipElapsedMs - (clipDurationMs - crossfadeDurationMs)) / crossfadeDurationMs,
      EASE_IN
    );
  }

  // Slow push-in zoom over the clip duration
  const clipProgress = clipElapsedMs / clipDurationMs;
  const zoomScale = interpolate(clipProgress, [0, 1], activeClip.zoomRange, {
    easing: EASE_OUT,
  });

  // NOTE: no `if (brollOpacity < 0.01) return null` guard here. At a segment's
  // first frame clipElapsedMs is 0, so tween(0, EASE_OUT) = 0 and that guard
  // made BrollLayer return null — a one-frame talking-head flash before every
  // fade-in. Opacity is already applied to the container div below, so a
  // zero-opacity layer simply composites as nothing. The crossfade is unchanged.

  // Guard: if the B-roll file has not been downloaded yet, render nothing
  // rather than throwing MEDIA_ELEMENT_ERROR and killing the whole render.
  const clipExists = BROLL_AVAILABLE.has(activeClip.file);
  if (!clipExists) return null;

  // ─── Source-frame budgeting ────────────────────────────────────────────────
  // How long this segment plays in the composition, in composition frames.
  const neededFrames = activeClip.to - activeClip.from;

  // How many composition frames the SOURCE can actually supply.
  //
  // The source has its own frame rate (29.97 for seg-6, 24 for seg-7) which
  // differs from the composition's 23.976, so the mapping is by TIME, not by
  // frame count: source frame N is at time N/sourceFps seconds, and the
  // composition frame at that time is (N/sourceFps) * compFps.
  //
  // The last source frame is (frames-1), so the source runs dry at
  // composition frame ceil((frames-1)/sourceFps * compFps).
  const srcFps = activeClip.source.fps;
  const srcLastCompFrame = Math.ceil(
    ((activeClip.source.frames - 1) / srcFps) * fps
  );
  const availableCompFrames = srcLastCompFrame + 1;

  // The Sequence runs for exactly as many frames as the segment needs, but
  // never longer than the source can supply. Both clips are comfortably
  // longer than their segments, so in practice this equals neededFrames; the
  // min() is the guard that stops a future short clip from reading EOF frames.
  //
  // This replaces a hardcoded `srcDurationSec = 15`, which asked for 360
  // frames from a 329-frame source (seg-6) and a 145-frame source (seg-7) —
  // both would have read past the end of the file.
  const srcTotalFrames = Math.min(neededFrames, availableCompFrames);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 3,
        opacity: brollOpacity,
      }}
    >
      <Sequence from={0} durationInFrames={srcTotalFrames}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${zoomScale})`,
          }}
        >
          <Video
            src={staticFile(activeClip.file)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>
      </Sequence>
    </div>
  );
}

// ─── Video Layer (Talking Head) ─────────────────────────────────────────────
// Slow zoom throughout + emphasis punches at slam moments.

const FOOTAGE =
  "projects/corporate-career-growth-amana/footage/testing-video.mp4";
// Frame 0 of the footage, extracted once, used as a one-frame poster.
const FIRST_FRAME_POSTER =
  "projects/corporate-career-growth-amana/footage/first-frame.jpg";

function VideoLayer() {
  const frame = useCurrentFrame();

  const slowZoom = interpolate(frame, [0, TOTAL_FRAMES], [1.0, 1.04], {
    easing: EASE_OUT,
  });
  // Emphasis punches, keyed to the corrected PHRASES starts above. Each is
  // [sceneStart, sceneStart + 18, amount] so the punch peaks mid-scene and
  // eases back to zero — except the finale, which holds to the last frame.
  const punches: [number, number, number][] = [
    [104, 122, 0], [175, 193, 0.02], [253, 271, 0.02],
    [374, 392, 0.02], [456, 474, 0.02], [498, 513, 0.04],
  ];

  let punch = 0;
  for (const [start, end, amount] of punches) {
    if (frame >= start && frame <= end) {
      const p = (frame - start) / (end - start);
      const eased = interpolate(p, [0, 0.5, 1], [0, amount, 0], {
        easing: EASE_IN_OUT,
      });
      punch += eased;
    }
  }

  const scale = slowZoom + punch;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `scale(${scale})`,
        zIndex: 1,
      }}
    >
      <Video
        src={staticFile(
          "projects/corporate-career-growth-amana/footage/testing-video.mp4"
        )}
        // The decoder paints nothing at exactly t=0, which would leave the
        // opening frame black. Hold a poster frame under it for one frame.
        poster={frame === 0 ? staticFile(FIRST_FRAME_POSTER) : undefined}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
    </div>
  );
}

// ─── Gradient Overlay ───────────────────────────────────────────────────────
// Deepens during slam scenes for readability. When B-roll is active,
// the gradient deepens further to keep text readable over footage.

function GradientOverlay() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  // Check if we're in a B-roll scene. Same exclusive-end comparison and the
  // same BROLL_SEGMENTS source as BrollLayer, so the deepened gradient cannot
  // disagree with the clip actually on screen. Where no segment is defined
  // (e.g. seg-9, talking-head) this falls back to the lighter 0.35.
  const inBroll = BROLL_SEGMENTS.some((c) => frame >= c.from && frame < c.to);

  let sceneIntensity = inBroll ? 0.55 : 0.35;

  for (const phrase of PHRASES) {
    if (frame >= phrase.from && frame <= phrase.to) {
      const sceneLen = phrase.to - phrase.from;
      const inScene = (frame - phrase.from) / sceneLen;
      let localIntensity = 0;
      if (inScene < 0.3) {
        localIntensity = interpolate(inScene, [0, 0.3], [0.4, 0.85], { easing: EASE_OUT });
      } else if (inScene < 0.8) {
        localIntensity = 0.85;
      } else {
        localIntensity = interpolate(inScene, [0.8, 1.0], [0.85, 0.4], { easing: EASE_IN });
      }
      sceneIntensity = Math.max(sceneIntensity, localIntensity);
      break;
    }
  }

  // Finale deepen — keyed to the POSITIONING phrase start (frame 498), which
  // now lasts 15 frames rather than the earlier 7.
  if (frame >= 498) {
    const p = Math.min((frame - 498) / 7, 1);
    sceneIntensity = Math.max(sceneIntensity, interpolate(p, [0, 1], [0.85, 0.95], { easing: EASE_OUT }));
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 320,
        background: `linear-gradient(to bottom, rgba(0,0,0,${sceneIntensity}) 0%, rgba(0,0,0,${sceneIntensity * 0.5}) 40%, rgba(0,0,0,0) 100%)`,
        zIndex: 2,
        pointerEvents: "none",
      }}
    />
  );
}

// ─── Phrase Headline ────────────────────────────────────────────────────────
// Kinetic slam with overshoot entrance. Emphasized words get a yellow pill.
// Uses local frame via usePhraseFrame().

function PhraseHeadline({
  words,
  emphasisWord,
  stacked,
}: {
  words: string[];
  emphasisWord: number;
  stacked: boolean;
}) {
  const { frame, sceneDuration } = usePhraseFrame();

  const maxEnter = Math.floor(sceneDuration * 0.55);
  const maxExit = Math.floor(sceneDuration * 0.35);
  const enterFrames = Math.min(maxEnter, 14);
  const exitFrames = Math.min(maxExit, 8);
  const minHold = 3;
  const holdFrames = Math.max(sceneDuration - enterFrames - exitFrames, minHold);
  const exitStart = enterFrames + holdFrames;

  if (frame >= exitStart + exitFrames) return null;

  const isEntering = frame < enterFrames;
  const isExiting = frame >= exitStart;

  let scale = 1;
  let translateY = 0;
  let opacity = 1;

  if (isEntering) {
    const p = frame / enterFrames;
    if (p < 0.65) {
      const ep = p / 0.65;
      scale = interpolate(ep, [0, 1], [0.94, 1.07], { easing: EASE_OUT });
      translateY = interpolate(ep, [0, 1], [24, -4], { easing: EASE_OUT });
    } else {
      const ep = (p - 0.65) / 0.35;
      scale = interpolate(ep, [0, 1], [1.07, 1.0], { easing: EASE_IN_OUT });
      translateY = interpolate(ep, [0, 1], [-4, 0], { easing: EASE_IN_OUT });
    }
    opacity = Math.min(p / 0.35, 1);
  } else if (isExiting) {
    const p = (frame - exitStart) / exitFrames;
    scale = interpolate(p, [0, 1], [1.0, 0.92], { easing: EASE_IN });
    translateY = interpolate(p, [0, 1], [0, 20], { easing: EASE_IN });
    opacity = interpolate(p, [0, 1], [1, 0], { easing: EASE_IN });
  }

  if (opacity < 0.01) return null;

  const maxFontSize = Math.min(stacked ? 120 : 110, HEADLINE_FONT_CAP);
  const { lines, fontSize } = layoutHeadline(words, stacked, maxFontSize);

  return (
    <div
      style={{
        position: "absolute",
        top: HEADLINE_TOP,
        left: SAFE.left,
        right: SAFE.right,
        textAlign: "center",
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.02em",
          lineHeight: 1.1,
        }}
      >
        {lines.map((line, lineIdx) => (
          <span
            key={lineIdx}
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "0.1em",
              lineHeight: 1.1,
            }}
          >
            {line.map((word, i) => {
              const actualIdx = lineIdx === 0 ? i : (words.length === 2 ? 1 : 2);
              const isEmphasis = emphasisWord === actualIdx;

              if (isEmphasis) {
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      position: "relative",
                      padding: "0.04em 0.24em",
                      margin: "0 0.02em",
                      backgroundColor: YELLOW,
                      borderRadius: 8,
                      transform: `translateY(${translateY}px) scale(${scale})`,
                      opacity,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: tokens.fontFamily,
                        fontSize: fontSize,
                        fontWeight: 900,
                        color: "#000000",
                        lineHeight: 1.1,
                        letterSpacing: "0.03em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        display: "inline-block",
                      }}
                    >
                      {word}
                    </span>
                  </span>
                );
              }

              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    fontFamily: tokens.fontFamily,
                    fontSize,
                    fontWeight: 700,
                    color: "#FFFFFF",
                    WebkitTextStroke: `2px #000`,
                    textShadow: "0 0 20px rgba(255,255,255,0.15), 0 2px 8px rgba(0,0,0,0.8)",
                    lineHeight: 1.1,
                    letterSpacing: "0.03em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    margin: "0 0.08em",
                    transform: `translateY(${translateY}px) scale(${scale})`,
                    opacity,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </span>
        ))}
      </span>
    </div>
  );
}

// ─── Scene Graphics ──────────────────────────────────────────────────────────
// Each graphic uses usePhraseFrame() for LOCAL frame math.
// Dynamically sized to scene duration.

function StatPill() {
  const { frame, sceneDuration } = usePhraseFrame();
  const enterFrames = 20;
  const exitFrames = 15;
  const holdFrames = Math.max(sceneDuration - enterFrames - exitFrames, 3);

  if (frame > enterFrames + holdFrames + exitFrames) return null;

  let progress: number;
  if (frame < enterFrames) {
    progress = tween(frame / enterFrames, EASE_OUT);
  } else if (frame < enterFrames + holdFrames) {
    progress = 1;
  } else {
    progress = 1 - tween((frame - enterFrames - holdFrames) / exitFrames, EASE_IN);
  }

  if (progress < 0.01) return null;

  const scale = 0.88 + 0.12 * progress;
  const translateY = (1 - progress) * 20;
  const opacity = progress;

  return (
    <div
      style={{
        position: "absolute",
        // Band B — never band A. The headline owns 36→340; this pill starts
        // 28px below that worst case.
        top: GRAPHIC_BAND_TOP,
        left: "50%",
        transform: `translateX(-50%) translateY(${translateY}px) scale(${scale})`,
        opacity,
        zIndex: 11,
        pointerEvents: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        backgroundColor: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: "10px 20px",
        borderRadius: tokens.radius.md,
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 4L10 16M10 16L5 11M10 16L15 11"
          stroke={tokens.accent}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        style={{
          fontFamily: tokens.fontFamily,
          fontSize: tokens.type.label.size,
          fontWeight: 600,
          color: tokens.captionText,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        30-40% HIGHER
      </span>
    </div>
  );
}

function NegationLine() {
  const { frame, sceneDuration } = usePhraseFrame();
  const enterFrames = 12;
  const exitFrames = 10;
  const holdFrames = Math.max(sceneDuration - enterFrames - exitFrames, 3);
  const total = enterFrames + holdFrames + exitFrames;

  if (frame > total) return null;

  let progress: number;
  if (frame < enterFrames) {
    progress = tween(frame / enterFrames, EASE_OUT);
  } else if (frame < enterFrames + holdFrames) {
    progress = 1;
  } else {
    progress = 1 - tween((frame - enterFrames - holdFrames) / exitFrames, EASE_IN);
  }

  if (progress < 0.01) return null;

  // Band B. This graphic is a short accent rule that sits *under* the
  // headline as a supporting element, so it must live below HEADLINE_BAND_END
  // — the old y (HEADLINE_TOP + 85 = 121) drew a red line straight through
  // the headline text and across the speaker's forehead.
  const yCenter = GRAPHIC_BAND_TOP + 14;
  const xStart = SAFE.left + 80;
  const xEnd = SAFE.left + AVAILABLE_WIDTH - 80;

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 11,
        pointerEvents: "none",
      }}
    >
      <line
        x1={xStart}
        y1={yCenter}
        x2={xStart + (xEnd - xStart) * progress}
        y2={yCenter}
        stroke={RED}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

const CAREER_LEVELS = [
  { label: "ASSOCIATE", year: 0 },
  { label: "MANAGER", year: 3 },
  { label: "SR. MGR", year: 7 },
  { label: "DIRECTOR", year: 11 },
  { label: "VP", year: 13 },
];

function RollingCounter() {
  const { frame, sceneDuration } = usePhraseFrame();
  const enterFrames = 20;
  const exitFrames = 13;
  const holdFrames = Math.max(sceneDuration - enterFrames - exitFrames, 3);

  if (frame > enterFrames + holdFrames + exitFrames) return null;

  let progress: number;
  if (frame < enterFrames) {
    progress = tween(frame / enterFrames, EASE_OUT);
  } else if (frame < enterFrames + holdFrames) {
    progress = 1;
  } else {
    progress = 1 - tween((frame - enterFrames - holdFrames) / exitFrames, EASE_IN);
  }

  if (progress < 0.01) return null;

  const currentValue = Math.round(progress * 13);

  return (
    <span
      style={{
        fontFamily: tokens.fontFamily,
        fontSize: 80,
        fontWeight: 700,
        color: YELLOW,
        WebkitTextStroke: "2px #000",
        textShadow: "0 0 20px rgba(255,229,0,0.3), 0 2px 8px rgba(0,0,0,0.8)",
        lineHeight: 1,
        transform: `scale(${0.9 + 0.1 * progress})`,
        opacity: progress,
        display: "inline-block",
      }}
    >
      {currentValue}
    </span>
  );
}

function CareerTimeline() {
  const { frame, sceneDuration } = usePhraseFrame();
  const enterFrames = 20;
  const exitFrames = 10;
  const holdFrames = Math.max(sceneDuration - enterFrames - exitFrames, 3);

  if (frame > enterFrames + holdFrames + exitFrames) return null;

  let containerOpacity: number;
  if (frame < enterFrames) {
    containerOpacity = tween(frame / enterFrames, EASE_OUT);
  } else if (frame < enterFrames + holdFrames) {
    containerOpacity = 1;
  } else {
    containerOpacity = 1 - tween((frame - enterFrames - holdFrames) / exitFrames, EASE_IN);
  }

  if (containerOpacity < 0.01) return null;

  const viewBoxW = AVAILABLE_WIDTH;
  // 30px of headroom above the bars for the "TOTAL: 13 YRS" row.
  const viewBoxH = 130;
  const barY = 60;
  const barHeight = 8;
  const barX = 40;
  const barWidth = viewBoxW - 80;
  const markerY = barY - 6;
  const markerRadius = 5;

  const counterProgress = Math.min(frame / 50, 1);
  const litLevels = Math.floor(counterProgress * 5);

  return (
    <div
      style={{
        position: "absolute",
        top: GRAPHIC_BAND_TOP,
        left: SAFE.left,
        right: SAFE.right,
        opacity: containerOpacity,
        zIndex: 11,
        pointerEvents: "none",
      }}
    >
      <svg
        width="100%"
        height={viewBoxH}
        viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x={barX} y={barY} width={barWidth} height={barHeight} rx={4} fill="rgba(255,255,255,0.1)" />
        <rect x={barX} y={barY} width={barWidth * Math.min(counterProgress, 1)} height={barHeight} rx={4} fill={tokens.accent} />
        {CAREER_LEVELS.map((level, i) => {
          const x = barX + (barWidth * i) / 4;
          const isLit = i < litLevels;
          return (
            <g key={i}>
              <circle cx={x} cy={markerY + 4} r={markerRadius} fill={isLit ? tokens.accent : "rgba(255,255,255,0.2)"} stroke={isLit ? "#fff" : "none"} strokeWidth="1.5" />
              <text x={x} y={markerY - 8} textAnchor="middle" fill={isLit ? "#FFFFFF" : "rgba(255,255,255,0.35)"} fontSize="11" fontFamily={tokens.fontFamily} fontWeight={isLit ? 600 : 400} letterSpacing="0.05em">{level.label}</text>
              <text x={x} y={markerY + 22} textAnchor="middle" fill={isLit ? tokens.accent : "rgba(255,255,255,0.25)"} fontSize="10" fontFamily={tokens.fontFamily} fontWeight={500}>YR {level.year}</text>
            </g>
          );
        })}
        {/* TOTAL sits on its own row above the level labels, left-anchored so it
            never collides with the final level's tag ("VP / YR 13") which is
            centred on the bar's right edge. */}
        {counterProgress > 0.8 && (
          <text x={barX} y={markerY - 30} textAnchor="start" fill={tokens.accent} fontSize="13" fontFamily={tokens.fontFamily} fontWeight={700} letterSpacing="0.05em">TOTAL: 13 YRS</text>
        )}
      </svg>
    </div>
  );
}

function ComparisonBars() {
  const { frame, sceneDuration } = usePhraseFrame();
  const enterFrames = 25;
  const exitFrames = 20;
  const holdFrames = Math.max(sceneDuration - enterFrames - exitFrames, 3);

  if (frame > enterFrames + holdFrames + exitFrames) return null;

  let opacity: number;
  if (frame < enterFrames) {
    opacity = tween(frame / enterFrames, EASE_OUT);
  } else if (frame < enterFrames + holdFrames) {
    opacity = 1;
  } else {
    opacity = 1 - tween((frame - enterFrames - holdFrames) / exitFrames, EASE_IN);
  }

  if (opacity < 0.01) return null;

  const barAnim = tween(Math.min(frame / 25, 1), EASE_OUT);
  // Extra 30px of headroom below the baseline for the category labels.
  const viewBoxH = 210;
  const barBaseline = 170;
  const barMaxWidth = (AVAILABLE_WIDTH - 160) / 2;
  const barGap = 40;
  const leftWidth = barMaxWidth * 0.42 * barAnim;
  const rightWidth = barMaxWidth * 0.78 * barAnim;
  const leftHeight = barBaseline * 0.5 * barAnim;
  const rightHeight = barBaseline * 0.82 * barAnim;
  const leftX = 80;
  const rightX = 80 + barMaxWidth + barGap;

  return (
    <div
      style={{
        position: "absolute",
        // Band B — below the headline, above the caption band.
        top: GRAPHIC_BAND_TOP,
        left: SAFE.left,
        right: SAFE.right,
        opacity,
        zIndex: 11,
        pointerEvents: "none",
      }}
    >
      <svg width="100%" height={viewBoxH} viewBox={`0 0 ${AVAILABLE_WIDTH} ${viewBoxH}`} preserveAspectRatio="xMidYMid meet">
        {/* Baseline — anchors both bars so they read as one chart, not loose blocks. */}
        <line
          x1={SAFE.left - 20}
          y1={barBaseline}
          x2={SAFE.left + AVAILABLE_WIDTH - 20}
          y2={barBaseline}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Left bar — accent, muted: "similar experience". */}
        <rect x={leftX} y={barBaseline - leftHeight} width={leftWidth} height={leftHeight} rx={8} fill={tokens.accent} opacity={0.45} />
        {/* Right bar — full accent: "much more salary". The height ratio is the story. */}
        <rect x={rightX} y={barBaseline - rightHeight} width={rightWidth} height={rightHeight} rx={8} fill={tokens.accent} />
        {/* Category labels sit BELOW the baseline, never floating above the bars. */}
        <text x={leftX + barMaxWidth / 2} y={barBaseline - leftHeight - 14} textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="13" fontFamily={tokens.fontFamily} fontWeight={700} letterSpacing="0.04em">SIMILAR</text>
        <text x={leftX + barMaxWidth / 2} y={barBaseline + 22} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="12" fontFamily={tokens.fontFamily} fontWeight={500} letterSpacing="0.06em">EXPERIENCE</text>
        <text x={rightX + barMaxWidth / 2} y={barBaseline - rightHeight - 14} textAnchor="middle" fill={tokens.accent} fontSize="16" fontFamily={tokens.fontFamily} fontWeight={700} letterSpacing="0.04em">MUCH FASTER</text>
        <text x={rightX + barMaxWidth / 2} y={barBaseline + 22} textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="12" fontFamily={tokens.fontFamily} fontWeight={600} letterSpacing="0.06em">MOVING AHEAD</text>
      </svg>
    </div>
  );
}

function DividerLine() {
  const { frame, sceneDuration } = usePhraseFrame();
  const enterFrames = 15;
  const exitFrames = 10;
  const holdFrames = Math.max(sceneDuration - enterFrames - exitFrames, 3);

  if (frame > enterFrames + holdFrames + exitFrames) return null;

  let progress: number;
  if (frame < enterFrames) {
    progress = tween(frame / enterFrames, EASE_OUT);
  } else if (frame < enterFrames + holdFrames) {
    progress = 1;
  } else {
    progress = 1 - tween((frame - enterFrames - holdFrames) / exitFrames, EASE_IN);
  }

  if (progress < 0.01) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: HEADLINE_TOP + 28,
        left: SAFE.left + AVAILABLE_WIDTH / 2 - 1,
        width: 2,
        height: 28,
        backgroundColor: `rgba(255,255,255,${0.35 * progress})`,
        zIndex: 11,
        pointerEvents: "none",
        borderRadius: 1,
      }}
    />
  );
}

function FinaleGlow() {
  const { frame } = usePhraseFrame();
  const enterFrames = 5;

  if (frame > enterFrames + 2) return null;

  let progress: number;
  if (frame < enterFrames) {
    progress = tween(frame / enterFrames, EASE_OUT);
  } else {
    progress = 1;
  }

  if (progress < 0.01) return null;

  const pulse = interpolate(Math.sin(frame * 0.15), [-1, 1], [0.12, 0.28]);

  return (
    <div
      style={{
        position: "absolute",
        top: HEADLINE_TOP - 20,
        left: SAFE.left,
        right: SAFE.right,
        height: 100,
        background: `radial-gradient(ellipse at center, rgba(255,77,45,${pulse}) 0%, transparent 70%)`,
        zIndex: 9,
        pointerEvents: "none",
        opacity: progress,
      }}
    />
  );
}

const GRAPHICS: Record<string, React.FC> = {
  "stat-pill": StatPill,
  "negation-line": NegationLine,
  "counter-timeline": () => (
    <>
      <RollingCounter />
      <CareerTimeline />
    </>
  ),
  "comparison-bars": ComparisonBars,
  "divider-line": DividerLine,
  "finale-glow": FinaleGlow,
};

// ─── Caption Bar ─────────────────────────────────────────────────────────────
// Continuous across entire video. Active word highlighted in yellow.

function CaptionBar() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  let activeIdx = -1;
  for (let i = WORDS.length - 1; i >= 0; i--) {
    if (currentMs >= WORDS[i][1]) {
      activeIdx = i;
      break;
    }
  }

  if (activeIdx < 0) return null;

  // Show a 7-word window, but only words already spoken. Each word is gated
  // by its own start time, so the caption never reveals future text.
  const windowWords = WORDS.slice(activeIdx, activeIdx + 7).filter(
    ([, startMs]) => currentMs >= startMs
  );

  if (windowWords.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: SAFE.bottom - 80,
        left: SAFE.left,
        right: SAFE.right,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 10,
        padding: "14px 22px",
        zIndex: 20,
      }}
    >
      {windowWords.map(([word, startMs, endMs]) => {
        // Current = spoken, not yet finished.
        const isCurrentWord = currentMs >= startMs && currentMs <= endMs;

        return (
          <span key={`${startMs}-${word}`} style={{
            fontFamily: tokens.fontFamily,
            fontSize: tokens.type.caption.size,
            fontWeight: isCurrentWord ? 700 : 500,
            color: isCurrentWord ? YELLOW : tokens.captionText,
            opacity: isCurrentWord ? 1 : 0.5,
            textShadow: isCurrentWord
              ? "0 2px 12px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.6)"
              : "0 1px 6px rgba(0,0,0,0.5)",
            lineHeight: tokens.type.caption.lineHeight,
            transform: isCurrentWord ? "scale(1.08)" : "scale(1)",
            display: "inline-block",
            marginRight: "0.25em",
          }}>
            {word}
          </span>
        );
      })}
    </div>
  );
}

// ─── Main Composition ────────────────────────────────────────────────────────
// Architecture:
//   z=1:   VideoLayer (talking head, always running)
//   z=2:   GradientOverlay (dynamic darkening)
//   z=3:   BrollLayer (crossfades in/out per segment, plays exact source window)
//   z=9-11: Phrase graphics (headlines + SVG annotations)
//   z=20:  CaptionBar (continuous)
//
// When B-roll files are NOT present, BrollLayer returns null silently.
// The talking head + gradient + text work identically.

export default function CorporateCareerGrowthAmanaPremium916() {
  return (
    <AbsoluteFill>
      {/* Talking head — always running */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <VideoLayer />
      </Sequence>

      {/* Gradient overlay — always running */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <GradientOverlay />
      </Sequence>

      {/* B-roll crossfades — only active where manifest entries exist */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <BrollLayer />
      </Sequence>

      {/* Each phrase: headline + graphic in local frame */}
      {PHRASES.map((phrase, i) => (
        <Sequence key={i} from={phrase.from} durationInFrames={phrase.to - phrase.from}>
          <PhraseProvider phraseFrom={phrase.from} phraseTo={phrase.to}>
            <PhraseHeadline
              words={phrase.words}
              emphasisWord={phrase.emphasisWord}
              stacked={phrase.stacked}
            />
            {(() => { const G = GRAPHICS[phrase.graphic]; return G ? <G /> : null; })()}
          </PhraseProvider>
        </Sequence>
      ))}

      {/* Captions — global, absolute frame */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <CaptionBar />
      </Sequence>

      {/* Audio */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <Audio
          src={staticFile("projects/corporate-career-growth-amana/sfx.wav")}
          volume={0.5}
        />
      </Sequence>
    </AbsoluteFill>
  );
}

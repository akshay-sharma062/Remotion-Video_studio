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
  delayRender,
} from "remotion";
import { EASE_IN, EASE_OUT, EASE_IN_OUT, OPACITY_LEAD } from "../../design/motion";
import { tokens } from "../../design/tokens";
import WORDS from "../../videos/corporate-career-growth-amana/words.generated";

const TOTAL_FRAMES = 513;
const FPS = 23.976;

const SAFE = { top: 250, bottom: 380, left: 80, right: 80 };
const HEADLINE_TOP = 36; // px from top edge — within top safe zone (250px), well above face (~290px+)
const AVAILABLE_WIDTH = 1080 - SAFE.left - SAFE.right; // 920px
const CAPTION_WINDOW = 7; // words kept in the caption bar

// Canvas-based font size measurement — avoids guesswork from avgCharWidth.
// Height the headline block is allowed to occupy. The top safe zone is 250px,
// so a stacked headline must sit entirely inside it — font size is capped by
// height as well as width.
const HEADLINE_HEIGHT = SAFE.top - HEADLINE_TOP - 20; // 250 - 36 - 20 = 194px

function maxFontSizeFor(words: string[], maxSize: number, lines: number): number {
  // Measured cap-height ratio for Inter Black at 1080px canvas: ~0.56 of fontSize per unit character
  // Plus 0.04em letter-spacing accounts for ~0.04 * fontSize * (wordLen - 1) overhead
  const heightCap = Math.floor(HEADLINE_HEIGHT / (lines * 1.2));
  const cap = Math.min(maxSize, heightCap);
  let lo = 8;
  let hi = cap;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const fits = words.every((w) => {
      const charWidth = mid * 0.56;
      const letterSpacing = mid * 0.04 * (w.length - 1);
      return w.length * charWidth + letterSpacing <= AVAILABLE_WIDTH * 0.88;
    });
    if (fits) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// Phrase definitions — derived from canonical transcript.json word timings.
// stacked: true = two-line layout for longer phrases
// emphasisWord: index of word to highlight (-1 = none)
// Word indices reference words.generated.ts (68 words, indices 0-67).
// All timings in frames at 23.976fps, derived from transcript word start/end_ms.
const PHRASES = [
  // Word [16-17] "significantly" (104f) → "more" (118f) — editorial slam
  { text: "SIGNIFICANTLY\nMORE", words: ["SIGNIFICANTLY", "MORE"], from: 104, to: 122, emphasisWord: 0, stacked: true },
  // Word [27-28] "more" (175f) → "talented." (204f) — editorial slam
  { text: "MORE\nTALENTED", words: ["MORE", "TALENTED"], from: 175, to: 208, emphasisWord: -1, stacked: true },
  // Word [36-37] "13" (253f) → "years" (268f) — key stat
  { text: "13 YEARS", words: ["13", "YEARS"], from: 253, to: 272, emphasisWord: 0, stacked: false },
  // Word [50-52] "much" (374f) → "salary" (420f) — editorial: "SALARY"
  // Word [52] is "selfie." per faster-whisper; contextually "salary" per user.
  // Emphasis on "SALARY" (word index 2) — the key takeaway.
  { text: "MUCH MORE\nSALARY", words: ["MUCH", "MORE", "SALARY"], from: 374, to: 424, emphasisWord: 2, stacked: true },
  // Word [60-62] "talent" (456f) → "skills," (475f) — key message
  { text: "TALENT OR\nSKILLS", words: ["TALENT", "OR", "SKILLS"], from: 456, to: 494, emphasisWord: -1, stacked: true },
  // Word [67] "position." (498f-507f) — closing key word
  { text: "POSITION", words: ["POSITION"], from: 498, to: 513, emphasisWord: 0, stacked: false },
];

// ─── Phrase Headline ───────────────────────────────────────────────────────
// Phrase-based kinetic headline with overshoot entrance.
// Entire phrase enters as one unit, stays stable, then exits.
// Key words get yellow highlight with black text.
function PhraseHeadline({
  words,
  phraseFrom,
  phraseTo,
  emphasisWord,
  stacked,
}: {
  words: string[];
  phraseFrom: number;
  phraseTo: number;
  emphasisWord: number;
  stacked: boolean;
}) {
  const frame = useCurrentFrame();
  const localFrame = frame;

  const sceneDuration = phraseTo - phraseFrom;

  // Word-by-word entrance (motion law 8: groups always stagger). Flatten to
  // on-screen order so the stagger reads top-to-bottom, left-to-right.
  const lines: string[][] = stacked
    ? words.length === 2
      ? [words.slice(0, 1), words.slice(1)]
      : words.length === 3
        ? [words.slice(0, 2), words.slice(2)]
        : [words]
    : [words];

  const fontSize = maxFontSizeFor(words, stacked ? 140 : 120, lines.length);

  const flat: Array<{ lineIdx: number; wordIdx: number }> = [];
  lines.forEach((line, lineIdx) => {
    line.forEach((_, wordIdx) => {
      flat.push({ lineIdx, wordIdx });
    });
  });
  const STAGGER = 5; // frames between word entrances (~208ms)
  const ENTER = 16; // per-word entrance duration
  const EXIT = Math.round(ENTER * 0.65); // motion law 3: exit = entrance × 0.65
  const settleFrames = 7;

  // A short scene cannot hold a full staggered entrance plus a hold plus an
  // exit. Shrink the stagger and entrance first (the words still read as a
  // group arriving in order), then trim the hold, and only as a last resort
  // compress the exit.
  const needed = flat.length * STAGGER + ENTER + settleFrames + EXIT;
  let stagger = STAGGER;
  let enter = ENTER;
  let exitFrames = EXIT;
  if (needed > sceneDuration) {
    stagger = 3;
    enter = 10;
    exitFrames = 7;
  }

  const lastWordIn = flat.length * stagger + enter + settleFrames;
  const exitStart = Math.min(
    Math.max(sceneDuration - exitFrames, lastWordIn),
    sceneDuration - 1
  );
  exitFrames = Math.min(exitFrames, sceneDuration - exitStart);

  if (localFrame >= exitStart + exitFrames) return null;

  const isExiting = localFrame >= exitStart;

  const lineElements = lines.map((line, lineIdx) => {
    const wordElements = line.map((word, i) => {
      const flatIdx = flat.findIndex((f) => f.lineIdx === lineIdx && f.wordIdx === i);

      let scale = 1;
      let translateY = 0;
      let opacity = 1;
      let blur = 0;

      if (!isExiting) {
        // Per-word staggered entrance: rise + scale + fade, then settle.
        const p = (localFrame - flatIdx * stagger) / enter;
        if (p <= 0) {
          opacity = 0;
          scale = 0.8;
          translateY = 30;
        } else if (p < 1) {
          // Opacity leads and reaches full at 60% of the move (motion law 5);
          // scale and travel continue to the end so opacity never moves alone.
          const opP = Math.min(p / OPACITY_LEAD, 1);
          const ep = EASE_OUT(p);
          scale = interpolate(ep, [0, 1], [0.8, 1.06]);
          translateY = interpolate(ep, [0, 1], [30, -4]);
          opacity = EASE_OUT(opP);
          blur = (1 - p) * 12;
        } else {
          // Settle back from the overshoot.
          const sp = Math.min((p - 1) / 0.4, 1);
          scale = interpolate(EASE_IN_OUT(sp), [0, 1], [1.06, 1]);
          translateY = interpolate(EASE_IN_OUT(sp), [0, 1], [-4, 0]);
          opacity = 1;
        }
      } else {
        // Whole phrase exits together — continuity, no staggered exit.
        const p = (localFrame - exitStart) / exitFrames;
        const ep = EASE_IN(p);
        scale = interpolate(ep, [0, 1], [1.0, 0.88]);
        translateY = interpolate(ep, [0, 1], [0, 25]);
        // Opacity leaves slightly later than the travel so it never moves alone.
        const opP = Math.max((p - 0.25) / 0.75, 0);
        opacity = interpolate(EASE_IN(opP), [0, 1], [1, 0]);
      }

      if (opacity < 0.01) return null;

      // Offset of this line within the phrase's word list. 3-word phrases split
      // 2+1, so line 1 starts at word index 2 regardless of its own length.
      const lineOffset = lineIdx === 0 ? 0 : lines[0].length;
      const isEmphasis = emphasisWord === lineOffset + i;

      if (isEmphasis) {
        // Yellow highlight with black text — contained within word bounds
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              position: "relative",
              padding: "0.05em 0.25em",
              margin: "0 0.02em",
              backgroundColor: "#FFE500",
              borderRadius: 8,
              transform: `translateY(${translateY}px) scale(${scale})`,
              filter: blur > 0.5 ? `blur(${blur.toFixed(1)}px)` : "none",
              opacity,
            }}
          >
            <span
              style={{
                fontFamily: tokens.fontFamily,
                fontSize: fontSize * 1.0,
                fontWeight: 900,
                color: "#000000",
                textShadow: "none",
                lineHeight: 1.2,
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

      // Normal word: white with black stroke
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
            lineHeight: 1.2,
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            margin: "0 0.04em",
            transform: `translateY(${translateY}px) scale(${scale})`,
            filter: blur > 0.5 ? `blur(${blur.toFixed(1)}px)` : "none",
            opacity,
          }}
        >
          {word}
        </span>
      );
    });

    return (
      <span
        key={lineIdx}
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "0.06em",
          lineHeight: 1.2,
        }}
      >
        {wordElements}
      </span>
    );
  });

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
          gap: stacked ? "0.03em" : "0",
          lineHeight: 1.2,
        }}
      >
        {lineElements}
      </span>
    </div>
  );
}

// ─── Caption Bar ────────────────────────────────────────────────────────────
// Continuous across entire video. Active word highlighted in yellow.
function CaptionBar() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  // The word currently being spoken is the last one whose start has passed.
  let activeIdx = -1;
  for (let i = WORDS.length - 1; i >= 0; i--) {
    if (currentMs >= WORDS[i][1]) {
      activeIdx = i;
      break;
    }
  }

  if (activeIdx < 0) return null;

  // Backward-looking window: the current word plus the CAPTION_WINDOW-1 words
  // before it. Nothing unspoken is ever shown.
  const from = Math.max(0, activeIdx - (CAPTION_WINDOW - 1));
  const windowWords = WORDS.slice(from, activeIdx + 1);
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
      {windowWords.map(([word], i) => {
        const isCurrent = i === windowWords.length - 1;

        return (
          <span
            key={activeIdx + i}
            style={{
              fontFamily: tokens.fontFamily,
              fontSize: tokens.type.caption.size,
              fontWeight: isCurrent ? 700 : 500,
              color: isCurrent ? "#FFE500" : tokens.captionText,
              opacity: isCurrent ? 1 : 0.6,
              textShadow: isCurrent
                ? "0 2px 12px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.6)"
                : "0 1px 6px rgba(0,0,0,0.5)",
              lineHeight: tokens.type.caption.lineHeight,
              transform: isCurrent ? "scale(1.08)" : "scale(1)",
              display: "inline-block",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

// ─── Video Layer ──────────────────────────────────────────────────────────
function VideoLayer() {
  const frame = useCurrentFrame();

  const slowZoom = interpolate(frame, [0, TOTAL_FRAMES], [1.0, 1.06], {
    easing: EASE_OUT,
  });

  const emphasisPunch = interpolate(
    frame,
    [340, 360, 400],
    [0, 0.04, 0],
    { easing: EASE_IN_OUT }
  );

  const scale = slowZoom + emphasisPunch;

  const videoSrc = staticFile(
    "projects/corporate-career-growth-amana/footage/testing-video.mp4"
  );

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
        src={videoSrc}
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

// ─── Main Composition ───────────────────────────────────────────────────────
export default function CorporateCareerGrowthAmana() {
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <VideoLayer />
      </Sequence>

      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <Audio
          src={staticFile(
            "projects/corporate-career-growth-amana/sfx.wav"
          )}
          volume={0.5}
        />
      </Sequence>

      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <CaptionBar />
      </Sequence>

      {PHRASES.map((phrase, i) => (
        <Sequence
          key={i}
          from={phrase.from}
          durationInFrames={phrase.to - phrase.from}
        >
          <PhraseHeadline
            words={phrase.words}
            phraseFrom={phrase.from}
            phraseTo={phrase.to}
            emphasisWord={phrase.emphasisWord}
            stacked={phrase.stacked}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

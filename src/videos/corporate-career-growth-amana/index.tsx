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
import { EASE_IN, EASE_OUT, EASE_IN_OUT } from "../../design/motion";
import { tokens } from "../../design/tokens";
import WORDS from "../../videos/corporate-career-growth-amana/words.generated";

const TOTAL_FRAMES = 513;
const FPS = 23.976;

const SAFE = { top: 250, bottom: 380, left: 80, right: 80 };
const HEADLINE_TOP = 36; // px from top edge — within top safe zone (250px), well above face (~290px+)
const AVAILABLE_WIDTH = 1080 - SAFE.left - SAFE.right; // 920px

// Phrase definitions — derived from canonical transcript.json word timings.
// stacked: true = two-line layout for longer phrases
// emphasisWord: index of word to highlight (-1 = none)
// Word indices reference words.generated.ts (68 words, indices 0-67).
// All timings in frames at 23.976fps, derived from transcript word start/end_ms.
const PHRASES = [
  // Word [16-17] "significantly" (91f) → "more" (114f) — editorial slam
  { text: "SIGNIFICANTLY\nMORE", words: ["SIGNIFICANTLY", "MORE"], from: 91, to: 122, emphasisWord: 0, stacked: true },
  // Word [27-28] "more" (170f) → "talented." (180f) — editorial slam
  { text: "MORE\nTALENTED", words: ["MORE", "TALENTED"], from: 170, to: 192, emphasisWord: -1, stacked: true },
  // Word [36-37] "13" (243f) → "years" (258f) — key stat
  { text: "13 YEARS", words: ["13", "YEARS"], from: 243, to: 266, emphasisWord: 0, stacked: false },
  // Word [50-52] "much" (360f) → "selfie." (386f) — editorial: "SALARY"
  // Word [52] is "selfie." per faster-whisper; contextually "salary" per user.
  // Emphasis on "SALARY" (word index 2) — the key takeaway.
  { text: "MUCH MORE\nSALARY", words: ["MUCH", "MORE", "SALARY"], from: 360, to: 395, emphasisWord: 2, stacked: true },
  // Word [60-62] "talent" (450f) → "skills," (466f) — key message
  { text: "TALENT OR\nSKILLS", words: ["TALENT", "OR", "SKILLS"], from: 450, to: 474, emphasisWord: -1, stacked: true },
  // Word [68] "positioning." (499f-508f) — closing key word
  { text: "POSITIONING", words: ["POSITIONING"], from: 499, to: 513, emphasisWord: 0, stacked: false },
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
  const enterFrames = 14;
  const exitFrames = 8;
  const exitStart = sceneDuration - exitFrames;

  if (localFrame >= exitStart + exitFrames) return null;

  const isEntering = localFrame < enterFrames;
  const isExiting = localFrame >= exitStart;

  let scale = 1;
  let translateY = 0;
  let opacity = 1;

  if (isEntering) {
    const p = localFrame / enterFrames;
    if (p < 0.65) {
      const ep = p / 0.65;
      scale = interpolate(ep, [0, 1], [0.88, 1.07], { easing: EASE_OUT });
      translateY = interpolate(ep, [0, 1], [36, -5], { easing: EASE_OUT });
    } else {
      const ep = (p - 0.65) / 0.35;
      scale = interpolate(ep, [0, 1], [1.07, 1.0], { easing: EASE_IN_OUT });
      translateY = interpolate(ep, [0, 1], [-5, 0], { easing: EASE_IN_OUT });
    }
    opacity = Math.min(p / 0.35, 1);
  } else if (isExiting) {
    const p = (localFrame - exitStart) / exitFrames;
    scale = interpolate(p, [0, 1], [1.0, 0.88], { easing: EASE_IN });
    translateY = interpolate(p, [0, 1], [0, 25], { easing: EASE_IN });
    opacity = interpolate(p, [0, 1], [1, 0], { easing: EASE_IN });
  }

  if (opacity < 0.01) return null;

  // Calculate font size to fit within safe width
  // For stacked: each line max ~AVAILABLE_WIDTH
  // For single line: total width must fit
  const maxFontSize = stacked ? 140 : 120;
  const testFontSize = (word: string) => {
    // Approximate character width for Inter Bold at various sizes
    // Inter Bold average char width ≈ 0.58 of font size for uppercase
    const avgCharWidth = 0.58;
    const wordWidth = word.length * maxFontSize * avgCharWidth;
    if (wordWidth > AVAILABLE_WIDTH * 0.85) {
      return Math.floor((AVAILABLE_WIDTH * 0.85) / (word.length * avgCharWidth));
    }
    return maxFontSize;
  };

  const fontSize = testFontSize(words.reduce((a, w) => a.length > w.length ? a : w, ""));

  // Build lines for stacked layout
  const lines: string[][] = stacked
    ? words.length === 2
      ? [words.slice(0, 1), words.slice(1)]
      : words.length === 3
        ? [words.slice(0, 2), words.slice(2)]
        : [words]
    : [words];

  const lineElements = lines.map((line, lineIdx) => {
    const wordElements = line.map((word, i) => {
      // Calculate actual index in words array
      const actualIdx = stacked
        ? (lineIdx === 0 ? i : (words.length === 2 ? 1 : 2))
        : i;
      const isEmphasis = emphasisWord === actualIdx;

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

  let activeIdx = -1;
  for (let i = WORDS.length - 1; i >= 0; i--) {
    if (currentMs >= WORDS[i][1]) {
      activeIdx = i;
      break;
    }
  }

  if (activeIdx < 0) return null;

  const windowWords = WORDS.slice(activeIdx, activeIdx + 7);

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
        const isCurrent = i === 0;

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

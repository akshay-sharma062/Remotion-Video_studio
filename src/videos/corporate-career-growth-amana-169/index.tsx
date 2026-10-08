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

// 16:9 safe zones (from tokens)
const SAFE = { top: 40, bottom: 40, left: 40, right: 40 };
const AVAILABLE_WIDTH = 1920 - SAFE.left - SAFE.right; // 1840px

// Phrase definitions — IDENTICAL timing to 9:16
const PHRASES = [
  { text: "SIGNIFICANTLY\nMORE", words: ["SIGNIFICANTLY", "MORE"], from: 87, to: 121, emphasisWord: 0, stacked: true },
  { text: "MORE\nTALENTED", words: ["MORE", "TALENTED"], from: 166, to: 188, emphasisWord: -1, stacked: true },
  { text: "13 YEARS", words: ["13", "YEARS"], from: 239, to: 266, emphasisWord: 0, stacked: false },
  { text: "MUCH MORE\nSALARY", words: ["MUCH", "MORE", "SALARY"], from: 356, to: 394, emphasisWord: 2, stacked: true },
  { text: "TALENT OR\nSKILLS", words: ["TALENT", "OR", "SKILLS"], from: 445, to: 474, emphasisWord: -1, stacked: true },
  { text: "POSITION", words: ["POSITION"], from: 494, to: 513, emphasisWord: 0, stacked: false },
];

// ─── Top Gradient Overlay ──────────────────────────────────────────────────
// Creates a dark-to-transparent gradient at the top of the frame,
// providing guaranteed clear space for the headline regardless of
// video content. Fades out around y:280 to keep the speaker visible.
function TopGradient() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 280,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0) 100%)",
        zIndex: 2,
        pointerEvents: "none",
      }}
    />
  );
}

// ─── Phrase Headline ───────────────────────────────────────────────────────
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

  // 16:9 headline type scale — impactful size with gradient overlay for readability
  const maxFontSize = stacked ? 90 : 100;
  const testFontSize = (word: string) => {
    const avgCharWidth = 0.58;
    const wordWidth = word.length * maxFontSize * avgCharWidth;
    if (wordWidth > AVAILABLE_WIDTH * 0.85) {
      return Math.floor((AVAILABLE_WIDTH * 0.85) / (word.length * avgCharWidth));
    }
    return maxFontSize;
  };

  const fontSize = testFontSize(words.reduce((a, w) => a.length > w.length ? a : w, ""));

  const lines: string[][] = stacked
    ? words.length === 2
      ? [words.slice(0, 1), words.slice(1)]
      : words.length === 3
        ? [words.slice(0, 2), words.slice(2)]
        : [words]
    : [words];

  const lineElements = lines.map((line, lineIdx) => {
    const wordElements = line.map((word, i) => {
      const actualIdx = stacked
        ? (lineIdx === 0 ? i : (words.length === 2 ? 1 : 2))
        : i;
      const isEmphasis = emphasisWord === actualIdx;

      if (isEmphasis) {
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
        top: 50,
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
        bottom: 80,
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
              fontSize: tokens.type16x9.caption.size,
              fontWeight: isCurrent ? 700 : 500,
              color: isCurrent ? "#FFE500" : tokens.captionText,
              opacity: isCurrent ? 1 : 0.6,
              textShadow: isCurrent
                ? "0 2px 12px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.6)"
                : "0 1px 6px rgba(0,0,0,0.5)",
              lineHeight: tokens.type16x9.caption.lineHeight,
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
// Source is 1080x1920 (portrait). Canvas is 1920x1080 (landscape).
// The video renders at native size (1080x1920), centered in the frame.
// objectFit:fill stretches it to fill the landscape canvas width,
// so the speaker fills the wide frame. The container's scale
// transform provides the slow zoom-in effect.
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
    "projects/corporate-career-growth-amana/footage/testing-video-169.mp4"
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
          objectFit: "fill",
        }}
      />
    </div>
  );
}

// ─── Main Composition ───────────────────────────────────────────────────────
export default function CorporateCareerGrowthAmana169() {
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

      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <TopGradient />
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

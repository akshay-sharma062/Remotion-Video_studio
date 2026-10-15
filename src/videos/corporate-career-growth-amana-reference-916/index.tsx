/**
 * CorporateCareerGrowthAmana-Reference-916 — corrected foundation.
 *
 * TIMING FOUNDATION (v2 — corrected):
 *   - Captions: derived from words.generated.ts (canonical transcript.json)
 *   - Every caption word matches the actual spoken transcript
 *   - Reference headlines are visual only — never mixed with captions
 *   - SFX: sfx.wav (the only audio asset on disk) as continuous mix
 *
 * VISUAL LAYERS (Phase 8 — minimal until foundation passes):
 *   - VideoLayer: raw footage, slow zoom + emphasis punch
 *   - CaptionBar: word-by-word from transcript timestamps
 *   - ReferenceHeadline: editorial slam text (visual, not spoken)
 *
 * Composition ID: CorporateCareerGrowthAmana-Reference-916
 * Registered in Root.tsx
 */

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
import { EASE_IN, EASE_OUT, EASE_IN_OUT } from "../../design/motion";
import { tokens } from "../../design/tokens";
import WORDS from "../../videos/corporate-career-growth-amana/words.generated";

// ─── Constants ──────────────────────────────────────────────────────────────

const TOTAL_FRAMES = 513;
const FPS = 23.976;

// 9:16 safe zones
const SAFE = { top: 250, bottom: 380, left: 80, right: 80 };
const AVAILABLE_WIDTH = 1080 - SAFE.left - SAFE.right; // 920px

// Caption position: bottom safe zone
const CAPTION_BOTTOM = 1490; // y position for captions

// ─── Reference headline definitions ─────────────────────────────────────────
// These are VISUAL GRAPHICS only — they do NOT represent spoken words.
// They are editorial treatments inspired by the reference clip's style.
// Timing is mapped to SEMANTIC moments in the corporate speech, NOT
// blindly copied from reference timestamps.

const REF_HEADLINES = [
  // Scene 1: "SIGNIFICANTLY MORE" — maps to words [16-17] "significantly" → "more"
  {
    text: "SIGNIFICANTLY\nMORE",
    from: 91,   // frame where "significantly" starts (word[16])
    to: 122,    // frame where "more" ends (word[17])
    emphasisWord: 0, // highlight "SIGNIFICANTLY"
    stacked: true,
  },
  // Scene 2: "MORE TALENTED" — maps to words [27-28] "more" → "talented."
  {
    text: "MORE\nTALENTED",
    from: 170,  // frame where "more" starts (word[27])
    to: 192,   // frame where "talented." ends (word[28])
    emphasisWord: -1,
    stacked: true,
  },
  // Scene 3: "13 YEARS" — maps to words [36-37] "13" → "years"
  {
    text: "13 YEARS",
    from: 243,  // frame where "13" starts (word[36])
    to: 266,   // frame where "years" ends (word[37])
    emphasisWord: 0,
    stacked: false,
  },
  // Scene 4: "MUCH MORE SALARY" — maps to words [50-52] "much" → "salary"
  // Note: word[52] is "salary" (corrected from "selfie." in transcript.json)
  {
    text: "MUCH MORE\nSALARY",
    from: 360,  // frame where "much" starts (word[50])
    to: 395,   // frame where "salary" ends (word[52])
    emphasisWord: 2,
    stacked: true,
  },
  // Scene 5: "TALENT OR SKILLS" — maps to words [60-62] "talent" → "skills,"
  {
    text: "TALENT OR\nSKILLS",
    from: 450,  // frame where "talent" starts (word[60])
    to: 474,   // frame where "skills," ends (word[62])
    emphasisWord: -1,
    stacked: true,
  },
  // Scene 6: "POSITIONING" — maps to word[67] "positioning."
  {
    text: "POSITIONING",
    from: 499,  // frame where "positioning." starts (word[67])
    to: 513,   // end of video
    emphasisWord: 0,
    stacked: false,
  },
];

// ─── Sub-Components ─────────────────────────────────────────────────────────

/**
 * CaptionBar — REAL word-by-word captions from transcript timestamps.
 *
 * CRITICAL RULES:
 * - Every word comes from WORDS (words.generated.ts)
 * - Active word = the one currently being spoken
 * - 7-word rolling window from active word
 * - Positioned in bottom safe zone (y:1490+)
 * - NEVER shows reference headline text
 * - NEVER shows words before they are spoken
 */
function CaptionBar() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  // Find the currently active word index
  let activeIdx = -1;
  for (let i = WORDS.length - 1; i >= 0; i--) {
    if (currentMs >= WORDS[i][1]) {
      activeIdx = i;
      break;
    }
  }

  if (activeIdx < 0) return null;

  // Rolling 7-word window starting from active word
  const windowWords = WORDS.slice(activeIdx, activeIdx + 7);

  return (
    <div
      style={{
        position: "absolute",
        bottom: CAPTION_BOTTOM,
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
            key={`${activeIdx}-${i}`}
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

/**
 * ReferenceHeadline — editorial slam text from the reference treatment.
 *
 * These are VISUAL GRAPHICS only. They are NOT spoken captions.
 * They reinforce key concepts the speaker is saying at that moment.
 *
 * Styling: yellow fill + black stroke, overshoot entrance, exit fade.
 */
function ReferenceHeadline({
  text,
  phraseFrom,
  phraseTo,
  emphasisWord,
  stacked,
}: {
  text: string;
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
  const maxFontSize = stacked ? 140 : 120;
  const testFontSize = (word: string) => {
    const avgCharWidth = 0.58;
    const wordWidth = word.length * maxFontSize * avgCharWidth;
    if (wordWidth > AVAILABLE_WIDTH * 0.85) {
      return Math.floor((AVAILABLE_WIDTH * 0.85) / (word.length * avgCharWidth));
    }
    return maxFontSize;
  };

  const fontSize = testFontSize(text.replace("\n", "").split(" ").reduce((a, w) => a.length > w.length ? a : w, ""));

  // Build lines for stacked layout
  const lines = text.split("\n");

  const lineElements = lines.map((line, lineIdx) => {
    const words = line.split(" ");
    const wordElements = words.map((word, i) => {
      // Calculate actual index in the full words array
      const actualIdx = stacked
        ? (lineIdx === 0 ? i : (lines.length === 2 ? 1 : 2))
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
        top: 36, // HEADLINE_TOP — well within top safe zone (250px)
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

/**
 * VideoLayer — raw footage with slow zoom and emphasis punch.
 */
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
        poster={
          frame === 0
            ? staticFile(
                "projects/corporate-career-growth-amana/footage/first-frame.jpg"
              )
            : undefined
        }
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

export default function CorporateCareerGrowthAmanaReference() {
  return (
    <AbsoluteFill>
      {/* Layer 1: Raw video with slow zoom */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <VideoLayer />
      </Sequence>

      {/* Layer 2: Real captions from transcript — full duration */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <CaptionBar />
      </Sequence>

      {/* Layer 3: Reference-style headlines — mapped to semantic speech moments */}
      {REF_HEADLINES.map((headline, i) => (
        <Sequence
          key={i}
          from={headline.from}
          durationInFrames={headline.to - headline.from}
        >
          <ReferenceHeadline
            text={headline.text}
            phraseFrom={headline.from}
            phraseTo={headline.to}
            emphasisWord={headline.emphasisWord}
            stacked={headline.stacked}
          />
        </Sequence>
      ))}

      {/* Layer 4: Audio — sfx.wav is the only audio asset on disk */}
      {/* It plays as a continuous mix underneath the video's embedded voice */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <Audio
          src={staticFile(
            "projects/corporate-career-growth-amana/sfx.wav"
          )}
          volume={0.5}
        />
      </Sequence>
    </AbsoluteFill>
  );
}

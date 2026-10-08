import React from "react";
import {
  AbsoluteFill,
  staticFile,
  Video,
  Sequence,
  Audio,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { EASE_IN, EASE_OUT, EASE_IN_OUT } from "../../design/motion";
import { tokens } from "../../design/tokens";
import WORDS from "../../videos/corporate-career-growth-amana/words.generated";

const TOTAL_FRAMES = 513;
const FPS = 23.976;

const SAFE = { top: 250, bottom: 380, left: 80, right: 80 };
const HEADLINE_TOP = 36;
const AVAILABLE_WIDTH = 1080 - SAFE.left - SAFE.right;

// ─── SAFE-ZONE-AWARE WORDS (never faces, never bodies) ───────────────────
// Derived from canonical transcript.json word timings (ms → frames at 23.976fps).
// Phrases are anchored to TOP safe zone (Y=70-360) — never over face (Y=440-950).
// Word indices reference words.generated.ts (68 words, indices 0-68).

// Scene 1: "There are people who have almost the same experience" → SLAM: SIGNIFICANTLY MORE
// Word [16] "significantly" starts frame 91, word [17] "more" ends frame 114
// Headline enters from frame 91, holds, exits by frame 122
const SCENE_1_FROM = 91;
const SCENE_1_TO = 122;

// Scene 2: "you have, but they are not being" → SLAM: MORE TALENTED
// Word [27] "more" starts frame 170, word [28] "talented." ends frame 180
const SCENE_2_FROM = 170;
const SCENE_2_TO = 192;

// Scene 3: "Hi, I am Aman. I have worked" → SLAM: 13 YEARS
// Word [36] "13" starts frame 243, word [37] "years" ends frame 258
const SCENE_3_FROM = 243;
const SCENE_3_TO = 266;

// Scene 4: "much more selfie." → SLAM: MUCH MORE SALARY (selfie → salary editorial)
// Word [50] "much" starts frame 360, word [52] "selfie." ends frame 386
// HIGHLIGHT "PAYING" on "much" moment → Yellow word punch
const SCENE_4_FROM = 360;
const SCENE_4_TO = 395;
const SCENE_4_HIGHLIGHT_WORD = "much";  // Yellow highlight on key word
const SCENE_4_HIGHLIGHT_FRAME = 374;    // Frame where "much" is active

// Scene 5: "talent or skills, the difference is" → SLAM: TALENT OR SKILLS
// Word [60] "talent" starts frame 450, word [62] "skills," ends frame 466
const SCENE_5_FROM = 450;
const SCENE_5_TO = 474;

// Scene 6: "in their positioning." → SLAM: POSITION
// Word [68] "positioning." starts frame 499
const SCENE_6_FROM = 499;
const SCENE_6_TO = 513;

// B-ROLL MOMENT: Dubai aerial treatment
// Word [49] "getting" at frame 341 → B-roll during "getting much more..."
// Zoom-through at frame 340, B-roll holds through frame 356
const BROLL_FROM = 340;
const BROLL_TO = 360;

// GRAPHIC MOMENTS
// "YOUR PROFILE" cartoon overlay → during "I have seen people..."
// Word [45] "people" starts frame 305 → graphic from 300 to 340
const GFX_PROFILE_FROM = 300;
const GFX_PROFILE_TO = 340;

// COMPARISON DIAGRAM → during "the difference is not in their talent or skills"
const GFX_DIAGRAM_FROM = 423;
const GFX_DIAGRAM_TO = 450;

// CLOSING: LAND + ENTIRE SYSTEM
// Word [53] "And" starts frame 416
const CLOSING_1_FROM = 416;
const CLOSING_1_TO = 450;

// CLOSING: REGISTER NOW
// Word [63] "the" starts frame 473
const CLOSING_2_FROM = 473;
const CLOSING_2_TO = 513;

// ─── SAFE-ZONE BOUNDING BOX ───────────────────────────────────────────────
// TOP: x=54-1026, y=70-360 (measured from raw frames, clear of face at Y=440+)
// BOTTOM: x=54-1026, y=1490-1830 (for captions only)
// FACE PROTECTED: y=440-950
// BODY PROTECTED: y=950-1450

function Headline({ text, sceneFrom, sceneTo, emphasisWordIdx = -1, stacked = false }: {
  text: string;
  sceneFrom: number;
  sceneTo: number;
  emphasisWordIdx?: number;
  stacked?: boolean;
}) {
  const frame = useCurrentFrame();
  const localFrame = frame - sceneFrom;
  const sceneDuration = sceneTo - sceneFrom;

  if (localFrame < 0 || localFrame >= sceneDuration) return null;

  const ENTER_FRAMES = 16;
  const EXIT_FRAMES = 10;
  const EXIT_START = sceneDuration - EXIT_FRAMES;
  const isEntering = localFrame < ENTER_FRAMES;
  const isExiting = localFrame >= EXIT_START;

  let scale = 1;
  let translateY = 0;
  let opacity = 1;

  if (isEntering) {
    const p = localFrame / ENTER_FRAMES;
    if (p < 0.6) {
      const ep = p / 0.6;
      scale = interpolate(ep, [0, 1], [0.82, 1.08], { easing: EASE_OUT });
      translateY = interpolate(ep, [0, 1], [40, -4], { easing: EASE_OUT });
    } else {
      const ep = (p - 0.6) / 0.4;
      scale = interpolate(ep, [0, 1], [1.08, 1.0], { easing: EASE_IN_OUT });
      translateY = interpolate(ep, [0, 1], [-4, 0], { easing: EASE_IN_OUT });
    }
    opacity = Math.min(p / 0.4, 1);
  } else if (isExiting) {
    const p = (localFrame - EXIT_START) / EXIT_FRAMES;
    scale = interpolate(p, [0, 1], [1.0, 0.85], { easing: EASE_IN });
    translateY = interpolate(p, [0, 1], [0, 30], { easing: EASE_IN });
    opacity = interpolate(p, [0, 1], [1, 0], { easing: EASE_IN });
  }

  if (opacity < 0.01) return null;

  // Font sizing: stays within safe width
  const MAX_FONT = stacked ? 130 : 120;
  const AVG_CHAR = 0.58;
  const words = text.split("\n").join(" ").split(" ");
  const longestWord = words.reduce((a, w) => w.length > a.length ? w : a, "");
  const wordPx = longestWord.length * MAX_FONT * AVG_CHAR;
  const fontSize = wordPx > AVAILABLE_WIDTH * 0.85
    ? Math.floor((AVAILABLE_WIDTH * 0.85) / (longestWord.length * AVG_CHAR))
    : MAX_FONT;

  // Build lines
  const lines: string[][] = stacked
    ? text.includes("\n")
      ? text.split("\n").map(l => l.split(" "))
      : words.length === 2 ? [words.slice(0, 1), words.slice(1)]
      : words.length === 3 ? [words.slice(0, 2), words.slice(2)]
      : [words]
    : [words];

  const lineH = fontSize * 1.3;
  const wordGap = fontSize * 0.08;

  return (
    <div
      style={{
        position: "absolute",
        top: HEADLINE_TOP,  // 36px from top — within TOP safe zone (70-360)
        left: SAFE.left,
        right: SAFE.right,
        textAlign: "center",
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      <div style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: stacked ? "0.03em" : "0",
        lineHeight: 1.2,
        transform: `translateY(${translateY}px) scale(${scale})`,
        opacity,
      }}>
        {lines.map((line, lineIdx) => (
          <div key={lineIdx} style={{
            display: "flex",
            justifyContent: "center",
            gap: wordGap,
            lineHeight: 1.2,
          }}>
            {line.map((word, i) => {
              const globalIdx = stacked
                ? (lineIdx === 0 ? i : (words.length === 2 ? 1 : 2))
                : i;
              const isEmphasis = emphasisWordIdx === globalIdx;

              if (isEmphasis) {
                return (
                  <span key={i} style={{
                    display: "inline-block",
                    position: "relative",
                    padding: "0.06em 0.28em",
                    margin: "0 0.02em",
                    backgroundColor: "#FFE500",
                    borderRadius: 10,
                    lineHeight: 1.2,
                    letterSpacing: "0.03em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}>
                    <span style={{
                      fontFamily: tokens.fontFamily,
                      fontSize,
                      fontWeight: 900,
                      color: "#000000",
                      textShadow: "none",
                      lineHeight: 1.2,
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                      display: "inline-block",
                    }}>
                      {word}
                    </span>
                  </span>
                );
              }

              return (
                <span key={i} style={{
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
                }}>
                  {word}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Yellow Highlight Punch (single word, timed) ─────────────────────────
function YellowHighlight({ text, activeFrom, activeTo }: {
  text: string;
  activeFrom: number;
  activeTo: number;
}) {
  const frame = useCurrentFrame();
  const localFrame = frame - activeFrom;
  const duration = activeTo - activeFrom;

  if (localFrame < 0 || localFrame >= duration) return null;

  const PUNCH_FRAMES = 12;
  const HOLD_FRAMES = 8;
  const EXIT_FRAMES = 6;

  let scale = 1;
  let opacity = 1;

  if (localFrame < PUNCH_FRAMES) {
    // Punch in with overshoot
    const p = localFrame / PUNCH_FRAMES;
    scale = interpolate(p, [0, 0.5, 1], [0.6, 1.12, 1.0], { easing: EASE_OUT });
    opacity = Math.min(p / 0.3, 1);
  } else if (localFrame < PUNCH_FRAMES + HOLD_FRAMES) {
    scale = 1.0;
    opacity = 1;
  } else {
    const p = (localFrame - PUNCH_FRAMES - HOLD_FRAMES) / EXIT_FRAMES;
    scale = interpolate(p, [0, 1], [1.0, 0.9], { easing: EASE_IN });
    opacity = interpolate(p, [0, 1], [1, 0], { easing: EASE_IN });
  }

  if (opacity < 0.01) return null;

  const fontSize = 72;
  const font = useCurrentFrame();

  return (
    <div style={{
      position: "absolute",
      top: HEADLINE_TOP,
      left: SAFE.left,
      right: SAFE.right,
      textAlign: "center",
      zIndex: 15,
      pointerEvents: "none",
      transform: `scale(${scale})`,
      opacity,
    }}>
      <span style={{
        display: "inline-block",
        padding: "0.08em 0.4em",
        backgroundColor: "#FFE500",
        borderRadius: 12,
        fontFamily: tokens.fontFamily,
        fontSize,
        fontWeight: 900,
        color: "#000000",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        textShadow: "none",
        boxShadow: "0 4px 24px rgba(255,229,0,0.4)",
      }}>
        {text}
      </span>
    </div>
  );
}

// ─── Caption Bar ────────────────────────────────────────────────────────
// Continuous across entire video. Active word highlighted in yellow.
function CaptionBar() {
  const frame = useCurrentFrame();
  const currentMs = (frame / FPS) * 1000;

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
    <div style={{
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
    }}>
      {windowWords.map(([word], i) => {
        const isCurrent = i === 0;

        return (
          <span key={activeIdx + i} style={{
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
          }}>
            {word}
          </span>
        );
      })}
    </div>
  );
}

// ─── Video Layer ────────────────────────────────────────────────────────
function VideoLayer() {
  const frame = useCurrentFrame();

  const slowZoom = interpolate(frame, [0, TOTAL_FRAMES], [1.0, 1.06], {
    easing: EASE_OUT,
  });

  // Emphasis punch at scene 4 highlight moment (frame 374)
  const emphasisPunch = interpolate(
    frame,
    [340, 360, 400],
    [0, 0.04, 0],
    { easing: EASE_IN_OUT }
  );

  // Zoom-through for B-roll transition (frame 340)
  const zoomThrough = interpolate(
    frame,
    [335, 340, 350],
    [1.0, 1.12, 1.0],
    { easing: EASE_IN_OUT }
  );

  const scale = slowZoom + emphasisPunch + zoomThrough * 0.1;

  const videoSrc = staticFile(
    "projects/corporate-career-growth-amana/footage/testing-video.mp4"
  );

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      transform: `scale(${scale})`,
      zIndex: 1,
    }}>
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

// ─── Reference-Driven Composition ───────────────────────────────────────
export default function CorporateCareerGrowthAmanaReference() {
  return (
    <AbsoluteFill>
      {/* Base video layer */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <VideoLayer />
      </Sequence>

      {/* Original voice audio — played ONCE */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <Audio
          src={staticFile(
            "projects/corporate-career-growth-amana/footage/testing-video.mp4"
          )}
          volume={1.0}
        />
      </Sequence>

      {/* Caption bar — continuous */}
      <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
        <CaptionBar />
      </Sequence>

      {/* Scene 1: SIGNIFICANTLY MORE (frames 91-122) */}
      <Sequence from={SCENE_1_FROM} durationInFrames={SCENE_1_TO - SCENE_1_FROM}>
        <Headline
          text="SIGNIFICANTLY\nMORE"
          sceneFrom={0}
          sceneTo={SCENE_1_TO - SCENE_1_FROM}
          emphasisWordIdx={0}
          stacked={true}
        />
      </Sequence>

      {/* Scene 2: MORE TALENTED (frames 170-192) */}
      <Sequence from={SCENE_2_FROM} durationInFrames={SCENE_2_TO - SCENE_2_FROM}>
        <Headline
          text="MORE\nTALENTED"
          sceneFrom={0}
          sceneTo={SCENE_2_TO - SCENE_2_FROM}
          emphasisWordIdx={-1}
          stacked={true}
        />
      </Sequence>

      {/* Scene 3: 13 YEARS (frames 243-266) */}
      <Sequence from={SCENE_3_FROM} durationInFrames={SCENE_3_TO - SCENE_3_FROM}>
        <Headline
          text="13 YEARS"
          sceneFrom={0}
          sceneTo={SCENE_3_TO - SCENE_3_FROM}
          emphasisWordIdx={0}
          stacked={false}
        />
      </Sequence>

      {/* Scene 4: MUCH MORE SALARY (frames 360-395) */}
      <Sequence from={SCENE_4_FROM} durationInFrames={SCENE_4_TO - SCENE_4_FROM}>
        <Headline
          text="MUCH MORE\nSALARY"
          sceneFrom={0}
          sceneTo={SCENE_4_TO - SCENE_4_FROM}
          emphasisWordIdx={2}
          stacked={true}
        />
      </Sequence>

      {/* Scene 5: TALENT OR SKILLS (frames 450-474) */}
      <Sequence from={SCENE_5_FROM} durationInFrames={SCENE_5_TO - SCENE_5_FROM}>
        <Headline
          text="TALENT OR\nSKILLS"
          sceneFrom={0}
          sceneTo={SCENE_5_TO - SCENE_5_FROM}
          emphasisWordIdx={-1}
          stacked={true}
        />
      </Sequence>

      {/* Scene 6: POSITION (frames 499-513) */}
      <Sequence from={SCENE_6_FROM} durationInFrames={SCENE_6_TO - SCENE_6_FROM}>
        <Headline
          text="POSITION"
          sceneFrom={0}
          sceneTo={SCENE_6_TO - SCENE_6_FROM}
          emphasisWordIdx={0}
          stacked={false}
        />
      </Sequence>
    </AbsoluteFill>
  );
}

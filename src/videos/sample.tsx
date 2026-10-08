import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT } from "../design/motion";

const headlineSize = 116;
const bigNumberSize = 170;
const bodySize = 22;
const bg = "#F8F7F4";
const textColor = "#1A1A1A";
const textSecondary = "#6B6B6B";
const captionBg = "rgba(0,0,0,0.55)";
const captionText = "#FFFFFF";
const accent = "#FF4D2D";
const radiusMd = 12;
const shadowLg = "0 8px 32px rgba(0,0,0,0.10)";
const fontFamily = "'Inter', sans-serif";

export default function Sample() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const seq1 = interpolate(frame, [0, 90], [0, 1], { easing: EASE_OUT });
  const seq2 = interpolate(frame, [90, 150], [0, 1], { easing: EASE_OUT });
  const seq3 = interpolate(frame, [150, 210], [0, 1], { easing: EASE_OUT });

  const captions: Array<{ word: string; startFrame: number; endFrame: number }> = [
    { word: "Word-by-word", startFrame: 30, endFrame: 60 },
    { word: "captions", startFrame: 60, endFrame: 90 },
    { word: "work", startFrame: 120, endFrame: 150 },
    { word: "beautifully", startFrame: 180, endFrame: 210 },
  ];

  const currentCaption = captions.find((c) => frame >= c.startFrame && frame <= c.endFrame);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
        padding: 80,
      }}
    >
      {/* Presence: entrance animation */}
      <div
        style={{
          opacity: seq1,
          transform: `translateY(${(1 - seq1) * 40}px) scale(${0.92 + 0.08 * seq1})`,
        }}
      >
        <h1
          style={{
            fontSize: headlineSize,
            fontWeight: 700,
            color: textColor,
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          Your Editing OS
        </h1>
      </div>

      {/* MaskReveal: text wipe */}
      <div
        style={{
          marginTop: 32,
          opacity: seq2,
          clipPath: `inset(0 ${100 - seq2 * 100}% 0 0)`,
          WebkitClipPath: `inset(0 ${100 - seq2 * 100}% 0 0)`,
        }}
      >
        <p
          style={{
            fontSize: bodySize,
            color: textSecondary,
            margin: 0,
            maxWidth: 800,
            textAlign: "center",
          }}
        >
          Quality lives in the system, never in one-off hacks.
        </p>
      </div>

      {/* RollingNumber + HighlightMark: accent behind key phrase */}
      <div
        style={{
          marginTop: 48,
          position: "relative",
          display: "inline-block",
          opacity: seq3,
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: "-4px -8px",
            backgroundColor: accent,
            borderRadius: 8,
            clipPath: `inset(0 ${100 - seq3 * 100}% 0 0)`,
            WebkitClipPath: `inset(0 ${100 - seq3 * 100}% 0 0)`,
          }}
        />
        <span
          style={{
            position: "relative",
            fontSize: bigNumberSize,
            fontWeight: 600,
            color: textColor,
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
            display: "inline-block",
          }}
        >
          {String(Math.round(interpolate(seq3, [0, 1], [0, 2024], { easing: EASE_OUT })))}
        </span>
      </div>

      {/* Captions: word-by-word */}
      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          bottom: 120,
          left: 40,
          right: 40,
          pointerEvents: "none",
          zIndex: 50,
        }}
      >
        {currentCaption && (
          <div
            style={{
              backgroundColor: captionBg,
              color: captionText,
              fontSize: 42,
              fontWeight: 600,
              lineHeight: 1.2,
              padding: "12px 20px",
              borderRadius: radiusMd,
              boxShadow: shadowLg,
              maxWidth: "90%",
              textAlign: "center",
            }}
          >
            {currentCaption.word}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

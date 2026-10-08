import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { EASE_OUT } from "../design/motion";
import { tokens } from "../design/tokens";

export type CaptionWord = {
  word: string;
  startFrame: number;
  endFrame: number;
};

export function Captions({
  words,
  style,
}: {
  words: CaptionWord[];
  style?: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  const current = words.find((w) => frame >= w.startFrame && frame <= w.endFrame);
  if (!current) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 120,
        left: 40,
        right: 40,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 50,
        ...style,
      }}
    >
      <div
        style={{
          backgroundColor: tokens.captionShadow,
          color: tokens.captionText,
          fontFamily: tokens.fontFamily,
          fontSize: tokens.type.caption.size,
          fontWeight: tokens.type.caption.weight,
          lineHeight: tokens.type.caption.lineHeight,
          padding: `${tokens.space[3]}px ${tokens.space[5]}px`,
          borderRadius: tokens.radius.md,
          boxShadow: tokens.shadow.lg,
          maxWidth: "90%",
          textAlign: "center",
        }}
      >
        {current.word}
      </div>
    </div>
  );
}

/**
 * Captions — word-by-word captions driven by word timings.
 *
 * One caption zone per layout. Centred at the bottom safe zone.
 *
 * Usage: <Captions words={wordTimings} />
 */

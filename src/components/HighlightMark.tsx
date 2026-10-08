import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { EASE_IN, EASE_OUT } from "../design/motion";

export function HighlightMark({
  children,
  duration = 500,
  color = "#FF4D2D",
  thickness = 6,
  paddingY = 4,
}: {
  children: React.ReactNode;
  duration?: number;
  color?: string;
  thickness?: number;
  paddingY?: number;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const enterFrames = duration * fps / 1000;
  const exitDuration = Math.round(duration * 0.65);
  const exitFrames = exitDuration * fps / 1000;
  const exitStart = durationInFrames - exitFrames;

  const enterProgress = Math.min(frame / enterFrames, 1);
  const easedEnter = interpolate(enterProgress, [0, 1], [0, 1], { easing: EASE_OUT });

  const exitProgress = frame > exitStart ? Math.min((frame - exitStart) / exitFrames, 1) : 0;
  const easedExit = interpolate(exitProgress, [0, 1], [0, 1], { easing: EASE_IN });

  const widthPercent = easedEnter * 100;
  const opacity = frame < enterFrames ? easedEnter : 1 - easedExit;

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: -paddingY,
          bottom: -paddingY,
          backgroundColor: color,
          borderRadius: 4,
          clipPath: `inset(0 ${100 - widthPercent}% 0 0)`,
          opacity,
        }}
      />
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </span>
  );
}

/**
 * HighlightMark — accent marker that wipes behind a key phrase.
 *
 * Usage: the quick <HighlightMark duration={500}>brown fox</HighlightMark> jumps
 */

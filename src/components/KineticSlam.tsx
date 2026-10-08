import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Sequence } from "remotion";
import { EASE_OUT, OVERSHOOT } from "../design/motion";

/**
 * OvershootSlam — kinetic text entrance with overshoot bounce.
 *
 * Reference: references-clip.mp4 moments 1–2
 * Rules: scale starts at 0.94, overshoots past 1, settles. Blur resolves before move ends.
 *
 * Usage: <OvershootSlam>text</OvershootSlam>
 */
export function OvershootSlam({
  children,
  duration = 500,
  delay = 0,
  strokeWidth = 3,
  strokeColor = "#000000",
  blurMax = 8,
  fontSize = 100,
  fontWeight = 700,
  color = "#1A1A1A",
  lineHeight = 1.1,
  fontFamily = "'Inter', sans-serif",
  textTransform = "none",
  letterSpacing = "normal",
  as: Tag = "span",
  staggerWords = false,
  onEntered,
}: {
  children: React.ReactNode;
  duration?: number;
  delay?: number;
  strokeWidth?: number;
  strokeColor?: string;
  blurMax?: number;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  lineHeight?: number;
  fontFamily?: string;
  textTransform?: string;
  letterSpacing?: string;
  as?: "span" | "div";
  staggerWords?: boolean;
  onEntered?: () => void;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enterFrames = (duration * fps) / 1000;
  const adjustedFrame = Math.max(0, frame - (delay * fps) / 1000);
  const progress = Math.min(adjustedFrame / enterFrames, 1);

  // Overshoot: goes from 0.94 → 1.06 → 1.0
  const scale = interpolate(progress, [0, 0.6, 1], [0.94, 1.06, 1.0], {
    easing: EASE_OUT,
  });

  const translateY = interpolate(progress, [0, 1], [24, 0], { easing: EASE_OUT });

  // Blur: starts at max, resolves by 60% of move (OPACITY_LEAD = 0.6)
  const blurProgress = Math.min(progress / 0.6, 1);
  const blur = interpolate(blurProgress, [0, 1], [blurMax, 0], { easing: EASE_OUT });

  const opacity = progress < 0.6 ? progress / 0.6 : 1 - (progress - 0.6) / 0.4 * 0.3;

  // Call onEntered when settled
  if (progress >= 1 && onEntered && !(frame > enterFrames + 1)) {
    onEntered();
  }

  const baseStyle: React.CSSProperties = {
    fontFamily,
    fontSize,
    fontWeight,
    color,
    lineHeight,
    textTransform,
    letterSpacing,
    opacity,
    transform: `translateY(${translateY}px) scale(${scale})`,
    filter: blur > 0.5 ? `blur(${blur}px)` : "none",
    display: "inline-block",
    willChange: "transform, opacity, filter",
    textShadow: `0 0 ${blur * 0.5}px ${color}40`,
    WebkitTextStroke: `${strokeWidth}px ${strokeColor}`,
  };

  if (staggerWords) {
    return (
      <Tag style={baseStyle}>
        {React.Children.map(children, (child, i) => (
          <WordStagger key={i} index={i} parentFrame={frame} fps={fps}>
            {child}
          </WordStagger>
        ))}
      </Tag>
    );
  }

  return <Tag style={baseStyle}>{children}</Tag>;
}

/**
 * WordStagger — single word inside an OvershootSlam with stagger delay.
 */
function WordStagger({
  children,
  index,
  parentFrame,
  fps,
}: {
  children: React.ReactNode;
  index: number;
  parentFrame: number;
  fps: number;
}) {
  const staggerMs = index * 67; // tight stagger
  const adjustedFrame = Math.max(0, parentFrame - (staggerMs * fps) / 1000);
  const progress = Math.min(adjustedFrame / ((500 * fps) / 1000), 1);

  const scale = interpolate(progress, [0, 0.6, 1], [0.94, 1.06, 1.0], {
    easing: EASE_OUT,
  });
  const translateY = interpolate(progress, [0, 1], [16, 0], { easing: EASE_OUT });
  const blurProgress = Math.min(progress / 0.6, 1);
  const blur = interpolate(blurProgress, [0, 1], [8, 0], { easing: EASE_OUT });
  const opacity = progress < 0.6 ? progress / 0.6 : 1;

  return (
    <span
      style={{
        display: "inline-block",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        filter: blur > 0.5 ? `blur(${blur}px)` : "none",
      }}
    >
      {children}
    </span>
  );
}

/**
 * KineticSwap — kinetic text swap: old text exits with overshoot while
 * new text enters with overshoot. Staggered per word.
 *
 * Reference: references-clip.mp4 moment 2
 */
export function KineticSwap({
  oldText,
  newText,
  swapAt = 30,
  duration = 400,
  fontSize = 100,
  fontWeight = 700,
  fontFamily = "'Inter', sans-serif",
  color = "#1A1A1A",
  lineHeight = 1.1,
  textTransform = "none",
  letterSpacing = "normal",
}: {
  oldText: string;
  newText: string;
  swapAt?: number;
  duration?: number;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  color?: string;
  lineHeight?: number;
  textTransform?: string;
  letterSpacing?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const swapFrame = swapAt;
  const exitFrames = (duration * 0.65 * fps) / 1000;
  const enterFrames = (duration * fps) / 1000;

  const oldProgress = frame > swapFrame
    ? Math.min((frame - swapFrame) / exitFrames, 1)
    : 0;
  const newProgress = frame > swapFrame + 5
    ? Math.min((frame - swapFrame - 5) / enterFrames, 1)
    : 0;

  const oldScale = interpolate(oldProgress, [0, 1], [1, 1.08], { easing: EASE_OUT });
  const oldOpacity = 1 - oldProgress;
  const oldBlur = interpolate(oldProgress, [0, 1], [0, 6]);

  const newScale = interpolate(newProgress, [0, 0.6, 1], [0.94, 1.06, 1.0], {
    easing: EASE_OUT,
  });
  const newTranslateY = interpolate(newProgress, [0, 1], [16, 0], { easing: EASE_OUT });
  const newBlurProgress = Math.min(newProgress / 0.6, 1);
  const newBlur = interpolate(newBlurProgress, [0, 1], [8, 0], { easing: EASE_OUT });
  const newOpacity = newProgress < 0.6 ? newProgress / 0.6 : 1;

  const baseStyle: React.CSSProperties = {
    fontFamily,
    fontSize,
    fontWeight,
    color,
    lineHeight,
    textTransform,
    letterSpacing,
    display: "inline-block",
  };

  return (
    <span style={{ position: "relative", display: "inline-block", ...baseStyle }}>
      {oldText && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            opacity: oldOpacity,
            transform: `scale(${oldScale})`,
            filter: oldBlur > 0.5 ? `blur(${oldBlur}px)` : "none",
            pointerEvents: "none",
          }}
        >
          {oldText}
        </span>
      )}
      {newText && (
        <span
          style={{
            opacity: newOpacity,
            transform: `translateY(${newTranslateY}px) scale(${newScale})`,
            filter: newBlur > 0.5 ? `blur(${newBlur}px)` : "none",
          }}
        >
          {newText}
        </span>
      )}
    </span>
  );
}

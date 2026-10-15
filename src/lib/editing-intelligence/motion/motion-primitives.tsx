/**
 * motion-primitives.ts — reusable Remotion animation primitives.
 *
 * Each primitive is a React component that applies a specific motion effect
 * using frame-driven animation (useCurrentFrame + interpolate).
 * All timing comes from src/design/motion.ts.
 * All easing comes from the composed easing functions.
 *
 * Primitives match HyperFrames motion concept but are implemented as
 * production-ready Remotion components following our 12 motion laws.
 *
 * Available primitives:
 *   SlamText         — kinetic text entrance with overshoot (scale 0.94→1.06→1)
 *   SlideIn          — slide from a direction with blur resolve
 *   FadeInOut        — fade with scale travel (never opacity alone)
 *   ZoomPunch        — quick zoom peak at a specific frame
 *   BlurResolve      — blur-in that resolves before move ends
 *   WordReveal       — word-by-word kinetic reveal with stagger
 *   Emphasize        — single-word highlight punch
 *   ScaleBounce      — scale bounce without translation
 *   SlideSwap        — old text slides out, new slides in
 */

import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
} from "remotion";
import { EASE_OUT, EASE_IN, EASE_IN_OUT, OVERSHOOT, tween } from "../../design/motion";
import { tokens } from "../../design/tokens";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PrimitiveBaseProps {
  /** Duration in ms. Default: 400 (base) */
  duration?: number;
  /** Delay before animation starts (ms). Default: 0 */
  delay?: number;
  /** Enter easing. Default: EASE_OUT */
  enterEasing?: (t: number) => number;
  /** Exit easing. Default: EASE_IN */
  exitEasing?: (t: number) => number;
  /** Children to animate */
  children?: React.ReactNode;
  /** Z-index */
  zIndex?: number;
  /** Called when entrance animation completes */
  onEntered?: () => void;
  /** Called when exit animation completes */
  onExited?: () => void;
}

export interface SlamTextProps extends PrimitiveBaseProps {
  /** Text content */
  text: string;
  /** Font size in px. Default: 120 */
  fontSize?: number;
  /** Font weight. Default: 700 */
  fontWeight?: number;
  /** Text colour. Default: tokens.text */
  color?: string;
  /** Maximum blur during entrance (px). Default: 8 */
  blurMax?: number;
  /** Whether to apply yellow highlight to key word */
  highlight?: boolean;
  /** Index of word to highlight (0-based) */
  highlightIndex?: number;
  /** Font family. Default: tokens.fontFamily */
  fontFamily?: string;
}

export interface SlideInProps extends PrimitiveBaseProps {
  /** Direction to slide from */
  direction: "left" | "right" | "top" | "bottom";
  /** Distance to travel (px). Default: 80 */
  distance?: number;
  /** Blur during movement (px). Default: 6 */
  blurMax?: number;
  /** Scale start value. Default: 0.94 */
  scaleFrom?: number;
}

export interface FadeInOutProps extends PrimitiveBaseProps {
  /** Scale travel range. Default: [0.94, 1] */
  scaleRange?: [number, number];
  /** Opacity start. Default: 0 */
  opacityFrom?: number;
}

export interface ZoomPunchProps {
  /** Frame at which the punch peaks */
  peakFrame: number;
  /** Maximum zoom scale. Default: 1.06 */
  maxZoom?: number;
  /** Punch duration in ms. Default: 800 */
  duration?: number;
  /** Children (typically the video layer) */
  children?: React.ReactNode;
  /** Whether this is an emphasis punch (peaks then settles back) */
  emphasis?: boolean;
}

export interface BlurResolveProps extends PrimitiveBaseProps {
  /** Maximum blur (px). Default: 12 */
  blurMax?: number;
  /** Whether blur should fully resolve before move ends. Default: true */
  resolveBeforeEnd?: boolean;
}

export interface WordRevealProps extends PrimitiveBaseProps {
  /** Words to reveal */
  words: string[];
  /** Font size in px. Default: 120 */
  fontSize?: number;
  /** Font weight. Default: 700 */
  fontWeight?: number;
  /** Stagger between each word (ms). Default: 67 (tight) */
  staggerMs?: number;
  /** Whether to highlight specific words */
  highlightIndices?: number[];
  /** Gap between words (px). Default: 16 */
  wordGap?: number;
}

export interface EmphasizeProps extends PrimitiveBaseProps {
  /** The word or phrase to emphasize */
  text: string;
  /** Font size. Default: 120 */
  fontSize?: number;
  /** Emphasis colour. Default: tokens.accent */
  color?: string;
  /** Whether to show background highlight. Default: true */
  showHighlight?: boolean;
}

export interface ScaleBounceProps extends PrimitiveBaseProps {
  /** Scale range [from, peak, to]. Default: [0.85, 1.08, 1.0] */
  scaleRange?: [number, number, number];
  /** Whether to use overshoot easing. Default: true */
  overshoot?: boolean;
}

export interface SlideSwapProps extends PrimitiveBaseProps {
  /** Old text (exits) */
  oldText: string;
  /** New text (enters) */
  newText: string;
  /** Direction of swap. Default: "up" */
  direction?: "up" | "down" | "left" | "right";
  /** Font size. Default: 120 */
  fontSize?: number;
}

// ─── SlamText ────────────────────────────────────────────────────────────────

/**
 * SlamText — kinetic text entrance with overshoot bounce.
 *
 * Pattern: scale 0.94 → 1.06 → 1.0, translateY 30→0, blur 8→0
 * Opacity resolves at 60% of move.
 * Blur resolves by 60% of move.
 * Never animate opacity alone — paired with scale + travel.
 *
 * Reference: references-clip.mp4 moments 1-2
 */
export function SlamText({
  text,
  fontSize = 120,
  fontWeight = 700,
  color = tokens.text,
  blurMax = 8,
  duration = 400,
  delay = 0,
  highlight = false,
  highlightIndex = 0,
  fontFamily = tokens.fontFamily,
  enterEasing = EASE_OUT,
  onEntered,
  children,
  zIndex = 10,
}: SlamTextProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { durationInFrames } = useVideoConfig();

  const enterFrames = (duration * fps) / 1000;
  const delayFrames = (delay * fps) / 1000;
  const localFrame = frame - delayFrames;

  // Entrance progress
  const enterProgress = Math.min(Math.max(localFrame / enterFrames, 0), 1);
  const easedEnter = tween(enterProgress, enterEasing);

  // Exit: in the last 35% of duration, or when durationInFrames is known
  const exitDurationFrames = Math.round(durationInFrames * 0.35);
  const exitStartFrame = durationInFrames - exitDurationFrames;
  const isExiting = localFrame > exitStartFrame && durationInFrames > 0;
  const exitProgress = isExiting
    ? Math.min((localFrame - exitStartFrame) / exitDurationFrames, 1)
    : 0;
  const easedExit = tween(exitProgress, EASE_IN);

  // ─── Motion values ─────────────────────────────────────────────────────────

  // Entrance
  const enterScale = interpolate(easedEnter, [0, 0.6, 1], [0.94, 1.06, 1.0]);
  const enterTranslateY = interpolate(easedEnter, [0, 1], [30, 0]);
  const enterBlur = interpolate(easedEnter, [0, 0.6, 1], [blurMax, 2, 0]);
  const enterOpacity = enterProgress < 0.6 ? easedEnter / 0.6 : 1 - easedEnter * 0.05;

  // Exit
  const exitScale = interpolate(easedExit, [0, 1], [1, 0.92]);
  const exitTranslateY = interpolate(easedExit, [0, 1], [0, 25]);
  const exitOpacity = 1 - easedExit;

  // Combine enter + exit
  const scale = isExiting ? exitScale : enterScale;
  const translateY = isExiting ? exitTranslateY : enterTranslateY;
  const blur = isExiting ? 0 : enterBlur;
  const opacity = isExiting ? exitOpacity : enterOpacity;

  if (opacity < 0.01 && !isExiting) return null;

  const words = text.split(" ");
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    top: "14%",
    left: tokens.space[4] + "px",
    right: tokens.space[4] + "px",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: fontSize * 0.08,
    zIndex,
    opacity,
    transform: `translateY(${translateY}px) scale(${scale})`,
    filter: blur > 0.5 ? `blur(${blur}px)` : "none",
    fontFamily,
    fontSize,
    fontWeight,
    color,
    lineHeight: 1.1,
    textAlign: "center",
    pointerEvents: "none",
    willChange: "transform, opacity, filter",
    textShadow: `0 ${blur}px ${blur * 2}px ${color}40`,
  };

  return (
    <div style={containerStyle}>
      {words.map((word, i) => {
        const isHighlighted = highlight && i === highlightIndex;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              position: "relative",
              padding: isHighlighted ? "0.02em 0.2em" : "0",
              margin: isHighlighted ? "0 0.01em" : "0",
              backgroundColor: isHighlighted ? "#FFE500" : "transparent",
              borderRadius: isHighlighted ? tokens.radius.sm : 0,
              color: isHighlighted ? "#000000" : color,
              fontWeight: isHighlighted ? 900 : fontWeight,
              WebkitTextStroke: isHighlighted ? undefined : "2px #000000",
              textShadow: isHighlighted
                ? "none"
                : `0 2px 8px rgba(0,0,0,0.4)`,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

// ─── SlideIn ─────────────────────────────────────────────────────────────────

/**
 * SlideIn — slide from a direction with blur resolve.
 *
 * Travels from `distance` pixels to 0, with blur that resolves by 60%.
 * Paired with scale 0.94→1 per motion law #5.
 */
export function SlideIn({
  children,
  direction = "left",
  distance = 80,
  blurMax = 6,
  scaleFrom = 0.94,
  duration = 400,
  delay = 0,
  enterEasing = EASE_OUT,
  zIndex = 10,
}: SlideInProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterFrames = (duration * fps) / 1000;
  const delayFrames = (delay * fps) / 1000;
  const localFrame = Math.max(0, frame - delayFrames);
  const progress = Math.min(localFrame / enterFrames, 1);
  const eased = tween(progress, enterEasing);

  const scale = interpolate(eased, [0, 1], [scaleFrom, 1]);
  const opacity = Math.min(progress / 0.6, 1);

  let translateX = 0;
  let translateY = 0;

  if (direction === "left") translateX = interpolate(eased, [0, 1], [-distance, 0]);
  else if (direction === "right") translateX = interpolate(eased, [0, 1], [distance, 0]);
  else if (direction === "top") translateY = interpolate(eased, [0, 1], [-distance, 0]);
  else if (direction === "bottom") translateY = interpolate(eased, [0, 1], [distance, 0]);

  const blur = interpolate(eased, [0, 0.6, 1], [blurMax, blurMax * 0.2, 0]);

  return (
    <AbsoluteFill
      style={{
        zIndex,
        opacity,
        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
        filter: blur > 0.5 ? `blur(${blur}px)` : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

// ─── FadeInOut ────────────────────────────────────────────────────────────────

/**
 * FadeInOut — fade with paired scale travel (never opacity alone).
 *
 * Per motion law #5: opacity is always paired with 8-24px travel or scale.
 */
export function FadeInOut({
  children,
  duration = 400,
  delay = 0,
  scaleRange = [0.94, 1],
  opacityFrom = 0,
  enterEasing = EASE_OUT,
  exitEasing = EASE_IN,
  zIndex = 10,
}: FadeInOutProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const enterFrames = (duration * fps) / 1000;
  const delayFrames = (delay * fps) / 1000;
  const localFrame = Math.max(0, frame - delayFrames);

  const enterProgress = Math.min(localFrame / enterFrames, 1);
  const easedEnter = tween(enterProgress, enterEasing);

  const exitDurationMs = duration * 0.65;
  const exitFrames = (exitDurationMs * fps) / 1000;
  const exitStartFrame = durationInFrames - exitFrames;
  const isExiting = localFrame > exitStartFrame && durationInFrames > 0;
  const exitProgress = isExiting
    ? Math.min((localFrame - exitStartFrame) / exitFrames, 1)
    : 0;
  const easedExit = tween(exitProgress, exitEasing);

  const scale = isExiting
    ? interpolate(easedExit, [0, 1], [scaleRange[1], scaleRange[0]])
    : interpolate(easedEnter, [0, 1], scaleRange);
  const opacity = isExiting
    ? 1 - easedExit
    : opacityFrom + (1 - opacityFrom) * easedEnter;

  return (
    <AbsoluteFill
      style={{
        zIndex,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

// ─── ZoomPunch ───────────────────────────────────────────────────────────────

/**
 * ZoomPunch — quick zoom that peaks at a specific frame.
 *
 * Used for emphasis moments: scale goes 1.0 → 1.06, peaks, then eases back.
 * Can be emphasis punch (1.0 → 1.1 → 1.0) for maximum attention grab.
 */
export function ZoomPunch({
  peakFrame,
  maxZoom = 1.06,
  duration = 800,
  emphasis = false,
  children,
}: ZoomPunchProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const peakFrames = (duration * fps) / 2000; // peak at half the total duration
  const startFrame = peakFrame - peakFrames;
  const endFrame = peakFrame + peakFrames;
  const totalFrames = endFrame - startFrame;

  const relativeFrame = frame - startFrame;
  const progress = Math.min(Math.max(relativeFrame / totalFrames, 0), 1);

  const punchMax = emphasis ? 1.1 : maxZoom;
  const scale = interpolate(progress, [0, 0.5, 1], [1, punchMax, 1], {
    easing: EASE_IN_OUT,
  });

  const translateX = interpolate(progress, [0, 0.5, 1], [0, 0, 0]);
  const translateY = interpolate(progress, [0, 0.5, 1], [0, 0, 0]);

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

// ─── BlurResolve ──────────────────────────────────────────────────────────────

/**
 * BlurResolve — blur-in that resolves before the move ends.
 *
 * Per motion law #7: blur at most 12px, resolves before move ends (by 60%).
 */
export function BlurResolve({
  children,
  duration = 400,
  delay = 0,
  blurMax = 12,
  resolveBeforeEnd = true,
  enterEasing = EASE_OUT,
  zIndex = 10,
}: BlurResolveProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterFrames = (duration * fps) / 1000;
  const delayFrames = (delay * fps) / 1000;
  const localFrame = Math.max(0, frame - delayFrames);
  const progress = Math.min(localFrame / enterFrames, 1);
  const eased = tween(progress, enterEasing);

  // Blur resolves by 60% (OPACITY_LEAD)
  const resolvePoint = resolveBeforeEnd ? 0.6 : 1.0;
  const blurProgress = Math.min(progress / resolvePoint, 1);
  const blur = interpolate(blurProgress, [0, 1], [blurMax, 0]);
  const opacity = Math.min(progress / 0.6, 1);

  const scale = interpolate(eased, [0, 1], [0.96, 1]);
  const translateY = interpolate(eased, [0, 1], [12, 0]);

  return (
    <AbsoluteFill
      style={{
        zIndex,
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        filter: blur > 0.5 ? `blur(${blur}px)` : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

// ─── WordReveal ──────────────────────────────────────────────────────────────

/**
 * WordReveal — word-by-word kinetic reveal with stagger.
 *
 * Each word enters with: scale 0.8→1, translateY 30→0, opacity 0→1, blur resolve.
 * Words are staggered by `staggerMs` (default: 67ms = tight).
 * Highlighted words get yellow background.
 */
export function WordReveal({
  words,
  fontSize = 120,
  fontWeight = 700,
  color = tokens.text,
  duration = 400,
  delay = 0,
  staggerMs = 67,
  highlightIndices = [],
  wordGap = 16,
  fontFamily = tokens.fontFamily,
}: WordRevealProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterFrames = (duration * fps) / 1000;
  const delayFrames = (delay * fps) / 1000;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: `${wordGap}px`,
        top: "14%",
        left: tokens.space[4] + "px",
        right: tokens.space[4] + "px",
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      {words.map((word, i) => {
        const wordDelayFrames = (i * staggerMs * fps) / 1000;
        const localFrame = Math.max(0, frame - delayFrames - wordDelayFrames);
        const progress = Math.min(localFrame / enterFrames, 1);
        const eased = tween(progress, EASE_OUT);

        const scale = interpolate(eased, [0, 0.6, 1], [0.8, 1.04, 1.0]);
        const translateY = interpolate(eased, [0, 1], [30, 0]);
        const blur = interpolate(eased, [0, 0.6, 1], [8, 2, 0]);
        const opacity = progress < 0.6 ? eased / 0.6 : 1 - eased * 0.03;

        const isHighlighted = highlightIndices.includes(i);

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity,
              transform: `translateY(${translateY}px) scale(${scale})`,
              filter: blur > 0.5 ? `blur(${blur}px)` : "none",
              fontSize,
              fontWeight: isHighlighted ? 900 : fontWeight,
              fontFamily,
              color: isHighlighted ? "#000000" : color,
              backgroundColor: isHighlighted ? "#FFE500" : "transparent",
              padding: isHighlighted ? "0.05em 0.25em" : "0",
              margin: isHighlighted ? "0 0.02em" : "0",
              borderRadius: isHighlighted ? tokens.radius.sm : 0,
              lineHeight: 1.1,
              textShadow: isHighlighted ? "none" : `0 2px 8px rgba(0,0,0,0.4)`,
              WebkitTextStroke: isHighlighted ? undefined : "2px #000000",
            }}
          >
            {word}
          </span>
        );
      })}
    </AbsoluteFill>
  );
}

// ─── Emphasize ────────────────────────────────────────────────────────────────

/**
 * Emphasize — single-word highlight punch.
 *
 * Scale peaks at 1.1 (emphasis per motion law), then settles to 1.0.
 * Background highlight wipes in behind the word.
 */
export function Emphasize({
  text,
  fontSize = 120,
  color = tokens.text,
  duration = 400,
  delay = 0,
  showHighlight = true,
  fontFamily = tokens.fontFamily,
  zIndex = 10,
}: EmphasizeProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enterFrames = (duration * fps) / 1000;
  const delayFrames = (delay * fps) / 1000;
  const localFrame = Math.max(0, frame - delayFrames);
  const enterProgress = Math.min(localFrame / enterFrames, 1);
  const easedEnter = tween(enterProgress, EASE_OUT);

  // Scale peaks at 1.1, settles to 1.0
  const scale = interpolate(easedEnter, [0, 0.5, 0.8, 1], [0.9, 1.1, 1.05, 1.0]);
  const translateY = interpolate(easedEnter, [0, 1], [20, 0]);
  const opacity = Math.min(enterProgress / 0.5, 1);

  // Highlight width wipe
  const highlightWidth = showHighlight ? Math.min(easedEnter * 120, 100) : 0;

  return (
    <AbsoluteFill
      style={{
        zIndex,
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        top: "14%",
      }}
    >
      <span
        style={{
          position: "relative",
          display: "inline-block",
          fontSize,
          fontWeight: 900,
          fontFamily,
          color: "#000000",
          backgroundColor: showHighlight ? "#FFE500" : "transparent",
          padding: showHighlight ? "0.05em 0.3em" : "0",
          borderRadius: showHighlight ? tokens.radius.sm : 0,
          clipPath: showHighlight
            ? `inset(0 ${100 - highlightWidth}% 0 0)`
            : undefined,
          lineHeight: 1.1,
          textShadow: "none",
        }}
      >
        {text}
      </span>
    </AbsoluteFill>
  );
}

// ─── ScaleBounce ──────────────────────────────────────────────────────────────

/**
 * ScaleBounce — scale-only bounce animation.
 *
 * Goes from `scaleFrom` → `peakScale` → 1.0 with overshoot easing.
 * For emphasis without travel. Per motion law #6: never scale from below 0.9.
 */
export function ScaleBounce({
  children,
  duration = 500,
  delay = 0,
  scaleRange = [0.85, 1.08, 1.0],
  overshoot = true,
  zIndex = 10,
}: ScaleBounceProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterFrames = (duration * fps) / 1000;
  const delayFrames = (delay * fps) / 1000;
  const localFrame = Math.max(0, frame - delayFrames);
  const progress = Math.min(localFrame / enterFrames, 1);

  // Enforce motion law #6: never below 0.9
  const [from, peak, to] = scaleRange;
  const clampedFrom = Math.max(from, 0.9);
  const clampedPeak = Math.max(peak, 1.0);

  const easing = overshoot ? OVERSHOOT : EASE_OUT;
  const scale = interpolate(progress, [0, 0.5, 1], [clampedFrom, clampedPeak, to], {
    easing,
  });
  const opacity = Math.min(progress / 0.5, 1);

  return (
    <AbsoluteFill
      style={{
        zIndex,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

// ─── SlideSwap ────────────────────────────────────────────────────────────────

/**
 * SlideSwap — old text exits while new text enters.
 *
 * Old text: slides in direction + fades.
 * New text: slides in from opposite direction + scales in.
 * Creates a kinetic text swap effect.
 */
export function SlideSwap({
  oldText,
  newText,
  direction = "up",
  duration = 400,
  delay = 0,
  fontSize = 120,
  children,
  zIndex = 10,
}: SlideSwapProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const swapFrame = (delay * fps) / 1000;
  const exitFrames = (duration * 0.65 * fps) / 1000;
  const enterFrames = (duration * fps) / 1000;

  const oldProgress = frame > swapFrame
    ? Math.min((frame - swapFrame) / exitFrames, 1)
    : -1; // -1 means not started
  const newProgress = frame > swapFrame + 3
    ? Math.min((frame - swapFrame - 3) / enterFrames, 1)
    : -1;

  // Direction vectors
  const dirMap = {
    up: { exit: [0, -40], enter: [0, 40] },
    down: { exit: [0, 40], enter: [0, -40] },
    left: { exit: [-60, 0], enter: [60, 0] },
    right: { exit: [60, 0], enter: [-60, 0] },
  };
  const dir = dirMap[direction];

  const oldOpacity = oldProgress >= 0 ? 1 - tween(oldProgress, EASE_IN) : 1;
  const oldScale = oldProgress >= 0 ? interpolate(oldProgress, [0, 1], [1, 1.06]) : 1;
  const oldTranslateX = oldProgress >= 0 ? dir.exit[0] * oldProgress : 0;
  const oldTranslateY = oldProgress >= 0 ? dir.exit[1] * oldProgress : 0;

  const newOpacity = newProgress >= 0 ? tween(newProgress, EASE_OUT) : 0;
  const newScale = newProgress >= 0 ? interpolate(newProgress, [0, 1], [0.94, 1.0]) : 0.94;
  const newTranslateX = newProgress >= 0 ? dir.enter[0] * (1 - newProgress) : dir.enter[0];
  const newTranslateY = newProgress >= 0 ? dir.enter[1] * (1 - newProgress) : dir.enter[1];

  return (
    <AbsoluteFill
      style={{
        zIndex,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        top: "14%",
      }}
    >
      {/* Old text (exiting) */}
      {oldText && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            fontSize,
            fontWeight: 700,
            fontFamily: tokens.fontFamily,
            color: tokens.text,
            opacity: oldOpacity,
            transform: `translate(${oldTranslateX}px, ${oldTranslateY}px) scale(${oldScale})`,
            filter: `blur(${oldProgress >= 0 ? oldProgress * 4 : 0}px)`,
            whiteSpace: "nowrap",
            lineHeight: 1.1,
            textShadow: "0 2px 8px rgba(0,0,0,0.4)",
            WebkitTextStroke: "2px #000000",
          }}
        >
          {oldText}
        </span>
      )}

      {/* New text (entering) */}
      {newText && (
        <span
          style={{
            fontSize,
            fontWeight: 700,
            fontFamily: tokens.fontFamily,
            color: tokens.text,
            opacity: newOpacity,
            transform: `translate(${newTranslateX}px, ${newTranslateY}px) scale(${newScale})`,
            whiteSpace: "nowrap",
            lineHeight: 1.1,
            textShadow: "0 2px 8px rgba(0,0,0,0.4)",
            WebkitTextStroke: "2px #000000",
          }}
        >
          {newText}
        </span>
      )}

      {/* Custom children (if provided instead of newText) */}
      {children}
    </AbsoluteFill>
  );
}

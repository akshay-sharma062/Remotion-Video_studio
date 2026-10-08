import {
  interpolate,
  Easing,
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
} from "remotion";

export { Easing };

// Custom cubic-bezier curves (x1 y1 x2 y2)
const OVERSHOOT_CURVE: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

/**
 * overshoot — scale goes past target then settles back.
 * For kinetic slam and bounce entrances. Use only for scale.
 */
export const OVERSHOOT = (t: number) => Easing.bezier(...OVERSHOOT_CURVE)(t);

/**
 * Compose a Remotion higher-order easing (in/out/inOut) with a base curve.
 * Usage: const eased = composed(Easing.out, Easing.ease);
 */
export function composed(
  modifier: (fn: (t: number) => number) => (t: number) => number,
  base: (t: number) => number,
): (t: number) => number {
  return modifier(base);
}

/** Pre-composed easings ready for use with interpolate/tween */
export const EASE_OUT = composed(Easing.out, Easing.ease);
export const EASE_IN = composed(Easing.in, Easing.ease);
export const EASE_IN_OUT = composed(Easing.inOut, Easing.ease);

/**
 * tween — linear interpolation with a Remotion easing function.
 *
 * Usage: const progress = tween(frame / totalFrames, EASE_OUT);
 */
export function tween(progress: number, easing = EASE_OUT): number {
  return interpolate(progress, [0, 1], [0, 1], { easing });
}

/**
 * readableHold — minimum readable display time for N words.
 * 900ms + 250ms + 55ms per word.
 */
export function readableHold(wordCount: number): number {
  return 900 + 250 + 55 * wordCount;
}

/**
 * useMotionBlur — returns a blur value in px based on velocity.
 * Pass this frame's position and last frame's position.
 * Clamps to 12px max.
 */
export function useMotionBlur(current: number, previous: number): number {
  const velocity = Math.abs(current - previous);
  return Math.min(velocity * 2, 12);
}

import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { tween, EASE_IN, EASE_OUT } from "../design/motion";

export function Presence({
  children,
  enterDuration = 600,
  exitDuration,
  enterEasing = EASE_OUT,
  exitEasing = EASE_IN,
}: {
  children: React.ReactNode;
  enterDuration?: number;
  exitDuration?: number;
  enterEasing?: (t: number) => number;
  exitEasing?: (t: number) => number;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const defaultExit = calcExitDuration(enterDuration);
  const actualExit = exitDuration ?? defaultExit;

  const enterT = Math.min(frame / (enterDuration * fps / 1000), 1);
  const enterProgress = tween(enterT, enterEasing);

  const exitStart = durationInFrames - actualExit * fps / 1000;
  const exitProgress =
    frame > exitStart ? tween(Math.min((frame - exitStart) / (actualExit * fps / 1000), 1), exitEasing) : 0;

  const opacity = frame < enterDuration * fps / 1000 ? enterProgress : frame > exitStart ? 1 - exitProgress : 1;
  const scale = frame < enterDuration * fps / 1000 ? 0.94 + 0.06 * enterProgress : frame > exitStart ? 1 - 0.04 * exitProgress : 1;
  const translateY = frame < enterDuration * fps / 1000 ? 24 * (1 - enterProgress) : frame > exitStart ? 16 * exitProgress : 0;
  const blur = frame < enterDuration * fps / 1000 ? 12 * (1 - enterProgress) : frame > exitStart ? 8 * exitProgress : 0;

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        filter: `blur(${blur}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

function calcExitDuration(entranceDuration: number): number {
  return Math.round(entranceDuration * 0.65);
}

/**
 * Presence — entrance and exit wrapper with automatic velocity motion blur.
 *
 * Wrap any element. Animates in with ease-out, eases out on exit.
 * Scale travels 0.94→1, translateY 24px, blur resolves 12px→0.
 * Opacity finishes at 60% of the move.
 *
 * Usage: <Presence enterDuration={600}><YourContent /></Presence>
 */

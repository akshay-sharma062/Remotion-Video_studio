import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT } from "../design/motion";

export type TransitionType = "none" | "fade" | "dissolve" | "wipe-left" | "wipe-right" | "zoom-through";

export interface TransitionConfig {
  type: TransitionType;
  duration?: number; // ms, default 400
}

/**
 * ClipTransition — handles the outgoing clip in a transition pair.
 *
 * Usage:
 * <ClipTransition type="fade" duration={400}>
 *   <img src={clip1} />
 * </ClipTransition>
 */
export function ClipTransition({
  children,
  transition,
}: {
  children: React.ReactNode;
  transition: TransitionConfig;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durFrames = Math.round((transition.duration ?? 400) * fps / 1000);
  const progress = Math.min(frame / durFrames, 1);

  let outgoingStyle: React.CSSProperties = {};

  switch (transition.type) {
    case "fade":
      outgoingStyle.opacity = 1 - interpolate(progress, [0, 1], [0, 1], { easing: EASE_IN });
      break;
    case "dissolve":
      outgoingStyle.opacity = 1 - interpolate(progress, [0, 1], [0, 1], { easing: EASE_IN_OUT });
      break;
    case "wipe-left":
      outgoingStyle.transform = `translateX(${-interpolate(progress, [0, 1], [0, 100], { easing: EASE_IN_OUT })}%)`;
      outgoingStyle.opacity = 1 - progress;
      break;
    case "wipe-right":
      outgoingStyle.transform = `translateX(${interpolate(progress, [0, 1], [0, 100], { easing: EASE_IN_OUT })}%)`;
      outgoingStyle.opacity = 1 - progress;
      break;
    case "zoom-through": {
      const zoomScale = interpolate(progress, [0, 0.5, 1], [1, 1.08, 1], { easing: EASE_IN_OUT });
      outgoingStyle.transform = `scale(${zoomScale})`;
      outgoingStyle.opacity = 1 - interpolate(progress, [0.5, 1], [0, 1], { easing: EASE_IN });
      break;
    }
    default:
      break;
  }

  return (
    <AbsoluteFill style={outgoingStyle}>
      {children}
    </AbsoluteFill>
  );
}

/**
 * ClipTransitionIn — handles the incoming clip in a transition pair.
 */
export function ClipTransitionIn({
  children,
  transition,
}: {
  children: React.ReactNode;
  transition: TransitionConfig;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durFrames = Math.round((transition.duration ?? 400) * fps / 1000);
  const progress = Math.min(frame / durFrames, 1);

  let incomingStyle: React.CSSProperties = {};

  switch (transition.type) {
    case "fade":
      incomingStyle.opacity = interpolate(progress, [0, 1], [0, 1], { easing: EASE_OUT });
      break;
    case "dissolve":
      incomingStyle.opacity = interpolate(progress, [0, 1], [0, 1], { easing: EASE_IN_OUT });
      break;
    case "wipe-left":
      incomingStyle.transform = `translateX(${interpolate(progress, [0, 1], [100, 0], { easing: EASE_IN_OUT })}%)`;
      incomingStyle.opacity = progress;
      break;
    case "wipe-right":
      incomingStyle.transform = `translateX(${interpolate(progress, [0, 1], [-100, 0], { easing: EASE_IN_OUT })}%)`;
      incomingStyle.opacity = progress;
      break;
    case "zoom-through": {
      const zoomScale = interpolate(progress, [0, 0.5, 1], [0.95, 1.08, 1], { easing: EASE_IN_OUT });
      incomingStyle.transform = `scale(${zoomScale})`;
      incomingStyle.opacity = interpolate(progress, [0, 0.5, 1], [0, 1], { easing: EASE_OUT });
      break;
    }
    default:
      break;
  }

  return (
    <AbsoluteFill style={incomingStyle}>
      {children}
    </AbsoluteFill>
  );
}

/**
 * BeatCutTransition — pure style helper for beat-aligned transitions.
 *
 * IMPORTANT: This component has NO inner <Sequence> elements.
 * You must wrap it in <Sequence> at the correct frame positions yourself.
 *
 * Usage (at composition root level, not nested in another Sequence):
 *
 *   <Sequence from={0} durationInFrames={beatFrame}>
 *     <AbsoluteFill>{outgoingClip}</AbsoluteFill>
 *   </Sequence>
 *   <Sequence from={beatFrame} durationInFrames={transFrames}>
 *     <BeatCutTransition transition={transition}>
 *       {outgoingClip}
 *     </BeatCutTransition>
 *     <BeatCutTransitionIn transition={transition}>
 *       {incomingClip}
 *     </BeatCutTransitionIn>
 *   </Sequence>
 *   <Sequence from={beatFrame + transFrames} durationInFrames={remaining}>
 *     <AbsoluteFill>{incomingClip}</AbsoluteFill>
 *   </Sequence>
 *
 * All <Sequence> elements must be at the composition root level.
 * Never nest <BeatCutTransition> inside another <Sequence>.
 */
export function BeatCutTransition({
  children,
  transition,
}: {
  children: React.ReactNode;
  transition: TransitionConfig;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durFrames = Math.round((transition.duration ?? 400) * fps / 1000);
  const progress = Math.min(frame / durFrames, 1);

  let outgoingStyle: React.CSSProperties = {};

  switch (transition.type) {
    case "fade":
      outgoingStyle.opacity = 1 - interpolate(progress, [0, 1], [0, 1], { easing: EASE_IN });
      break;
    case "dissolve":
      outgoingStyle.opacity = 1 - interpolate(progress, [0, 1], [0, 1], { easing: EASE_IN_OUT });
      break;
    case "wipe-left":
      outgoingStyle.transform = `translateX(${-interpolate(progress, [0, 1], [0, 100], { easing: EASE_IN_OUT })}%)`;
      outgoingStyle.opacity = 1 - progress;
      break;
    case "wipe-right":
      outgoingStyle.transform = `translateX(${interpolate(progress, [0, 1], [0, 100], { easing: EASE_IN_OUT })}%)`;
      outgoingStyle.opacity = 1 - progress;
      break;
    case "zoom-through": {
      const zoomScale = interpolate(progress, [0, 0.5, 1], [1, 1.08, 1], { easing: EASE_IN_OUT });
      outgoingStyle.transform = `scale(${zoomScale})`;
      outgoingStyle.opacity = 1 - interpolate(progress, [0.5, 1], [0, 1], { easing: EASE_IN });
      break;
    }
    default:
      break;
  }

  return (
    <AbsoluteFill style={outgoingStyle}>
      {children}
    </AbsoluteFill>
  );
}

/**
 * BeatCutTransitionIn — incoming side of a beat-aligned transition.
 * Pure style helper, no inner <Sequence> elements.
 */
export function BeatCutTransitionIn({
  children,
  transition,
}: {
  children: React.ReactNode;
  transition: TransitionConfig;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const durFrames = Math.round((transition.duration ?? 400) * fps / 1000);
  const progress = Math.min(frame / durFrames, 1);

  let incomingStyle: React.CSSProperties = {};

  switch (transition.type) {
    case "fade":
      incomingStyle.opacity = interpolate(progress, [0, 1], [0, 1], { easing: EASE_OUT });
      break;
    case "dissolve":
      incomingStyle.opacity = interpolate(progress, [0, 1], [0, 1], { easing: EASE_IN_OUT });
      break;
    case "wipe-left":
      incomingStyle.transform = `translateX(${interpolate(progress, [0, 1], [100, 0], { easing: EASE_IN_OUT })}%)`;
      incomingStyle.opacity = progress;
      break;
    case "wipe-right":
      incomingStyle.transform = `translateX(${interpolate(progress, [0, 1], [-100, 0], { easing: EASE_IN_OUT })}%)`;
      incomingStyle.opacity = progress;
      break;
    case "zoom-through": {
      const zoomScale = interpolate(progress, [0, 0.5, 1], [0.95, 1.08, 1], { easing: EASE_IN_OUT });
      incomingStyle.transform = `scale(${zoomScale})`;
      incomingStyle.opacity = interpolate(progress, [0, 0.5, 1], [0, 1], { easing: EASE_OUT });
      break;
    }
    default:
      break;
  }

  return (
    <AbsoluteFill style={incomingStyle}>
      {children}
    </AbsoluteFill>
  );
}

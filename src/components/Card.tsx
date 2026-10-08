import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { EASE_OUT } from "../design/motion";
import { tokens } from "../design/tokens";

export function Card({
  children,
  accent = false,
  entering = true,
  enterDuration = 400,
  style,
}: {
  children: React.ReactNode;
  accent?: boolean;
  entering?: boolean;
  enterDuration?: number;
  style?: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enterFrames = entering ? enterDuration * fps / 1000 : 0;
  const progress = entering ? Math.min(frame / enterFrames, 1) : 1;
  const eased = interpolate(progress, [0, 1], [0, 1], { easing: EASE_OUT });

  return (
    <div
      style={{
        backgroundColor: tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderRadius: tokens.radius.lg,
        padding: tokens.space[8],
        boxShadow: tokens.shadow.md,
        opacity: eased,
        transform: `scale(${0.94 + 0.06 * eased}) translateY(${24 * (1 - eased)}px)`,
        borderLeft: accent ? `3px solid ${tokens.accent}` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

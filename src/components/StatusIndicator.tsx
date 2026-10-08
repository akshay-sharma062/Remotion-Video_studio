import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { EASE_OUT } from "../design/motion";
import { tokens } from "../design/tokens";

type Status = "success" | "warning" | "error" | "info";

const statusColors: Record<Status, string> = {
  success: tokens.success,
  warning: tokens.warning,
  error: tokens.error,
  info: tokens.accent,
};

export function StatusIndicator({
  status,
  label,
  entering = true,
  enterDuration = 400,
}: {
  status: Status;
  label: string;
  entering?: boolean;
  enterDuration?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enterFrames = entering ? enterDuration * fps / 1000 : 0;
  const progress = entering ? Math.min(frame / enterFrames, 1) : 1;
  const eased = interpolate(progress, [0, 1], [0, 1], { easing: EASE_OUT });

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: tokens.space[2],
        opacity: eased,
        transform: `translateY(${12 * (1 - eased)}px)`,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          backgroundColor: statusColors[status],
          display: "inline-block",
        }}
      />
      <span
        style={{
          fontFamily: tokens.fontFamily,
          fontSize: 16,
          fontWeight: 500,
          color: tokens.text,
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
}

import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { EASE_OUT } from "../design/motion";
import { tokens } from "../design/tokens";

export function EmptyState({
  icon,
  title = "Nothing here yet",
  subtitle,
  action,
  entering = true,
  enterDuration = 500,
}: {
  icon?: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
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
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.space[4],
        padding: `${tokens.space[8]}px ${tokens.space[4]}px`,
        textAlign: "center",
        opacity: eased,
        transform: `translateY(${16 * (1 - eased)}px)`,
      }}
    >
      {icon && (
        <div
          aria-hidden
          style={{
            width: 64,
            height: 64,
            color: tokens.textSecondary,
            opacity: 0.5,
          }}
        >
          {icon}
        </div>
      )}
      <span
        style={{
          fontFamily: tokens.fontFamily,
          fontSize: 20,
          fontWeight: 500,
          color: tokens.text,
          lineHeight: 1.4,
        }}
      >
        {title}
      </span>
      {subtitle && (
        <span
          style={{
            fontFamily: tokens.fontFamily,
            fontSize: 16,
            fontWeight: 400,
            color: tokens.textSecondary,
            lineHeight: 1.5,
            maxWidth: 320,
          }}
        >
          {subtitle}
        </span>
      )}
      {action && <div style={{ marginTop: tokens.space[4] }}>{action}</div>}
    </div>
  );
}

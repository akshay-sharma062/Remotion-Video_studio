import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { EASE_OUT } from "../design/motion";
import { tokens } from "../design/tokens";

type Variant = "primary" | "secondary" | "ghost";

const variantStyles: Record<Variant, { bg: string; color: string; border: string }> = {
  primary: {
    bg: tokens.accent,
    color: "#FFFFFF",
    border: "none",
  },
  secondary: {
    bg: tokens.surface,
    color: tokens.text,
    border: `1px solid ${tokens.border}`,
  },
  ghost: {
    bg: "transparent",
    color: tokens.textSecondary,
    border: "none",
  },
};

export function Button({
  children,
  variant = "primary",
  disabled = false,
  entering = true,
  enterDuration = 400,
  style,
}: {
  children: React.ReactNode;
  variant?: Variant;
  disabled?: boolean;
  entering?: boolean;
  enterDuration?: number;
  style?: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vs = variantStyles[variant];

  const enterFrames = entering ? enterDuration * fps / 1000 : 0;
  const progress = entering ? Math.min(frame / enterFrames, 1) : 1;
  const eased = interpolate(progress, [0, 1], [0, 1], { easing: EASE_OUT });

  return (
    <button
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.space[2],
        height: 48,
        padding: `0 ${tokens.space[6]}px`,
        backgroundColor: vs.bg,
        color: disabled ? tokens.textSecondary : vs.color,
        border: vs.border,
        borderRadius: tokens.radius.md,
        fontFamily: tokens.fontFamily,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1,
        boxShadow: tokens.shadow.md,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : eased,
        transform: `scale(${0.94 + 0.06 * eased}) translateY(${24 * (1 - eased)}px)`,
        outline: "none",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

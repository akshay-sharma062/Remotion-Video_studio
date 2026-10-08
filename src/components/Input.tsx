import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { EASE_OUT } from "../design/motion";
import { tokens } from "../design/tokens";

type Size = "md";

const sizes: Record<Size, { height: number; fontSize: number; padX: number }> = {
  md: { height: 48, fontSize: 16, padX: 16 },
};

export function Input({
  placeholder,
  value,
  error,
  disabled = false,
  entering = true,
  enterDuration = 400,
  style,
}: {
  placeholder?: string;
  value?: string;
  error?: string;
  disabled?: boolean;
  entering?: boolean;
  enterDuration?: number;
  style?: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = sizes.md;
  const enterFrames = entering ? enterDuration * fps / 1000 : 0;
  const progress = entering ? Math.min(frame / enterFrames, 1) : 1;
  const eased = interpolate(progress, [0, 1], [0, 1], { easing: EASE_OUT });

  return (
    <div style={{ position: "relative", ...style }}>
      <div
        style={{
          height: s.height,
          padding: `0 ${s.padX}px`,
          backgroundColor: disabled ? tokens.surfaceSunken : tokens.surface,
          border: `1px solid ${error ? tokens.error : tokens.border}`,
          borderRadius: tokens.radius.md,
          boxShadow: error ? `0 0 0 3px rgba(220,38,38,0.15)` : "none",
          display: "flex",
          alignItems: "center",
          opacity: eased,
          transform: `scale(${0.96 + 0.04 * eased})`,
        }}
      >
        <span
          style={{
            flex: 1,
            fontFamily: tokens.fontFamily,
            fontSize: s.fontSize,
            fontWeight: 400,
            color: disabled ? tokens.textSecondary : tokens.text,
            lineHeight: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {value ?? (
            <span style={{ color: tokens.textSecondary }}>{placeholder}</span>
          )}
        </span>
      </div>
      {error && (
        <span
          style={{
            display: "block",
            marginTop: tokens.space[2],
            fontFamily: tokens.fontFamily,
            fontSize: 14,
            color: tokens.error,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

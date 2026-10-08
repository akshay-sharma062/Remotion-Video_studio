import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { EASE_OUT } from "../design/motion";
import { tokens } from "../design/tokens";

export function BrowserWindow({
  children,
  title = "example.com",
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = Math.min(frame / (20 * fps / 1000), 1);
  const eased = interpolate(progress, [0, 1], [0, 1], { easing: EASE_OUT });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: tokens.surface,
        borderRadius: tokens.radius.lg,
        overflow: "hidden",
        boxShadow: tokens.shadow.lg,
        border: `1px solid ${tokens.border}`,
        opacity: eased,
        transform: `scale(${0.96 + 0.04 * eased}) translateY(${(1 - eased) * 20}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 14px",
          backgroundColor: tokens.bg,
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#FF5F57", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#FEBC2E", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#28C840", display: "inline-block" }} />
        <span
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 18,
            color: tokens.textSecondary,
            fontFamily: tokens.fontFamily,
          }}
        >
          {title}
        </span>
      </div>
      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          backgroundColor: tokens.surfaceSunken,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * BrowserWindow — a clean browser frame around your screenshot.
 *
 * Usage: <BrowserWindow title="mysite.com"><ScreenView src={screenshot} /></BrowserWindow>
 */

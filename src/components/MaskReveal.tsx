import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT } from "../design/motion";

export function MaskReveal({
  children,
  direction = "left",
  duration = 600,
}: {
  children: React.ReactNode;
  direction?: "left" | "right" | "up" | "down";
  duration?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = Math.min(frame / (duration * fps / 1000), 1);
  const eased = interpolate(progress, [0, 1], [0, 1], { easing: EASE_OUT });

  const reveal = eased * 100;
  const clipPath = (() => {
    switch (direction) {
      case "left": return `inset(0 ${100 - reveal}% 0 0)`;
      case "right": return `inset(0 0 0 ${100 - reveal}%)`;
      case "up": return `inset(${100 - reveal}% 0 0 0)`;
      case "down": return `inset(0 0 ${100 - reveal}% 0)`;
    }
  })();

  return (
    <div style={{ clipPath, WebkitClipPath: clipPath }}>
      {children}
    </div>
  );
}

/**
 * MaskReveal — text that wipes in from behind a soft-edged mask.
 *
 * Usage: <MaskReveal direction="left" duration={600}><Heading /></MaskReveal>
 */

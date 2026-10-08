import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT } from "../design/motion";

export function ScreenView({
  src,
  pan = { x: 0, y: 0 },
  zoom = 1,
  duration = 600,
}: {
  src: string;
  pan?: { x: number; y: number };
  zoom?: number;
  duration?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = Math.min(frame / (duration * fps / 1000), 1);
  const eased = interpolate(progress, [0, 1], [0, 1], { easing: EASE_IN_OUT });

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden" }}>
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${1 + (zoom - 1) * eased}) translate(${pan.x * eased}px, ${pan.y * eased}px)`,
        }}
      />
    </div>
  );
}

/**
 * ScreenView — a screenshot that pans and zooms inside a BrowserWindow.
 *
 * Usage: <ScreenView src="screenshot.png" pan={{x:-40, y:20}} zoom={1.15} />
 */

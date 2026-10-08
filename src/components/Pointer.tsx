import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT } from "../design/motion";

export function Pointer({
  x,
  y,
  startDelay = 0,
  duration = 400,
  clickAt,
}: {
  x: number;
  y: number;
  startDelay?: number;
  duration?: number;
  clickAt?: { frame: number };
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterT = Math.max(0, Math.min((frame - startDelay) / (duration * fps / 1000), 1));
  const eased = interpolate(enterT, [0, 1], [0, 1], { easing: EASE_OUT });

  const isClicking = clickAt !== undefined && frame >= clickAt.frame && frame < clickAt.frame + fps * 0.2;
  const clickScale = isClicking
    ? interpolate(frame - clickAt!.frame, [0, 8], [1, 1.8], { easing: EASE_OUT })
    : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: x * eased,
        top: y * eased,
        width: 36,
        height: 36,
        transform: `translate(-50%, -50%) scale(${clickScale})`,
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      <svg
        width="36"
        height="36"
        viewBox="0 0 36 36"
        fill="none"
        style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))" }}
      >
        <path
          d="M8 4L28 18L18 20L14 30Z"
          fill="white"
          stroke="#1A1A1A"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      {isClicking && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "2px solid rgba(255,77,45,0.7)",
            transform: `scale(${1 + (frame - clickAt!.frame) * 0.3})`,
            opacity: 1 - (frame - clickAt!.frame) / (fps * 0.2),
          }}
        />
      )}
    </div>
  );
}

/**
 * Pointer — an arrow that glides to a point and clicks with a ripple.
 *
 * Usage: <Pointer x={540} y={900} duration={400} clickAt={{frame: 150}} />
 */

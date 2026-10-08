import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  Easing,
} from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT } from "../design/motion";

export interface ZoomThroughCut {
  frame: number;
  duration?: number;
  maxZoom?: number;
}

export function Stage({
  src,
  zoomThrough = [],
  objectFit = "cover",
}: {
  src: string;
  zoomThrough?: ZoomThroughCut[];
  objectFit?: "cover" | "contain";
}) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const activeCut = zoomThrough.find((cut) => frame >= cut.frame);
  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  if (activeCut) {
    const duration = activeCut.duration ?? 1200;
    const maxZoom = activeCut.maxZoom ?? 1.12;
    const endFrame = activeCut.frame + (duration / 1000) * fps;

    if (frame < endFrame) {
      const progress = (frame - activeCut.frame) / (endFrame - activeCut.frame);
      const eased = interpolate(progress, [0, 0.5, 1], [0, 1, 0], {
        easing: EASE_IN_OUT,
      });
      scale = 1 + (maxZoom - 1) * eased;
      translateX = (1 - scale) * width * 0.5;
      translateY = (1 - scale) * height * 0.5;
    }
  }

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <video
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/**
 * Stage — full-screen footage with zoom-through for jump cuts.
 *
 * Usage: <Stage src={footageSrc} zoomThrough={[{frame: 120}]} />
 */

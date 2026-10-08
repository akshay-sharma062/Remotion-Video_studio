import { useCurrentFrame, interpolate } from "remotion";
import { EASE_OUT } from "../design/motion";

export function LocationLabel({
  location,
  date,
  duration = 400,
}: {
  location: string;
  date?: string;
  duration?: number;
}) {
  const frame = useCurrentFrame();
  const progress = Math.min(frame / (duration * 0.6), 1);
  const eased = interpolate(progress, [0, 1], [0, 1], { easing: EASE_OUT });

  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        left: 48,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        opacity: eased,
        transform: `translateY(${(1 - eased) * 12}px)`,
        zIndex: 10,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <span style={{ fontSize: 116, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.1 }}>
        {location}
      </span>
      {date && (
        <span style={{ fontSize: 40, fontWeight: 500, letterSpacing: "0.1em", color: "#6B6B6B", textTransform: "uppercase" }}>
          {date}
        </span>
      )}
    </div>
  );
}

/**
 * LocationLabel — small place/date label for montages.
 *
 * Usage: <LocationLabel location="Tokyo" date="Apr 2024" />
 */

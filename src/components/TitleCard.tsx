import { useCurrentFrame, interpolate } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT } from "../design/motion";

export function TitleCard({
  title,
  subtitle,
  duration = 90,
}: {
  title: string;
  subtitle?: string;
  duration?: number;
}) {
  const frame = useCurrentFrame();
  const progress = Math.min(frame / duration, 1);
  const eased = interpolate(progress, [0, 1], [0, 1], { easing: EASE_OUT });
  const exit = progress > 0.75
    ? interpolate(progress, [0.75, 1], [0, 1], { easing: EASE_IN })
    : 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F8F7F4",
        opacity: 1 - exit,
        transform: `translateY(${(1 - eased) * 30}px)`,
        fontFamily: "'Inter', sans-serif",
        padding: 48,
      }}
    >
      <h1
        style={{
          fontSize: 116,
          fontWeight: 700,
          color: "#1A1A1A",
          lineHeight: 1.1,
          margin: 0,
          textAlign: "center",
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          style={{
            fontSize: 40,
            fontWeight: 500,
            letterSpacing: "0.1em",
            color: "#6B6B6B",
            marginTop: 16,
            textTransform: "uppercase",
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

/**
 * TitleCard — clean typographic opening card for montages.
 *
 * Usage: <TitleCard title="Tokyo" subtitle="Japan — 2024" />
 */

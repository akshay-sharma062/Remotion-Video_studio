import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { EASE_OUT } from "../design/motion";
import { tokens } from "../design/tokens";

function rollDigit(digit: number, from: number, to: number, progress: number): number {
  if (from === to) return to;
  const range = to - from;
  const wrapped = ((from + range * progress) % 10 + 10) % 10;
  return Math.round(wrapped);
}

export function RollingNumber({
  from,
  to,
  duration = 800,
  pad = 3,
  className,
  style,
}: {
  from: number;
  to: number;
  duration?: number;
  pad?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = Math.min(frame / (duration * (fps / 1000)), 1);
  const eased = interpolate(progress, [0, 1], [0, 1], {
    easing: EASE_OUT,
  });

  const digits = String(to).padStart(pad, "0").split("");
  const fromStr = String(from).padStart(pad, "0");

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        fontVariantNumeric: "tabular-nums",
        fontFamily: tokens.fontFamily,
        fontSize: tokens.type.bigNumber.size,
        fontWeight: tokens.type.bigNumber.weight,
        lineHeight: tokens.type.bigNumber.lineHeight,
        color: tokens.accent,
        ...style,
      }}
    >
      {digits.map((targetDigit, i) => {
        const fromDigit = parseInt(fromStr[i] ?? "0", 10);
        const target = parseInt(targetDigit, 10);
        const current = rollDigit(i, fromDigit, target, eased);
        const translateY = (1 - eased) * -20;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              transform: `translateY(${translateY}px)`,
              opacity: eased,
            }}
          >
            {current}
          </span>
        );
      })}
    </span>
  );
}

/**
 * RollingNumber — digits roll from one value to another.
 *
 * Usage: <RollingNumber from={0} to={1337} duration={800} pad={4} />
 */

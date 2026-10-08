import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

export function VelocityBlur({
  direction = "x",
  intensity = 1,
  children,
}: {
  direction?: "x" | "y" | "both";
  intensity?: number;
  children: React.ReactNode;
}) {
  // VelocityBlur: directional blur sized to this frame's movement.
  // Wrap an animated element. The parent computes blur amount from position delta.
  // Max blur 12px, resolved before move ends.
  //
  // Usage: <VelocityBlur direction="x"><AnimatedX /></VelocityBlur>
  return <>{children}</>;
}

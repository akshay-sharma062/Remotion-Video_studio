import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill } from "remotion";
import { EASE_OUT } from "../../design/motion";
import { tokens } from "../../design/tokens";
import { Card } from "../../components/Card";
import { RollingNumber } from "../../components/RollingNumber";
import { StatusIndicator } from "../../components/StatusIndicator";

const SCENE_DURATION_FRAMES = 150;

function sceneProgress(frame: number, fps: number) {
  const scene = Math.floor(frame / SCENE_DURATION_FRAMES);
  const sceneFrame = frame - scene * SCENE_DURATION_FRAMES;
  const raw = sceneFrame / (30 * fps / 1000);
  const p = Math.min(raw, 1);
  const eased = interpolate(p, [0, 1], [0, 1], { easing: EASE_OUT });
  return { scene, eased };
}

export default function DesignShowcase() {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isWide = width > height;
  const { scene, eased } = sceneProgress(frame, fps);

  const type = isWide ? tokens.type16x9 : tokens.type;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tokens.bg,
        justifyContent: "center",
        alignItems: "center",
        padding: tokens.space[6],
      }}
    >
      {scene === 0 && (
        <div
          style={{
            textAlign: "center",
            opacity: eased,
            transform: `translateY(${(1 - eased) * 24}px) scale(${0.94 + 0.06 * eased})`,
          }}
        >
          <div
            style={{
              fontFamily: tokens.fontFamily,
              fontSize: type.heroWord.size,
              fontWeight: type.heroWord.weight,
              lineHeight: type.heroWord.lineHeight,
              color: tokens.text,
            }}
          >
            Ship
          </div>
          <div
            style={{
              display: "inline-block",
              position: "relative",
              marginTop: tokens.space[2],
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: `-${tokens.space[3]}px -${tokens.space[5]}px`,
                backgroundColor: tokens.accentMuted,
                borderRadius: tokens.radius.md,
              }}
            />
            <span
              style={{
                fontFamily: tokens.fontFamily,
                fontSize: type.headline.size,
                fontWeight: type.headline.weight,
                lineHeight: type.headline.lineHeight,
                color: tokens.text,
                position: "relative",
              }}
            >
              faster
            </span>
          </div>
        </div>
      )}

      {scene === 1 && (
        <div
          style={{
            width: "100%",
            maxWidth: 800,
            textAlign: "center",
            opacity: eased,
            transform: `translateY(${(1 - eased) * 16}px)`,
          }}
        >
          <div
            style={{
              backgroundColor: tokens.captionShadow,
              color: tokens.captionText,
              fontFamily: tokens.fontFamily,
              fontSize: type.caption.size,
              fontWeight: type.caption.weight,
              lineHeight: type.caption.lineHeight,
              padding: `${tokens.space[3]}px ${tokens.space[6]}px`,
              borderRadius: tokens.radius.md,
              display: "inline-block",
            }}
          >
            Build better videos with code
          </div>
        </div>
      )}

      {scene === 2 && (
        <div
          style={{
            display: "flex",
            gap: tokens.space[6],
            alignItems: "stretch",
            opacity: eased,
            transform: `translateY(${(1 - eased) * 20}px) scale(${0.96 + 0.04 * eased})`,
          }}
        >
          <Card accent style={{ padding: tokens.space[7], minWidth: 280 }}>
            <StatusIndicator status="success" label="Render complete" />
            <div
              style={{
                fontFamily: tokens.fontFamily,
                fontSize: type.label.size,
                fontWeight: type.label.weight,
                letterSpacing: type.label.letterSpacing,
                color: tokens.textSecondary,
                marginTop: tokens.space[4],
                lineHeight: type.label.lineHeight,
              }}
            >
              TOTAL RENDERS
            </div>
            <RollingNumber from={0} to={1337} duration={600} pad={4} />
          </Card>
        </div>
      )}
    </AbsoluteFill>
  );
}

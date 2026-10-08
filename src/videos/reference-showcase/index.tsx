import { useCurrentFrame, useVideoConfig, interpolate, AbsoluteFill, Sequence } from "remotion";
import { EASE_IN, EASE_OUT } from "../../design/motion";
import { tokens } from "../../design/tokens";
import {
  OvershootSlam,
  KineticSwap,
} from "../../components/KineticSlam";
import { HighlightMark } from "../../components/HighlightMark";
import { RollingNumber } from "../../components/RollingNumber";
import { TitleCard } from "../../components/TitleCard";

const FPS = 30;

// --- scene timings (in frames) ---
const SCENE_1 = { start: 0, end: 90 };      // Kinetic slam — "Are You Someone"
const SCENE_2 = { start: 90, end: 150 };    // Kinetic swap — "Are You Someone" → "Working In"
const SCENE_3 = { start: 150, end: 240 };   // Selective HighlightMark — "Paying Verticals"
const SCENE_4 = { start: 240, end: 330 };   // Pivot HighlightMark — "It&apos;s About Having"
const SCENE_5 = { start: 330, end: 420 };   // Stacked headline + rolling number
const SCENE_6 = { start: 420, end: 510 };   // Kinetic slam with yellow fill variant

const type = tokens.type;

function sceneProgress(frame: number, start: number, end: number) {
  return Math.min(Math.max((frame - start) / (end - start), 0), 1);
}

export default function ReferenceShowcase() {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isWide = width > height;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: tokens.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Scene 1: Kinetic slam — bold yellow fill, thick black stroke */}
      <Sequence from={SCENE_1.start} durationInFrames={SCENE_1.end - SCENE_1.start}>
        <SlamDemo
          text="Are You Someone"
          fill="#FFE500"
          stroke="#000000"
          strokeWidth={4}
        />
      </Sequence>

      {/* Scene 2: Kinetic swap */}
      <Sequence from={SCENE_2.start} durationInFrames={SCENE_2.end - SCENE_2.start}>
        <SwapDemo />
      </Sequence>

      {/* Scene 3: Selective HighlightMark */}
      <Sequence from={SCENE_3.start} durationInFrames={SCENE_3.end - SCENE_3.start}>
        <SelectiveDemo />
      </Sequence>

      {/* Scene 4: Pivot HighlightMark */}
      <Sequence from={SCENE_4.start} durationInFrames={SCENE_4.end - SCENE_4.start}>
        <PivotDemo />
      </Sequence>

      {/* Scene 5: Stacked headline */}
      <Sequence from={SCENE_5.start} durationInFrames={SCENE_5.end - SCENE_5.start}>
        <StackedDemo />
      </Sequence>

      {/* Scene 6: CTA slam */}
      <Sequence from={SCENE_6.start} durationInFrames={SCENE_6.end - SCENE_6.start}>
        <CTADemo />
      </Sequence>
    </AbsoluteFill>
  );
}

// --- individual scenes ---

function SlamDemo({
  text,
  fill,
  stroke,
  strokeWidth,
}: {
  text: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
}) {
  const frame = useCurrentFrame();
  const progress = sceneProgress(frame, 0, 60);

  const eased = interpolate(progress, [0, 1], [0, 1], { easing: EASE_OUT });
  const scale = interpolate(progress, [0, 0.6, 1], [0.94, 1.06, 1.0], { easing: EASE_OUT });
  const translateY = interpolate(progress, [0, 1], [24, 0], { easing: EASE_OUT });
  const blurProgress = Math.min(progress / 0.6, 1);
  const blur = interpolate(blurProgress, [0, 1], [8, 0], { easing: EASE_OUT });
  const opacity = progress < 0.6 ? progress / 0.6 : 1;

  const isLarge = text.length > 12;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: tokens.space[6],
      }}
    >
      <span
        style={{
          fontFamily: tokens.fontFamily,
          fontSize: isLarge ? 72 : 100,
          fontWeight: 700,
          color: fill,
          WebkitTextStroke: `${strokeWidth}px ${stroke}`,
          paintOrder: "stroke fill",
          lineHeight: 1.1,
          textAlign: "center",
          opacity,
          transform: `translateY(${translateY}px) scale(${scale})`,
          filter: blur > 0.5 ? `blur(${blur}px)` : "none",
        }}
      >
        {text}
      </span>
    </div>
  );
}

function SwapDemo() {
  const frame = useCurrentFrame();
  const swapFrame = 20;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: tokens.space[6],
      }}
    >
      <KineticSwap
        oldText="Are You Someone"
        newText="Working In"
        swapAt={swapFrame}
        duration={400}
        fontSize={100}
        fontWeight={700}
        color="#1A1A1A"
      />
    </div>
  );
}

function SelectiveDemo() {
  const frame = useCurrentFrame();
  const startFrame = 0;
  const durationFrames = 500 * FPS / 1000;
  const progress = sceneProgress(frame, startFrame, startFrame + durationFrames + 30);

  const eased = interpolate(progress, [0, 1], [0, 1], { easing: EASE_OUT });
  const scale = interpolate(progress, [0, 0.6, 1], [0.94, 1.06, 1.0], { easing: EASE_OUT });
  const translateY = interpolate(progress, [0, 1], [24, 0], { easing: EASE_OUT });
  const blur = interpolate(Math.min(progress / 0.6, 1), [0, 1], [8, 0], { easing: EASE_OUT });
  const opacity = progress < 0.6 ? progress / 0.6 : 1;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: tokens.space[6],
      }}
    >
      <span
        style={{
          fontFamily: tokens.fontFamily,
          fontSize: 100,
          fontWeight: 700,
          color: tokens.text,
          lineHeight: 1.1,
          textAlign: "center",
          opacity,
          transform: `translateY(${translateY}px) scale(${scale})`,
          filter: blur > 0.5 ? `blur(${blur}px)` : "none",
        }}
      >
        <HighlightMark duration={500} color="#FF4D2D" thickness={6}>
          Paying
        </HighlightMark>
        {" "}Verticals
      </span>
    </div>
  );
}

function PivotDemo() {
  const frame = useCurrentFrame();
  const durationFrames = 500 * FPS / 1000;
  const progress = sceneProgress(frame, 0, durationFrames + 30);

  const eased = interpolate(progress, [0, 1], [0, 1], { easing: EASE_OUT });
  const scale = interpolate(progress, [0, 0.6, 1], [0.94, 1.06, 1.0], { easing: EASE_OUT });
  const translateY = interpolate(progress, [0, 1], [24, 0], { easing: EASE_OUT });
  const blur = interpolate(Math.min(progress / 0.6, 1), [0, 1], [8, 0], { easing: EASE_OUT });
  const opacity = progress < 0.6 ? progress / 0.6 : 1;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: tokens.space[6],
      }}
    >
      <span
        style={{
          fontFamily: tokens.fontFamily,
          fontSize: 84,
          fontWeight: 700,
          color: tokens.text,
          lineHeight: 1.1,
          textAlign: "center",
          opacity,
          transform: `translateY(${translateY}px) scale(${scale})`,
          filter: blur > 0.5 ? `blur(${blur}px)` : "none",
        }}
      >
        It&apos;s About{" "}
        <HighlightMark duration={500} color="#FF4D2D" thickness={6}>
          Having
        </HighlightMark>
      </span>
    </div>
  );
}

function StackedDemo() {
  const frame = useCurrentFrame();
  const holdFrames = 50;
  const exitStart = 60;

  const enterProgress = Math.min(frame / 50, 1);
  const easedEnter = interpolate(enterProgress, [0, 1], [0, 1], { easing: EASE_OUT });

  const scale = interpolate(enterProgress, [0, 0.6, 1], [0.94, 1.06, 1.0], { easing: EASE_OUT });
  const translateY = interpolate(enterProgress, [0, 1], [24, 0], { easing: EASE_OUT });
  const blur = interpolate(Math.min(enterProgress / 0.6, 1), [0, 1], [8, 0], { easing: EASE_OUT });
  const opacity = enterProgress < 0.6 ? enterProgress / 0.6 : 1;

  const exitProgress = frame > exitStart ? Math.min((frame - exitStart) / 30, 1) : 0;
  const easedExit = interpolate(exitProgress, [0, 1], [0, 1], { easing: EASE_IN });
  const finalOpacity = frame > exitStart ? opacity * (1 - easedExit) : opacity;

  const showNumber = frame > 25 && frame < 80;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: tokens.space[4],
      }}
    >
      <span
        style={{
          fontFamily: tokens.fontFamily,
          fontSize: 100,
          fontWeight: 700,
          color: tokens.text,
          lineHeight: 1.1,
          textAlign: "center",
          opacity: finalOpacity,
          transform: `translateY(${translateY}px) scale(${scale})`,
          filter: blur > 0.5 ? `blur(${blur}px)` : "none",
        }}
      >
        Right Negotiation
        <br />
        Strategy
      </span>

      {showNumber && (
        <span
          style={{
            fontFamily: tokens.fontFamily,
            fontSize: 150,
            fontWeight: 600,
            color: "#FF4D2D",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <RollingNumber from={0} to={47} duration={400} pad={2} />
        </span>
      )}
    </div>
  );
}

function CTADemo() {
  const frame = useCurrentFrame();
  const durationFrames = 60;

  const progress = Math.min(frame / durationFrames, 1);
  const eased = interpolate(progress, [0, 1], [0, 1], { easing: EASE_OUT });
  const scale = interpolate(progress, [0, 0.6, 1], [0.94, 1.06, 1.0], { easing: EASE_OUT });
  const translateY = interpolate(progress, [0, 1], [24, 0], { easing: EASE_OUT });
  const blur = interpolate(Math.min(progress / 0.6, 1), [0, 1], [8, 0], { easing: EASE_OUT });
  const opacity = progress < 0.6 ? progress / 0.6 : 1;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: tokens.space[3],
      }}
    >
      <span
        style={{
          fontFamily: tokens.fontFamily,
          fontSize: 96,
          fontWeight: 700,
          color: "#FFE500",
          WebkitTextStroke: `3px #000000`,
          paintOrder: "stroke fill",
          lineHeight: 1.1,
          textAlign: "center",
          opacity,
          transform: `translateY(${translateY}px) scale(${scale})`,
          filter: blur > 0.5 ? `blur(${blur}px)` : "none",
        }}
      >
        ENTIRE SYSTEM
      </span>
      <span
        style={{
          fontFamily: tokens.fontFamily,
          fontSize: 48,
          fontWeight: 700,
          color: "#FF4D2D",
          letterSpacing: "0.02em",
          marginTop: tokens.space[4],
          opacity: Math.max(0, (progress - 0.5) * 2),
        }}
      >
        REGISTER NOW
      </span>
    </div>
  );
}

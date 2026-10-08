import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  staticFile,
  Video,
  Sequence,
} from "remotion";
import { OvershootSlam } from "../../components/KineticSlam";
import { EASE_IN, EASE_OUT } from "../../design/motion";
import { tokens } from "../../design/tokens";
import WORDS from "../../videos/organic-affiliate-marketing/words.generated";

// ─── Caption bar ─────────────────────────────────────────────────────────
function CaptionBar({ startMs }: { startMs: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000 + startMs;

  let activeIdx = -1;
  for (let i = WORDS.length - 1; i >= 0; i--) {
    if (currentMs >= WORDS[i][1]) {
      activeIdx = i;
      break;
    }
  }

  if (activeIdx < 0) return null;

  const windowWords = WORDS.slice(activeIdx, activeIdx + 8);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 60,
        left: 32,
        right: 32,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 8,
        padding: "16px 24px",
        zIndex: 20,
      }}
    >
      {windowWords.map(([word], i) => {
        const isCurrent = i === 0;
        const isUpcoming = i > 0;

        return (
          <span
            key={`${activeIdx + i}`}
            style={{
              fontFamily: tokens.fontFamily,
              fontSize: tokens.type.caption.size,
              fontWeight: isCurrent ? 700 : 500,
              color: tokens.captionText,
              opacity: isCurrent ? 1 : isUpcoming ? 0.7 : 0.5,
              textShadow: isCurrent
                ? "0 2px 12px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.5)"
                : "0 1px 6px rgba(0,0,0,0.5)",
              lineHeight: tokens.type.caption.lineHeight,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

// ─── Scene boundaries (frames at 30fps) ────────────────────────────────────
// Scene 1: Hook (0–7.5s) — full speaker, captions only
// Scene 2: ORGANIC (7.5–17.7s) — HighlightMark + slam at word "ORGANIC"
// Scene 3: GENERATING RESULTS (17.7–29.7s) — slam at word "generating"
// Scene 4: THIS SUNDAY (29.7–36.5s) — slam at word "this"
// Scene 5: Beat (36.5–41.5s) — captions only
// Scene 6: CTA (41.5–63.8s) — slam at word "join"
const S1_END = 7500;
const S2_END = 17700;
const S3_END = 29700;
const S4_END = 36500;
const S5_END = 41500;
const TOTAL_MS = 63800;

// Jump cut frames (30fps) where zoom-through hides the cut:
// Cut ~26.9s -> frame 807 (gap between "methods." and "Right?")
// Cut ~38.1s -> frame 1143 (gap between "Sunday" gesture and word)
const CUT_FRAME_1 = Math.round(26900 / 1000 * 30); // ~807
const CUT_FRAME_2 = Math.round(38100 / 1000 * 30); // ~1143

function msToFrames(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps);
}

// ─── Positioned slam wrapper ──────────────────────────────────────────────
function SlamBox({ top, children }: { top: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10,
        textAlign: "center",
        pointerEvents: "none",
      }}
    >
      {children}
    </div>
  );
}

// ─── Delayed HighlightMark ────────────────────────────────────────────────
function DelayedHighlightMark({
  sceneStartMs,
  wordStartMs,
  duration = 600,
  color = tokens.accent,
  thickness = 6,
  paddingY = 6,
  children,
}: {
  sceneStartMs: number;
  wordStartMs: number;
  duration?: number;
  color?: string;
  thickness?: number;
  paddingY?: number;
  children: React.ReactNode;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delayMs = wordStartMs - sceneStartMs;
  const delayFrames = Math.round((delayMs / 1000) * fps);
  const enterFrames = Math.round((duration / 1000) * fps);

  const localFrame = Math.max(0, frame - delayFrames);
  const progress = Math.min(localFrame / enterFrames, 1);
  const easedProgress = interpolate(progress, [0, 1], [0, 1], { easing: EASE_OUT });
  const widthPercent = easedProgress * 100;
  const opacity = progress > 0 ? Math.min(progress / 0.3, 1) : 0;

  if (opacity < 0.01) return null;

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: -paddingY,
          bottom: -paddingY,
          backgroundColor: color,
          borderRadius: 4,
          clipPath: `inset(0 ${100 - widthPercent}% 0 0)`,
          opacity,
        }}
      />
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </span>
  );
}

// ─── Video layer with zoom-through jump-cut covers ─────────────────────────
function VideoLayer() {
  const frame = useCurrentFrame();

  const PEAK_FRAMES = 6;
  const RECOVER_FRAMES = 16;

  let scale = 1.0;
  let translateY = 0;

  for (const cut of [CUT_FRAME_1, CUT_FRAME_2]) {
    const enterStart = cut - PEAK_FRAMES;
    const exitEnd = cut + RECOVER_FRAMES;

    if (frame >= enterStart && frame <= exitEnd) {
      const local = frame - enterStart;
      const total = PEAK_FRAMES + RECOVER_FRAMES;

      let s: number, ty: number;
      if (local <= PEAK_FRAMES) {
        s = interpolate(local, [0, PEAK_FRAMES], [1.0, 1.06], {
          easing: EASE_IN,
        });
        ty = interpolate(local, [0, PEAK_FRAMES], [0, -8], {
          easing: EASE_IN,
        });
      } else {
        s = interpolate(local, [PEAK_FRAMES, total], [1.06, 1.0], {
          easing: EASE_OUT,
        });
        ty = interpolate(local, [PEAK_FRAMES, total], [-8, 0], {
          easing: EASE_OUT,
        });
      }

      scale = Math.max(scale, s);
      translateY = Math.min(translateY, ty);
    }
  }

  const videoSrc = staticFile(
    "projects/organic-affiliate-marketing/footage/Shobhit-portrait.mp4"
  );

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `scale(${scale}) translateY(${translateY}px)`,
        zIndex: 1,
      }}
    >
      <Video
        src={videoSrc}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
    </div>
  );
}

// ─── Kinetic text colors matching reference-showcase ───────────────────────
// Reference style: yellow (#FFE500) fill + black stroke
const SLAM_YELLOW = "#FFE500";
const SLAM_STROKE = "#000000";

// ─── Main composition ─────────────────────────────────────────────────────
export default function OrganicAffiliateMarketing() {
  const { fps } = useVideoConfig();

  const totalFrames = msToFrames(TOTAL_MS, fps);

  // Caption bar start offsets — must equal scene start (absolute video ms)
  const s1CaptionStart = 0;
  const s2CaptionStart = S1_END;
  const s3CaptionStart = S2_END;
  const s4CaptionStart = S3_END;
  const s5CaptionStart = S4_END;
  const s6CaptionStart = S5_END;

  // Animation delays (ms within scene, from corrected word timestamps)
  const s2Delay = Math.round(26920 - S1_END);
  const s3Delay = Math.round(31400 - S2_END);
  const s4Delay = Math.round(37800 - S3_END);
  const s6Delay = Math.round(56810 - S5_END);

  return (
    <AbsoluteFill>
      {/* Video background — spans entire timeline, zoom-through hides cut artifacts */}
      <Sequence from={0} durationInFrames={totalFrames}>
        <VideoLayer />
      </Sequence>

      {/* Scene 1: Hook — full speaker, captions only (0–7.5s) */}
      <Sequence from={0} durationInFrames={msToFrames(S1_END, fps)}>
        <CaptionBar startMs={s1CaptionStart} />
      </Sequence>

      {/* Scene 2: ORGANIC — HighlightMark + slam at word "ORGANIC" */}
      <Sequence
        from={msToFrames(S1_END, fps)}
        durationInFrames={msToFrames(S2_END - S1_END, fps)}
      >
        <CaptionBar startMs={s2CaptionStart} />

        <SlamBox top="14%">
          <DelayedHighlightMark
            sceneStartMs={S1_END}
            wordStartMs={26920}
            duration={600}
            color={tokens.accent}
            thickness={6}
            paddingY={6}
          >
            <OvershootSlam
              duration={500}
              delay={s2Delay}
              fontSize={tokens.type.heroWord.size}
              fontWeight={tokens.type.heroWord.weight}
              color={SLAM_YELLOW}
              strokeColor={SLAM_STROKE}
              strokeWidth={3}
              textTransform="uppercase"
            >
              ORGANIC
            </OvershootSlam>
          </DelayedHighlightMark>
        </SlamBox>
      </Sequence>

      {/* Scene 3: GENERATING RESULTS — slam at word "generating" */}
      <Sequence
        from={msToFrames(S2_END, fps)}
        durationInFrames={msToFrames(S3_END - S2_END, fps)}
      >
        <CaptionBar startMs={s3CaptionStart} />

        <SlamBox top="10%">
          <OvershootSlam
            duration={500}
            delay={s3Delay}
            fontSize={tokens.type.headline.size}
            fontWeight={tokens.type.headline.weight}
            color={SLAM_YELLOW}
            strokeColor={SLAM_STROKE}
            strokeWidth={3}
            textTransform="uppercase"
          >
            GENERATING RESULTS
          </OvershootSlam>
        </SlamBox>
      </Sequence>

      {/* Scene 4: THIS SUNDAY — slam at word "this" */}
      <Sequence
        from={msToFrames(S3_END, fps)}
        durationInFrames={msToFrames(S4_END - S3_END, fps)}
      >
        <CaptionBar startMs={s4CaptionStart} />

        <SlamBox top="10%">
          <OvershootSlam
            duration={500}
            delay={s4Delay}
            fontSize={tokens.type.headline.size}
            fontWeight={tokens.type.headline.weight}
            color={SLAM_YELLOW}
            strokeColor={SLAM_STROKE}
            strokeWidth={3}
            textTransform="uppercase"
          >
            THIS SUNDAY
          </OvershootSlam>
        </SlamBox>
      </Sequence>

      {/* Scene 5: Beat — captions only (36.5–41.5s) */}
      <Sequence
        from={msToFrames(S4_END, fps)}
        durationInFrames={msToFrames(S5_END - S4_END, fps)}
      >
        <CaptionBar startMs={s5CaptionStart} />
      </Sequence>

      {/* Scene 6: CTA slam — SUNDAY 11AM + YOU CAN'T MISS IT */}
      <Sequence
        from={msToFrames(S5_END, fps)}
        durationInFrames={totalFrames - msToFrames(S5_END, fps)}
      >
        <CaptionBar startMs={s6CaptionStart} />

        <SlamBox top="12%">
          <OvershootSlam
            duration={500}
            delay={s6Delay}
            fontSize={100}
            fontWeight={700}
            lineHeight={1.3}
            color={SLAM_YELLOW}
            strokeColor={SLAM_STROKE}
            strokeWidth={3}
            textTransform="uppercase"
          >
            SUNDAY 11AM
          </OvershootSlam>
          <OvershootSlam
            duration={500}
            delay={s6Delay + 150}
            fontSize={64}
            fontWeight={700}
            lineHeight={1.3}
            color={SLAM_YELLOW}
            strokeColor={SLAM_STROKE}
            strokeWidth={3}
            textTransform="uppercase"
          >
            YOU CAN&apos;T MISS IT
          </OvershootSlam>
        </SlamBox>
      </Sequence>
    </AbsoluteFill>
  );
}

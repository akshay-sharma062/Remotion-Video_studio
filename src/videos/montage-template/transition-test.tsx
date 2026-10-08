/**
 * transition-test — minimal test for BeatCutTransition nesting fix.
 *
 * Tests that BeatCutTransition/BeatCutTransitionIn work correctly
 * when all <Sequence> elements are at the composition root level.
 *
 * This composition is NOT registered in Root.tsx.
 * Render with: npx remotion render transition-test out/test.mp4
 */

import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  Sequence,
  staticFile,
} from "remotion";
import { EASE_IN, EASE_OUT } from "../../design/motion";
import { BeatCutTransition, BeatCutTransitionIn } from "../../components/Transition";

// ─── Config ───────────────────────────────────────────────────────────────
const FPS = 30;
const TRANSITION_MS = 400;
const TRANSITION_FRAMES = Math.round(TRANSITION_MS * FPS / 1000); // 12 frames

// Two solid-color "clips" using divs instead of video
function ColorClip({ color, label }: { color: string; label: string }) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 120,
          fontWeight: 700,
          color: "white",
          textShadow: "0 2px 8px rgba(0,0,0,0.5)",
        }}
      >
        {label}
      </span>
    </AbsoluteFill>
  );
}

// ─── Composition ──────────────────────────────────────────────────────────
export default function TransitionTest() {
  const totalFrames = 120; // 4 seconds at 30fps

  const beatFrame = 60; // Transition starts at frame 60

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Clip A: frames 0-59 */}
      <Sequence from={0} durationInFrames={beatFrame}>
        <ColorClip color="#DC2626" label="CLIP A" />
      </Sequence>

      {/* Transition zone: frames 60-71 */}
      <Sequence from={beatFrame} durationInFrames={TRANSITION_FRAMES}>
        <BeatCutTransition transition={{ type: "fade", duration: TRANSITION_MS }}>
          <ColorClip color="#DC2626" label="CLIP A" />
        </BeatCutTransition>
        <BeatCutTransitionIn transition={{ type: "fade", duration: TRANSITION_MS }}>
          <ColorClip color="#2563EB" label="CLIP B" />
        </BeatCutTransitionIn>
      </Sequence>

      {/* Clip B: frames 72-119 */}
      <Sequence from={beatFrame + TRANSITION_FRAMES} durationInFrames={totalFrames - beatFrame - TRANSITION_FRAMES}>
        <ColorClip color="#2563EB" label="CLIP B" />
      </Sequence>

      {/* Frame counter for verification */}
      <FrameCounter />
    </AbsoluteFill>
  );
}

function FrameCounter() {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        right: 20,
        fontFamily: "monospace",
        fontSize: 14,
        color: "white",
        backgroundColor: "rgba(0,0,0,0.7)",
        padding: "4px 8px",
        borderRadius: 4,
        zIndex: 100,
      }}
    >
      f:{frame} | t:{(frame / FPS).toFixed(2)}s
    </div>
  );
}

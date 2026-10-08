/**
 * montage-template — scaffold for 9:16 montage videos.
 *
 * Usage:
 *   1. Copy this folder to src/videos/[your-montage-name]/
 *   2. Rename the component and composition ID
 *   3. Fill in the SHOT_LIST with your b-roll clips and beat positions
 *   4. Register in Root.tsx
 *
 * Features:
 *   - Beat-aligned clip cuts
 *   - Title card opening
 *   - Location labels
 *   - Clean transitions (fade, wipe, zoom-through)
 *   - 9:16 primary (1080x1920)
 *   - Optional 16:9 adaptation
 */

import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  Sequence,
  Audio,
  staticFile,
} from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT } from "../../design/motion";
import { tokens } from "../../design/tokens";
import { TitleCard, LocationLabel } from "../../components/TitleCard";
import { ClipTransition, ClipTransitionIn, BeatCutTransition, BeatCutTransitionIn } from "../../components/Transition";
import { BeatCut, Beat } from "../../components/BeatCut";

// ─── Configuration ────────────────────────────────────────────────────────
const FPS = 30;
const TRANSITION_DURATION = 400; // ms

// Shot list — replace with your clips and beat positions
interface Shot {
  src: string;
  startFrame: number;
  endFrame: number;
  label?: string;
  location?: string;
  date?: string;
}

const SHOT_LIST: Shot[] = [
  { src: "", startFrame: 0, endFrame: 90, label: "TITLE", location: "LOCATION", date: "2025" },
  // Add your shots here:
  // { src: staticFile("projects/name/broll/clip1.mp4"), startFrame: 90, endFrame: 210, label: "Scene 1" },
  // { src: staticFile("projects/name/broll/clip2.mp4"), startFrame: 210, endFrame: 330, label: "Scene 2" },
];

// Beat map — load from work/[name]/prep/refs/beat-map.json
// For now, placeholder beats every ~120 frames (~4s at 30fps = 15 BPM)
const BEATS: Beat[] = [];
for (let f = 0; f < 2000; f += 120) {
  BEATS.push({ frame: f, strength: 1 });
}

// Transition config
const TRANSITION: TransitionType = "fade";

// ─── Clip Player ──────────────────────────────────────────────────────────
function ClipPlayer({ src, startFrame, endFrame, label, location, date }: Shot) {
  // This component renders a single b-roll clip.
  // For video clips, use Remotion's <Video> or <Stage> component.
  // For images, use <img> or <AbsoluteFill> with backgroundImage.

  const hasContent = src && src.length > 0;

  return (
    <AbsoluteFill>
      {hasContent ? (
        <video
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <AbsoluteFill
          style={{
            backgroundColor: tokens.surfaceSunken,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: tokens.fontFamily,
              fontSize: 48,
              color: tokens.textSecondary,
            }}
          >
            Add b-roll clip
          </span>
        </AbsoluteFill>
      )}

      {/* Location label */}
      {(location || date) && (
        <LocationLabel
          location={location ?? ""}
          date={date}
          duration={TRANSITION_DURATION}
        />
      )}
    </AbsoluteFill>
  );
}

// ─── Main Composition ─────────────────────────────────────────────────────
export default function MontageTemplate() {
  const totalFrames = SHOT_LIST.length > 0
    ? SHOT_LIST[SHOT_LIST.length - 1].endFrame
    : 90;

  return (
    <AbsoluteFill>
      {/* Audio */}
      {SHOT_LIST.length > 0 && (
        <Sequence from={0} durationInFrames={totalFrames}>
          <Audio
            src={staticFile("projects/montage-template/audio/music.mp3")}
            volume={0.6}
          />
        </Sequence>
      )}

      {/* Title card (first 90 frames / 3s) */}
      <Sequence from={0} durationInFrames={90}>
        <TitleCard
          title="YOUR TITLE"
          subtitle="Subtitle here"
          duration={90}
        />
      </Sequence>

      {/* B-roll clips with beat-aligned transitions */}
      {SHOT_LIST.map((shot, i) => {
        if (i === 0) return null; // Skip title shot
        const prevShot = SHOT_LIST[i - 1];
        const transFrames = Math.round(TRANSITION_DURATION * FPS / 1000);
        const cutFrame = shot.startFrame;

        return (
          <Sequence key={i} from={cutFrame} durationInFrames={shot.endFrame - cutFrame}>
            <ClipPlayer {...shot} />
          </Sequence>
        );
      })}

      {/* ─── Correct transition pattern ───────────────────────────────────
       *
       * CORRECT: All <Sequence> elements at composition root level.
       * WRONG:  Nesting <BeatCutTransition> inside another <Sequence>.
       *
       * Uncomment and adapt this pattern for beat-aligned cuts:
       *
       * {shots.slice(1).map((shot, i) => {
       *   const prev = shots[i];
       *   const cutFrame = shot.startFrame;
       *   const transFrames = Math.round(TRANSITION_DURATION * FPS / 1000);
       *
       *   return (
       *     <React.Fragment key={i}>
       *       {/* Outgoing clip (holds until beat) */}
       *       <Sequence from={prev.startFrame} durationInFrames={cutFrame - prev.startFrame}>
       *         <AbsoluteFill>
       *           <video src={prev.src} style={{width:'100%',height:'100%',objectFit:'cover'}} />
       *         </AbsoluteFill>
       *       </Sequence>
       *
       *       {/* Transition zone */}
       *       <Sequence from={cutFrame} durationInFrames={transFrames}>
       *         <BeatCutTransition transition={{type:"fade", duration: TRANSITION_DURATION}}>
       *           <video src={prev.src} style={{width:'100%',height:'100%',objectFit:'cover'}} />
       *         </BeatCutTransition>
       *         <BeatCutTransitionIn transition={{type:"fade", duration: TRANSITION_DURATION}}>
       *           <video src={shot.src} style={{width:'100%',height:'100%',objectFit:'cover'}} />
       *         </BeatCutTransitionIn>
       *       </Sequence>
       *
       *       {/* Incoming clip (after transition) */}
       *       <Sequence from={cutFrame + transFrames} durationInFrames={shot.endFrame - cutFrame - transFrames}>
       *         <AbsoluteFill>
       *           <video src={shot.src} style={{width:'100%',height:'100%',objectFit:'cover'}} />
       *         </AbsoluteFill>
       *       </Sequence>
       *     </React.Fragment>
       *   );
       * })}
       */}
    </AbsoluteFill>
  );
}

// ─── Registration ────────────────────────────────────────────────────────
// Uncomment and register in Root.tsx:
//
// <Composition
//   id="YourMontageName-916"
//   component={YourMontageName}
//   durationInFrames={totalFrames}
//   fps={FPS}
//   width={1080}
//   height={1920}
// />
//
// For 16:9 adaptation, add a second composition with width={1920} height={1080}
// and update clip rendering for landscape aspect ratio.

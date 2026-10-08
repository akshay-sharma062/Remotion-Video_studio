/**
 * MontageBuilder — declarative scaffold for montage compositions.
 *
 * Provides structural helpers for:
 * - Beat-aligned clip sequencing
 * - Title card + location labels
 * - Transitions (fade, dissolve, wipe, zoom-through)
 * - Audio mixing
 *
 * This is NOT a runtime builder — compositions are declarative React.
 * Use this as a reference when copying the montage-template scaffold.
 *
 * For the actual editing workflow, see:
 * 1. npm run new-video [name] --type montage
 * 2. npm run prep-montage [name]  (contact sheets + shot list + beat map)
 * 3. npm run beat-map [name]      (music beat detection)
 * 4. Copy src/videos/montage-template/ → src/videos/[name]/
 * 5. Fill SHOT_LIST, register in Root.tsx
 */

import { AbsoluteFill, Sequence, Audio, Video } from "remotion";

export interface MontageShot {
  src: string;
  startFrame: number;
  endFrame: number;
  label?: string;
  location?: string;
  date?: string;
}

export interface MontageBeat {
  frame: number;
  strength: number;
}

export interface TransitionConfig {
  type: "fade" | "dissolve" | "wipe-left" | "wipe-right" | "zoom-through";
  duration?: number; // ms
}

export interface MontageConfig {
  fps: number;
  width: number;
  height: number;
  titleCard?: { title: string; subtitle?: string; frames?: number };
  audioSrc?: string;
  audioVolume?: number;
  transition?: TransitionConfig;
}

/**
 * calculateTotalFrames — sum all shot durations for the composition length.
 */
export function calculateTotalFrames(shots: MontageShot[], fps = 30): number {
  if (shots.length === 0) return 90;
  return shots[shots.length - 1].endFrame;
}

/**
 * findNearestBeat — find the beat closest to a target frame.
 */
export function findNearestBeat(targetFrame: number, beats: MontageBeat[]): MontageBeat {
  if (beats.length === 0) return { frame: targetFrame, strength: 1 };
  return beats.reduce((best, beat) =>
    Math.abs(beat.frame - targetFrame) < Math.abs(best.frame - targetFrame) ? beat : best
  );
}

/**
 * beatsInRange — count beats within a frame range.
 */
export function beatsInRange(startFrame: number, endFrame: number, beats: MontageBeat[]): number {
  return beats.filter((b) => b.frame >= startFrame && b.frame < endFrame).length;
}

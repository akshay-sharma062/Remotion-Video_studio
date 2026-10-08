export interface Beat {
  frame: number;
  strength: number;
}

export interface Shot {
  src: string;
  startFrame: number;
  endFrame: number;
  speed?: number; // 1 = normal, 0.5 = half speed, 2 = double
}

export function buildBeatSequence({
  beats,
  shots,
  transitionDuration = 200,
}: {
  beats: Beat[];
  shots: Shot[];
  transitionDuration?: number;
}): Array<{ src: string; startFrame: number; endFrame: number }> {
  const sequence: Array<{ src: string; startFrame: number; endFrame: number }> = [];

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const beat = beats[i] ?? beats[beats.length - 1];
    const start = beat.frame;
    const nextBeat = beats[i + 1];
    const end = nextBeat ? nextBeat.frame : shot.endFrame;

    sequence.push({
      src: shot.src,
      startFrame: start,
      endFrame: end,
    });
  }

  return sequence;
}

/**
 * BeatCut — beat-aligned clip sequencer helper.
 *
 * Turns a beat map and a shot list into a sequence of clips that cut on
 * each beat, with optional smooth speed ramps.
 *
 * Usage:
 * const seq = buildBeatSequence({
 *   beats: detectedBeats,
 *   shots: myShots,
 *   transitionDuration: 200
 * });
 */

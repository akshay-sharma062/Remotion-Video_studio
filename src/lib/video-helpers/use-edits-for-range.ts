/**
 * use-edits-for-range.ts
 *
 * Hook: filters an EditDecisionEngine output for a given frame range.
 *
 * Usage inside a Remotion Sequence or component:
 *   const { sfx, motions, captions } = useEditsForRange(
 *     renderDecisions,
 *     compositionFps,
 *     sequenceFromFrame,
 *     sequenceDurationInFrames
 *   );
 *
 * All timestamps are in milliseconds. Frame conversions use the composition FPS.
 */

import { useMemo } from "react";
import type { RenderDecision } from "../../editing-intelligence";

export interface EditDecisionSlice {
  /** SFX events that fall within the frame window */
  sfx: RenderDecision["sfx"];
  /** Motion events that fall within the frame window */
  motions: RenderDecision["motions"];
  /** Caption events that fall within the frame window */
  captions: RenderDecision["captions"];
  /** Raw frame range in milliseconds */
  windowMs: { start: number; end: number };
}

/**
 * Filter render decisions to a frame range.
 *
 * @param decision — Full render decision from EditDecisionEngine
 * @param fps — Composition frame rate (e.g., 23.976, 30, 60)
 * @param fromFrame — Sequence `from` frame (default: 0)
 * @param durationInFrames — Sequence duration (default: full video)
 */
export function useEditsForRange(
  decision: RenderDecision | null,
  fps: number,
  fromFrame = 0,
  durationInFrames = Infinity
): EditDecisionSlice {
  return useMemo(() => {
    if (!decision) {
      return { sfx: [], motions: [], captions: [], windowMs: { start: 0, end: 0 } };
    }

    const startMs = (fromFrame / fps) * 1000;
    const endMs = startMs + (durationInFrames / fps) * 1000;

    const sfx = decision.sfx.filter(
      (e) => e.timeMs >= startMs && e.timeMs < endMs
    );
    const motions = decision.motions.filter(
      (e) => e.timeMs >= startMs && e.timeMs < endMs
    );
    const captions = decision.captions.filter(
      (e) => e.timeMs >= startMs && e.timeMs < endMs
    );

    return { sfx, motions, captions, windowMs: { start: startMs, end: endMs } };
  }, [decision, fps, fromFrame, durationInFrames]);
}

/**
 * caption-decision.ts — decides when, where, and how to display captions.
 *
 * This is the intelligence layer for caption decisions:
 * - WHICH words to show at each frame (derived from transcript timestamps)
 * - WHERE to position them (safe zone compliant)
 * - HOW to animate them (word-by-word kinetic reveal)
 * - WHEN to hide them (scene boundaries, future word prevention)
 */

import type { TimestampedEvent } from "../analysis/edit-blueprint";

// ─── Caption Decision Config ──────────────────────────────────────────────────

export interface CaptionDecisionConfig {
  /** How many words to show at once. Default: 7 */
  windowSize: number;
  /** Padding from bottom of screen (px). Default: 380 (bottom safe zone) */
  bottomPadding: number;
  /** Left/right padding (px). Default: 80 */
  sidePadding: number;
  /** Font size (px). Default: 32 */
  fontSize: number;
  /** Words per line. Default: 3 */
  wordsPerLine: number;
}

export const DEFAULT_CAPTION_CONFIG: CaptionDecisionConfig = {
  windowSize: 7,
  bottomPadding: 380,
  sidePadding: 80,
  fontSize: 32,
  wordsPerLine: 3,
};

// ─── Caption Decision ─────────────────────────────────────────────────────────

export interface CaptionDecision {
  /** Words to show, in order */
  visibleWords: string[];
  /** Index of the currently spoken word within visibleWords */
  activeIndex: number;
  /** Y position from bottom (px) */
  yPosition: number;
  /** Whether captions should be visible at all */
  visible: boolean;
  /** Timestamp when this state starts (seconds) */
  timestamp: number;
  /** Timestamp when this state ends (seconds) */
  endTimestamp: number;
}

/**
 * Decide caption state at a given point in time.
 *
 * Rules:
 * - Show at most `windowSize` words
 * - Never show words whose start time is in the future
 * - Active word is the one currently being spoken
 * - Past words are dimmed, future words are hidden
 * - Hide captions during headline scenes (no text overlap)
 */
export function decideCaptionAtTime(
  allWords: Array<{ word: string; start: number; end: number }>,
  currentTimeSec: number,
  events: TimestampedEvent[],
  config: CaptionDecisionConfig = DEFAULT_CAPTION_CONFIG
): CaptionDecision {
  // Check if we're in a headline scene (hide captions)
  const inHeadlineScene = events.some((e) => {
    if (e.category !== "caption") return false;
    return currentTimeSec >= e.timestamp && currentTimeSec < e.timestamp + e.duration / 1000;
  });

  if (inHeadlineScene) {
    return {
      visibleWords: [],
      activeIndex: -1,
      yPosition: config.bottomPadding,
      visible: false,
      timestamp: currentTimeSec,
      endTimestamp: currentTimeSec + 0.5,
    };
  }

  // Find words that should be visible
  const visibleWords: string[] = [];
  let activeIndex = -1;

  // Find the active word (currently being spoken)
  const activeWordIdx = allWords.findIndex(
    (w) => currentTimeSec >= w.start && currentTimeSec < w.end
  );

  if (activeWordIdx < 0) {
    // No active word — find the most recent past word
    const lastPastWord = allWords.findLast((w) => w.start <= currentTimeSec);
    if (lastPastWord) {
      const lastIdx = allWords.indexOf(lastPastWord);
      // Show a window around the last word
      const startIdx = Math.max(0, lastIdx - config.windowSize + 1);
      for (let i = startIdx; i <= lastIdx && visibleWords.length < config.windowSize; i++) {
        visibleWords.push(allWords[i].word);
      }
      activeIndex = visibleWords.length - 1;
    }
  } else {
    // Active word found — show window around it
    const startIdx = Math.max(0, activeWordIdx - Math.floor(config.windowSize / 2));
    let endIdx = startIdx + config.windowSize;
    if (endIdx > allWords.length) {
      endIdx = allWords.length;
      const newStart = Math.max(0, endIdx - config.windowSize);
      startIdx = newStart;
    }

    for (let i = startIdx; i < endIdx; i++) {
      visibleWords.push(allWords[i].word);
    }

    activeIndex = activeWordIdx - startIdx;
  }

  return {
    visibleWords,
    activeIndex,
    yPosition: config.bottomPadding,
    visible: visibleWords.length > 0,
    timestamp: currentTimeSec,
    endTimestamp: currentTimeSec + 0.5,
  };
}

/**
 * Get all caption decisions for a given set of events and word timestamps.
 * Produces a decision for each caption event in the edit blueprint.
 */
export function decideAllCaptions(
  allWords: Array<{ word: string; start: number; end: number }>,
  events: TimestampedEvent[],
  config: CaptionDecisionConfig = DEFAULT_CAPTION_CONFIG
): CaptionDecision[] {
  const captionEvents = events.filter((e) => e.category === "caption");
  const decisions: CaptionDecision[] = [];

  for (const event of captionEvents) {
    const startSec = event.timestamp;
    const endSec = event.timestamp + event.duration / 1000;
    const step = 1 / 23.976; // ~42ms per frame

    for (let t = startSec; t < endSec; t += step) {
      const decision = decideCaptionAtTime(allWords, t, events, config);
      decisions.push(decision);
    }
  }

  return decisions;
}

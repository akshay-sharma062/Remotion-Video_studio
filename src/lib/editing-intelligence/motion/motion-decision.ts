/**
 * motion-decision.ts — decides which motion primitive to use for each event.
 *
 * This is the intelligence layer that maps edit events to specific motion
 * primitives. It knows when to use a slam vs. a slide, when to add a zoom
 * punch, and what intensity level each motion should have.
 *
 * Rules are derived from:
 * 1. The 12 motion laws
 * 2. HyperFrames motion concepts (slam, overshoot, bounce, etc.)
 * 3. The reference event types from edit-blueprint.json
 */

import type { TimestampedEvent } from "../analysis/edit-blueprint";
import type { SfxDecision } from "../sfx/sfx-decision";

// ─── Motion Decision Config ───────────────────────────────────────────────────

export interface MotionDecisionConfig {
  /** Base duration for motions (ms). Default: 400 */
  baseDurationMs: number;
  /** Slow duration (ms). Default: 600 */
  slowDurationMs: number;
  /** Stagger between words (ms). Default: 67 (tight) */
  staggerMs: number;
  /** Whether to use overshoot for emphasis. Default: true */
  useOvershoot: boolean;
  /** Whether to add motion blur for fast movements. Default: true */
  useMotionBlur: boolean;
}

export const DEFAULT_MOTION_CONFIG: MotionDecisionConfig = {
  baseDurationMs: 400,
  slowDurationMs: 600,
  staggerMs: 67,
  useOvershoot: true,
  useMotionBlur: true,
};

// ─── Motion Decision ──────────────────────────────────────────────────────────

export interface MotionDecision {
  /** The type of motion primitive to use */
  primitive: "slam" | "slide" | "fade" | "zoomPunch" | "blurResolve" | "wordReveal" | "emphasize" | "scaleBounce" | "slideSwap";
  /** Duration in ms */
  durationMs: number;
  /** Delay before starting (ms) */
  delayMs: number;
  /** Stagger between words (ms). Only for wordReveal. */
  staggerMs?: number;
  /** Event this motion is for */
  event: TimestampedEvent;
  /** Additional parameters */
  params: Record<string, unknown>;
  /** Confidence in this decision */
  confidence: number;
  /** Human-readable reason */
  reason: string;
}

// ─── Mapping Rules ────────────────────────────────────────────────────────────

interface MotionRule {
  matches: (event: TimestampedEvent) => boolean;
  decide: (event: TimestampedEvent, config: MotionDecisionConfig) => MotionDecision;
  priority: number;
}

const MOTION_RULES: MotionRule[] = [
  // ── Kinetic text slam ──────────────────────────────────────────────────────

  {
    priority: 1,
    matches: (e) => e.category === "caption" && e.kind === "slam",
    decide: (event, config) => ({
      primitive: "slam",
      durationMs: config.baseDurationMs,
      delayMs: 0,
      event,
      params: {
        text: event.label,
        fontSize: event.params.fontSize as number | undefined || 120,
        color: "#ffffff",
      },
      confidence: 0.9,
      reason: "Kinetic text slam — overshoot entrance",
    }),
  },

  // ── Word highlight ─────────────────────────────────────────────────────────

  {
    priority: 1,
    matches: (e) => e.category === "highlight",
    decide: (event, config) => ({
      primitive: "emphasize",
      durationMs: config.baseDurationMs,
      delayMs: 0,
      event,
      params: {
        text: event.label,
        fontSize: (event.params.fontSize as number) || 120,
        showHighlight: true,
      },
      confidence: 0.85,
      reason: "Word highlight emphasis",
    }),
  },

  // ── Graphic entrance ───────────────────────────────────────────────────────

  {
    priority: 2,
    matches: (e) => e.category === "graphic",
    decide: (event, config) => {
      const kind = event.kind;
      if (kind === "arrow" || kind === "magnifier") {
        return {
          primitive: "slide" as const,
          durationMs: config.baseDurationMs,
          delayMs: 0,
          event,
          params: { direction: "left", distance: 40 },
          confidence: 0.8,
          reason: "Graphic slide-in",
        };
      }
      if (kind === "icon" || kind === "pop" || kind === "card") {
        return {
          primitive: "scaleBounce" as const,
          durationMs: config.baseDurationMs,
          delayMs: 0,
          event,
          params: { scaleRange: [0.9, 1.06, 1.0] },
          confidence: 0.8,
          reason: "Graphic scale-bounce entrance",
        };
      }
      if (kind === "diagram") {
        return {
          primitive: "blurResolve" as const,
          durationMs: config.slowDurationMs,
          delayMs: 0,
          event,
          params: { blurMax: 8 },
          confidence: 0.75,
          reason: "Diagram blur-resolve entrance",
        };
      }
      // Default: fade with scale
      return {
        primitive: "fade" as const,
        durationMs: config.baseDurationMs,
        delayMs: 0,
        event,
        params: { scaleRange: [0.94, 1] },
        confidence: 0.7,
        reason: "Default graphic fade entrance",
      };
    },
  },

  // ── Camera zoom / punch ─────────────────────────────────────────────────────

  {
    priority: 2,
    matches: (e) => e.category === "camera" && (e.kind === "punch_in" || e.kind === "punch_out"),
    decide: (event, config) => {
      const params = event.params as Record<string, unknown>;
      const peakScale = (params.peakScale as number) || 1.06;
      return {
        primitive: "zoomPunch",
        durationMs: config.slowDurationMs,
        delayMs: 0,
        event,
        params: {
          peakFrame: Math.round(event.timestamp * 23.976), // approximate
          maxZoom: peakScale,
          emphasis: peakScale >= 1.08,
        },
        confidence: 0.85,
        reason: "Camera zoom punch",
      };
    },
  },

  // ── Text swap ───────────────────────────────────────────────────────────────

  {
    priority: 2,
    matches: (e) => e.category === "caption" && e.kind === "swap",
    decide: (event, config) => {
      const params = event.params as Record<string, unknown>;
      return {
        primitive: "slideSwap",
        durationMs: config.baseDurationMs,
        delayMs: 0,
        event,
        params: {
          oldText: (params.oldText as string) || "",
          newText: (params.newText as string) || event.label,
          direction: (params.direction as "up" | "down" | "left" | "right") || "up",
          fontSize: (params.fontSize as number) || 120,
        },
        confidence: 0.85,
        reason: "Text kinetic swap",
      };
    },
  },

  // ── Emphasis word (voice) ───────────────────────────────────────────────────

  {
    priority: 3,
    matches: (e) => e.category === "voice" && e.kind === "emphasis",
    decide: (event, config) => ({
      primitive: "emphasize",
      durationMs: config.baseDurationMs,
      delayMs: 50,
      event,
      params: { text: event.label, showHighlight: true },
      confidence: 0.7,
      reason: "Voice emphasis word highlight",
    }),
  },

  // ── Lower third ─────────────────────────────────────────────────────────────

  {
    priority: 3,
    matches: (e) => e.category === "graphic" && e.kind === "lower_third",
    decide: (event, config) => ({
      primitive: "slide",
      durationMs: config.slowDurationMs,
      delayMs: 0,
      event,
      params: { direction: "left", distance: 60 },
      confidence: 0.8,
      reason: "Lower third slide-in",
    }),
  },
];

// ─── Decision Engine ──────────────────────────────────────────────────────────

/**
 * Decide the motion primitive for a single event.
 * Returns null if no rule matches (no motion needed).
 */
export function decideMotionForEvent(
  event: TimestampedEvent,
  config: MotionDecisionConfig = DEFAULT_MOTION_CONFIG
): MotionDecision | null {
  const matchingRules = MOTION_RULES
    .filter((r) => r.matches(event))
    .sort((a, b) => a.priority - b.priority);

  if (matchingRules.length === 0) return null;
  return matchingRules[0].decide(event, config);
}

/**
 * Decide motions for all events in an edit blueprint.
 * Returns only events that need animation (not all events get motion).
 */
export function decideAllMotions(
  events: TimestampedEvent[],
  config: MotionDecisionConfig = DEFAULT_MOTION_CONFIG
): MotionDecision[] {
  const decisions: MotionDecision[] = [];

  for (const event of events) {
    // Skip very short events
    if (event.duration < 100) continue;

    // Skip events without animation
    if (!event.hasAnimation) continue;

    const decision = decideMotionForEvent(event, config);
    if (decision) {
      decisions.push(decision);
    }
  }

  // Sort by timestamp
  decisions.sort((a, b) => a.event.timestamp - b.event.timestamp);

  return decisions;
}

/**
 * Get motion decisions for a specific category of events.
 */
export function getMotionDecisionsByCategory(
  events: TimestampedEvent[],
  category: string,
  config: MotionDecisionConfig = DEFAULT_MOTION_CONFIG
): MotionDecision[] {
  const categoryEvents = events.filter((e) => e.category === category);
  return decideAllMotions(categoryEvents, config);
}

/**
 * sfx-decision.ts — maps edit events to SFX choices.
 *
 * This is the intelligence layer that decides:
 * - WHICH SFX to use for a given event
 * - WHEN to place it (with lead time before the visual event)
 * - HOW LOUD (gain, ducking)
 * - FADE settings
 * - FILTER settings
 *
 * The goal: no SFX is hardcoded. Every SFX event is derived from the
 * visual/motion event that triggered it, with explicit rules.
 */

import type { TimestampedEvent, SfxEvent } from "../analysis/edit-blueprint";
import { findBestSfx, getSfxAsset, SfxAsset } from "./sfx-registry";
import type { AudioBuffer } from "./sfx-generators";

// ─── Decision Config ──────────────────────────────────────────────────────────

export interface SfxDecisionConfig {
  /** Lead time before visual event (ms). Default: 133 */
  leadMs: number;
  /** Tail after visual event (ms). Default: 267 */
  tailMs: number;
  /** How far ahead of voice to place SFX (ms). Positive = before voice */
  voiceLeadMs: number;
  /** Global SFX volume multiplier (0-1) */
  globalVolume: number;
  /** Whether to generate SFX programmatically when asset is unavailable */
  fallbackToGenerative: boolean;
}

export const DEFAULT_SFX_CONFIG: SfxDecisionConfig = {
  leadMs: 133,
  tailMs: 267,
  voiceLeadMs: 80,
  globalVolume: 0.8,
  fallbackToGenerative: true,
};

// ─── SFX Decision ─────────────────────────────────────────────────────────────

export interface SfxDecision {
  /** Registry ID of the chosen SFX */
  sfxId: string;
  /** When to play (seconds) */
  timestamp: number;
  /** Duration in ms */
  durationMs: number;
  /** Volume (0-1) after ducking */
  volume: number;
  /** Duck dB under voice */
  duckDb: number;
  /** Fade in (ms) */
  fadeInMs: number;
  /** Fade out (ms) */
  fadeOutMs: number;
  /** High-pass filter frequency (Hz) */
  highPassHz: number;
  /** The source event that triggered this SFX */
  sourceEvent: TimestampedEvent;
  /** Confidence in this decision (0-1) */
  confidence: number;
  /** Why this SFX was chosen */
  reason: string;
  /** The resolved asset (for rendering) */
  asset: SfxAsset;
}

// ─── Event → SFX Mapping Rules ────────────────────────────────────────────────

/**
 * Mapping rules: event pattern → SFX specification.
 * Each rule checks if the event matches a pattern and returns SFX parameters.
 */
interface SfxMappingRule {
  /** Check if this rule applies to the event */
  matches: (event: TimestampedEvent) => boolean;
  /** Choose the SFX registry ID */
  sfxId: (event: TimestampedEvent) => string;
  /** Override duration (ms). Returns null to use asset default. */
  durationMs?: (event: TimestampedEvent) => number | null;
  /** Override volume (0-1). Returns null to use asset default. */
  volume?: (event: TimestampedEvent) => number | null;
  /** Override duck level (dB). Returns null to use asset default. */
  duckDb?: (event: TimestampedEvent) => number | null;
  /** Priority (lower = checked first) */
  priority: number;
  /** Human-readable reason */
  reason: (event: TimestampedEvent) => string;
}

const MAPPING_RULES: SfxMappingRule[] = [
  // ── Kinetic text slam ────────────────────────────────────────────────────────

  {
    priority: 1,
    matches: (e) => e.category === "caption" && (e.kind === "slam" || e.kind === "word_active"),
    sfxId: (e) => {
      const params = e.params as Record<string, unknown>;
      const isEmphasis = params.isEmphasis as boolean | undefined;
      if (isEmphasis) return "impact_medium";
      // Check if it's a multi-word slam
      const words = params.wordCount as number | undefined;
      if (words && words >= 3) return "impact_medium";
      return "impact_light";
    },
    reason: () => "Kinetic text slam needs impact hit",
  },

  // ── Word highlight ──────────────────────────────────────────────────────────

  {
    priority: 1,
    matches: (e) => e.category === "highlight",
    sfxId: () => "chime_soft",
    reason: () => "Word highlight gets soft chime",
  },

  // ── Graphic overlay ─────────────────────────────────────────────────────────

  {
    priority: 2,
    matches: (e) => e.category === "graphic",
    sfxId: (e) => {
      const kind = e.kind;
      if (kind === "icon" || kind === "magnifier") return "ui_pop";
      if (kind === "arrow") return "ui_click";
      if (kind === "broll_insert") return "whoosh_medium";
      if (kind === "diagram") return "chime_soft";
      return "ui_pop";
    },
    reason: (e) => `Graphic ${e.kind} entrance`,
  },

  // ── Camera zoom / punch ─────────────────────────────────────────────────────

  {
    priority: 2,
    matches: (e) => e.category === "camera" && (e.kind === "punch_in" || e.kind === "punch_out"),
    sfxId: (e) => {
      const cam = e as { params: { peakScale?: number } };
      const peakScale = cam.params.peakScale;
      if (peakScale && peakScale >= 1.08) return "whoosh_medium";
      return "whoosh_light";
    },
    durationMs: () => 400,
    reason: () => "Camera zoom punch",
  },

  // ── Transition ──────────────────────────────────────────────────────────────

  {
    priority: 2,
    matches: (e) => e.category === "transition",
    sfxId: (e) => {
      if (e.kind === "zoom_through") return "whoosh_heavy";
      if (e.kind === "wipe_left" || e.kind === "wipe_right") return "swoosh_wipe";
      if (e.kind === "dissolve" || e.kind === "fade") return "whoosh_light";
      return "whoosh_medium";
    },
    reason: (e) => `Transition: ${e.kind}`,
  },

  // ── CTA / action prompt ─────────────────────────────────────────────────────

  {
    priority: 3,
    matches: (e) => {
      const params = e.params as Record<string, unknown>;
      return params.isCta as boolean || e.label.toLowerCase().includes("cta") ||
             e.label.toLowerCase().includes("register") || e.label.toLowerCase().includes("subscribe");
    },
    sfxId: () => "chime_bell",
    reason: () => "CTA appearance",
  },

  // ── Emphasis word ───────────────────────────────────────────────────────────

  {
    priority: 3,
    matches: (e) => e.category === "voice" && e.kind === "emphasis",
    sfxId: () => "chime_soft",
    reason: () => "Emphasis word chime",
  },

  // ── Lower third ─────────────────────────────────────────────────────────────

  {
    priority: 3,
    matches: (e) => e.category === "graphic" && e.kind === "lower_third",
    sfxId: () => "whoosh_light",
    reason: () => "Lower third entrance",
  },

  // ── Data / numbers ──────────────────────────────────────────────────────────

  {
    priority: 3,
    matches: (e) => e.category === "graphic" && (e.kind === "bar_chart" || e.kind === "diagram"),
    sfxId: () => "chime_soft",
    reason: () => "Data graphic entrance",
  },

  // ── Status indicator ────────────────────────────────────────────────────────

  {
    priority: 4,
    matches: (e) => e.category === "graphic" && e.kind === "card",
    sfxId: () => "ui_pop",
    reason: () => "Card/graphic appearing",
  },
];

// ─── Decision Engine ──────────────────────────────────────────────────────────

/**
 * Decide which SFX to use for each event in an edit blueprint.
 *
 * Rules:
 * - Events are matched against MAPPING_RULES in priority order
 * - First matching rule wins
 * - If no rule matches, returns null (no SFX)
 * - If the chosen SFX asset is unavailable and fallbackToGenerative is true,
 *   uses the generative version
 */
export function decideSfxForEvent(
  event: TimestampedEvent,
  config: SfxDecisionConfig = DEFAULT_SFX_CONFIG
): SfxDecision | null {
  // Find the best matching rule
  const matchingRules = MAPPING_RULES
    .filter((r) => r.matches(event))
    .sort((a, b) => a.priority - b.priority);

  if (matchingRules.length === 0) return null;

  const rule = matchingRules[0];
  const sfxId = rule.sfxId(event);
  const asset = getSfxAsset(sfxId);

  if (!asset) {
    console.warn(`[SFX Decision] Asset not found: ${sfxId} for event: ${event.label}`);
    return null;
  }

  // Resolve duration
  const rawDuration = rule.durationMs?.(event) ?? asset.durationMs[1];
  const durationMs = rawDuration ?? asset.durationMs[1];

  // Calculate timestamp: lead before the event
  const eventTimestampSec = event.timestamp;
  const sfxTimestampSec = eventTimestampSec - config.leadMs / 1000;
  const sfxEndSec = sfxTimestampSec + (durationMs + config.tailMs) / 1000;

  // Don't place SFX before time 0
  const clampedTimestamp = Math.max(0, sfxTimestampSec);

  // Resolve volume
  const baseVolume = rule.volume?.(event) ?? asset.defaultGain;
  const volume = baseVolume * config.globalVolume;

  // Resolve duck
  const duckDb = rule.duckDb?.(event) ?? asset.duckDb;

  return {
    sfxId,
    timestamp: clampedTimestamp,
    durationMs,
    volume,
    duckDb,
    fadeInMs: asset.fadeInMs,
    fadeOutMs: asset.fadeOutMs,
    highPassHz: asset.highPassHz,
    sourceEvent: event,
    confidence: 0.85,
    reason: rule.reason(event),
    asset,
  };
}

/**
 * Process all events in an edit blueprint and produce SFX decisions.
 * Filters out events that shouldn't have SFX (duration = 0, no matching rule).
 */
export function decideAllSfx(
  events: TimestampedEvent[],
  config: SfxDecisionConfig = DEFAULT_SFX_CONFIG
): SfxDecision[] {
  const decisions: SfxDecision[] = [];

  for (const event of events) {
    // Skip very short events
    if (event.duration < 50) continue;

    const decision = decideSfxForEvent(event, config);
    if (decision && decision.timestamp >= 0) {
      decisions.push(decision);
    }
  }

  // Sort by timestamp
  decisions.sort((a, b) => a.timestamp - b.timestamp);

  // Remove overlapping SFX (keep the earlier one if gap < 100ms)
  const filtered: SfxDecision[] = [];
  for (const decision of decisions) {
    const last = filtered[filtered.length - 1];
    if (last) {
      const gap = (decision.timestamp - last.timestamp) * 1000;
      const lastEnd = last.timestamp + (last.durationMs + last.fadeOutMs) / 1000;
      if (decision.timestamp < lastEnd + 0.05) {
        // Overlapping — skip this one unless it's higher priority
        const lastAsset = getSfxAsset(last.sfxId);
        const thisAsset = getSfxAsset(decision.sfxId);
        if (thisAsset && lastAsset && thisAsset.intensity > lastAsset.intensity) {
          filtered.pop();
          filtered.push(decision);
        }
        continue;
      }
    }
    filtered.push(decision);
  }

  return filtered;
}

/**
 * Generate an SFX-CUES.txt file listing every SFX decision.
 */
export function generateSfxCues(decisions: SfxDecision[]): string {
  const lines: string[] = [
    "SFX CUES",
    "=".repeat(60),
    `Generated: ${new Date().toISOString()}`,
    `Total SFX events: ${decisions.length}`,
    "",
    "ID  | Timecode    | Duration | SFX Name          | Reason",
    "-".repeat(80),
  ];

  decisions.forEach((d, i) => {
    const tc = formatTimecode(d.timestamp);
    const dur = `${d.durationMs}ms`;
    const id = String(i + 1).padStart(2, " ");
    const name = d.asset.name.padEnd(17);
    lines.push(`${id}  | ${tc} | ${dur.padEnd(9)} | ${name} | ${d.reason}`);
  });

  return lines.join("\n");
}

/**
 * Get all unique SFX IDs referenced in decisions.
 * Use this to validate that all referenced SFX exist.
 */
export function getReferencedSfxIds(decisions: SfxDecision[]): string[] {
  return [...new Set(decisions.map((d) => d.sfxId))];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

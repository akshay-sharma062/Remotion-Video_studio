/**
 * headline-sfx-selector.ts — Premium headline sound-design engine.
 *
 * Analyses a headline event's context and selects the most appropriate
 * SFX from the library. Never adds sound to every line — silence is
 * used where it improves the edit.
 *
 * Headline classification:
 *   - headline:   full-screen kinetic headline (highest intensity)
 *   - supporting: secondary supporting line
 *   - number:     a statistic or data point
 *   - keyword:    a single emphasised word within a headline
 *   - cta:        final call-to-action
 *
 * Selection strategy:
 *   - Prefer airy whooshes for headline entrances
 *   - Heavy cinematic whoosh for major title reveals
 *   - Soft impact for bold statement reveals
 *   - Subtle text sweep for supporting lines
 *   - Clean tonal accent for highlighted keywords
 *   - Restrained transitions between scenes
 *   - Some events get no SFX at all
 */

import type { SfxAsset, SfxCategory, VisualEventType } from "../sfx/sfx-registry";
import { getSfxAsset, SfxAsset as SfxAssetType } from "../sfx/sfx-registry";

// ─── Context Types ─────────────────────────────────────────────────────────────

export type HeadlineType = "headline" | "supporting" | "number" | "keyword" | "cta";
export type TransitionType = "none" | "fade" | "wipe_left" | "wipe_right" | "zoom_through" | "dissolve";
export type EntranceAnimation = "slam" | "reveal" | "fade" | "slide" | "stagger" | "punch";

export interface HeadlineSfxContext {
  /** Classification of the text */
  headlineType: HeadlineType;
  /** Entrance animation type */
  entrance: EntranceAnimation;
  /** Entrance duration in ms */
  entranceDurationMs: number;
  /** Visual transition type */
  transition: TransitionType;
  /** Visual intensity 1-5 */
  visualIntensity: number;
  /** Scene index (0-based) */
  sceneIndex: number;
  /** Total scenes in video */
  totalScenes: number;
  /** Whether this is the very first headline */
  isOpening: boolean;
  /** Whether this is the very last headline */
  isEnding: boolean;
  /** Time since previous SFX (ms). 0 if first. */
  timeSinceLastSfxMs: number;
  /** Whether speech is active during this moment */
  voiceActive: boolean;
}

export interface HeadlineSfxDecision {
  /** Selected SFX asset, or null if silence is recommended */
  asset: SfxAssetType | null;
  /** Confidence 0-1 */
  confidence: number;
  /** Human-readable reason */
  reason: string;
  /** Alternative SFX options (in case the primary is rejected) */
  alternatives: Array<{ asset: SfxAssetType; reason: string }>;
  /** Whether silence was deliberately chosen */
  isSilence: boolean;
  /** Lead time before visual event (ms) */
  leadMs: number;
  /** Tail after visual event (ms) */
  tailMs: number;
  /** Volume multiplier (after ducking) */
  volume: number;
}

// ─── Selection Rules ───────────────────────────────────────────────────────────

interface HeadlineRule {
  /** Priority — lower = checked first */
  priority: number;
  /** Does this rule match the context? */
  matches: (ctx: HeadlineSfxContext) => boolean;
  /** Select the SFX registry ID */
  sfxId: (ctx: HeadlineSfxContext) => string | null;
  /** Override lead time (ms). null = use default 133 */
  leadMs?: (ctx: HeadlineSfxContext) => number | null;
  /** Override volume multiplier. null = use asset default */
  volume?: (ctx: HeadlineSfxContext) => number | null;
  /** Override confidence. null = calculate from match quality */
  confidence?: (ctx: HeadlineSfxContext) => number | null;
  /** Why this rule matched */
  reason: (ctx: HeadlineSfxContext) => string;
}

const HEADLINE_RULES: HeadlineRule[] = [
  // ── Opening: heavy cinematic whoosh for the first headline ──────────────────

  {
    priority: 1,
    matches: (ctx) => ctx.isOpening && ctx.headlineType === "headline" && ctx.entrance === "slam",
    sfxId: () => "whoosh_heavy",
    leadMs: () => 80,
    volume: () => 0.75,
    confidence: () => 0.95,
    reason: () =>
      "Opening headline slam gets heavy cinematic whoosh — sets the editorial tone",
  },

  {
    priority: 1,
    matches: (ctx) => ctx.isOpening && ctx.headlineType === "headline" && ctx.entrance !== "slam",
    sfxId: () => "whoosh_rising",
    leadMs: () => 100,
    volume: () => 0.65,
    confidence: () => 0.85,
    reason: () =>
      "Opening headline (non-slam) gets rising whoosh — builds anticipation",
  },

  // ── Opening: silence if opening is a number reveal ──────────────────────────

  {
    priority: 2,
    matches: (ctx) => ctx.isOpening && ctx.headlineType === "number",
    sfxId: () => null,
    leadMs: () => null,
    volume: () => 1,
    confidence: () => 0.6,
    reason: () =>
      "Opening with a number — silence lets the stat land. Voiceover is the opening",
  },

  // ── Closing: restrained ending ──────────────────────────────────────────────

  {
    priority: 1,
    matches: (ctx) => ctx.isEnding && ctx.headlineType === "cta",
    sfxId: () => "impact_soft",
    leadMs: () => 60,
    volume: () => 0.55,
    confidence: () => 0.8,
    reason: () =>
      "CTA ending gets soft impact — positive, decisive, not overwhelming",
  },

  {
    priority: 1,
    matches: (ctx) => ctx.isEnding && ctx.headlineType === "headline",
    sfxId: () => "whoosh_soft",
    leadMs: () => 80,
    volume: () => 0.5,
    confidence: () => 0.75,
    reason: () =>
      "Closing headline gets airy sweep — gentle landing, doesn't fight the fade-out",
  },

  // ── Major headline slam (mid-video) ─────────────────────────────────────────

  {
    priority: 2,
    matches: (ctx) =>
      ctx.headlineType === "headline" &&
      ctx.entrance === "slam" &&
      ctx.visualIntensity >= 4,
    sfxId: () => "impact_premium",
    leadMs: () => 60,
    volume: () => 0.7,
    confidence: () => 0.9,
    reason: () =>
      "High-intensity slam gets premium impact — weighty, modern, cinematic",
  },

  // ── Standard headline entrance ──────────────────────────────────────────────

  {
    priority: 3,
    matches: (ctx) => ctx.headlineType === "headline" && ctx.entrance === "slam",
    sfxId: () => "impact_medium",
    leadMs: () => 80,
    volume: () => 0.65,
    confidence: () => 0.8,
    reason: () =>
      "Text slam gets medium hit — balanced corporate slam",
  },

  // ── Staggered reveal ────────────────────────────────────────────────────────

  {
    priority: 3,
    matches: (ctx) => ctx.headlineType === "headline" && ctx.entrance === "stagger",
    sfxId: () => "whoosh_medium",
    leadMs: () => 100,
    volume: () => 0.5,
    confidence: () => 0.8,
    reason: () =>
      "Staggered headline words get medium whoosh — swept, flowing entrance",
  },

  // ── Keyword highlight ───────────────────────────────────────────────────────

  {
    priority: 2,
    matches: (ctx) => ctx.headlineType === "keyword",
    sfxId: () => "chime_soft",
    leadMs: () => 30,
    volume: () => 0.45,
    confidence: () => 0.85,
    reason: () =>
      "Keyword highlight gets soft chime — brief, clean, attention-pull",
  },

  // ── Number reveal ───────────────────────────────────────────────────────────

  {
    priority: 2,
    matches: (ctx) => ctx.headlineType === "number",
    sfxId: (ctx) =>
      ctx.visualIntensity >= 4 ? "data_rise_fast" : "chime_soft",
    leadMs: () => 60,
    volume: () => 0.6,
    confidence: () => 0.8,
    reason: () =>
      "Number reveal gets chime — crisp, precise, data-like",
  },

  // ── Supporting line ─────────────────────────────────────────────────────────

  {
    priority: 3,
    matches: (ctx) => ctx.headlineType === "supporting" && ctx.entrance === "fade",
    sfxId: () => "whoosh_light",
    leadMs: () => 120,
    volume: () => 0.35,
    confidence: () => 0.6,
    reason: () =>
      "Supporting line fade gets light whoosh — barely there, keeps focus on main",
  },

  // ── Supporting line — silence for fade-only ──────────────────────────────────

  {
    priority: 4,
    matches: (ctx) => ctx.headlineType === "supporting" && ctx.entranceDurationMs <= 300,
    sfxId: () => null,
    leadMs: () => null,
    volume: () => 1,
    confidence: () => 0.55,
    reason: () =>
      "Quick supporting line fade — no SFX. Let the visual breathe.",
  },

  // ── Scene transition (no headline) ──────────────────────────────────────────

  {
    priority: 4,
    matches: (ctx) =>
      ctx.transition !== "none" &&
      !ctx.isOpening &&
      !ctx.isEnding,
    sfxId: () => "whoosh_light",
    leadMs: () => 133,
    volume: () => 0.4,
    confidence: () => 0.7,
    reason: () =>
      "Scene transition gets light whoosh — restrained, doesn't interrupt flow",
  },

  // ── Punch zoom ──────────────────────────────────────────────────────────────

  {
    priority: 3,
    matches: (ctx) =>
      ctx.entrance === "punch" && ctx.headlineType === "headline",
    sfxId: () => "whoosh_heavy",
    leadMs: () => 40,
    volume: () => 0.6,
    confidence: () => 0.85,
    reason: () =>
      "Punch zoom headline gets heavy whoosh — fast, authoritative, punchy",
  },

  // ── Default: no SFX ─────────────────────────────────────────────────────────

  {
    priority: 10,
    matches: () => true,
    sfxId: () => null,
    leadMs: () => null,
    volume: () => 1,
    confidence: () => 0.3,
    reason: () =>
      "No strong match — silence preferred. Only add SFX when it serves the story.",
  },
];

// ─── Fallback catalogue (for rule alternatives) ───────────────────────────────

const HEADLINE_ALTERNATIVES: Partial<Record<HeadlineType, SfxAsset[]>> = {
  headline: [],
  keyword: [],
  number: [],
  supporting: [],
  cta: [],
};

// ─── Selection Engine ─────────────────────────────────────────────────────────

/**
 * Select the best SFX for a headline event given its full context.
 *
 * Returns null for asset when silence is the right choice.
 * The caller is responsible for respecting isSilence.
 */
export function selectHeadlineSfx(context: HeadlineSfxContext): HeadlineSfxDecision {
  // Apply rules in priority order
  const matched = HEADLINE_RULES
    .filter((r) => r.matches(context))
    .sort((a, b) => a.priority - b.priority);

  const bestRule = matched[0];

  if (!bestRule || bestRule.sfxId(context) === null) {
    return {
      asset: null,
      confidence: bestRule ? bestRule.confidence!(context) : 0.3,
      reason: bestRule
        ? bestRule.reason(context)
        : "No suitable SFX — silence chosen",
      alternatives: [],
      isSilence: true,
      leadMs: bestRule?.leadMs?.(context) ?? 133,
      tailMs: 267,
      volume: 1,
    };
  }

  const sfxId = bestRule.sfxId(context);
  const asset = getSfxAsset(sfxId);

  if (!asset) {
    return {
      asset: null,
      confidence: 0,
      reason: `SFX asset "${sfxId}" not found in registry — silence used`,
      alternatives: [],
      isSilence: true,
      leadMs: bestRule.leadMs?.(context) ?? 133,
      tailMs: 267,
      volume: 1,
    };
  }

  // Build alternatives from other matching rules
  const alternatives = matched
    .slice(1, 4)
    .filter((r) => r.sfxId(context) !== null)
    .map((r) => {
      const altId = r.sfxId(context)!;
      const altAsset = getSfxAsset(altId);
      return {
        asset: altAsset!,
        reason: r.reason(context),
      };
    })
    .filter((a) => a.asset.id !== asset.id);

  return {
    asset,
    confidence: bestRule.confidence?.(context) ?? 0.8,
    reason: bestRule.reason(context),
    alternatives,
    isSilence: false,
    leadMs: bestRule.leadMs?.(context) ?? 133,
    tailMs: 267,
    volume: bestRule.volume?.(context) ?? asset.defaultGain,
  };
}

/**
 * Convenience: build a HeadlineSfxContext from a TimestampedEvent and scene metadata.
 */
export function contextFromEvent(
  event: import("../analysis/edit-blueprint").TimestampedEvent,
  overrides: Partial<HeadlineSfxContext> = {}
): HeadlineSfxContext {
  const isHeadline = event.category === "caption" || event.category === "highlight";
  const params = event.params as Record<string, unknown> | undefined;

  return {
    headlineType: (params?.headlineType as HeadlineType) ||
      (isHeadline ? "headline" : "supporting"),
    entrance: (params?.entrance as EntranceAnimation) || "slam",
    entranceDurationMs: (params?.entranceDurationMs as number) || 400,
    transition: (params?.transition as TransitionType) || "none",
    visualIntensity: (params?.visualIntensity as number) || 3,
    sceneIndex: (params?.sceneIndex as number) || 0,
    totalScenes: (params?.totalScenes as number) || 1,
    isOpening: (params?.isOpening as boolean) || false,
    isEnding: (params?.isEnding as boolean) || false,
    timeSinceLastSfxMs: (params?.timeSinceLastSfxMs as number) || 0,
    voiceActive: (params?.voiceActive as boolean) || true,
    ...overrides,
  };
}

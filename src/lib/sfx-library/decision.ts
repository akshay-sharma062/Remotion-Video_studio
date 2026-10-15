/**
 * sfx-library/decision.ts — maps visual events to SFX choices for the SFX Library.
 *
 * This is the intelligence layer that decides:
 * - WHICH SFX to use for a given event
 * - WHEN to place it (with lead time before the visual event)
 * - HOW LOUD (gain, ducking)
 * - FADE settings
 * - FILTER settings
 *
 * Uses the SFX_LIBRARY registry (all 44 assets, 14 categories).
 */

import type {
  SfxAsset,
  SfxCategory,
  SfxDecisionConfig,
  SfxDecision,
  SfxSearchQuery,
  SfxSearchResult,
  SfxSelectionDecision,
  VisualEventType,
} from "./types";
import { SFX_LIBRARY, CATEGORY_META } from "./registry";
import { SFX_LIBRARY_GENERATORS } from "./generators";

// ─── Decision Config ──────────────────────────────────────────────────────────

export const DEFAULT_LIBRARY_SFX_CONFIG: SfxDecisionConfig = {
  leadMs: 133,
  tailMs: 267,
  voiceLeadMs: 80,
  globalVolume: 0.8,
  fallbackToGenerative: true,
};

// ─── Event → Category Mapping ─────────────────────────────────────────────────

/**
 * Maps visual event types to preferred SFX categories.
 * Returns ordered list (primary, secondary, tertiary) for best-match selection.
 */
const EVENT_CATEGORY_MAP: Record<VisualEventType, SfxCategory[]> = {
  text_slam:         ["impact", "highlight"],
  text_entrance:     ["whoosh", "transition"],
  text_exit:         ["reverse", "transition"],
  word_highlight:    ["highlight", "ui"],
  word_emphasis:     ["highlight", "impact"],
  number_reveal:     ["data", "highlight"],
  number_count:      ["data", "riser"],
  icon_appear:       ["reveal", "ui"],
  diagram_build:     ["reveal", "data"],
  infographic_step:  ["reveal", "ui"],
  zoom_punch:        ["transition", "whoosh"],
  zoom_through:      ["whoosh", "transition"],
  scene_transition:  ["transition", "reverse"],
  wipe_transition:   ["transition", "reverse"],
  button_appear:     ["ui", "reveal"],
  card_appear:       ["ui", "highlight"],
  lower_third:       ["ui", "reveal"],
  cta_appear:        ["cta", "highlight"],
  logo_reveal:       ["cta", "cinematic"],
  success_event:     ["cta", "notification"],
  error_event:       ["ui", "impact"],
  warning_event:     ["ui", "riser"],
  dropdown:          ["ui", "transition"],
  toggle:            ["ui", "ui"],
  checkmark:         ["ui", "notification"],
  progress_step:     ["ui", "data"],
  pull_to_refresh:   ["ui", "whoosh"],
  swipe:             ["transition", "whoosh"],
  broll_transition:  ["transition", "whoosh"],
  emotional_peak:    ["cinematic", "impact"],
  reflection:        ["cinematic", "ambience"],
  celebration:       ["accent", "cta"],
  playful_note:      ["accent", "highlight"],
  reveal_moment:     ["highlight", "cinematic"],
  background_accent: ["ambience", "riser"],
};

// ─── Intensity by Event Type ───────────────────────────────────────────────────

const EVENT_INTENSITY_MAP: Partial<Record<VisualEventType, [number, number]>> = {
  text_slam:         [3, 5],
  text_entrance:     [1, 3],
  text_exit:         [1, 2],
  word_highlight:    [1, 2],
  word_emphasis:     [2, 3],
  number_reveal:     [2, 4],
  number_count:      [1, 2],
  icon_appear:       [1, 2],
  diagram_build:     [1, 3],
  infographic_step:  [1, 2],
  zoom_punch:        [2, 4],
  zoom_through:      [3, 5],
  scene_transition:  [2, 4],
  wipe_transition:   [2, 4],
  button_appear:     [1, 2],
  card_appear:       [1, 2],
  lower_third:       [1, 2],
  cta_appear:        [3, 5],
  logo_reveal:       [4, 5],
  success_event:     [2, 4],
  error_event:       [2, 3],
  warning_event:     [1, 2],
  dropdown:          [1, 2],
  toggle:            [1, 2],
  checkmark:         [1, 2],
  progress_step:     [1, 2],
  pull_to_refresh:   [2, 3],
  swipe:             [2, 3],
  broll_transition:  [2, 4],
  emotional_peak:    [3, 5],
  reflection:        [1, 2],
  celebration:       [2, 4],
  playful_note:      [1, 2],
  reveal_moment:     [2, 4],
  background_accent: [1, 1],
};

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Search the SFX library for assets matching the query.
 */
export function searchLibrary(query: SfxSearchQuery): SfxSearchResult[] {
  let results = [...SFX_LIBRARY];

  // Filter by category
  if (query.category) {
    results = results.filter((a) => a.category === query.category);
  }

  // Filter by intensity range
  if (query.intensityRange) {
    const [minI, maxI] = query.intensityRange;
    results = results.filter((a) => a.intensity >= minI && a.intensity <= maxI);
  }

  // Filter by tonal
  if (query.tonal) {
    results = results.filter((a) => a.tonal === query.tonal);
  }

  // Filter by duration range
  if (query.durationRange) {
    const [minD, maxD] = query.durationRange;
    results = results.filter((a) => a.durationMs[0] <= maxD && a.durationMs[1] >= minD);
  }

  // Filter by generative only
  if (query.generativeOnly) {
    results = results.filter((a) => a.generative);
  }

  // Filter by has audio file
  if (query.hasAudioFile) {
    results = results.filter((a) => a.assetPath !== null);
  }

  // Exclude IDs
  if (query.excludeIds) {
    results = results.filter((a) => !query.excludeIds!.includes(a.id));
  }

  // Text search
  if (query.query && query.query.trim()) {
    const q = query.query.toLowerCase();
    results = results.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q)) ||
        a.useFor.some((u) => u.toLowerCase().includes(q)) ||
        a.kind.toLowerCase().includes(q)
    );
  }

  // Score and sort
  const scored: SfxSearchResult[] = results.map((asset) => {
    let score = 0;
    const matchedTags: string[] = [];
    const matchedUseFor: string[] = [];

    if (query.query && query.query.trim()) {
      const q = query.query.toLowerCase();
      if (asset.name.toLowerCase().includes(q)) score += 10;
      asset.tags.forEach((t) => {
        if (t.includes(q)) { score += 3; matchedTags.push(t); }
      });
      asset.useFor.forEach((u) => {
        if (u.toLowerCase().includes(q)) { score += 5; matchedUseFor.push(u); }
      });
    }

    // Boost generative assets for immediate use
    if (asset.generative) score += 2;

    return { asset, score, matchedTags, matchedUseFor };
  });

  scored.sort((a, b) => b.score - a.score);

  const limit = query.limit ?? 50;
  return scored.slice(0, limit);
}

// ─── Selection ────────────────────────────────────────────────────────────────

/**
 * Select the best SFX for a visual event type.
 * Falls back to "MISSING" description if no suitable asset exists.
 */
export function selectSfxForEvent(
  eventType: VisualEventType,
  config: SfxDecisionConfig = DEFAULT_LIBRARY_SFX_CONFIG
): SfxSelectionDecision {
  const categories = EVENT_CATEGORY_MAP[eventType] || ["whoosh"];
  const intensityRange = EVENT_INTENSITY_MAP[eventType] || [1, 3];

  // Search for best match
  const candidates: SfxSearchResult[] = [];
  for (const category of categories) {
    const results = searchLibrary({
      category,
      intensityRange,
      generativeOnly: true,
      limit: 5,
    });
    candidates.push(...results);
  }

  // Sort by score, dedupe
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    if (seen.has(c.asset.id)) return false;
    seen.add(c.asset.id);
    return true;
  });

  if (unique.length > 0) {
    const best = unique[0];
    const alternatives = unique.slice(1, 4);
    return {
      asset: best.asset,
      confidence: Math.min(1, best.score / 15),
      reason: `Best match for ${eventType} (category: ${best.asset.category}, intensity: ${best.asset.intensity})`,
      alternatives,
      isMissing: false,
    };
  }

  // No match found — return MISSING description
  const fallbackCategory = categories[0] ?? "whoosh";
  const description = `${fallbackCategory} SFX for ${eventType} event (intensity ${intensityRange[0]}-${intensityRange[1]})`;
  return {
    asset: null as unknown as SfxAsset,
    confidence: 0,
    reason: `No matching SFX found for ${eventType}`,
    alternatives: [],
    isMissing: true,
    missingDescription: description,
  };
}

/**
 * Select SFX for multiple event types at once.
 * Returns a map of eventType → selection decision.
 */
export function selectSfxForEvents(
  eventTypes: VisualEventType[],
  config: SfxDecisionConfig = DEFAULT_LIBRARY_SFX_CONFIG
): Map<VisualEventType, SfxSelectionDecision> {
  const results = new Map<VisualEventType, SfxSelectionDecision>();
  const usedIds = new Set<string>();

  for (const eventType of eventTypes) {
    const decision = selectSfxForEvent(eventType, config);

    // If best match was already used, try alternatives
    if (decision.asset && usedIds.has(decision.asset.id)) {
      for (const alt of decision.alternatives) {
        if (!usedIds.has(alt.asset.id)) {
          decision.asset = alt.asset;
          decision.reason = `Alternative for ${eventType} (category: ${alt.asset.category})`;
          break;
        }
      }
    }

    if (decision.asset && decision.asset.id) {
      usedIds.add(decision.asset.id);
    }

    results.set(eventType, decision);
  }

  return results;
}

// ─── Decision Engine ──────────────────────────────────────────────────────────

/**
 * Decide which SFX to use for a list of timed events.
 * Each event has a timestamp, duration, type, and visual event kind.
 */
export interface TimedSfxEvent {
  timestamp: number;       // seconds
  durationMs: number;      // milliseconds
  eventType: VisualEventType;
  label?: string;
  confidence?: number;
}

export interface SfxLibraryDecision {
  sfxId: string;
  asset: SfxAsset;
  timestamp: number;       // seconds
  durationMs: number;
  volume: number;
  duckDb: number;
  fadeInMs: number;
  fadeOutMs: number;
  highPassHz: number;
  sourceEvent: TimedSfxEvent;
  confidence: number;
  reason: string;
}

export function decideLibrarySfx(
  events: TimedSfxEvent[],
  config: SfxDecisionConfig = DEFAULT_LIBRARY_SFX_CONFIG
): SfxLibraryDecision[] {
  const decisions: SfxLibraryDecision[] = [];

  for (const event of events) {
    const selection = selectSfxForEvent(event.eventType, config);

    if (selection.isMissing || !selection.asset) {
      console.warn(`[SFX Library] Missing SFX for event: ${event.eventType}`);
      continue;
    }

    const asset = selection.asset;
    const rawDuration = Math.max(asset.durationMs[0], Math.min(asset.durationMs[1], event.durationMs));
    const durationMs = rawDuration ?? asset.durationMs[1];

    // Calculate timestamp with lead time
    let timestampSec = event.timestamp - config.leadMs / 1000;
    if (timestampSec < 0) timestampSec = 0;

    const baseVolume = asset.defaultGain;
    const volume = baseVolume * config.globalVolume;
    const duckDb = asset.duckDb;

    decisions.push({
      sfxId: asset.id,
      asset,
      timestamp: timestampSec,
      durationMs,
      volume,
      duckDb,
      fadeInMs: asset.fadeInMs,
      fadeOutMs: asset.fadeOutMs,
      highPassHz: asset.highPassHz,
      sourceEvent: event,
      confidence: selection.confidence,
      reason: selection.reason,
    });
  }

  // Sort by timestamp
  decisions.sort((a, b) => a.timestamp - b.timestamp);

  // Remove overlapping SFX (keep higher intensity)
  const filtered: SfxLibraryDecision[] = [];
  for (const decision of decisions) {
    const last = filtered[filtered.length - 1];
    if (last) {
      const lastEnd = last.timestamp + (last.durationMs + last.fadeOutMs) / 1000;
      if (decision.timestamp < lastEnd + 0.05) {
        if (decision.asset.intensity > last.asset.intensity) {
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

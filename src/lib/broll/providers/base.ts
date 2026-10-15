/**
 * base.ts — Provider interface and shared utilities.
 */

import type {
  ProviderVideoResult,
  VideoSearchQuery,
  ProviderCredentials,
} from "../types";

/**
 * Base provider interface.
 * Every provider must implement these methods.
 */
export interface BrollProvider {
  /** Provider name */
  name: string;

  /** Check if credentials are configured */
  hasCredentials(credentials: ProviderCredentials): boolean;

  /** Search for videos matching the query */
  searchVideos(
    query: VideoSearchQuery,
    credentials: ProviderCredentials
  ): Promise<ProviderVideoResult[]>;

  /** Validate that a URL is a reachable download link */
  validateDownloadUrl?(url: string): Promise<boolean>;
}

/**
 * Build a video search query with orientation and duration filters.
 */
export function buildQuery(
  baseQuery: string,
  orientation: "portrait" | "landscape" | "any" = "any",
  minDurationSec?: number,
  maxDurationSec?: number
): VideoSearchQuery {
  const query: VideoSearchQuery = { query: baseQuery };

  if (orientation !== "any") {
    query.orientation = orientation;
  }

  if (minDurationSec !== undefined) {
    query.minDurationSec = minDurationSec;
  }

  if (maxDurationSec !== undefined) {
    query.maxDurationSec = maxDurationSec;
  }

  return query;
}

/**
 * Deduplicate results by asset ID, keeping highest relevance.
 */
export function deduplicateResults(
  results: ProviderVideoResult[]
): ProviderVideoResult[] {
  const seen = new Map<string, ProviderVideoResult>();

  for (const result of results) {
    const existing = seen.get(result.assetId);
    if (!existing || result.relevance > existing.relevance) {
      seen.set(result.assetId, result);
    }
  }

  return Array.from(seen.values()).sort((a, b) => b.relevance - a.relevance);
}

/**
 * Parse a "WxH" resolution string into numeric width and height.
 *
 * Returns null for anything that is not two positive integers — a missing,
 * empty or malformed resolution must be treated as UNKNOWN, never as 0x0,
 * because a zero height would make `height > width` false and silently
 * classify an unknown clip as landscape.
 */
export function parseResolution(
  resolution: string | undefined | null
): { width: number; height: number } | null {
  if (!resolution) return null;
  const match = /^\s*(\d+)\s*x\s*(\d+)\s*$/i.exec(resolution);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

/**
 * Whether a "WxH" resolution string describes a PORTRAIT video.
 *
 * This replaces the old string test `resolution.includes("1080x1920")`, which
 * only recognised one canonical size. Real portrait B-roll arrives as 1080x1904,
 * 1080x1905, 2160x3840, 2160x4096 and others — every one of those was scored as
 * landscape, so the downloader rejected portrait clips for the 9:16 Premium
 * composition while asking the API for portrait.
 *
 * An unparseable resolution returns false (treated as landscape / unknown), so
 * callers that need to distinguish "not portrait" from "unknown" should call
 * parseResolution themselves.
 */
export function isPortraitResolution(resolution: string | undefined | null): boolean {
  const parsed = parseResolution(resolution);
  if (!parsed) return false;
  return parsed.height > parsed.width;
}

/**
 * Words that carry no topical signal in a B-roll search.
 *
 * These appear in almost every planner query ("career growth", "similar
 * comparison matching") and in almost every stock tag list, so counting them
 * would inflate unrelated clips and flatten the differences between genuinely
 * relevant and irrelevant footage.
 */
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "in", "on", "for", "with", "to", "is",
  "are", "was", "were", "be", "been", "being", "not", "no", "their", "they",
  "them", "its", "it", "by", "as", "at", "from", "that", "this", "these",
  "those", "than", "then", "so", "if", "but", "about", "into", "over",
  "under", "up", "down", "out", "off", "very", "more", "most", "some", "any",
  "all", "each", "other", "such", "only", "own", "same", "too", "can",
  "will", "just", "now", "how", "what", "when", "where", "who", "why",
  "video", "videos", "clip", "clips", "footage", "stock", "hd", "4k", "1080p",
  "720p", "full", "format", "quality", "background", "scene", "shot", "film",
  "movie", "cinematic", "animation", "animated", "loop", "loopable",
]);

/**
 * Normalize one token for comparison.
 *
 * Lowercases, trims, and strips punctuation that Pixabay tags carry ("ai
 * generated," -> "ai generated"). Hyphens become spaces so "close-up" and
 * "close up" compare equal; the pieces are re-split so both forms yield the
 * same tokens.
 */
function normalizeToken(raw: string): string[] {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/-/g, " ")
    .trim();
  if (!cleaned) return [];
  return cleaned.split(/\s+/).filter(Boolean);
}

/**
 * Split a comma- or space-separated phrase into normalized, de-duplicated
 * keywords, with stop words removed.
 *
 * Order is preserved (first occurrence wins) so callers that weight early
 * keywords see the query's own priority order.
 */
export function tokenizeKeywords(text: string): string[] {
  const parts = text
    .split(",")
    .flatMap((chunk) => normalizeToken(chunk))
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    if (STOP_WORDS.has(part)) continue;
    if (part.length < 2) continue;
    if (seen.has(part)) continue;
    seen.add(part);
    out.push(part);
  }
  return out;
}

/**
 * Score how well a provider result matches the search query, 0..1.
 *
 * Deterministic: same inputs always give the same number, with no randomness
 * and no dependence on result ordering or page position.
 *
 * Matching is WHOLE-TOKEN, never prefix or substring. Multi-word tags are split
 * into tokens first, so "money" matches the tag "money-bag" (tokens
 * ["money","bag"]) and "salary" matches "salary raise". It deliberately does NOT
 * use `startsWith`, which produced false positives: "cash" matched
 * "cashier-station" and "cat" matched "caterpillar".
 *
 * Two tiers of match, which feed a confidence term:
 *   EXACT  — the whole tag is the keyword (tag tokens === [keyword])
 *   TOKEN  — the keyword is one token of a multi-word tag
 *
 *   score = coverage x confidence
 *   coverage   = matched keywords / query keywords
 *   confidence = 0.5 + 0.5 x (exact matches / query keywords)
 *
 * So full exact coverage scores 1.0, the same coverage via multi-word tags
 * scores 0.5, a partial match lands in between, and zero overlap scores 0.
 *
 * This replaces the hard-coded `relevance: 0.8` every provider used to emit,
 * which made all results tie so page order decided the winner — that is how a
 * mosque clip outranked money footage for a salary query.
 */
export function scoreRelevance(
  queryKeywords: string[],
  tags: string[]
): number {
  if (queryKeywords.length === 0) return 0;

  // Each tag becomes its list of normalized tokens, e.g. "close-up" -> ["close"].
  const tagTokens = tags
    .map((t) => normalizeToken(t))
    .filter((tokens) => tokens.length > 0);

  if (tagTokens.length === 0) return 0;

  let matched = 0;
  let exactHits = 0;

  for (const keyword of queryKeywords) {
    // Whole-tag match: the tag is exactly this keyword and nothing else.
    const isExact = tagTokens.some(
      (tokens) => tokens.length === 1 && tokens[0] === keyword
    );
    if (isExact) {
      matched++;
      exactHits++;
      continue;
    }
    // Token match: the keyword is one word of a multi-word tag.
    if (tagTokens.some((tokens) => tokens.includes(keyword))) {
      matched++;
    }
  }

  if (matched === 0) return 0;

  const coverage = matched / queryKeywords.length;
  const confidence = 0.5 + 0.5 * (exactHits / queryKeywords.length);
  return round4(coverage * confidence);
}

/** Convenience wrapper: tokenize a raw query string and score in one call. */
export function scoreRelevanceForQuery(
  queryText: string,
  tags: string[]
): number {
  return scoreRelevance(tokenizeKeywords(queryText), tags);
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Filter results by minimum criteria.
 */
export function filterResults(
  results: ProviderVideoResult[],
  minDurationSec = 0,
  minRelevance = 0
): ProviderVideoResult[] {
  return results.filter(
    (r) =>
      r.durationSec >= minDurationSec &&
      r.relevance >= minRelevance &&
      r.commercialUse
  );
}

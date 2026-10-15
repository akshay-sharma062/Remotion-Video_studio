/**
 * pixabay.ts — Pixabay video provider.
 *
 * Pixabay API docs: https://pixabay.com/api/docs/
 * - Free API key required (sign up at pixabay.com/accounts/register/)
 * - Rate limit: No strict limit, but be reasonable
 * - License: Pixabay License (free for commercial use, no attribution required)
 * - Videos: MP4, up to 1080p on free tier
 *
 * TWO THINGS THIS FILE IS CAREFUL ABOUT:
 *
 * 1. `orientation` IS IGNORED BY THE VIDEO API.
 *    Pixabay's `orientation=vertical` parameter is honoured on its IMAGE search
 *    but not on /api/videos/. A query with and without the flag returns the same
 *    result set. So orientation is still SENT (it is harmless, and will start
 *    working if Pixabay adds support), but it is NEVER relied on: portrait
 *    selection happens client-side in `selectPixabayResults`.
 *
 * 2. PORTRAIT CLIPS ARE SPARSE, SO ONE PAGE IS NOT ENOUGH.
 *    For a typical Premium 9:16 query, roughly 4% of results are portrait and
 *    they cluster on pages 2-4. The first page (per_page<=20) is almost always
 *    entirely landscape. `searchVideos` therefore pages forward until it has
 *    enough portrait candidates or hits a hard bound — never unbounded.
 *
 * Required env var or config: PIXABAY_API_KEY
 */

import type {
  VideoSearchQuery,
  ProviderVideoResult,
  ProviderCredentials,
} from "../types";
import type { BrollProvider } from "./base";
import { isPortraitResolution, scoreRelevanceForQuery } from "./base";

const PIXABAY_API_BASE = "https://pixabay.com/api/videos/";

/**
 * Results requested per page.
 *
 * Pixabay rejects per_page < 3 with HTTP 400 "per_page is out of valid range",
 * and caps it at 200. 100 is the largest value that keeps the response payload
 * manageable while halving the number of requests needed to reach the pages
 * where portrait clips actually appear.
 */
const PER_PAGE = 100;

/**
 * Hard bound on API requests made by a single `searchVideos` call.
 *
 * Pagination must never become an unbounded crawl: this is the ceiling no
 * matter how few portrait clips turn up. 4 requests x 100 results = at most 400
 * candidates examined, which is comfortably inside Pixabay's "be reasonable"
 * guidance and covers the ~375-result set the test queries return.
 */
const MAX_PAGES = 4;

/**
 * Stop paging once this many portrait candidates have been collected.
 *
 * The downloader picks one clip, so a small pool is enough to choose from while
 * still leaving room for a relevance comparison. Without this bound a query
 * with many portrait hits would page all the way to MAX_PAGES for no benefit.
 */
const PORTRAIT_TARGET = 5;

/**
 * Build one page request's query string.
 *
 * Exported for tests: the request shape (page size, page index, which filters
 * are sent) is exactly what the bounds tests assert against.
 */
export function buildPixabayParams(
  query: VideoSearchQuery,
  credentials: ProviderCredentials,
  page: number
): URLSearchParams {
  const params = new URLSearchParams({
    key: credentials.apiKey,
    q: query.query,
    video_type: "film",
    per_page: String(PER_PAGE),
    page: String(page),
  });

  if (query.minDurationSec) {
    params.set("min_duration", String(query.minDurationSec));
  }
  if (query.maxDurationSec) {
    params.set("max_duration", String(query.maxDurationSec));
  }

  // Sent for forward-compatibility. The video API ignores it — portrait is
  // decided client-side below, so this flag can never be the thing that makes
  // a search return landscape clips for a 9:16 composition.
  if (query.orientation && query.orientation !== "any") {
    params.set(
      "orientation",
      query.orientation === "portrait" ? "vertical" : "horizontal"
    );
  }

  return params;
}

/**
 * Order results for a PORTRAIT-first, relevance-second selection.
 *
 * Ordering is a three-level, fully deterministic key:
 *   1. orientation match (portrait first when portrait was requested)
 *   2. relevance, descending
 *   3. assetId, ascending — the tie-break
 *
 * The assetId tie-break matters. Pixabay assigns numeric ids roughly in upload
 * order, so two clips with equal relevance would otherwise be ordered by page
 * position, which varies with the query. Sorting on the id makes the chosen clip
 * reproducible across runs: the same query on different days selects the same
 * asset, so a manifest written today matches one written tomorrow.
 *
 * Non-matching orientation is kept at the end rather than discarded, preserving
 * the provider's fallback behaviour: if a project has no portrait clip for a
 * query, the downloader still receives a candidate instead of an empty list.
 */
export function selectPixabayResults(
  results: ProviderVideoResult[],
  orientation: "portrait" | "landscape" | "any" = "any"
): ProviderVideoResult[] {
  const compare = (a: ProviderVideoResult, b: ProviderVideoResult): number => {
    // 2. Relevance first: a relevant clip must beat an irrelevant one even when
    // both are portrait, which is the bug this ordering fixes.
    if (b.relevance !== a.relevance) return b.relevance - a.relevance;
    // 3. Deterministic tie-break.
    if (a.assetId !== b.assetId) return a.assetId < b.assetId ? -1 : 1;
    return 0;
  };

  if (orientation === "any") {
    return [...results].sort(compare);
  }

  // 1. Orientation groups.
  const wanted = (r: ProviderVideoResult) =>
    orientation === "portrait"
      ? isPortraitResolution(r.resolution)
      : !isPortraitResolution(r.resolution);

  const matching = results.filter(wanted).sort(compare);
  const rest = results.filter((r) => !wanted(r)).sort(compare);
  return [...matching, ...rest];
}

/**
 * Parse the Pixabay API response into our standard format.
 *
 * `queryText` is the search query the response belongs to. It is REQUIRED for
 * relevance scoring: a result's score is how well ITS tags match the QUERY, so
 * the query must be threaded through here. (An earlier version scored each hit
 * against its own tags, which returned 1.0 for every clip and reproduced the
 * "everything ties" bug it was meant to fix.)
 *
 * Tolerates a malformed body: a missing or non-array `hits` yields [] rather
 * than throwing, so an unexpected response shape reads as "no results" and the
 * provider falls through to the next candidate. A non-2xx status is a different
 * case — that is raised by fetchPixabayPage, which still throws.
 */
function parsePixabayResponse(data: unknown, queryText: string): ProviderVideoResult[] {
  const response = data as {
    totalHits?: number;
    hits?: unknown;
  };

  const hits = Array.isArray(response?.hits) ? response.hits : [];

  return (hits as Array<{
    id: number;
    pageURL: string;
    type: string;
    tags: string;
    duration: number;
    videos: {
      large: { url: string; width: number; height: number };
      medium?: { url: string; width: number; height: number };
      small?: { url: string; width: number; height: number };
      tiny?: { url: string; width: number; height: number };
    };
    user: string;
    userImageURL: string;
  }>).map((hit): ProviderVideoResult | null => {
    const videoData = hit.videos.large ?? hit.videos.medium ?? hit.videos.small ?? hit.videos.tiny;

    if (!videoData) return null;

    // Pixabay returns one comma-separated tag string. Normalize it once here and
    // reuse it for both the result's `tags` and its relevance score so the two
    // can never disagree.
    const tags = hit.tags.split(",").map((t) => t.trim()).filter(Boolean);

    return {
      assetId: `pixabay-${hit.id}`,
      downloadUrl: videoData.url,
      pageUrl: hit.pageURL,
      thumbnailUrl: hit.userImageURL,
      title: tags.slice(0, 3).join(", "),
      creator: hit.user,
      durationSec: hit.duration,
      resolution: `${videoData.width}x${videoData.height}`,
      license: "cc0",
      attribution: null,
      attributionRequired: false,
      commercialUse: true,
      modificationPermitted: true,
      // Scored against the QUERY, not against the clip's own tags.
      relevance: scoreRelevanceForQuery(queryText, tags),
      tags,
    };
  }).filter((r): r is ProviderVideoResult => r !== null);
}

/**
 * Fetch and parse one page of Pixabay video results.
 *
 * Throws on any non-2xx response, matching the previous behaviour so a bad
 * credential still fails loudly instead of being read as "no results".
 */
async function fetchPixabayPage(
  query: VideoSearchQuery,
  credentials: ProviderCredentials,
  page: number
): Promise<{ results: ProviderVideoResult[]; totalHits: number }> {
  const params = buildPixabayParams(query, credentials, page);
  const response = await fetch(`${PIXABAY_API_BASE}?${params}`);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Pixabay API error ${response.status}: ${response.statusText} — ${body.slice(0, 200)}`
    );
  }

  const data = await response.json();
  return {
    results: parsePixabayResponse(data, query.query),
    totalHits: Number((data as { totalHits?: unknown })?.totalHits ?? 0),
  };
}

export const pixabayProvider: BrollProvider = {
  name: "pixabay",

  hasCredentials(credentials: ProviderCredentials): boolean {
    return !!credentials.apiKey && credentials.apiKey.length > 0;
  },

  async searchVideos(
    query: VideoSearchQuery,
    credentials: ProviderCredentials
  ): Promise<ProviderVideoResult[]> {
    const wantsPortrait = query.orientation === "portrait";
    const collected: ProviderVideoResult[] = [];
    const seen = new Set<string>();
    let totalHits = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const { results, totalHits: total } = await fetchPixabayPage(
        query,
        credentials,
        page
      );
      totalHits = total;

      for (const result of results) {
        if (seen.has(result.assetId)) continue;
        seen.add(result.assetId);
        collected.push(result);
      }

      // Stop when there is nothing left to fetch, or enough portrait candidates
      // are in hand. Both conditions keep the request count bounded.
      const portraitCount = collected.filter((r) =>
        isPortraitResolution(r.resolution)
      ).length;

      // `totalHits` is the authoritative end-of-results signal. A short page is
      // NOT on its own proof that the set is exhausted — Pixabay returns fewer
      // than per_page for legitimate reasons (duplicate filtering, private
      // assets), and trusting it alone stopped the scan after page 1 and missed
      // the portrait clips on pages 2-4.
      const exhausted = totalHits > 0 && collected.length >= totalHits;

      if (exhausted || (wantsPortrait && portraitCount >= PORTRAIT_TARGET)) {
        break;
      }
    }

    // Portrait-first ordering. Landscape results are kept (at the end) so the
    // provider still returns a usable candidate when no portrait clip exists
    // for the query — this preserves the old fallback behaviour.
    return selectPixabayResults(collected, query.orientation ?? "any");
  },
};

export default pixabayProvider;

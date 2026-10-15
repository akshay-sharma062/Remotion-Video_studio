/**
 * _broll-pixabay-portrait.test.ts — tests for Pixabay portrait-video selection.
 *
 * Four groups, matching the defects these changes fix:
 *   1. LANDSCAPE REJECTION  — portrait is decided from real WxH, not a string
 *      match on "1080x1920". Non-canonical portrait sizes must count as portrait.
 *   2. PORTRAIT SELECTION   — portrait clips rank ahead of landscape ones.
 *   3. PAGINATION BOUNDS    — searchVideos makes at most MAX_PAGES requests,
 *      never an unbounded crawl, and stops early when it has enough.
 *   4. EMPTY RESULTS        — an empty or malformed API response yields [] and
 *      does not throw; a bad credential still throws.
 *
 * `fetch` is stubbed for every test: no network, no API key, no download.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  pixabayProvider,
  selectPixabayResults,
  buildPixabayParams,
} from "./providers/pixabay";
import {
  isPortraitResolution,
  parseResolution,
} from "./providers/base";
import type { ProviderVideoResult } from "./types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CREDS = { apiKey: "test-key-not-real" };

function result(
  assetId: string,
  resolution: string,
  relevance = 0.8
): ProviderVideoResult {
  return {
    assetId,
    downloadUrl: `https://example.invalid/${assetId}.mp4`,
    pageUrl: "https://example.invalid/page",
    thumbnailUrl: "https://example.invalid/thumb.jpg",
    title: assetId,
    creator: "tester",
    durationSec: 10,
    resolution,
    license: "cc0",
    attribution: null,
    attributionRequired: false,
    commercialUse: true,
    modificationPermitted: true,
    relevance,
    tags: [],
  };
}

/** The clip we verified by hand for seg-7. */
const VERIFIED_SEG7 = result("pixabay-377143", "1080x1904", 0.9);

const LANDSCAPE_1080P = result("pixabay-4853", "1920x1080", 0.8);
const LANDSCAPE_4K = result("pixabay-9001", "3840x2160", 0.7);
const PORTRAIT_2160x4096 = result("pixabay-40002", "2160x4096", 0.6);
const PORTRAIT_1080x1905 = result("pixabay-50003", "1080x1905", 0.5);

/** Build a page of `n` hits, `portraitEvery` of which are portrait. */
function pageOf(
  pageIndex: number,
  n: number,
  portraitEvery: number,
  totalHits: number
): unknown {
  const hits = [];
  for (let i = 0; i < n; i++) {
    const id = pageIndex * 1000 + i;
    const isPortrait = portraitEvery > 0 && i % portraitEvery === 0;
    hits.push({
      id,
      pageURL: `https://pixabay.invalid/${id}`,
      type: "film",
      tags: `tag${id}, stock`,
      duration: 10,
      videos: {
        large: {
          url: `https://cdn.invalid/${id}.mp4`,
          width: isPortrait ? 1080 : 1920,
          height: isPortrait ? 1904 : 1080,
        },
      },
      user: "tester",
      userImageURL: "",
    });
  }
  return { totalHits, hits };
}

/** Stub global fetch with a handler that returns a Response per call. */
function stubFetch(
  handler: (url: string, page: number) => unknown,
  onCall?: (page: number) => void
): void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : String(input);
    const page = Number(new URL(url).searchParams.get("page") ?? 1);
    onCall?.(page);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => handler(url, page),
      text: async () => JSON.stringify(handler(url, page)),
    } as unknown as Response;
  }) as typeof fetch;
  // Restore after the current test via process hook is awkward; tests that stub
  // always restore in a finally block.
  (globalThis as { __origFetch?: typeof fetch }).__origFetch = original;
}

function restoreFetch(): void {
  const original = (globalThis as { __origFetch?: typeof fetch }).__origFetch;
  if (original) globalThis.fetch = original;
}

// ─── 1. Landscape rejection: real dimensions, not a string match ───────────────

test("isPortraitResolution: canonical and non-canonical portrait sizes", () => {
  // These all FAILED the old `includes("1080x1920")` test.
  assert.equal(isPortraitResolution("1080x1920"), true);
  assert.equal(isPortraitResolution(VERIFIED_SEG7.resolution), true, "1080x1904 must be portrait");
  assert.equal(isPortraitResolution("1080x1905"), true);
  assert.equal(isPortraitResolution("2160x3840"), true);
  assert.equal(isPortraitResolution("2160x4096"), true);
  assert.equal(isPortraitResolution("720x1280"), true);
});

test("isPortraitResolution: landscape and square are not portrait", () => {
  assert.equal(isPortraitResolution("1920x1080"), false);
  assert.equal(isPortraitResolution("3840x2160"), false);
  assert.equal(isPortraitResolution("1280x720"), false);
  assert.equal(isPortraitResolution("1080x1080"), false, "square is not portrait");
});

test("isPortraitResolution: malformed input is not portrait and never throws", () => {
  assert.equal(isPortraitResolution(""), false);
  assert.equal(isPortraitResolution(undefined), false);
  assert.equal(isPortraitResolution(null), false);
  assert.equal(isPortraitResolution("unknown"), false);
  assert.equal(isPortraitResolution("1080x"), false);
  assert.equal(isPortraitResolution("x1080"), false);
  assert.equal(isPortraitResolution("1080 x 1080"), false);
  assert.equal(isPortraitResolution("0x0"), false);
  assert.equal(isPortraitResolution("1080x0"), false);
  assert.equal(isPortraitResolution("abc x def"), false);
  assert.equal(isPortraitResolution("1080x1920x720"), false);
});

test("parseResolution: returns null for anything unparseable", () => {
  assert.deepEqual(parseResolution("1080x1904"), { width: 1080, height: 1904 });
  assert.equal(parseResolution("garbage"), null);
  assert.equal(parseResolution(""), null);
  assert.equal(parseResolution(undefined), null);
  assert.equal(parseResolution("0x100"), null, "zero width is invalid, not 0x0");
});

// ─── 2. Portrait selection ────────────────────────────────────────────────────

test("selectPixabayResults: portrait ranks first when portrait requested", () => {
  const out = selectPixabayResults(
    [LANDSCAPE_1080P, LANDSCAPE_4K, PORTRAIT_2160x4096, VERIFIED_SEG7],
    "portrait"
  );

  assert.equal(out[0].assetId, VERIFIED_SEG7.assetId);
  assert.equal(out[1].assetId, PORTRAIT_2160x4096.assetId);
  assert.equal(out[2].assetId, LANDSCAPE_1080P.assetId);
  assert.equal(out[3].assetId, LANDSCAPE_4K.assetId);
});

test("selectPixabayResults: portrait ordering is by relevance among portraits", () => {
  const lowRel = result("pixabay-low", "1080x1920", 0.1);
  const highRel = result("pixabay-high", "1080x1904", 0.9);
  const midRel = result("pixabay-mid", "720x1280", 0.5);

  const out = selectPixabayResults([lowRel, LANDSCAPE_1080P, midRel, highRel], "portrait");
  assert.deepEqual(
    out.slice(0, 3).map((r) => r.assetId),
    ["pixabay-high", "pixabay-mid", "pixabay-low"]
  );
});

test("selectPixabayResults: landscape requested puts landscape first", () => {
  const out = selectPixabayResults(
    [VERIFIED_SEG7, LANDSCAPE_1080P, PORTRAIT_1080x1905],
    "landscape"
  );
  assert.equal(out[0].assetId, LANDSCAPE_1080P.assetId);
});

test("selectPixabayResults: orientation 'any' sorts purely by relevance", () => {
  const out = selectPixabayResults(
    [VERIFIED_SEG7, LANDSCAPE_1080P, PORTRAIT_2160x4096],
    "any"
  );
  assert.deepEqual(
    out.map((r) => r.assetId),
    ["pixabay-377143", "pixabay-4853", "pixabay-40002"]
  );
});

test("selectPixabayResults: landscape results are KEPT, not dropped (fallback)", () => {
  // If a project has no portrait clip for a query, the downloader must still get
  // a candidate — this is the behaviour that existed before the change.
  const out = selectPixabayResults([LANDSCAPE_1080P, LANDSCAPE_4K], "portrait");
  assert.equal(out.length, 2, "landscape-only results are still returned");
  assert.equal(out[0].assetId, LANDSCAPE_1080P.assetId);
});

test("selectPixabayResults: does not mutate the input array", () => {
  const input = [LANDSCAPE_1080P, VERIFIED_SEG7];
  const before = input.map((r) => r.assetId);
  selectPixabayResults(input, "portrait");
  assert.deepEqual(
    input.map((r) => r.assetId),
    before,
    "caller's array must not be reordered"
  );
});

// ─── 3. Pagination bounds ─────────────────────────────────────────────────────

test("searchVideos: makes MORE THAN ONE request to find portrait clips", async () => {
  const pages: number[] = [];
  stubFetch(
    (_url, page) => pageOf(page, 100, 0, 400), // all landscape, 400 total
    (page) => pages.push(page)
  );

  try {
    const out = await pixabayProvider.searchVideos(
      { query: "salary money finance", orientation: "portrait", minDurationSec: 5, maxDurationSec: 30 },
      CREDS
    );

    assert.ok(pages.length > 1, `expected multiple pages, got ${pages.length}`);
    assert.deepEqual(pages, [1, 2, 3, 4], "should page to the bound then stop");
    assert.equal(out.length, 400, "all unique results collected");
  } finally {
    restoreFetch();
  }
});

test("searchVideos: request count is BOUNDED at 4 pages even with no portrait", async () => {
  let calls = 0;
  stubFetch(() => {
    calls++;
    return pageOf(1, 100, 0, 100000); // claims a huge total, all landscape
  });

  try {
    await pixabayProvider.searchVideos(
      { query: "nothing portrait here", orientation: "portrait" },
      CREDS
    );
    assert.equal(calls, 4, `must stop at MAX_PAGES=4, made ${calls}`);
  } finally {
    restoreFetch();
  }
});

test("searchVideos: STOPS EARLY once enough portrait clips are found", async () => {
  let calls = 0;
  stubFetch(() => {
    calls++;
    // Every 3rd result is portrait -> ~33 per page, far more than needed.
    return pageOf(1, 100, 3, 300);
  });

  try {
    await pixabayProvider.searchVideos(
      { query: "plenty of portrait", orientation: "portrait" },
      CREDS
    );
    assert.equal(calls, 1, `should need only page 1, made ${calls}`);
  } finally {
    restoreFetch();
  }
});

test("searchVideos: STOPS when totalHits says the set is exhausted", async () => {
  let calls = 0;
  stubFetch(() => {
    calls++;
    // totalHits=30 with 30 collected => nothing left, stop after page 1.
    return pageOf(1, 30, 0, 30);
  });

  try {
    const out = await pixabayProvider.searchVideos(
      { query: "small result set", orientation: "portrait" },
      CREDS
    );
    assert.equal(calls, 1, `must not request a page past the end, made ${calls}`);
    assert.equal(out.length, 30);
  } finally {
    restoreFetch();
  }
});

test("searchVideos: a SHORT page alone does not stop the scan", async () => {
  // Regression: the exhaustion test used to be `results.length < PER_PAGE`,
  // which stopped after page 1 whenever Pixabay returned fewer than 100 hits —
  // including the real queries where portrait clips live on pages 2-4.
  let calls = 0;
  stubFetch((_url, page) => {
    calls++;
    if (page === 1) return pageOf(1, 30, 0, 400); // short page, but 400 total
    // Portrait clips only exist from page 2 onward.
    const body = pageOf(page, 100, 0, 400) as { hits: Array<Record<string, unknown>> };
    body.hits[0] = {
      id: 377143, pageURL: "u", type: "film", tags: "money, finance", duration: 6,
      videos: { large: { url: "https://cdn.invalid/377143.mp4", width: 1080, height: 1904 } },
      user: "u", userImageURL: "",
    };
    return body;
  });

  try {
    const out = await pixabayProvider.searchVideos(
      { query: "salary money finance", orientation: "portrait" },
      CREDS
    );
    assert.ok(calls >= 2, `must page past a short first page, made ${calls} call(s)`);
    assert.equal(out[0].assetId, "pixabay-377143", "portrait clip from page 2 must be found");
  } finally {
    restoreFetch();
  }
});

test("searchVideos: orientation=any does NOT page past page 1 for portrait", async () => {
  // With no portrait preference there is no early-stop condition, so it still
  // runs to the bound — but this documents the behaviour explicitly.
  let calls = 0;
  stubFetch(() => {
    calls++;
    return pageOf(1, 100, 0, 400);
  });

  try {
    await pixabayProvider.searchVideos({ query: "any orientation" }, CREDS);
    assert.equal(calls, 4);
  } finally {
    restoreFetch();
  }
});

test("searchVideos: portrait clips on LATER PAGES are reachable and ranked first", async () => {
  // The real defect: portrait clips exist only from page 2 onward, and the old
  // single-request implementation could never see them.
  stubFetch((_url, page) => {
    if (page === 1) return pageOf(1, 100, 0, 300); // all landscape
    if (page === 2) {
      const p = pageOf(2, 100, 0, 300);
      // Overwrite the first two hits on page 2 with portrait clips.
      (p as { hits: Array<Record<string, unknown>> }).hits[0] = {
        id: 377143,
        pageURL: "https://pixabay.invalid/377143",
        type: "film",
        tags: "money, finance",
        duration: 6,
        videos: { large: { url: "https://cdn.invalid/377143.mp4", width: 1080, height: 1904 } },
        user: "SambriaLG",
        userImageURL: "",
      };
      (p as { hits: Array<Record<string, unknown>> }).hits[1] = {
        id: 40002,
        pageURL: "https://pixabay.invalid/40002",
        type: "film",
        tags: "money, bills",
        duration: 16,
        videos: { large: { url: "https://cdn.invalid/40002.mp4", width: 2160, height: 4096 } },
        user: "someone",
        userImageURL: "",
      };
      return p;
    }
    return pageOf(page, 100, 0, 300);
  });

  try {
    const out = await pixabayProvider.searchVideos(
      { query: "similar comparison matching salary money finance career success", orientation: "portrait", minDurationSec: 5, maxDurationSec: 30 },
      CREDS
    );

    assert.equal(out[0].assetId, "pixabay-377143", "verified seg-7 clip must rank first");
    assert.equal(out[0].resolution, "1080x1904");
    assert.equal(isPortraitResolution(out[0].resolution), true);
    assert.equal(out[1].assetId, "pixabay-40002");
    // Everything after the two portraits is landscape.
    assert.equal(isPortraitResolution(out[2].resolution), false);
  } finally {
    restoreFetch();
  }
});

test("searchVideos: duplicate assetIds across pages are deduplicated", async () => {
  // Pixabay pagination can overlap; the same id must not appear twice.
  stubFetch(() => pageOf(1, 100, 0, 100));

  try {
    const out = await pixabayProvider.searchVideos(
      { query: "stable page", orientation: "portrait" },
      CREDS
    );
    const ids = out.map((r) => r.assetId);
    assert.equal(new Set(ids).size, ids.length, "no duplicate assetIds");
  } finally {
    restoreFetch();
  }
});

test("buildPixabayParams: per_page and page are within API limits", () => {
  const params = buildPixabayParams(
    { query: "x", orientation: "portrait", minDurationSec: 5, maxDurationSec: 30 },
    CREDS,
    2
  );

  const perPage = Number(params.get("per_page"));
  const page = Number(params.get("page"));

  // Pixabay rejects per_page < 3 with HTTP 400, and caps at 200.
  assert.ok(perPage >= 3, `per_page ${perPage} would be rejected`);
  assert.ok(perPage <= 200, `per_page ${perPage} exceeds the API cap`);
  assert.equal(perPage, 100);
  assert.equal(page, 2);
  assert.equal(params.get("min_duration"), "5");
  assert.equal(params.get("max_duration"), "30");
  assert.equal(params.get("orientation"), "vertical");
  assert.equal(params.get("video_type"), "film");
});

test("buildPixabayParams: omits orientation for 'any' and unknown values", () => {
  const any = buildPixabayParams({ query: "x", orientation: "any" }, CREDS, 1);
  assert.equal(any.get("orientation"), null);

  const none = buildPixabayParams({ query: "x" }, CREDS, 1);
  assert.equal(none.get("orientation"), null);

  const landscape = buildPixabayParams({ query: "x", orientation: "landscape" }, CREDS, 1);
  assert.equal(landscape.get("orientation"), "horizontal");
});

// ─── 4. Empty-result handling ─────────────────────────────────────────────────

test("searchVideos: zero hits returns [] and does not throw", async () => {
  stubFetch(() => ({ totalHits: 0, hits: [] }));

  try {
    const out = await pixabayProvider.searchVideos(
      { query: "zzzzz no such footage", orientation: "portrait" },
      CREDS
    );
    assert.deepEqual(out, []);
  } finally {
    restoreFetch();
  }
});

test("searchVideos: missing hits field is treated as empty, not a crash", async () => {
  stubFetch(() => ({ totalHits: 0 }));

  try {
    const out = await pixabayProvider.searchVideos(
      { query: "malformed response", orientation: "portrait" },
      CREDS
    );
    assert.deepEqual(out, []);
  } finally {
    restoreFetch();
  }
});

test("searchVideos: hits with no usable video entry are skipped", async () => {
  stubFetch(() => ({
    totalHits: 2,
    hits: [
      { id: 1, pageURL: "u", type: "film", tags: "a", duration: 5, videos: {}, user: "u", userImageURL: "" },
      {
        id: 2, pageURL: "u", type: "film", tags: "b", duration: 5,
        videos: { large: { url: "https://cdn.invalid/2.mp4", width: 1080, height: 1920 } },
        user: "u", userImageURL: "",
      },
    ],
  }));

  try {
    const out = await pixabayProvider.searchVideos(
      { query: "one good hit", orientation: "portrait" },
      CREDS
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].assetId, "pixabay-2");
  } finally {
    restoreFetch();
  }
});

test("searchVideos: a non-2xx response still THROWS (bad credential fails loudly)", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => ({
    ok: false,
    status: 401,
    statusText: "Unauthorized",
    json: async () => ({}),
    text: async () => '{"error":"Invalid key"}',
  }) as unknown as Response) as typeof fetch;

  try {
    await assert.rejects(
      () => pixabayProvider.searchVideos({ query: "x" }, CREDS),
      /Pixabay API error 401/,
      "a 401 must not be read as 'no results'"
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("searchVideos: a network failure still THROWS", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("ECONNREFUSED");
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => pixabayProvider.searchVideos({ query: "x" }, CREDS),
      /ECONNREFUSED/
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("hasCredentials: empty key is rejected", () => {
  assert.equal(pixabayProvider.hasCredentials({ apiKey: "" }), false);
  assert.equal(pixabayProvider.hasCredentials({ apiKey: "k" }), true);
});

test("provider interface is unchanged (name + method signatures)", () => {
  assert.equal(pixabayProvider.name, "pixabay");
  assert.equal(typeof pixabayProvider.searchVideos, "function");
  assert.equal(typeof pixabayProvider.hasCredentials, "function");
});

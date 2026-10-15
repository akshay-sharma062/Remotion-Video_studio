/**
 * _broll-pixabay-relevance.test.ts — deterministic relevance scoring tests.
 *
 * Replaces the hard-coded `relevance: 0.8` with a tag/query overlap score.
 * The defect being tested: every clip tied at 0.8, so page order picked the
 * winner and a mosque clip outranked money footage for a salary query.
 *
 * Groups:
 *   1. FINANCE QUERIES        — relevant finance clips outrank unrelated ones
 *   2. UNRELATED TAGS         — zero overlap scores 0, never above a match
 *   3. PARTIAL MATCHES        — score is graded, not binary
 *   4. PORTRAIT RANKING       — portrait preference is preserved, but semantic
 *                               relevance is primary AMONG portrait candidates
 *   5. EMPTY TAGS             — empty tag lists score 0 and never crash
 *   6. DETERMINISTIC TIES     — equal relevance breaks on assetId, reproducibly
 *
 * `fetch` is stubbed: no network, no API key, no download.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  pixabayProvider,
  selectPixabayResults,
} from "./providers/pixabay";
import {
  scoreRelevance,
  scoreRelevanceForQuery,
  tokenizeKeywords,
} from "./providers/base";
import type { ProviderVideoResult } from "./types";

const CREDS = { apiKey: "test-key-not-real" };

/** The real seg-7 query. */
const SALARY_QUERY =
  "similar comparison matching salary money finance career success";

function result(
  assetId: string,
  resolution: string,
  relevance: number,
  tags: string[] = []
): ProviderVideoResult {
  return {
    assetId,
    downloadUrl: `https://example.invalid/${assetId}.mp4`,
    pageUrl: "https://example.invalid/page",
    thumbnailUrl: "https://example.invalid/thumb.jpg",
    title: tags.slice(0, 3).join(", ") || assetId,
    creator: "tester",
    durationSec: 10,
    resolution,
    license: "cc0",
    attribution: null,
    attributionRequired: false,
    commercialUse: true,
    modificationPermitted: true,
    relevance,
    tags,
  };
}

function hit(id: number, tags: string, width: number, height: number, duration = 10): unknown {
  return {
    id,
    pageURL: `https://pixabay.invalid/${id}`,
    type: "film",
    tags,
    duration,
    videos: { large: { url: `https://cdn.invalid/${id}.mp4`, width, height } },
    user: "tester",
    userImageURL: "",
  };
}

function stubFetch(pages: Record<number, unknown>, onCall?: (page: number) => void): void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : String(input);
    const page = Number(new URL(url).searchParams.get("page") ?? 1);
    onCall?.(page);
    const body = pages[page] ?? { totalHits: 0, hits: [] };
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }) as typeof fetch;
  (globalThis as { __origFetch?: typeof fetch }).__origFetch = original;
}

function restoreFetch(): void {
  const original = (globalThis as { __origFetch?: typeof fetch }).__origFetch;
  if (original) globalThis.fetch = original;
}

// ─── 1. Finance queries ───────────────────────────────────────────────────────

test("finance query: money footage scores above unrelated footage", () => {
  const money = scoreRelevanceForQuery(SALARY_QUERY, ["money", "finance", "salary", "cash"]);
  const mosque = scoreRelevanceForQuery(SALARY_QUERY, ["blue mosque", "mosque", "islam", "istanbul"]);
  const nature = scoreRelevanceForQuery(SALARY_QUERY, ["mountains", "valley", "pasture", "forest"]);

  assert.ok(money > 0, "finance tags must score above zero");
  assert.equal(mosque, 0, "unrelated tags must score zero");
  assert.equal(nature, 0, "unrelated tags must score zero");
  assert.ok(money > mosque, "relevant must outrank irrelevant");
});

test("finance query: the exact mosque-vs-money case from the bug report", () => {
  // These are the two real clips that tied at 0.8 and were ordered by page.
  const mosque = result("pixabay-273961", "1080x1920", scoreRelevanceForQuery(
    SALARY_QUERY, ["blue mosque", "mosque", "islam", "istanbul"]
  ), ["blue mosque", "mosque", "islam", "istanbul"]);

  const businessFinance = result("pixabay-233393", "2160x4096", scoreRelevanceForQuery(
    SALARY_QUERY, ["man", "boss", "business", "finance"]
  ), ["man", "boss", "business", "finance"]);

  const out = selectPixabayResults([mosque, businessFinance], "portrait");

  assert.equal(out[0].assetId, "pixabay-233393", "business/finance must rank above the mosque");
  assert.ok(businessFinance.relevance > mosque.relevance);
});

test("finance query: full keyword coverage scores highest", () => {
  const full = scoreRelevanceForQuery(SALARY_QUERY, [
    "similar", "comparison", "matching", "salary", "money", "finance", "career", "success",
  ]);
  const partial = scoreRelevanceForQuery(SALARY_QUERY, ["salary", "money"]);

  assert.ok(full > partial, `full coverage ${full} must beat partial ${partial}`);
  assert.ok(full > 0.9, `full coverage should be near 1.0, got ${full}`);
});

test("career query: career tags beat unrelated tags", () => {
  const career = scoreRelevanceForQuery(SALARY_QUERY, ["career", "success", "business", "promotion"]);
  const food = scoreRelevanceForQuery(SALARY_QUERY, ["plate", "gas", "fire", "kitchen"]);
  assert.ok(career > food);
  assert.equal(food, 0);
});

// ─── 2. Unrelated tags ────────────────────────────────────────────────────────

test("unrelated tags score exactly zero", () => {
  assert.equal(scoreRelevanceForQuery(SALARY_QUERY, ["mosque", "istanbul", "turkey"]), 0);
  assert.equal(scoreRelevanceForQuery(SALARY_QUERY, ["dog", "park", "running"]), 0);
  assert.equal(scoreRelevanceForQuery(SALARY_QUERY, ["sunset", "beach", "ocean"]), 0);
});

test("a zero-scoring clip never outranks any scoring clip", () => {
  const zero = result("pixabay-a", "1080x1920", 0, ["mosque"]);
  const tiny = result("pixabay-b", "1080x1920", 0.1, ["money"]);
  const out = selectPixabayResults([zero, tiny], "portrait");
  assert.equal(out[0].assetId, "pixabay-b");
});

test("whole-token matching does not create false positives", () => {
  // Matching is whole-token, not prefix. `startsWith` produced false positives:
  // "cash" matched "cashier-station" and "cat" matched "caterpillar".
  assert.ok(scoreRelevanceForQuery("money", ["money-bag"]) > 0, "money-bag contains the token 'money'");
  assert.equal(scoreRelevanceForQuery("cash", ["cashier-station"]), 0, "cashier is not 'cash'");
  assert.equal(scoreRelevanceForQuery("pay", ["payment"]), 0, "payment is not 'pay'");
  assert.equal(scoreRelevanceForQuery("sal", ["salary"]), 0, "partial word is not a match");
  assert.equal(scoreRelevanceForQuery("salar", ["salary"]), 0, "truncated word is not a match");
});

test("substring-only matches are rejected", () => {
  // "cat" must not match "caterpillar", "education", or "location".
  assert.equal(scoreRelevanceForQuery("cat", ["caterpillar"]), 0);
  assert.equal(scoreRelevanceForQuery("cat", ["education"]), 0);
  assert.equal(scoreRelevanceForQuery("cat", ["location"]), 0);
});

// ─── 3. Partial matches ───────────────────────────────────────────────────────

test("partial matches produce a graded, intermediate score", () => {
  const q = ["salary", "money", "finance", "career"];
  const one = scoreRelevance(q, ["salary"]);
  const two = scoreRelevance(q, ["salary", "money"]);
  const three = scoreRelevance(q, ["salary", "money", "finance"]);

  assert.ok(one > 0 && one < two, `1 match ${one} must be below 2 matches ${two}`);
  assert.ok(two < three, `2 matches ${two} must be below 3 matches ${three}`);
  assert.ok(three < 1, `3/4 coverage ${three} must be below full coverage`);
});

test("exact tag matches outrank prefix-only matches at equal coverage", () => {
  const q = ["salary", "money"];
  const exact = scoreRelevance(q, ["salary", "money"]);          // both exact
  const prefix = scoreRelevance(q, ["salary-raise", "money-bag"]); // both prefix

  assert.ok(exact > prefix, `exact ${exact} must beat prefix-only ${prefix}`);
});

test("multi-word tags normalize consistently", () => {
  // "close-up", "close up" and "close,up" must all tokenize the same way.
  // "up" is a stop word, so it is dropped and the surviving token is ["close"].
  assert.deepEqual(tokenizeKeywords("close-up"), ["close"]);
  assert.deepEqual(tokenizeKeywords("close up"), ["close"]);
  assert.deepEqual(tokenizeKeywords("close,up"), ["close"]);

  // Use a pair with no stop words to show hyphen and space forms score equally.
  assert.deepEqual(tokenizeKeywords("money-bag"), ["money", "bag"]);
  assert.deepEqual(tokenizeKeywords("money bag"), ["money", "bag"]);

  const a = scoreRelevanceForQuery("money bag", ["money-bag"]);
  const b = scoreRelevanceForQuery("money-bag", ["money bag"]);
  assert.equal(a, b, "hyphen and space forms must score identically");
});

test("scores are bounded to 0..1 and rounded deterministically", () => {
  const cases: Array<[string, string[]]> = [
    [SALARY_QUERY, ["salary", "money", "finance", "career", "success"]],
    [SALARY_QUERY, ["money"]],
    [SALARY_QUERY, ["mosque"]],
    ["money money money", ["money", "money"]],
  ];
  for (const [q, tags] of cases) {
    const s = scoreRelevanceForQuery(q, tags);
    assert.ok(s >= 0 && s <= 1, `score ${s} out of range for ${q}`);
  }
  // Repeated calls are identical — no randomness, no ordering dependence.
  for (let i = 0; i < 5; i++) {
    assert.equal(
      scoreRelevanceForQuery(SALARY_QUERY, ["money", "finance"]),
      scoreRelevanceForQuery(SALARY_QUERY, ["money", "finance"])
    );
  }
});

test("stop words do not inflate a score", () => {
  // "and the for with" are all stop words — they must contribute nothing.
  assert.equal(scoreRelevanceForQuery("and the for with", ["and", "the", "for", "with"]), 0);
  // "video"/"stock"/"hd" are stop words too, so a generic stock tag list
  // must not score against a content query.
  assert.equal(scoreRelevanceForQuery("salary money", ["video", "stock", "hd", "4k"]), 0);
});

// ─── 4. Portrait ranking ──────────────────────────────────────────────────────

test("portrait preference is preserved: portrait beats landscape at equal relevance", () => {
  const portrait = result("pixabay-p", "1080x1904", 0.5, ["money"]);
  const landscape = result("pixabay-l", "1920x1080", 0.5, ["money"]);
  const out = selectPixabayResults([landscape, portrait], "portrait");
  assert.equal(out[0].assetId, "pixabay-p", "portrait must come first");
});

test("semantic relevance is PRIMARY among portrait candidates", () => {
  // Both portrait. The irrelevant one must NOT win just because it is portrait
  // or has a lower assetId.
  const mosque = result("pixabay-1", "1080x1920", scoreRelevanceForQuery(SALARY_QUERY, ["mosque", "islam"]), ["mosque", "islam"]);
  const finance = result("pixabay-999", "2160x4096", scoreRelevanceForQuery(SALARY_QUERY, ["money", "finance", "salary"]), ["money", "finance", "salary"]);

  const out = selectPixabayResults([mosque, finance], "portrait");
  assert.equal(out[0].assetId, "pixabay-999", "relevance must decide among portrait clips");
});

test("a relevant landscape clip does not displace a less-relevant portrait clip", () => {
  // Portrait is still a grouping criterion, so this stays portrait-first.
  const portraitWeak = result("pixabay-p", "1080x1904", 0.2, ["money"]);
  const landscapeStrong = result("pixabay-l", "1920x1080", 0.9, ["salary", "finance", "career"]);

  const out = selectPixabayResults([landscapeStrong, portraitWeak], "portrait");
  assert.equal(out[0].assetId, "pixabay-p", "portrait group wins, preserving the 9:16 workflow");
  assert.equal(out[1].assetId, "pixabay-l", "relevant landscape is still kept, ranked after");
});

test("landscape request puts the most relevant landscape clip first", () => {
  const a = result("pixabay-a", "1920x1080", 0.9, ["money"]);
  const b = result("pixabay-b", "3840x2160", 0.1, ["nature"]);
  const p = result("pixabay-p", "1080x1920", 1.0, ["money"]);
  const out = selectPixabayResults([b, p, a], "landscape");
  assert.equal(out[0].assetId, "pixabay-a");
  assert.equal(out[2].assetId, "pixabay-p", "portrait goes last for a landscape request");
});

test("orientation 'any' ranks purely by relevance", () => {
  const weak = result("pixabay-1", "1920x1080", 0.1, ["x"]);
  const strong = result("pixabay-2", "1080x1904", 0.9, ["money"]);
  const out = selectPixabayResults([weak, strong], "any");
  assert.deepEqual(out.map((r) => r.assetId), ["pixabay-2", "pixabay-1"]);
});

// ─── 5. Empty tags ────────────────────────────────────────────────────────────

test("empty tags score zero and never throw", () => {
  assert.equal(scoreRelevanceForQuery(SALARY_QUERY, []), 0);
  assert.equal(scoreRelevanceForQuery(SALARY_QUERY, ["", "  "]), 0);
  assert.equal(scoreRelevance([], ["money"]), 0, "empty query keywords -> 0, not NaN");
  assert.equal(scoreRelevance([], []), 0);
});

test("empty query string scores zero", () => {
  assert.equal(scoreRelevanceForQuery("", ["money", "finance"]), 0);
  assert.equal(scoreRelevanceForQuery("   ", ["money"]), 0);
});

test("a clip with empty tags never outranks a tagged clip", () => {
  const untagged = result("pixabay-1", "1080x1920", 0, []);
  const tagged = result("pixabay-2", "1080x1920", scoreRelevanceForQuery(SALARY_QUERY, ["money"]), ["money"]);
  const out = selectPixabayResults([untagged, tagged], "portrait");
  assert.equal(out[0].assetId, "pixabay-2");
});

test("punctuation and whitespace in tags are handled", () => {
  const s = scoreRelevanceForQuery("salary money", ["  SALARY , , Money! ", "..."]);
  assert.ok(s > 0, `expected a positive score, got ${s}`);
});

// ─── 6. Deterministic tie-breaking ────────────────────────────────────────────

test("equal relevance breaks on assetId, reproducibly", () => {
  const a = result("pixabay-100", "1080x1904", 0.5, ["money"]);
  const b = result("pixabay-200", "1080x1904", 0.5, ["money"]);
  const c = result("pixabay-300", "1080x1904", 0.5, ["money"]);

  // Shuffled input must always yield the same order.
  const expected = ["pixabay-100", "pixabay-200", "pixabay-300"];
  assert.deepEqual(selectPixabayResults([a, b, c], "portrait").map((r) => r.assetId), expected);
  assert.deepEqual(selectPixabayResults([c, b, a], "portrait").map((r) => r.assetId), expected);
  assert.deepEqual(selectPixabayResults([b, a, c], "portrait").map((r) => r.assetId), expected);
});

test("assetId tie-break is lexicographic and stable", () => {
  const low = result("pixabay-2", "1080x1904", 0.5, ["money"]);
  const high = result("pixabay-10", "1080x1904", 0.5, ["money"]);
  // "pixabay-10" < "pixabay-2" as strings, so it sorts first.
  assert.deepEqual(selectPixabayResults([low, high], "portrait").map((r) => r.assetId), ["pixabay-10", "pixabay-2"]);
});

test("selectPixabayResults does not mutate its input", () => {
  const input = [result("pixabay-b", "1080x1904", 0.1, ["x"]), result("pixabay-a", "1080x1904", 0.9, ["money"])];
  const before = input.map((r) => r.assetId);
  selectPixabayResults(input, "portrait");
  assert.deepEqual(input.map((r) => r.assetId), before);
});

// ─── End-to-end through the provider (stubbed fetch) ─────────────────────────

test("provider: mosque clip no longer outranks finance clips", async () => {
  // Page 1 returns the mosque and kitchen clips first (as the live API does),
  // page 2 the finance clips. All four are portrait. Both finance clips score
  // identically (each matches 1 of 8 query keywords), so the assetId tie-break
  // decides between them — what matters is that NEITHER unrelated clip wins.
  stubFetch({
    1: {
      totalHits: 200,
      hits: [
        hit(273961, "blue mosque, mosque, islam, istanbul, turkey", 1080, 1920, 23),
        hit(141854, "plate, gas, fire, kitchen", 1080, 1920, 5),
      ],
    },
    2: {
      totalHits: 200,
      hits: [
        hit(233393, "man, boss, business, finance, profit", 2160, 4096, 16),
        hit(215096, "money, bills, cash, party, luxury", 2160, 4096, 14),
      ],
    },
  });

  try {
    const out = await pixabayProvider.searchVideos(
      { query: SALARY_QUERY, orientation: "portrait", minDurationSec: 5, maxDurationSec: 30 },
      CREDS
    );

    // The winner is a finance clip, decided by the deterministic tie-break.
    assert.equal(out[0].assetId, "pixabay-215096");
    assert.ok(
      out.find((r) => r.assetId === "pixabay-233393")!.relevance ===
        out[0].relevance,
      "both finance clips must score equally"
    );

    // Both unrelated clips score zero and sit at the end.
    const zeroStart = out.findIndex((r) => r.relevance === 0);
    assert.ok(zeroStart >= 2, `zero-relevance clips must be last, first at ${zeroStart}`);
    assert.equal(
      new Set(out.filter((r) => r.relevance === 0).map((r) => r.assetId)).size,
      2,
      "exactly the two unrelated clips score zero"
    );
    assert.ok(
      out.filter((r) => r.relevance === 0).every((r) => ["pixabay-141854", "pixabay-273961"].includes(r.assetId)),
      "the zero-scoring clips are the mosque and kitchen ones"
    );
  } finally {
    restoreFetch();
  }
});

test("provider: relevance is no longer hard-coded to 0.8", async () => {
  stubFetch({
    1: {
      totalHits: 2,
      hits: [
        hit(1, "money, finance, salary", 1080, 1920),
        hit(2, "mosque, istanbul", 1080, 1920),
      ],
    },
  });

  try {
    const out = await pixabayProvider.searchVideos(
      { query: SALARY_QUERY, orientation: "portrait" },
      CREDS
    );
    const scores = out.map((r) => r.relevance);
    assert.ok(scores.some((s) => s === 0.8) === false, "0.8 must not appear as a score");
    assert.ok(new Set(scores).size > 1, `scores must differ, got ${scores}`);
    assert.ok(scores.every((s) => s >= 0 && s <= 1));
  } finally {
    restoreFetch();
  }
});

test("provider: all-landscape results still return a candidate (fallback)", async () => {
  stubFetch({ 1: { totalHits: 1, hits: [hit(9, "money", 1920, 1080)] } });

  try {
    const out = await pixabayProvider.searchVideos(
      { query: SALARY_QUERY, orientation: "portrait" },
      CREDS
    );
    assert.equal(out.length, 1, "landscape clip is still returned as a fallback");
    assert.equal(out[0].assetId, "pixabay-9");
  } finally {
    restoreFetch();
  }
});

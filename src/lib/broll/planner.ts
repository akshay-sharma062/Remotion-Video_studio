/**
 * planner.ts — the B-roll planning intelligence.
 *
 * Given a transcript + scene timeline, decides:
 *   1. Which segments need B-roll (vs keep talking-head)
 *   2. What visual treatment each segment gets
 *   3. What search query to use for stock footage
 *
 * Decision logic:
 *   - Negation words ("not", "no", "without") → talking-head
 *   - Concrete entities (names, numbers, places) → B-roll
 *   - Abstract concepts → animated graphic or highlight-only
 *   - Short segments (< 15 frames) → highlight-only
 *   - Hi/greeting → talking-head
 */

import type {
  TranscriptSegment,
  TranscriptWord,
  VisualSegment,
  VisualTreatment,
  BrollPlanStats,
} from "./types";

// ─── Negation / Concept Word Lists ────────────────────────────────────────────

const NEGATION_WORDS = new Set([
  "not", "no", "never", "neither", "nobody", "nothing", "nowhere",
  "nor", "without", "lack", "lacking", "without", "won't", "don't",
  "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't",
  "can't", "couldn't", "shouldn't", "wouldn't", "haven't", "hasn't",
]);

const CONCEPT_WORDS = new Set([
  "experience", "knowledge", "understanding", "awareness", "skill",
  "skills", "talent", "position", "positioning", "strategy", "mindset",
  "approach", "thinking", "perspective", "difference", "similar",
  "same", "growth", "career", "success", "achievement",
]);

const GREETING_WORDS = new Set([
  "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
  "i am", "i'm", "my name", "thanks", "thank you", "bye", "goodbye",
]);

const VISUAL_ENTITY_MAP: Record<string, { query: string; treatment: VisualTreatment }> = {
  // Concrete / visual
  salary:        { query: "salary money finance career success", treatment: "broll" },
  money:         { query: "money finance cash success", treatment: "broll" },
  finance:       { query: "finance business charts", treatment: "broll" },
  office:        { query: "modern office workplace team", treatment: "broll" },
  team:          { query: "professional team collaborating working", treatment: "broll" },
  meeting:       { query: "business meeting professional", treatment: "broll" },
  corporate:     { query: "corporate office modern building", treatment: "broll" },
  career:        { query: "career growth professional success", treatment: "broll" },
  growth:        { query: "business growth chart success", treatment: "broll" },
  success:       { query: "career success achievement celebration", treatment: "broll" },
  promotion:     { query: "career promotion achievement", treatment: "broll" },
  experienced:   { query: "experienced professional expert working", treatment: "broll" },
  skills:        { query: "professional skills training learning", treatment: "broll" },
  talent:        { query: "talented professional working", treatment: "broll" },
  technology:    { query: "modern technology digital", treatment: "broll" },
  business:      { query: "business professional corporate", treatment: "broll" },
  interview:     { query: "professional job interview", treatment: "broll" },
  hiring:        { query: "hiring manager interview", treatment: "broll" },
  professional:  { query: "professional person working office", treatment: "broll" },
  work:          { query: "professional working desk laptop", treatment: "broll" },
  education:     { query: "education learning development", treatment: "broll" },

  // Abstract / concept-only
  experience:    { query: "experience timeline years", treatment: "animated-graphic" },
  mindset:       { query: "mindset thinking perspective", treatment: "animated-graphic" },
  strategy:      { query: "strategy planning chess", treatment: "animated-graphic" },
  positioning:   { query: "positioning strategy placement", treatment: "highlight-only" },
  knowledge:     { query: "knowledge learning education", treatment: "animated-graphic" },
  thinking:      { query: "thinking brainstorming ideas", treatment: "animated-graphic" },
  perspective:   { query: "perspective view looking", treatment: "animated-graphic" },
  difference:    { query: "difference comparison contrast", treatment: "animated-graphic" },
  similar:       { query: "similar comparison matching", treatment: "animated-graphic" },
};

// ─── Segment Builder ──────────────────────────────────────────────────────────

/**
 * Split transcript words into coherent segments (phrase-level, ~3-8 words each).
 * Uses timing gaps > 400ms as natural boundaries.
 */
export function buildTranscriptSegments(
  inputWords: TranscriptWord[],
  fps: number
): TranscriptSegment[] {
  // Normalise to the canonical ms form. Callers may pass either the
  // transcript.json `start_ms`/`end_ms` shape or the short `start`/`end`.
  const words = inputWords.map((w) => ({
    word: w.word,
    start_ms: w.start_ms ?? w.start ?? 0,
    end_ms: w.end_ms ?? w.end ?? w.start_ms ?? w.start ?? 0,
  }));
  const segments: TranscriptSegment[] = [];
  const GAP_THRESHOLD_MS = 400; // pause > 400ms = new segment
  const MAX_WORDS = 8;

  let currentWords: typeof words = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const cleanWord = word.word.toLowerCase().replace(/[^a-z]/g, "");

    // Check if this starts a new segment
    if (currentWords.length >= MAX_WORDS) {
      pushSegment(currentWords, segments);
      currentWords = [];
    } else if (
      currentWords.length > 0 &&
      word.start_ms - currentWords[currentWords.length - 1].end_ms > GAP_THRESHOLD_MS
    ) {
      pushSegment(currentWords, segments);
      currentWords = [];
    }

    currentWords.push(word);
  }

  if (currentWords.length > 0) {
    pushSegment(currentWords, segments);
  }

  // pushSegment already emitted well-formed TranscriptSegment records.
  return segments;
}

function pushSegment(
  words: Array<{ word: string; start_ms: number; end_ms: number }>,
  segments: TranscriptSegment[]
): void {
  if (words.length === 0) return;
  const id = segments.length;
  segments.push({
    id: `seg-${id}`,
    startMs: words[0].start_ms,
    endMs: words[words.length - 1].end_ms,
    text: words.map((w) => w.word).join(" "),
    words: words.map((w) => ({
      word: w.word,
      start: w.start_ms,
      end: w.end_ms,
    })),
  });
}

// ─── Visual Segment Planner ───────────────────────────────────────────────────

/**
 * Decide B-roll treatment for a segment based on its content.
 */
function decideTreatment(
  text: string,
  frameCount: number
): { treatment: VisualTreatment; searchQuery: string; confidence: number } {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/).map((w) => w.replace(/[^a-z]/g, ""));

  // Check for greetings
  const isGreeting =
    GREETING_WORDS.has(words[0] ?? "") ||
    GREETING_WORDS.has(words.slice(0, 2).join(" "));
  if (isGreeting) {
    return { treatment: "talking-head", searchQuery: "", confidence: 0.9 };
  }

  // Check for negation
  const hasNegation = words.some((w) => NEGATION_WORDS.has(w));
  if (hasNegation) {
    return { treatment: "talking-head", searchQuery: "", confidence: 0.85 };
  }

  // Short segments get highlight-only
  if (frameCount < 15) {
    return { treatment: "highlight-only", searchQuery: "", confidence: 0.8 };
  }

  // Check for known visual entities
  const matchedEntities: string[] = [];
  let bestQuery = "";
  let bestTreatment: VisualTreatment = "animated-graphic";

  for (const word of words) {
    const mapped = VISUAL_ENTITY_MAP[word];
    if (mapped) {
      matchedEntities.push(word);
      if (!bestQuery) {
        bestQuery = mapped.query;
        bestTreatment = mapped.treatment;
      }
    }
  }

  if (matchedEntities.length > 0) {
    // Build enriched query from all matched entities
    const queries = matchedEntities
      .map((w) => VISUAL_ENTITY_MAP[w]?.query ?? "")
      .filter(Boolean);

    if (queries.length > 0) {
      bestQuery = queries.join(" ");
    }

    // If at least one entity is concrete, prefer B-roll
    const hasBrollEntity = matchedEntities.some(
      (w) => VISUAL_ENTITY_MAP[w]?.treatment === "broll"
    );
    if (hasBrollEntity && !hasNegation) {
      bestTreatment = "broll";
    }

    const confidence = Math.min(0.5 + matchedEntities.length * 0.1, 0.95);
    return { treatment: bestTreatment, searchQuery: bestQuery, confidence };
  }

  // No known entities — check for concept words
  const hasConcept = words.some((w) => CONCEPT_WORDS.has(w));
  if (hasConcept) {
    return {
      treatment: "animated-graphic",
      searchQuery: words.slice(0, 4).join(" "),
      confidence: 0.5,
    };
  }

  // Default: highlight-only for unknown content
  return {
    treatment: "highlight-only",
    searchQuery: "",
    confidence: 0.3,
  };
}

/**
 * Extract meaningful entities/concepts from segment text.
 */
function extractEntities(text: string): string[] {
  const lower = text.toLowerCase();
  const entities: string[] = [];

  for (const [word, mapping] of Object.entries(VISUAL_ENTITY_MAP)) {
    if (lower.includes(word)) {
      entities.push(word);
    }
  }

  return entities;
}

/**
 * Plan visual segments from transcript.
 *
 * Returns one VisualSegment per transcript segment, with treatment decisions.
 */
export function planVisualSegments(
  transcriptSegments: TranscriptSegment[],
  fps: number
): VisualSegment[] {
  const segments: VisualSegment[] = [];

  for (const ts of transcriptSegments) {
    const frameCount = Math.round(((ts.endMs - ts.startMs) / 1000) * fps);
    const { treatment, searchQuery, confidence } = decideTreatment(ts.text, frameCount);
    const entities = extractEntities(ts.text);

    // Priority: longer segments + B-roll treatment = higher priority
    let priority = frameCount / 10;
    if (treatment === "broll") priority += 3;
    if (treatment === "animated-graphic") priority += 1;
    if (entities.length > 0) priority += 1;

    segments.push({
      id: ts.id,
      from: Math.round((ts.startMs / 1000) * fps),
      to: Math.round((ts.endMs / 1000) * fps),
      startMs: ts.startMs,
      endMs: ts.endMs,
      transcriptText: ts.text,
      visualDescription: describeVisual(ts.text, treatment),
      searchQuery,
      treatment,
      brollConfidence: confidence,
      entities,
      priority: Math.round(priority),
    });
  }

  return segments;
}

/**
 * Generate a human-readable visual description for a segment.
 */
function describeVisual(text: string, treatment: VisualTreatment): string {
  const lower = text.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  const words = lower.split(/\s+/);

  switch (treatment) {
    case "broll":
      return `Show B-roll footage for: "${words.slice(0, 4).join(" ")}..."`;
    case "talking-head":
      return "Keep talking-head, no B-roll";
    case "animated-graphic":
      return `Animated graphic illustrating: "${words.slice(0, 4).join(" ")}..."`;
    case "still-image":
      return `Static image overlay: "${words.slice(0, 3).join(" ")}..."`;
    case "highlight-only":
      return "Kinetic text highlight, no background change";
  }
}

/**
 * Compute plan statistics.
 */
export function computeStats(segments: VisualSegment[]): BrollPlanStats {
  return {
    totalSegments: segments.length,
    brollSegments: segments.filter((s) => s.treatment === "broll").length,
    talkingHeadSegments: segments.filter((s) => s.treatment === "talking-head").length,
    animatedSegments: segments.filter(
      (s) => s.treatment === "animated-graphic" || s.treatment === "still-image"
    ).length,
    downloadedCount: 0,
    failedCount: 0,
    pendingCount: segments.filter((s) => s.treatment === "broll").length,
  };
}

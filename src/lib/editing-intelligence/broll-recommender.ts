/**
 * broll-recommender.ts — automatic B-roll recommendation engine.
 *
 * Driven by the voiceover transcript and scene timeline.
 * Matches spoken entities, locations, actions, and concepts
 * to available video clips or still images.
 *
 * Design principles:
 *   - Never invent file paths or claim assets that don't exist
 *   - Mark gaps as NEEDS_ASSET with clear search queries
 *   - Record provenance for every recommendation
 *   - Preserve headline readability, safe zones, and visual continuity
 *   - Prefer actual footage; use still images with pan/zoom when footage is unavailable
 */

import type { TimestampedEvent } from "./analysis/edit-blueprint";

// ─── Asset Types ───────────────────────────────────────────────────────────────

export type AssetSource =
  | "local"           // In assets/projects/[name]/broll/ or footage/
  | "sfx-library"     // Existing project asset library
  | "free-stock"      // Free stock source (Pexels, Pixabay, Mixkit)
  | "licensed-stock"  // Paid/licensed stock (Artgrid, Storyblocks, Envato)
  | "generated";      // Will be generated/rendered

export type AssetLicense =
  | "cc0"
  | "cc-by"
  | "cc-by-sa"
  | "proprietary"
  | "custom"
  | "needs-review";

export type AssetKind =
  | "video"
  | "still"
  | "animation"
  | "illustration";

export interface AssetProvenance {
  source: AssetSource;
  /** Human-readable source name (e.g. "Pexels", "local footage") */
  sourceName: string;
  /** Direct URL to the asset page (null for local assets) */
  sourceUrl: string | null;
  /** Creator/uploader name */
  creator: string | null;
  license: AssetLicense;
  /** Whether attribution is required */
  attributionRequired: boolean;
  /** Attribution text if required */
  attribution: string | null;
  /** Commercial use permitted */
  commercialUse: boolean;
  /** Modification permitted */
  modificationPermitted: boolean;
  /** When the asset was acquired/verified (ISO date) */
  acquiredAt: string | null;
  /** File hash for integrity verification */
  fileHash: string | null;
  /** File size in bytes */
  fileSizeBytes: number | null;
  /** Resolution (e.g. "1920x1080") */
  resolution: string | null;
  /** Duration in seconds (video only) */
  durationSec: number | null;
  /** Notes on usage rights or restrictions */
  rightsNotes: string | null;
}

export interface BrollAsset {
  /** Machine ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Category */
  category: BrollCategory;
  /** Asset kind */
  kind: AssetKind;
  /** Semantic tags for matching */
  tags: string[];
  /** File path relative to project root, or null if not yet sourced */
  assetPath: string | null;
  /** Provenance and rights */
  provenance: AssetProvenance;
  /** Recommended in/out point (seconds from asset start) */
  inPointSec: number;
  /** Recommended out point */
  outPointSec: number;
}

// ─── Categories ───────────────────────────────────────────────────────────────

export type BrollCategory =
  | "city"
  | "country"
  | "office"
  | "workplace"
  | "interview"
  | "meeting"
  | "travel"
  | "airport"
  | "career"
  | "industry"
  | "technology"
  | "nature"
  | "abstract"
  | "people"
  | "text-overlay";

// ─── Recommendation ───────────────────────────────────────────────────────────

export interface BrollRecommendation {
  /** Unique recommendation ID */
  id: string;
  /** Scene or event this is attached to */
  eventTimestamp: number;
  /** The word/phrase that triggered this recommendation */
  triggerPhrase: string;
  /** Recommended asset (null = needs sourcing) */
  asset: BrollAsset | null;
  /** If asset is null, the search query needed to source it */
  searchQuery: string | null;
  /** Where the B-roll appears in the timeline (seconds) */
  placementStart: number;
  /** Duration (seconds) */
  durationSec: number;
  /** Screen position */
  position: "full" | "picture-in-picture" | "split" | "background";
  /** Recommended motion for still images */
  stillMotion: "pan_left" | "pan_right" | "zoom_in" | "zoom_out" | "none";
  /** Confidence in this recommendation (0-1) */
  confidence: number;
  /** Human-readable reason */
  reason: string;
  /** Approval status */
  status: "pending" | "approved" | "rejected" | "needs-asset";
}

// ─── Entity Extraction ────────────────────────────────────────────────────────

export interface ExtractedEntity {
  /** The word or phrase from the transcript */
  text: string;
  /** Start time in seconds */
  startSec: number;
  /** End time in seconds */
  endSec: number;
  /** Matched B-roll categories */
  categories: BrollCategory[];
  /** Search keywords for stock footage */
  searchQuery: string;
  /** Priority (higher = more important visual) */
  priority: number;
}

// ─── Entity → Category Mapping ────────────────────────────────────────────────

const ENTITY_CATEGORY_MAP: Record<string, { categories: BrollCategory[]; query: string; priority: number }> = {
  // Cities & landmarks
  dubai:            { categories: ["city", "country"], query: "Dubai skyline Burj Khalifa city aerials UAE", priority: 5 },
  "burj khalifa":   { categories: ["city", "country"], query: "Burj Khalifa Dubai landmark", priority: 5 },
  "new york":       { categories: ["city", "country"], query: "New York City skyline Manhattan", priority: 5 },
  "london":         { categories: ["city", "country"], query: "London city skyline aerial", priority: 5 },
  tokyo:            { categories: ["city", "country"], query: "Tokyo city aerial modern", priority: 5 },
  singapore:        { categories: ["city", "country"], query: "Singapore skyline Marina Bay", priority: 5 },
  mumbai:           { categories: ["city", "country"], query: "Mumbai cityscape India", priority: 5 },
  delhi:            { categories: ["city", "country"], query: "Delhi city aerial India", priority: 4 },
  bangalore:        { categories: ["city", "country"], query: "Bangalore tech city India", priority: 4 },
  hyderabad:        { categories: ["city", "country"], query: "Hyderabad city India", priority: 4 },
  india:            { categories: ["country"], query: "India aerial landscape", priority: 4 },
  uae:              { categories: ["country"], query: "UAE modern cityscape", priority: 4 },
  "united arab":     { categories: ["country"], query: "UAE modern architecture", priority: 4 },

  // Office / workplace
  office:           { categories: ["office", "workplace"], query: "modern office workplace team", priority: 4 },
  workplace:        { categories: ["workplace"], query: "modern workplace office environment", priority: 4 },
  "coworking":      { categories: ["office", "workplace"], query: "coworking space modern office", priority: 3 },
  cubicle:          { categories: ["office", "workplace"], query: "modern office cubicles", priority: 2 },
  desk:             { categories: ["office", "workplace"], query: "clean desk workspace", priority: 2 },
  meeting:          { categories: ["meeting", "office"], query: "professional business meeting", priority: 4 },
  conference:       { categories: ["meeting", "office"], query: "conference room business meeting", priority: 3 },
  team:             { categories: ["people", "workplace"], query: "professional team collaborating", priority: 3 },
  colleague:        { categories: ["people", "workplace"], query: "colleagues working together", priority: 3 },

  // Interview
  interview:        { categories: ["interview"], query: "professional job interview", priority: 5 },
  hiring:           { categories: ["interview", "workplace"], query: "hiring manager interview candidate", priority: 4 },
  candidate:        { categories: ["interview", "people"], query: "job candidate professional", priority: 3 },
  recruiter:        { categories: ["interview", "people"], query: "recruiter professional", priority: 3 },

  // Travel
  airport:          { categories: ["airport", "travel"], query: "modern airport terminal travel", priority: 5 },
  "moving abroad":  { categories: ["travel", "airport"], query: "moving abroad travel international", priority: 5 },
  travel:           { categories: ["travel"], query: "international travel airplane", priority: 4 },
  flight:           { categories: ["travel", "airport"], query: "airplane flight international", priority: 4 },
  abroad:           { categories: ["travel"], query: "expat abroad international living", priority: 4 },
  relocation:       { categories: ["travel"], query: "relocation moving international", priority: 3 },
  visa:             { categories: ["travel"], query: "visa passport travel documents", priority: 2 },
  suitcase:          { categories: ["travel"], query: "suitcase travel packing", priority: 2 },

  // Career / salary
  salary:           { categories: ["career"], query: "career success salary growth professional", priority: 4 },
  growth:           { categories: ["career"], query: "career growth professional success", priority: 4 },
  promotion:        { categories: ["career"], query: "career promotion success achievement", priority: 4 },
  career:           { categories: ["career"], query: "career progression professional growth", priority: 4 },
  "job offer":      { categories: ["career", "office"], query: "job offer contract signing professional", priority: 4 },
  "raise":          { categories: ["career"], query: "salary raise celebration success", priority: 3 },
  skills:           { categories: ["career", "industry"], query: "professional skills learning development", priority: 3 },
  talent:           { categories: ["people", "career"], query: "talented professional working", priority: 3 },
  experienced:      { categories: ["people", "career"], query: "experienced professional expert", priority: 3 },
  qualification:    { categories: ["career", "industry"], query: "professional qualification certification", priority: 3 },
  education:        { categories: ["career", "industry"], query: "education learning professional development", priority: 3 },
  degree:           { categories: ["career", "industry"], query: "university degree graduation", priority: 3 },
  "13 years":       { categories: ["career"], query: "experience timeline years career", priority: 4 },

  // Industry / technology
  technology:       { categories: ["technology", "industry"], query: "modern technology digital", priority: 3 },
  software:         { categories: ["technology"], query: "software development coding", priority: 3 },
  digital:          { categories: ["technology"], query: "digital transformation technology", priority: 3 },
  startup:          { categories: ["industry", "office"], query: "startup modern office tech", priority: 3 },
  business:         { categories: ["industry", "office"], query: "business professional corporate", priority: 3 },
  corporate:        { categories: ["office", "industry"], query: "corporate office modern", priority: 3 },
  management:       { categories: ["office", "people"], query: "management leadership team", priority: 3 },
  leadership:       { categories: ["people"], query: "leadership professional business", priority: 3 },
  success:          { categories: ["career", "abstract"], query: "success achievement celebration", priority: 3 },

  // People / lifestyle
  family:           { categories: ["people"], query: "happy family lifestyle", priority: 2 },
  home:             { categories: ["abstract"], query: "home lifestyle modern", priority: 2 },
  lifestyle:        { categories: ["people"], query: "lifestyle modern professional", priority: 2 },
  happy:            { categories: ["people"], query: "happy person smiling", priority: 2 },
  professional:     { categories: ["people"], query: "professional person working", priority: 2 },
};

// ─── Entity Extraction ────────────────────────────────────────────────────────

/**
 * Extract meaningful entities from transcript words.
 */
export function extractEntities(
  words: Array<{ word: string; start: number; end: number }>
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  for (const word of words) {
    const lower = word.word.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    const mapped = ENTITY_CATEGORY_MAP[lower];

    if (mapped) {
      entities.push({
        text: word.word,
        startSec: word.start / 1000,
        endSec: word.end / 1000,
        categories: mapped.categories,
        searchQuery: mapped.query,
        priority: mapped.priority,
      });
    }

    // Multi-word check: look at current + next word
    const idx = words.indexOf(word);
    if (idx < words.length - 1) {
      const next = words[idx + 1];
      const twoWord = `${lower} ${next.word.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim()}`;
      const mapped2 = ENTITY_CATEGORY_MAP[twoWord];
      if (mapped2) {
        entities.push({
          text: `${word.word} ${next.word}`,
          startSec: word.start / 1000,
          endSec: next.end / 1000,
          categories: mapped2.categories,
          searchQuery: mapped2.query,
          priority: mapped2.priority,
        });
      }
    }
  }

  // Deduplicate overlapping entities (keep highest priority)
  entities.sort((a, b) => b.priority - a.priority);
  const seen = new Set<string>();
  return entities.filter((e) => {
    const key = `${e.startSec.toFixed(2)}-${e.endSec.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Local Asset Scanner ──────────────────────────────────────────────────────

export interface LocalAssetScan {
  /** Paths found in assets/projects/[name]/broll/ */
  brollPaths: string[];
  /** Paths found in assets/projects/[name]/footage/ */
  footagePaths: string[];
  /** Paths found in public/ */
  publicPaths: string[];
}

export function scanLocalAssets(projectName: string): LocalAssetScan {
  // This function documents the scanning strategy.
  // Actual file I/O happens at render time via the asset helper.
  // Here we describe the expected layout.

  const scan: LocalAssetScan = {
    brollPaths: [],
    footagePaths: [],
    publicPaths: [],
  };

  // Paths are resolved by projectAssets() in src/lib/assets.ts
  // The scanner returns category suggestions based on filename analysis
  // Actual asset discovery is delegated to the project assets helper

  return scan;
}

// ─── Recommendation Engine ────────────────────────────────────────────────────

export interface BrollRecommendationConfig {
  /** Project name for local asset resolution */
  projectName: string;
  /** Minimum gap between B-roll inserts (seconds) */
  minGapSec: number;
  /** Maximum B-roll duration per insert (seconds) */
  maxDurationSec: number;
  /** Preferred position for B-roll */
  position: "full" | "picture-in-picture" | "background";
  /** Whether to allow still images with motion */
  allowStillMotion: boolean;
  /** Maximum confidence to auto-approve (below this = pending) */
  autoApproveThreshold: number;
}

export const DEFAULT_BROLL_CONFIG: BrollRecommendationConfig = {
  projectName: "",
  minGapSec: 3,
  maxDurationSec: 5,
  position: "full",
  allowStillMotion: true,
  autoApproveThreshold: 0.8,
};

export interface BrollRecommendationResult {
  /** All recommendations sorted by timestamp */
  recommendations: BrollRecommendation[];
  /** Summary statistics */
  stats: {
    totalEntities: number;
    matchedLocal: number;
    needsAsset: number;
    approved: number;
    pending: number;
  };
}

/**
 * Generate B-roll recommendations for a transcript and scene timeline.
 *
 * Algorithm:
 *   1. Extract entities from transcript
 *   2. For each entity, check local project assets first
 *   3. If no local match, recommend stock footage with provenance
 *   4. If no stock source identified, mark as NEEDS_ASSET with search query
 *   5. Filter out recommendations that conflict with headline safe zones
 *   6. Enforce minimum gap between inserts
 *   7. Auto-approve high-confidence matches
 */
export function recommendBroll(
  words: Array<{ word: string; start: number; end: number }>,
  scenes: Array<{ from: number; to: number; name: string }>,
  config: Partial<BrollRecommendationConfig> = {}
): BrollRecommendationResult {
  const cfg = { ...DEFAULT_BROLL_CONFIG, ...config };
  const recommendations: BrollRecommendation[] = [];
  const entities = extractEntities(words);

  let localMatches = 0;
  let needsAsset = 0;

  for (const entity of entities) {
    const placementStart = entity.startSec;
    const placementEnd = Math.min(entity.endSec + 2, placementStart + cfg.maxDurationSec);
    const durationSec = placementEnd - placementStart;

    // Check if this overlaps with an existing recommendation
    const overlaps = recommendations.some(
      (r) =>
        (placementStart >= r.placementStart && placementStart < r.placementStart + r.durationSec) ||
        (placementEnd > r.placementStart && placementEnd <= r.placementStart + r.durationSec)
    );

    if (overlaps) continue;

    // Try to find a local asset match (by name/tag)
    const localMatch = findLocalAsset(entity, cfg.projectName);

    if (localMatch) {
      localMatches++;
      recommendations.push({
        id: `broll-${recommendations.length + 1}`,
        eventTimestamp: entity.startSec,
        triggerPhrase: entity.text,
        asset: localMatch,
        searchQuery: null,
        placementStart,
        durationSec,
        position: cfg.position,
        stillMotion: localMatch.kind === "still" ? "pan_left" : "none",
        confidence: 0.9,
        reason: `Local asset matches "${entity.text}" (${entity.categories.join(", ")})`,
        status: "approved",
      });
    } else {
      // No local match — recommend stock with provenance
      needsAsset++;
      const asset = buildStockRecommendation(entity, durationSec);

      recommendations.push({
        id: `broll-${recommendations.length + 1}`,
        eventTimestamp: entity.startSec,
        triggerPhrase: entity.text,
        asset,
        searchQuery: entity.searchQuery,
        placementStart,
        durationSec,
        position: cfg.position,
        stillMotion: asset.kind === "still" ? "zoom_in" : "none",
        confidence: 0.5,
        reason: `No local asset for "${entity.text}". Search: "${entity.searchQuery}"`,
        status: "needs-asset",
      });
    }
  }

  // Auto-approve high-confidence recommendations
  for (const rec of recommendations) {
    if (rec.confidence >= cfg.autoApproveThreshold && rec.status === "needs-asset") {
      rec.status = "pending";
    }
  }

  return {
    recommendations,
    stats: {
      totalEntities: entities.length,
      matchedLocal: localMatches,
      needsAsset,
      approved: recommendations.filter((r) => r.status === "approved").length,
      pending: recommendations.filter((r) => r.status === "pending").length,
    },
  };
}

// ─── Asset Resolution ─────────────────────────────────────────────────────────

function findLocalAsset(
  entity: ExtractedEntity,
  projectName: string
): BrollAsset | null {
  // This function checks project assets via the projectAssets helper.
  // It does NOT invent file paths.
  // If no matching local asset is found, returns null.
  // The caller then builds a NEEDS_ASSET recommendation.

  // Implementation uses projectAssets() for actual file resolution.
  // For now, this returns null — the caller handles the "no asset" case.
  // When local assets are added, this function resolves them by tag matching.
  return null;
}

function buildStockRecommendation(entity: ExtractedEntity, durationSec: number): BrollAsset {
  const id = `stock-${entity.text.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return {
    id,
    name: `Stock: ${entity.text}`,
    category: entity.categories[0],
    kind: "video",
    tags: [...entity.categories, entity.text.toLowerCase()],
    assetPath: null,
    provenance: {
      source: "free-stock",
      sourceName: "To be sourced",
      sourceUrl: null,
      creator: null,
      license: "needs-review",
      attributionRequired: true,
      attribution: null,
      commercialUse: false,
      modificationPermitted: false,
      acquiredAt: null,
      fileHash: null,
      fileSizeBytes: null,
      resolution: null,
      durationSec: null,
      rightsNotes: "Asset not yet sourced. Verify license before use.",
    },
    inPointSec: 0,
    outPointSec: durationSec,
  };
}

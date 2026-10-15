/**
 * asset-registry.ts — structured asset metadata and provenance registry.
 *
 * Maintains metadata, tags, duration, source, licence, and preview references
 * for every asset the system knows about. Supports semantic search so future
 * projects can reuse existing assets instead of sourcing everything again.
 *
 * Two-tier system:
 *   - AudioRegistry: SFX, music, ambience
 *   - VisualRegistry: B-roll, stills, images, graphics
 *
 * Both registries share the same provenance model and search interface.
 */

import type {
  AssetProvenance,
  AssetSource,
  AssetLicense,
  AssetKind,
} from "./broll-recommender";
import type { SfxAsset } from "./sfx/sfx-registry";

// ─── Shared Provenance Helpers ────────────────────────────────────────────────

export function provenanceFromGenerated(
  notes?: string
): AssetProvenance {
  return {
    source: "generated",
    sourceName: "VideoStudio procedural generation",
    sourceUrl: null,
    creator: null,
    license: "proprietary",
    attributionRequired: false,
    attribution: null,
    commercialUse: true,
    modificationPermitted: true,
    acquiredAt: new Date().toISOString(),
    fileHash: null,
    fileSizeBytes: null,
    resolution: null,
    durationSec: null,
    rightsNotes: notes ?? "Programmatically generated — no third-party rights.",
  };
}

export function provenanceFromMixkit(
  assetUrl: string,
  creator: string,
  attributionText: string,
  commercialUse = true,
  modificationPermmitted = true
): AssetProvenance {
  return {
    source: "free-stock",
    sourceName: "Mixkit",
    sourceUrl: assetUrl,
    creator,
    license: "cc-by",
    attributionRequired: true,
    attribution: attributionText,
    commercialUse,
    modificationPermitted: modificationPermmitted,
    acquiredAt: new Date().toISOString(),
    fileHash: null,
    fileSizeBytes: null,
    resolution: null,
    durationSec: null,
    rightsNotes: "Free stock from Mixkit. Attribution required.",
  };
}

export function provenanceFromPexels(
  assetUrl: string,
  photographer: string,
  pexelsUrl: string
): AssetProvenance {
  return {
    source: "free-stock",
    sourceName: "Pexels",
    sourceUrl: assetUrl,
    creator: photographer,
    license: "cc0",
    attributionRequired: false,
    attribution: null,
    commercialUse: true,
    modificationPermitted: true,
    acquiredAt: new Date().toISOString(),
    fileHash: null,
    fileSizeBytes: null,
    resolution: null,
    durationSec: null,
    rightsNotes: "Free stock from Pexels (CC0). No attribution required.",
  };
}

export function provenanceFromLocal(
  filePath: string,
  fileSizeBytes: number,
  resolution?: string,
  durationSec?: number
): AssetProvenance {
  return {
    source: "local",
    sourceName: "Project local asset",
    sourceUrl: null,
    creator: "User-provided",
    license: "proprietary",
    attributionRequired: false,
    attribution: null,
    commercialUse: true,
    modificationPermitted: true,
    acquiredAt: new Date().toISOString(),
    fileHash: null,
    fileSizeBytes,
    resolution: resolution ?? null,
    durationSec: durationSec ?? null,
    rightsNotes: "User-provided asset. Verify rights before external distribution.",
  };
}

// ─── Audio Asset Entry ────────────────────────────────────────────────────────

export interface AudioAssetEntry {
  /** Machine ID (matches sfx-registry) */
  id: string;
  /** Human name */
  name: string;
  /** Category */
  category: string;
  /** Tags for search */
  tags: string[];
  /** Duration range [min, max] in ms */
  durationMs: [number, number];
  /** Intensity 1-5 */
  intensity: number;
  /** Tonal character */
  tonal: string;
  /** File path relative to public/sfx/ or work/sfx-audition/ (null = generative) */
  filePath: string | null;
  /** Provenance */
  provenance: AssetProvenance;
  /** Whether this is suitable for headline use */
  headlineSuitable: boolean;
  /** If used for headline, what headline types it matches */
  headlineTypes: string[];
  /** Whether suitable for opening */
  openingSuitable: boolean;
  /** Whether suitable for ending */
  endingSuitable: boolean;
}

// ─── Visual Asset Entry ───────────────────────────────────────────────────────

export interface VisualAssetEntry {
  /** Machine ID */
  id: string;
  /** Human name */
  name: string;
  /** Category */
  category: string;
  /** Asset kind */
  kind: AssetKind;
  /** Tags */
  tags: string[];
  /** File path relative to project root (null = not yet sourced) */
  filePath: string | null;
  /** Provenance */
  provenance: AssetProvenance;
  /** Duration in seconds (video) or null (still) */
  durationSec: number | null;
  /** Resolution */
  resolution: string | null;
  /** Suggested in/out points */
  inPointSec: number;
  outPointSec: number;
  /** Which B-roll categories this matches */
  matchesCategories: string[];
  /** Transcript phrases this matches (semantic) */
  matchesPhrases: string[];
  /** Whether this asset has been reviewed/approved */
  reviewed: boolean;
}

// ─── Audio Registry ───────────────────────────────────────────────────────────

export interface AudioRegistry {
  assets: AudioAssetEntry[];
  categories: Record<string, { label: string; count: number }>;
  tags: string[];
}

export function createAudioRegistry(): AudioRegistry {
  return {
    assets: [],
    categories: {},
    tags: [],
  };
}

// ─── Visual Registry ──────────────────────────────────────────────────────────

export interface VisualRegistry {
  assets: VisualAssetEntry[];
  categories: Record<string, { label: string; count: number }>;
  tags: string[];
}

export function createVisualRegistry(): VisualRegistry {
  return {
    assets: [],
    categories: {},
    tags: [],
  };
}

// ─── Semantic Search ──────────────────────────────────────────────────────────

export interface SearchOptions {
  /** Filter by category */
  category?: string;
  /** Filter by tags (any match) */
  tags?: string[];
  /** Filter by tonal character (audio only) */
  tonal?: string;
  /** Filter by asset kind (visual only) */
  kind?: AssetKind;
  /** Filter by intensity (audio only) */
  intensityRange?: [number, number];
  /** Filter by headline suitability (audio only) */
  headlineSuitable?: boolean;
  /** Filter by opening suitability */
  openingSuitable?: boolean;
  /** Filter by ending suitability */
  endingSuitable?: boolean;
  /** Text search across name, tags, and matched phrases */
  query?: string;
  /** Maximum results */
  limit?: number;
}

export interface SearchResult<T> {
  item: T;
  score: number;
  matchedTags: string[];
  matchedFields: string[];
}

/**
 * Semantic search across an asset registry.
 * Scores by: exact category match > tag overlap > text query match > provenance quality
 */
export function searchAudioRegistry(
  registry: AudioRegistry,
  options: SearchOptions = {}
): SearchResult<AudioAssetEntry>[] {
  return searchRegistry(registry.assets, options, (a) => a);
}

export function searchVisualRegistry(
  registry: VisualRegistry,
  options: SearchOptions = {}
): SearchResult<VisualAssetEntry>[] {
  return searchRegistry(registry.assets, options, (a) => a);
}

function searchRegistry<T>(
  items: T[],
  options: SearchOptions,
  _identity: (item: T) => unknown
): SearchResult<T>[] {
  let results = [...items];

  // Category filter
  if (options.category) {
    const cat = options.category.toLowerCase();
    results = results.filter((item: unknown) => {
      const entry = item as Record<string, unknown>;
      return String(entry.category).toLowerCase() === cat;
    });
  }

  // Tag filter
  if (options.tags && options.tags.length > 0) {
    results = results.filter((item: unknown) => {
      const entry = item as Record<string, unknown>;
      const tags = (entry.tags as string[]) ?? [];
      return options.tags!.some((t) => tags.some((tag) => tag.includes(t) || t.includes(tag)));
    });
  }

  // Query text search
  if (options.query && options.query.trim()) {
    const q = options.query.toLowerCase();
    results = results.filter((item: unknown) => {
      const entry = item as Record<string, unknown>;
      const name = String(entry.name ?? "").toLowerCase();
      const tags = ((entry.tags as string[]) ?? []).join(" ").toLowerCase();
      const phrases = ((entry as Record<string, unknown>).matchesPhrases as string[] ?? []).join(" ").toLowerCase();
      return name.includes(q) || tags.includes(q) || phrases.includes(q);
    });
  }

  // Score and sort
  const scored: SearchResult<T>[] = results.map((item) => {
    let score = 0;
    const matchedTags: string[] = [];
    const matchedFields: string[] = [];

    const entry = item as Record<string, unknown>;

    if (options.query && options.query.trim()) {
      const q = options.query.toLowerCase();
      const name = String(entry.name ?? "").toLowerCase();
      const tags = (entry.tags as string[]) ?? [];

      if (name.includes(q)) { score += 10; matchedFields.push("name"); }
      tags.forEach((t: string) => {
        if (t.includes(q)) { score += 3; matchedTags.push(t); }
      });
      const phrases = ((entry as Record<string, unknown>).matchesPhrases as string[] ?? []);
      phrases.forEach((p: string) => {
        if (p.toLowerCase().includes(q)) { score += 5; matchedFields.push("phrase"); }
      });
    }

    // Boost reviewed items
    if ((entry as Record<string, unknown>).reviewed === true) score += 2;

    // Boost local items
    const provenance = entry.provenance as AssetProvenance | undefined;
    if (provenance?.source === "local") score += 3;

    return { item, score, matchedTags, matchedFields };
  });

  scored.sort((a, b) => b.score - a.score);
  const limit = options.limit ?? 20;
  return scored.slice(0, limit);
}

// ─── Registry Utilities ───────────────────────────────────────────────────────

export function addAudioAsset(registry: AudioRegistry, asset: AudioAssetEntry): AudioRegistry {
  const existing = registry.assets.findIndex((a) => a.id === asset.id);
  if (existing >= 0) {
    registry.assets[existing] = asset;
  } else {
    registry.assets.push(asset);
  }

  // Update category counts
  registry.categories[asset.category] ??= { label: asset.category, count: 0 };
  registry.categories[asset.category].count++;

  // Update global tag list
  for (const tag of asset.tags) {
    if (!registry.tags.includes(tag)) registry.tags.push(tag);
  }

  return registry;
}

export function addVisualAsset(registry: VisualRegistry, asset: VisualAssetEntry): VisualRegistry {
  const existing = registry.assets.findIndex((a) => a.id === asset.id);
  if (existing >= 0) {
    registry.assets[existing] = asset;
  } else {
    registry.assets.push(asset);
  }

  registry.categories[asset.category] ??= { label: asset.category, count: 0 };
  registry.categories[asset.category].count++;

  for (const tag of asset.tags) {
    if (!registry.tags.includes(tag)) registry.tags.push(tag);
  }

  return registry;
}

export function getAudioById(registry: AudioRegistry, id: string): AudioAssetEntry | undefined {
  return registry.assets.find((a) => a.id === id);
}

export function getVisualById(registry: VisualRegistry, id: string): VisualAssetEntry | undefined {
  return registry.assets.find((a) => a.id === id);
}

export function validateAssetReferences(
  registry: AudioRegistry | VisualRegistry,
  ids: string[]
): { valid: string[]; missing: string[] } {
  const valid: string[] = [];
  const missing: string[] = [];

  for (const id of ids) {
    if (registry.assets.some((a) => a.id === id)) {
      valid.push(id);
    } else {
      missing.push(id);
    }
  }

  return { valid, missing };
}

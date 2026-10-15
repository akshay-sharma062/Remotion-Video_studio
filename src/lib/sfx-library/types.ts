/**
 * sfx-library/types.ts — complete type system for the SFX Library.
 *
 * Every asset, decision, search query, and audit result is typed here.
 */

// ─── Core Asset ────────────────────────────────────────────────────────────────

export interface SfxAsset {
  /** Machine ID: lowercase_with_underscores */
  id: string;
  /** Human-readable name */
  name: string;
  /** Category this SFX belongs to */
  category: SfxCategory;
  /** Sub-type within the category */
  kind: string;
  /** Tags for search */
  tags: string[];
  /** Typical duration range [minMs, maxMs] */
  durationMs: [number, number];
  /** Intensity: 1=subtle, 5=maximum impact */
  intensity: 1 | 2 | 3 | 4 | 5;
  /** Tonal character */
  tonal: "bright" | "dark" | "neutral" | "warm" | "sharp";
  /** Recommended use cases */
  useFor: string[];
  /** Recommended visual events */
  recommendedFor: VisualEventType[];
  /** Default gain (0-1) relative to 0dB peak */
  defaultGain: number;
  /** Fade in (ms). 0 = instant. */
  fadeInMs: number;
  /** Fade out (ms) */
  fadeOutMs: number;
  /** Duck this many dB under voice when played during speech */
  duckDb: number;
  /** High-pass filter frequency (Hz). 0 = no filter. */
  highPassHz: number;
  /** Whether this can be generated programmatically if no asset file exists */
  generative: boolean;
  /** Path relative to public/sfx-library/ (null if generative-only) */
  assetPath: string | null;
  /** Provenance information */
  provenance: SfxProvenance;
}

export interface SfxProvenance {
  /** Source: "generated" | "mixkit" | "freesound" | "pixabay" | "custom" */
  source: SfxSource;
  /** Original source URL (if downloaded) */
  sourceUrl: string | null;
  /** Creator/author name (if available) */
  creator: string | null;
  /** License type */
  license: SfxLicense;
  /** Attribution text (if required) */
  attribution: string | null;
  /** Commercial use permitted? */
  commercialUse: boolean;
  /** Modification permitted? */
  modificationPermitted: boolean;
  /** Attribution required? */
  attributionRequired: boolean;
  /** Download date (ISO 8601) */
  downloadedAt: string | null;
  /** File hash for integrity verification */
  fileHash: string | null;
  /** File size in bytes (actual file) */
  fileSizeBytes: number | null;
  /** Sample rate of actual file */
  sampleRate: number | null;
  /** Notes about this asset */
  notes: string | null;
}

export type SfxSource = "generated" | "mixkit" | "freesound" | "pixabay" | "custom";
export type SfxLicense = "cc0" | "cc-by" | "cc-by-nc" | "mixkit-terms" | "freesound-cc0" | "pixabay-content" | "proprietary" | "unknown";

// ─── 14 Categories ─────────────────────────────────────────────────────────────

export type SfxCategory =
  | "whoosh"              // 1. Soft whooshes and airy sweeps
  | "impact"              // 2. Text slams, premium impacts
  | "ui"                  // 3. Clicks, ticks, taps, pops
  | "highlight"           // 4. Keyword highlights and markers
  | "riser"               // 5. Smooth risers and tonal accents
  | "data"                // 6. Number counters and data reveals
  | "transition"          // 7. Transitions, zooms, movement
  | "reveal"              // 8. Icons, diagrams, infographic reveals
  | "cta"                 // 9. CTA and logo endings
  | "ambience"            // 10. Ambient textures and background
  | "accent"              // 11. Light comedic and playful accents
  | "cinematic"           // 12. Cinematic and emotional accents
  | "reverse"             // 13. Reverse whooshes and transition tails
  | "notification";       // 14. Gentle notification and confirmation

// ─── Visual Event Types (for matching) ────────────────────────────────────────

export type VisualEventType =
  | "text_slam"
  | "text_entrance"
  | "text_exit"
  | "word_highlight"
  | "word_emphasis"
  | "number_reveal"
  | "number_count"
  | "icon_appear"
  | "diagram_build"
  | "infographic_step"
  | "zoom_punch"
  | "zoom_through"
  | "scene_transition"
  | "wipe_transition"
  | "button_appear"
  | "card_appear"
  | "lower_third"
  | "cta_appear"
  | "logo_reveal"
  | "success_event"
  | "error_event"
  | "warning_event"
  | "dropdown"
  | "toggle"
  | "checkmark"
  | "progress_step"
  | "pull_to_refresh"
  | "swipe"
  | "broll_transition"
  | "emotional_peak"
  | "reflection"
  | "celebration"
  | "playful_note"
  | "reveal_moment"
  | "background_accent";

// ─── Search & Selection ────────────────────────────────────────────────────────

export interface SfxSearchQuery {
  /** Category filter (optional) */
  category?: SfxCategory;
  /** Intensity range [min, max] */
  intensityRange?: [number, number];
  /** Tonal character filter */
  tonal?: SfxTonalFilter;
  /** Duration range in ms [min, max] */
  durationRange?: [number, number];
  /** Search in name, tags, useFor */
  query?: string;
  /** Only generative assets */
  generativeOnly?: boolean;
  /** Only assets with actual audio files (not generative-only) */
  hasAudioFile?: boolean;
  /** Maximum number of results */
  limit?: number;
  /** Exclude these IDs */
  excludeIds?: string[];
}

export type SfxTonalFilter = "bright" | "dark" | "neutral" | "warm" | "sharp";

export interface SfxSearchResult {
  asset: SfxAsset;
  score: number;
  matchedTags: string[];
  matchedUseFor: string[];
}

// ─── Selection Decision ────────────────────────────────────────────────────────

export interface SfxSelectionDecision {
  /** The chosen asset */
  asset: SfxAsset;
  /** Confidence in this choice (0-1) */
  confidence: number;
  /** Why this asset was chosen */
  reason: string;
  /** Alternative assets that were considered */
  alternatives: SfxSearchResult[];
  /** Whether this is a MISSING asset */
  isMissing: boolean;
  /** Required sound description (if missing) */
  missingDescription?: string;
}

// ─── Audit Results ─────────────────────────────────────────────────────────────

export interface SfxAuditResult {
  /** Total assets in registry */
  totalAssets: number;
  /** Assets with actual files on disk */
  filesFound: number;
  /** Assets referenced in registry but file missing */
  missingFiles: string[];
  /** Assets whose file is silent (no audible content) */
  silentFiles: string[];
  /** Duplicate or near-duplicate pairs */
  duplicates: SfxDuplicatePair[];
  /** Assets flagged as harsh/aggressive for default library */
  excludedHarsh: string[];
  /** Overall health score (0-100) */
  healthScore: number;
}

export interface SfxDuplicatePair {
  assetA: string;
  assetB: string;
  similarity: number;
  reason: string;
}

// ─── Audition ──────────────────────────────────────────────────────────────────

export interface SfxAuditionRequest {
  /** Asset IDs to audition */
  assetIds: string[];
  /** Output directory for audition files */
  outputDir: string;
  /** Normalize all to the same peak level */
  normalizePeak?: number;
  /** Include silence padding before/after (ms) */
  paddingMs?: number;
}

export interface SfxAuditionResult {
  /** Generated audition file paths */
  files: { id: string; path: string; durationMs: number }[];
  /** Total duration with padding */
  totalDurationMs: number;
  /** Output file path (concatenated if multiple) */
  outputPath: string | null;
}

// ─── Manifest ──────────────────────────────────────────────────────────────────

export interface SfxManifest {
  /** Schema version */
  version: string;
  /** Generated timestamp */
  generatedAt: string;
  /** Total asset count */
  totalAssets: number;
  /** Assets grouped by category */
  categories: Record<SfxCategory, SfxManifestEntry[]>;
  /** Asset list (flat) */
  assets: SfxManifestEntry[];
}

export interface SfxManifestEntry {
  id: string;
  name: string;
  category: SfxCategory;
  kind: string;
  tags: string[];
  durationMs: [number, number];
  intensity: number;
  tonal: string;
  generative: boolean;
  assetPath: string | null;
  source: SfxSource;
  creator: string | null;
  license: SfxLicense;
  commercialUse: boolean;
  attributionRequired: boolean;
  attribution: string | null;
  sourceUrl: string | null;
  useFor: string[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

export const SFX_LIBRARY_VERSION = "1.0.0";
export const SFX_LIBRARY_ROOT = "sfx-library";
export const SFX_DEFAULT_SAMPLE_RATE = 44100;
export const SFX_DEFAULT_DUCK_DB = -6;
export const SFX_DEFAULT_FADE_IN_MS = 10;
export const SFX_DEFAULT_FADE_OUT_MS = 120;
export const SFX_DEFAULT_HIGH_PASS_HZ = 130;

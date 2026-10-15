/**
 * types.ts — shared types for the B-roll automation system.
 */

// ─── Provider Types ────────────────────────────────────────────────────────────

export type ProviderName = "pexels" | "pixabay" | "mixkit";

export interface ProviderCredentials {
  apiKey: string;
}

export interface VideoSearchQuery {
  /** Human-readable query for the provider API */
  query: string;
  /** Orientation preference */
  orientation?: "portrait" | "landscape" | "any";
  /** Minimum duration in seconds */
  minDurationSec?: number;
  /** Maximum duration in seconds */
  maxDurationSec?: number;
}

export interface ProviderVideoResult {
  /** Provider-specific asset ID */
  assetId: string;
  /** Direct download URL */
  downloadUrl: string;
  /** Page URL for provenance */
  pageUrl: string;
  /** Thumbnail URL */
  thumbnailUrl: string;
  /** Video title/description */
  title: string;
  /** Creator name */
  creator: string;
  /** Duration in seconds */
  durationSec: number;
  /** Resolution as "WxH" */
  resolution: string;
  /** License type */
  license: ProviderLicense;
  /** Attribution text (if required) */
  attribution: string | null;
  /** Whether attribution is required */
  attributionRequired: boolean;
  /** Whether commercial use is permitted */
  commercialUse: boolean;
  /** Whether modification is permitted */
  modificationPermitted: boolean;
  /** Relevance score from provider (0-1) */
  relevance: number;
  /** Tags from provider */
  tags: string[];
}

export type ProviderLicense =
  | "cc0"             // No rights reserved
  | "cc-by"           // Attribution required
  | "cc-by-sa"        // Attribution + share-alike
  | "pexels-license"  // Pexels license (free, no attribution)
  | "mixkit-terms";   // Mixkit terms

// ─── Transcript Segment ───────────────────────────────────────────────────────

export interface TranscriptSegment {
  /** Segment ID */
  id: string;
  /** Start time in milliseconds */
  startMs: number;
  /** End time in milliseconds */
  endMs: number;
  /** Full text of the segment */
  text: string;
  /** Individual words */
  words: TranscriptWord[];
}

export interface TranscriptWord {
  word: string;
  /** Canonical start in ms (transcript.json uses this form) */
  start_ms?: number;
  /** Canonical end in ms (transcript.json uses this form) */
  end_ms?: number;
  /** Alternate short form, also accepted by the schema */
  start?: number;
  /** Alternate short form, also accepted by the schema */
  end?: number;
}

// ─── Visual Segment ───────────────────────────────────────────────────────────

export interface VisualSegment {
  /** Segment ID */
  id: string;
  /** Start frame */
  from: number;
  /** End frame */
  to: number;
  /** Start time in ms */
  startMs: number;
  /** End time in ms */
  endMs: number;
  /** Original transcript text */
  transcriptText: string;
  /** What should be shown visually */
  visualDescription: string;
  /** Search query for stock footage */
  searchQuery: string;
  /** Treatment type */
  treatment: VisualTreatment;
  /** Confidence that B-roll is appropriate (0-1) */
  brollConfidence: number;
  /** Extracted entities/concepts */
  entities: string[];
  /** Scene priority (higher = more important visual) */
  priority: number;
}

export type VisualTreatment =
  | "broll"            // Stock footage / downloaded video
  | "talking-head"     // Keep original footage, no B-roll
  | "animated-graphic" // Motion graphic / animated text
  | "still-image"      // Static image with motion
  | "highlight-only";  // Just animated text, no background change

// ─── B-roll Plan ──────────────────────────────────────────────────────────────

export interface BrollPlan {
  /** Project name */
  projectName: string;
  /** When the plan was generated (ISO) */
  generatedAt: string;
  /** Total video duration in frames */
  totalFrames: number;
  /** Frames per second */
  fps: number;
  /** All visual segments */
  segments: VisualSegment[];
  /** Assets that were successfully downloaded */
  downloadedAssets: DownloadedAsset[];
  /** Assets that failed to download */
  failedDownloads: FailedDownload[];
  /** Overall stats */
  stats: BrollPlanStats;
}

export interface DownloadedAsset {
  /** Asset ID */
  id: string;
  /** Which segment this serves */
  segmentId: string;
  /** Provider name */
  provider: ProviderName;
  /** Provider asset ID */
  providerAssetId: string;
  /** Local file path (relative to project root) */
  localPath: string;
  /** Source URL */
  sourceUrl: string;
  /** Creator name */
  creator: string;
  /** License */
  license: ProviderLicense;
  /** Attribution required */
  attributionRequired: boolean;
  /** Attribution text */
  attribution: string | null;
  /** Whether commercial use is permitted (carried from the provider result) */
  commercialUse: boolean;
  /** Whether modification/trimming is permitted (carried from the provider result) */
  modificationPermitted: boolean;
  /** File size in bytes */
  fileSizeBytes: number;
  /** Resolution */
  resolution: string;
  /** Duration in seconds */
  durationSec: number;
  /** File hash (sha256) */
  fileHash: string;
  /** Downloaded at (ISO) */
  downloadedAt: string;
}

export interface FailedDownload {
  segmentId: string;
  /**
   * Provider(s) attempted. A single ProviderName normally, but the downloader
   * joins every tried provider with "+" when a segment fails across all of them,
   * or reports "none" when no provider had credentials.
   */
  provider: ProviderName | string;
  providerAssetId: string;
  reason: string;
  attemptedAt: string;
}

export interface BrollPlanStats {
  totalSegments: number;
  brollSegments: number;
  talkingHeadSegments: number;
  animatedSegments: number;
  downloadedCount: number;
  failedCount: number;
  pendingCount: number;
}

// ─── Remotion Manifest Entry ──────────────────────────────────────────────────

export interface BrollManifestEntry {
  phraseIndex: number;
  file: string;
  from: number;
  to: number;
  zoomRange: [number, number];
}

// ─── Pipeline Configuration ───────────────────────────────────────────────────

export interface BrollPipelineConfig {
  /** Project name */
  projectName: string;
  /** Provider API credentials */
  credentials: {
    pexels?: { apiKey: string };
    pixabay?: { apiKey: string };
    mixkit?: { apiKey: string };
  };
  /** Preferred providers (in order) */
  preferredProviders: ProviderName[];
  /** Minimum B-roll confidence to auto-accept (0-1) */
  minBrollConfidence: number;
  /** Minimum segment duration for B-roll (frames) */
  minBrollFrames: number;
  /** Max results per provider per query */
  maxResultsPerQuery: number;
  /** Download directory (relative to project root) */
  downloadDir: string;
  /** Output paths */
  output: {
    planPath: string;
    manifestPath: string;
  };
  /** Whether to skip download (plan-only mode) */
  planOnly: boolean;
  /** Whether to overwrite existing assets */
  overwrite: boolean;
  /**
   * Optional phrase definitions to constrain manifest entries to.
   *
   * When supplied, the manifest is generated phrase-aligned: every entry's
   * from/to is clamped to the phrase it serves, so a planner segment that
   * straddles a phrase boundary cannot activate B-roll during the wrong scene.
   * Omit it to write the flat (unconstrained) manifest.
   */
  phrases?: Array<{
    phraseIndex: number;
    words: string[];
    from: number;
    to: number;
  }>;
  /** Proxy settings (optional) */
  proxy?: {
    host: string;
    port: number;
  };
}

export const DEFAULT_PIPELINE_CONFIG: BrollPipelineConfig = {
  projectName: "",
  credentials: {},
  preferredProviders: ["pexels", "pixabay", "mixkit"],
  minBrollConfidence: 0.5,
  minBrollFrames: 15,
  maxResultsPerQuery: 5,
  downloadDir: "",
  output: {
    planPath: "",
    manifestPath: "",
  },
  planOnly: false,
  overwrite: false,
};

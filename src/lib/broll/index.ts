/**
 * index.ts — barrel export for the B-roll automation library.
 */

// Core pipeline
export {
  runPipeline,
  planBroll,
} from "./pipeline";

// Configuration
export {
  loadBrollConfig,
  printProviderStatus,
  hasAnyProvider,
  validateConfigPaths,
  assertSafeManifestPath,
  assertSafeDownloadDir,
} from "./config";

// Asset path contract (the single definition of where clips live)
export {
  brollAssetFilename,
  brollAssetLocalPath,
  brollAssetStaticPath,
  toStaticFilePath,
} from "./asset-path";

// Phrase alignment (planner segments -> Premium PHRASES)
export {
  mapPlannerToPhrases,
  buildPhraseAlignedManifest,
} from "./phrase-mapper";
export type { PremiumPhrase } from "./phrase-mapper";

// Types
export type {
  BrollPipelineConfig,
  DEFAULT_PIPELINE_CONFIG,
  ProviderName,
  ProviderCredentials,
  ProviderVideoResult,
  ProviderLicense,
  VideoSearchQuery,
  TranscriptSegment,
  TranscriptWord,
  VisualSegment,
  VisualTreatment,
  BrollPlan,
  DownloadedAsset,
  FailedDownload,
  BrollPlanStats,
  BrollManifestEntry,
} from "./types";

// Downloader types
export type {
  DownloadProgress,
  ProgressCallback,
  DownloadResult,
} from "./downloader";

// Validator types
export type {
  ValidationResult,
  ValidationCheck,
  ValidatorConfig,
  DEFAULT_VALIDATOR_CONFIG,
} from "./validator";

// Providers
export { pexelsProvider } from "./providers/pexels";
export { pixabayProvider } from "./providers/pixabay";
export { mixkitProvider } from "./providers/mixkit";
export { buildQuery, deduplicateResults, filterResults } from "./providers/base";

// Planning
export {
  buildTranscriptSegments,
  planVisualSegments,
  computeStats,
} from "./planner";

// Downloading
export { downloadBrollAssets } from "./downloader";

// Validation
export {
  validateAsset,
  validateAllAssets,
  allValid,
} from "./validator";

// Manifest generation
export {
  generateRemotionManifest,
  generatePhraseAlignedManifest,
  generateMetadata,
  generateReport,
  writeManifestFiles,
} from "./manifest-generator";

// Schemas
export {
  validateTranscript,
  validatePlan,
} from "./schemas";
export type {
  TranscriptData,
  ValidationIssue,
} from "./schemas";

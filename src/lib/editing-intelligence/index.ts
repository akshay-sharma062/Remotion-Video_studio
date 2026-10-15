/**
 * editing-intelligence/index.ts — top-level exports for the editing intelligence system.
 *
 * This module provides:
 * 1. Analysis (blueprint generation, reference analysis, raw analysis)
 * 2. SFX (registry, generation, decisions, mixing)
 * 3. Motion (primitives, decisions)
 * 4. Captions (decisions)
 * 5. Audio (mixing)
 * 6. Quality (verification)
 * 7. The EditDecisionEngine (orchestrator)
 *
 * Usage:
 *   import { EditDecisionEngine, SFX_REGISTRY, SlamText, QualityChecker } from "./editing-intelligence";
 */

// Analysis layer
export {
  analyzeRaw,
  DEFAULT_RAW_CONFIG,
} from "./analysis/raw-analyzer";
export type { RawAnalysis, RawAnalysisConfig, TextRegion, FaceRegion, SafeZones } from "./analysis/raw-analyzer";

export {
  analyzeReference,
  DEFAULT_REFERENCE_CONFIG,
} from "./analysis/reference-analyzer";
export type {
  ReferenceAnalysis,
  ReferencePattern,
  PatternEffect,
} from "./analysis/reference-analyzer";

export {
  generateEditBlueprint,
} from "./analysis/edit-blueprint";
export type { EditBlueprint, TimestampedEvent, TranscriptWord } from "./analysis/edit-blueprint";

// SFX layer
export {
  SFX_REGISTRY,
  getSfxAsset,
  getSfxByCategory,
  getSfxByIntensity,
  getSfxForUse,
  findBestSfx,
  validateSfxReferences,
  SFX_GENERATORS,
  generateSfx,
  mixIntoTrack,
  decideSfxForEvent,
  decideAllSfx,
  generateSfxCues,
  getReferencedSfxIds,
  DEFAULT_SFX_CONFIG,
  SfxMixer,
  DEFAULT_MIX_CONFIG,
  dbToGain,
  gainToDb,
  calculateDuckGain,
} from "./sfx";
export type {
  SfxAsset,
  SfxCategory,
  SfxDecision,
  SfxDecisionConfig,
  AudioBuffer,
  MixConfig,
  MixResult,
} from "./sfx";

// Motion layer
export {
  SlamText,
  SlideIn,
  FadeInOut,
  ZoomPunch,
  BlurResolve,
  WordReveal,
  Emphasize,
  ScaleBounce,
  SlideSwap,
  decideMotionForEvent,
  decideAllMotions,
  getMotionDecisionsByCategory,
  DEFAULT_MOTION_CONFIG,
} from "./motion";
export type {
  SlamTextProps,
  SlideInProps,
  FadeInOutProps,
  ZoomPunchProps,
  BlurResolveProps,
  WordRevealProps,
  EmphasizeProps,
  ScaleBounceProps,
  SlideSwapProps,
  PrimitiveBaseProps,
  MotionDecision,
  MotionDecisionConfig,
} from "./motion";

// Caption layer
export {
  decideCaptionAtTime,
  decideAllCaptions,
  DEFAULT_CAPTION_CONFIG,
} from "./captions";
export type { CaptionDecision, CaptionDecisionConfig } from "./captions";

// Audio layer
export {
  AudioMixer,
  DEFAULT_AUDIO_MIX_CONFIG,
  dbToGain,
  gainToDb,
  calculateDuckGain,
} from "./audio";
export type { AudioMixConfig, AudioMixResult } from "./audio";

// Quality layer
export {
  QualityChecker,
} from "./quality";
export type {
  QualityCheckResult,
  QualityCheckFailure,
  QualityCheckConfig,
  TextBoundingBox,
} from "./quality";

// Engine (orchestrator)
export { EditDecisionEngine, DEFAULT_EDIT_DECISION_CONFIG } from "./edit-decision-engine";
export type { RenderDecision, EditDecisionConfig } from "./edit-decision-engine";

// ─── NEW: Premium headline SFX selection ─────────────────────────────────────

export {
  selectHeadlineSfx,
  contextFromEvent,
  HEADLINE_RULES,
} from "./headline-sfx-selector";
export type {
  HeadlineSfxContext,
  HeadlineSfxDecision,
  HeadlineType,
  EntranceAnimation,
  TransitionType,
} from "./headline-sfx-selector";

// ─── NEW: B-roll recommendation engine ───────────────────────────────────────

export {
  recommendBroll,
  extractEntities,
  scanLocalAssets,
  DEFAULT_BROLL_CONFIG,
} from "./broll-recommender";
export type {
  BrollAsset,
  BrollRecommendation,
  BrollRecommendationConfig,
  BrollRecommendationResult,
  ExtractedEntity,
  BrollCategory,
  AssetProvenance,
  AssetSource,
  AssetLicense,
  AssetKind,
  LocalAssetScan,
} from "./broll-recommender";

// ─── NEW: Asset registry and provenance ──────────────────────────────────────

export {
  createAudioRegistry,
  createVisualRegistry,
  addAudioAsset,
  addVisualAsset,
  searchAudioRegistry,
  searchVisualRegistry,
  getAudioById,
  getVisualById,
  validateAssetReferences,
  provenanceFromGenerated,
  provenanceFromMixkit,
  provenanceFromPexels,
  provenanceFromLocal,
} from "./asset-registry";
export type {
  AudioRegistry,
  VisualRegistry,
  AudioAssetEntry,
  VisualAssetEntry,
  SearchOptions,
  SearchResult,
} from "./asset-registry";

// ─── NEW: Blueprint-to-edit integration ──────────────────────────────────────

export {
  integrateBlueprintWithRecommendations,
  approveRecommendation,
  rejectRecommendation,
  getApprovedRecommendations,
  sourceBrollAsset,
  generateRecommendationReport,
  DEFAULT_INTEGRATION_CONFIG,
} from "./blueprint-integration";
export type {
  TimelineRecommendation,
  BlueprintIntegrationResult,
  BlueprintIntegrationConfig,
  ApprovalStatus,
  RecommendationKind,
} from "./blueprint-integration";

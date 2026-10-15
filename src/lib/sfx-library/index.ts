/**
 * sfx-library/index.ts — SFX Library barrel export.
 *
 * This is the complete, production-grade SFX Library for the Creator Editing OS.
 *
 * 14 categories × ~3 assets each = 44 assets total.
 * Every asset has:
 *   - Generative synthesis (no files required)
 *   - Provenance tracking
 *   - Licensing information
 *   - Search/selection intelligence
 *   - Decision engine integration
 *   - Mixer integration
 *   - Audition tools
 *   - Audit/health tools
 *
 * Usage:
 *   import { SFX_LIBRARY, searchLibrary, selectSfxForEvent } from "@/lib/sfx-library";
 */

// Types
export {
  type SfxAsset,
  type SfxProvenance,
  type SfxCategory,
  type SfxSource,
  type SfxLicense,
  type VisualEventType,
  type SfxSearchQuery,
  type SfxTonalFilter,
  type SfxSearchResult,
  type SfxSelectionDecision,
  type SfxAuditResult,
  type SfxDuplicatePair,
  type SfxAuditionRequest,
  type SfxAuditionResult,
  type SfxManifest,
  type SfxManifestEntry,
  type SfxDecisionConfig,
  type SfxLibraryDecision,
  type TimedSfxEvent,
  type LibraryMixConfig,
  type MixConfig,
  type MixResult,
  SFX_LIBRARY_VERSION,
  SFX_LIBRARY_ROOT,
  SFX_DEFAULT_SAMPLE_RATE,
  SFX_DEFAULT_DUCK_DB,
  SFX_DEFAULT_FADE_IN_MS,
  SFX_DEFAULT_FADE_OUT_MS,
  SFX_DEFAULT_HIGH_PASS_HZ,
} from "./types";

// Registry
export {
  SFX_LIBRARY,
  CATEGORY_META,
} from "./registry";

// Generators
export {
  generateWhooshSoft,
  generateWhooshRising,
  generateImpactSoft,
  generateImpactPremium,
  generateUiTap,
  generateUiNotification,
  generateHighlightMarker,
  generateHighlightUnderline,
  generateRiserSubtle,
  generateRiserBright,
  generateRiserTension,
  generateRiserClick,
  generateDataCount,
  generateDataReveal,
  generateDataWhoosh,
  generateDataEmphasis,
  generateTransitionSoft,
  generateTransitionPunch,
  generateTransitionCut,
  generateRevealDiagram,
  generateRevealStep,
  generateRevealMagnifier,
  generateCtaSuccess,
  generateCtaLogo,
  generateCtaAttention,
  generateCinematicRise,
  generateCinematicEmote,
  generateCinematicDrift,
  generateCinematicSting,
  generateReverseWhoosh,
  generateReverseSwoosh,
  generateReverseTail,
  generateAccentPlayful,
  generateAccentRise,
  generateAccentChime,
  generateNotificationSoft,
  generateNotificationConfirm,
  generateNotificationDing,
  generateNotificationSubtle,
  SFX_LIBRARY_GENERATORS,
  generateLibrarySfx,
} from "./generators";

// Decision engine
export {
  DEFAULT_LIBRARY_SFX_CONFIG,
  EVENT_CATEGORY_MAP,
  EVENT_INTENSITY_MAP,
  searchLibrary,
  selectSfxForEvent,
  selectSfxForEvents,
  decideLibrarySfx,
} from "./decision";

// Mixer
export {
  SfxLibraryMixer,
  DEFAULT_LIBRARY_MIX_CONFIG,
} from "./mixer";

// Audit
export {
  auditLibrary,
  verifyGenerators,
  categoryCoverage,
  printAuditReport,
} from "./audit";

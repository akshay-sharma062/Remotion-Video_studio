/**
 * sfx/index.ts — SFX editing intelligence module.
 *
 * Public API for the SFX subsystem.
 *
 * Usage:
 *   import { SfxMixer, decideAllSfx, generateSfxCues, SFX_REGISTRY } from "../editing-intelligence/sfx";
 */

export { SFX_REGISTRY, getSfxAsset, getSfxByCategory, getSfxByIntensity, getSfxForUse, findBestSfx, validateSfxReferences, type SfxAsset, type SfxCategory } from "./sfx-registry";
export { SFX_GENERATORS, generateSfx, mixIntoTrack, type AudioBuffer } from "./sfx-generators";
export { decideSfxForEvent, decideAllSfx, generateSfxCues, getReferencedSfxIds, DEFAULT_SFX_CONFIG, type SfxDecision, type SfxDecisionConfig } from "./sfx-decision";
export { SfxMixer, DEFAULT_MIX_CONFIG, type MixConfig, type MixResult } from "./sfx-mixer";

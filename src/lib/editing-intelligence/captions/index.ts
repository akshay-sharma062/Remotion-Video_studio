/**
 * captions/index.ts — Caption decision engine.
 *
 * Public API for the caption subsystem.
 *
 * Usage:
 *   import { decideCaptionAtTime, DEFAULT_CAPTION_CONFIG } from "../editing-intelligence/captions";
 */

export {
  decideCaptionAtTime,
  decideAllCaptions,
  DEFAULT_CAPTION_CONFIG,
} from "./caption-decision";
export type { CaptionDecision, CaptionDecisionConfig } from "./caption-decision";

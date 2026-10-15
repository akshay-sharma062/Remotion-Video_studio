/**
 * quality/index.ts — Automated quality verification.
 *
 * Public API for the quality subsystem.
 *
 * Usage:
 *   import { QualityChecker, type QualityCheckResult } from "../editing-intelligence/quality";
 */

export { QualityChecker } from "./quality-checker";
export type {
  QualityCheckResult,
  QualityCheckFailure,
  QualityCheckConfig,
  TextBoundingBox,
} from "./quality-checker";

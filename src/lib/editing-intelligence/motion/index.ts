/**
 * motion/index.ts — Motion primitives and decision engine.
 *
 * Public API for the motion subsystem.
 *
 * Usage:
 *   import { SlamText, SlideIn, decideMotionForEvent } from "../editing-intelligence/motion";
 */

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
} from "./motion-primitives";
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
} from "./motion-primitives";

export {
  decideMotionForEvent,
  decideAllMotions,
  getMotionDecisionsByCategory,
  DEFAULT_MOTION_CONFIG,
} from "./motion-decision";
export type { MotionDecision, MotionDecisionConfig } from "./motion-decision";

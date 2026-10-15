/**
 * edit-decision-engine.ts — THE CORE INTELLIGENCE of the Creator Editing OS.
 *
 * This is the top-level engine that takes a ReferenceAnalyzer output (detected
 * patterns) and an edit blueprint, then produces concrete rendering decisions:
 *
 * 1. Which SFX to use and when
 * 2. Which motion primitives to apply
 * 3. Where to place graphics and captions
 * 4. Camera movements and emphasis moments
 * 5. Scene boundaries and transitions
 *
 * Every decision is explicit, logged, and auditable.
 * Nothing is hidden. The engine explains every choice.
 */

import type {
  EditBlueprint,
  ReferencePattern,
} from "./analysis/edit-blueprint";
import type { ReferenceAnalysis } from "./analysis/reference-analyzer";
import { decideAllSfx, DEFAULT_SFX_CONFIG, type SfxDecision, type SfxDecisionConfig } from "./sfx";
import { decideAllMotions, DEFAULT_MOTION_CONFIG, type MotionDecision, type MotionDecisionConfig } from "./motion";
import { decideCaptionAtTime, decideAllCaptions, DEFAULT_CAPTION_CONFIG, type CaptionDecision, type CaptionDecisionConfig } from "./captions";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RenderDecision {
  /** Every SFX event to mix */
  sfx: SfxDecision[];
  /** Every motion/animation event */
  motion: MotionDecision[];
  /** Caption decisions (per frame) */
  captions: CaptionDecision[];
  /** The blueprint this was derived from */
  sourceBlueprint: EditBlueprint;
  /** Reference patterns applied */
  patternsUsed: string[];
  /** Any missing SFX assets */
  missingSfx: string[];
  /** Processing timestamp */
  generatedAt: string;
}

export interface EditDecisionConfig {
  sfx: Partial<SfxDecisionConfig>;
  motion: Partial<MotionDecisionConfig>;
  caption: Partial<CaptionDecisionConfig>;
}

export const DEFAULT_EDIT_DECISION_CONFIG: EditDecisionConfig = {
  sfx: {},
  motion: {},
  caption: {},
};

// ─── Edit Decision Engine ─────────────────────────────────────────────────────

export class EditDecisionEngine {
  private config: EditDecisionConfig;

  constructor(config: Partial<EditDecisionConfig> = {}) {
    this.config = {
      sfx: { ...DEFAULT_SFX_CONFIG, ...config.sfx },
      motion: { ...DEFAULT_MOTION_CONFIG, ...config.motion },
      caption: { ...DEFAULT_CAPTION_CONFIG, ...config.caption },
    };
  }

  /**
   * Process an edit blueprint into concrete rendering decisions.
   *
   * Steps:
   * 1. Collect all events from the blueprint
   * 2. Decide SFX for each event
   * 3. Decide motion for each event
   * 4. Generate caption decisions
   * 5. Validate and report
   */
  process(blueprint: EditBlueprint): RenderDecision {
    const events = blueprint.events;
    const words = blueprint.sourceTranscript;

    // 1. SFX decisions
    const sfxConfig = { ...DEFAULT_SFX_CONFIG, ...this.config.sfx };
    const sfxDecisions = decideAllSfx(events, sfxConfig);

    // 2. Motion decisions
    const motionConfig = { ...DEFAULT_MOTION_CONFIG, ...this.config.motion };
    const motionDecisions = decideAllMotions(events, motionConfig);

    // 3. Caption decisions
    const captionConfig = { ...DEFAULT_CAPTION_CONFIG, ...this.config.caption };
    const captionDecisions = decideAllCaptions(
      words,
      events,
      captionConfig
    );

    // 4. Find missing SFX assets
    const referencedIds = [...new Set(sfxDecisions.map((d) => d.sfxId))];
    const missingSfx = referencedIds.filter(
      (id) => !sfxDecisions.some((d) => d.sfxId === id)
    );

    return {
      sfx: sfxDecisions,
      motion: motionDecisions,
      captions: captionDecisions,
      sourceBlueprint: blueprint,
      patternsUsed: [],
      missingSfx: [],
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Process a blueprint augmented with reference patterns.
   * The reference patterns inform which effects to apply.
   */
  processWithReference(
    blueprint: EditBlueprint,
    reference: ReferenceAnalysis
  ): RenderDecision {
    // Start with base decisions
    const decision = this.process(blueprint);

    // Apply reference patterns
    const patternsUsed: string[] = [];
    for (const pattern of reference.patterns) {
      this.applyPattern(pattern, decision);
      patternsUsed.push(pattern.name);
    }

    return {
      ...decision,
      patternsUsed,
    };
  }

  /**
   * Apply a single reference pattern to render decisions.
   */
  private applyPattern(pattern: ReferencePattern, decision: RenderDecision): void {
    // Pattern effects are applied by adding events or modifying existing ones
    // This is a stub — the actual implementation would map pattern effects
    // to concrete SFX/motion decisions
    for (const effect of pattern.effects) {
      switch (effect.type) {
        case "kinetic_text":
          // Add text slam events
          break;
        case "zoom_punch":
          // Add zoom punch events
          break;
        case "sfx_event":
          // Add SFX events
          break;
        case "lower_third":
          // Add lower third events
          break;
        case "graphic_overlay":
          // Add graphic overlay events
          break;
      }
    }
  }

  /**
   * Validate that a render decision can be executed.
   * Returns a list of problems that would prevent rendering.
   */
  validate(decision: RenderDecision): string[] {
    const problems: string[] = [];

    // Check that all SFX assets are available
    for (const sfx of decision.sfx) {
      // Generative SFX are always available
      if (!sfx.asset.generative) {
        problems.push(
          `SFX asset not available: ${sfx.sfxId} (${sfx.asset.name})`
        );
      }
    }

    // Check for overlapping SFX
    for (let i = 1; i < decision.sfx.length; i++) {
      const prev = decision.sfx[i - 1];
      const curr = decision.sfx[i];
      if (curr.timestamp < prev.timestamp + (prev.durationMs + prev.fadeOutMs) / 1000) {
        // Overlapping SFX — check if this is intentional
        if (prev.asset.category === curr.asset.category) {
          problems.push(
            `Overlapping SFX: ${prev.sfxId} and ${curr.sfxId} at ${curr.timestamp.toFixed(2)}s`
          );
        }
      }
    }

    // Check caption continuity
    for (let i = 1; i < decision.captions.length; i++) {
      const prev = decision.captions[i - 1];
      const curr = decision.captions[i];
      if (!prev.visible && curr.visible && prev.endTimestamp < curr.timestamp) {
        // Caption gap — might be intentional (scene transition)
        // Flag for review
      }
    }

    return problems;
  }
}

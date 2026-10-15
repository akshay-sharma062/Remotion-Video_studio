/**
 * blueprint-integration.ts — connects sound and B-roll recommendations
 * to the existing video blueprint/timeline workflow.
 *
 * Every recommendation includes:
 *   - Timeline timestamp
 *   - Triggering word/phrase/headline/visual event
 *   - Recommended SFX or B-roll asset
 *   - Reason for the selection
 *   - Duration and placement
 *   - Volume/fade guidance (audio) or motion guidance (visual)
 *   - Confidence level and approval status
 *
 * Recommendations are reviewable before application.
 * No unverified assets are automatically inserted into locked productions.
 */

import type {
  EditBlueprint,
  TimestampedEvent,
  SfxDecision,
} from "./analysis/edit-blueprint";
import type { HeadlineSfxDecision, HeadlineSfxContext } from "./headline-sfx-selector";
import { selectHeadlineSfx, contextFromEvent } from "./headline-sfx-selector";
import type {
  BrollRecommendation,
  BrollRecommendationResult,
  BrollRecommendationConfig,
} from "./broll-recommender";
import { recommendBroll, extractEntities, DEFAULT_BROLL_CONFIG } from "./broll-recommender";
import type { EditDecisionConfig } from "./edit-decision-engine";

// ─── Recommendation Record ────────────────────────────────────────────────────

export type RecommendationKind = "sfx" | "broll" | "motion" | "caption";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "needs-asset";

export interface TimelineRecommendation {
  /** Unique ID */
  id: string;
  /** Kind of recommendation */
  kind: RecommendationKind;
  /** Timeline timestamp (seconds) */
  timestamp: number;
  /** What triggered this recommendation */
  trigger: {
    type: "word" | "phrase" | "headline" | "visual_event" | "scene_boundary";
    text: string;
    eventIndex?: number;
  };
  /** For SFX: the decision. For B-roll: the recommendation. */
  recommendation: HeadlineSfxDecision | BrollRecommendation;
  /** Where in the timeline this applies */
  placement: {
    startSec: number;
    durationSec: number;
    /** SFX: lead before event. B-roll: position on screen */
    leadMs?: number;
    tailMs?: number;
    /** Volume guidance (SFX only) */
    volume?: number;
    /** Fade in (ms) */
    fadeInMs?: number;
    /** Fade out (ms) */
    fadeOutMs?: number;
    /** Duck dB under voice */
    duckDb?: number;
    /** Visual position (B-roll only) */
    position?: "full" | "picture-in-picture" | "split" | "background";
    /** Motion for stills */
    stillMotion?: string;
  };
  /** Confidence 0-1 */
  confidence: number;
  /** Approval status */
  status: ApprovalStatus;
  /** Human-readable reason */
  reason: string;
  /** If rejected, the reason */
  rejectionReason?: string;
}

// ─── Integration Config ───────────────────────────────────────────────────────

export interface BlueprintIntegrationConfig {
  /** Enable SFX recommendations */
  enableSfx: boolean;
  /** Enable B-roll recommendations */
  enableBroll: boolean;
  /** Minimum confidence to include in output */
  minConfidence: number;
  /** Maximum SFX events per scene */
  maxSfxPerScene: number;
  /** Minimum gap between B-roll inserts (seconds) */
  minBrollGapSec: number;
  /** Maximum B-roll duration per insert (seconds) */
  maxBrollDurationSec: number;
  /** Project name for local asset resolution */
  projectName: string;
  /** Auto-approve above this confidence */
  autoApproveThreshold: number;
}

export const DEFAULT_INTEGRATION_CONFIG: BlueprintIntegrationConfig = {
  enableSfx: true,
  enableBroll: true,
  minConfidence: 0.4,
  maxSfxPerScene: 5,
  minBrollGapSec: 3,
  maxBrollDurationSec: 5,
  projectName: "",
  autoApproveThreshold: 0.8,
};

// ─── Integration Result ───────────────────────────────────────────────────────

export interface BlueprintIntegrationResult {
  /** All recommendations, sorted by timestamp */
  recommendations: TimelineRecommendation[];
  /** SFX-specific recommendations */
  sfxRecommendations: TimelineRecommendation[];
  /** B-roll-specific recommendations */
  brollRecommendations: TimelineRecommendation[];
  /** Summary statistics */
  stats: {
    totalRecommendations: number;
    sfxCount: number;
    brollCount: number;
    autoApproved: number;
    pendingReview: number;
    needsAsset: number;
    rejected: number;
    averageConfidence: number;
  };
  /** The source blueprint */
  blueprint: EditBlueprint;
  /** When this was generated */
  generatedAt: string;
}

// ─── Integration Engine ───────────────────────────────────────────────────────

/**
 * Process an edit blueprint and produce timeline recommendations.
 *
 * This is the bridge between the analysis layer and the review layer.
 * It does NOT automatically insert anything — it produces reviewable recommendations.
 */
export function integrateBlueprintWithRecommendations(
  blueprint: EditBlueprint,
  config: Partial<BlueprintIntegrationConfig> = {}
): BlueprintIntegrationResult {
  const cfg = { ...DEFAULT_INTEGRATION_CONFIG, ...config };
  const recommendations: TimelineRecommendation[] = [];
  let recId = 0;

  const events = blueprint.events;
  const totalScenes = countScenes(events);

  // ── SFX Recommendations ──────────────────────────────────────────────────────

  if (cfg.enableSfx) {
    const sfxPerScene = new Map<number, number>();

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const sceneIndex = getSceneIndex(event, events);

      // Enforce max SFX per scene
      const sceneSfxCount = sfxPerScene.get(sceneIndex) ?? 0;
      if (sceneSfxCount >= cfg.maxSfxPerScene) continue;

      // Skip events that shouldn't have SFX
      if (event.duration < 50 && event.category !== "caption") continue;

      // Determine headline context
      const isHeadlineEvent = event.category === "caption" || event.category === "highlight";
      const isOpening = i === 0 || sceneIndex === 0;
      const isEnding = sceneIndex === totalScenes - 1;

      let decision: HeadlineSfxDecision;

      if (isHeadlineEvent) {
        const ctx: HeadlineSfxContext = {
          headlineType: classifyHeadlineType(event),
          entrance: (event.params as Record<string, unknown>)?.entrance as
            | "slam"
            | "reveal"
            | "fade"
            | "slide"
            | "stagger"
            | "punch" || "slam",
          entranceDurationMs: (event.params as Record<string, unknown>)
            ?.entranceDurationMs as number || event.duration || 400,
          transition: (event.params as Record<string, unknown>)?.transition as
            | "none"
            | "fade"
            | "wipe_left"
            | "wipe_right"
            | "zoom_through"
            | "dissolve" || "none",
          visualIntensity: (event.params as Record<string, unknown>)
            ?.visualIntensity as number || 3,
          sceneIndex,
          totalScenes,
          isOpening,
          isEnding,
          timeSinceLastSfxMs: 0,
          voiceActive: true,
        };

        // Calculate time since last SFX
        if (recommendations.length > 0) {
          const lastRec = recommendations[recommendations.length - 1];
          ctx.timeSinceLastSfxMs =
            (event.timestamp - lastRec.timestamp) * 1000;
        }

        decision = selectHeadlineSfx(ctx);
      } else {
        // Non-headline event — use a default approach
        decision = {
          asset: null,
          confidence: 0.3,
          reason: "Non-headline event — no headline SFX selected",
          alternatives: [],
          isSilence: true,
          leadMs: 0,
          tailMs: 0,
          volume: 1,
        };
      }

      if (decision.confidence < cfg.minConfidence) continue;

      const status: ApprovalStatus =
        decision.isSilence
          ? "approved"
          : decision.confidence >= cfg.autoApproveThreshold
            ? "approved"
            : "pending";

      if (status === "approved") {
        sfxPerScene.set(sceneIndex, sceneSfxCount + 1);
      }

      const rec: TimelineRecommendation = {
        id: `sfx-${++recId}`,
        kind: "sfx",
        timestamp: Math.max(0, event.timestamp - (decision.leadMs || 0) / 1000),
        trigger: {
          type: isHeadlineEvent ? "headline" : "visual_event",
          text: event.label,
          eventIndex: i,
        },
        recommendation: decision,
        placement: {
          startSec: Math.max(0, event.timestamp - (decision.leadMs || 0) / 1000),
          durationSec: (decision.leadMs || 133 + 267) / 1000,
          leadMs: decision.leadMs || 133,
          tailMs: 267,
          volume: decision.volume,
          fadeInMs: decision.asset?.fadeInMs ?? 10,
          fadeOutMs: decision.asset?.fadeOutMs ?? 267,
          duckDb: decision.asset?.duckDb ?? 6,
        },
        confidence: decision.confidence,
        status,
        reason: decision.reason,
      };

      recommendations.push(rec);
    }
  }

  // ── B-roll Recommendations ───────────────────────────────────────────────────

  if (cfg.enableBroll && blueprint.sourceTranscript) {
    const words = blueprint.sourceTranscript.map((w) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    }));

    const scenes = events
      .filter((e) => e.category === "transition" || e.category === "caption")
      .map((e) => ({
        from: e.timestamp,
        to: e.timestamp + e.duration / 1000,
        name: e.label,
      }));

    const brollResult = recommendBroll(words, scenes, {
      ...cfg,
      projectName: cfg.projectName,
    });

    for (const brollRec of brollResult.recommendations) {
      const rec: TimelineRecommendation = {
        id: `broll-${++recId}`,
        kind: "broll",
        timestamp: brollRec.placementStart,
        trigger: {
          type: "phrase",
          text: brollRec.triggerPhrase,
        },
        recommendation: brollRec,
        placement: {
          startSec: brollRec.placementStart,
          durationSec: brollRec.durationSec,
          position: brollRec.position,
          stillMotion: brollRec.stillMotion,
        },
        confidence: brollRec.confidence,
        status: brollRec.status as ApprovalStatus,
        reason: brollRec.reason,
      };

      recommendations.push(rec);
    }
  }

  // ── Sort and deduplicate ────────────────────────────────────────────────────

  recommendations.sort((a, b) => a.timestamp - b.timestamp);

  // Deduplicate overlapping recommendations
  const deduped: TimelineRecommendation[] = [];
  for (const rec of recommendations) {
    const overlaps = deduped.some((existing) => {
      const existingEnd = existing.timestamp + (existing.placement.durationSec ?? 0);
      const recEnd = rec.timestamp + (rec.placement.durationSec ?? 0);
      return (
        (rec.timestamp >= existing.timestamp && rec.timestamp < existingEnd) ||
        (recEnd > existing.timestamp && recEnd <= existingEnd)
      );
    });

    if (!overlaps) {
      deduped.push(rec);
    }
  }

  // ── Compute stats ───────────────────────────────────────────────────────────

  const sfxRecs = deduped.filter((r) => r.kind === "sfx");
  const brollRecs = deduped.filter((r) => r.kind === "broll");

  const stats = {
    totalRecommendations: deduped.length,
    sfxCount: sfxRecs.length,
    brollCount: brollRecs.length,
    autoApproved: deduped.filter((r) => r.status === "approved").length,
    pendingReview: deduped.filter((r) => r.status === "pending").length,
    needsAsset: deduped.filter((r) => r.status === "needs-asset").length,
    rejected: deduped.filter((r) => r.status === "rejected").length,
    averageConfidence:
      deduped.length > 0
        ? deduped.reduce((sum, r) => sum + r.confidence, 0) / deduped.length
        : 0,
  };

  return {
    recommendations: deduped,
    sfxRecommendations: sfxRecs,
    brollRecommendations: brollRecs,
    stats,
    blueprint,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Approval Workflow ────────────────────────────────────────────────────────

/**
 * Approve a recommendation by ID.
 */
export function approveRecommendation(
  result: BlueprintIntegrationResult,
  recId: string
): BlueprintIntegrationResult {
  const rec = result.recommendations.find((r) => r.id === recId);
  if (!rec) return result;

  return {
    ...result,
    recommendations: result.recommendations.map((r) =>
      r.id === recId ? { ...r, status: "approved" as ApprovalStatus } : r
    ),
  };
}

/**
 * Reject a recommendation by ID with a reason.
 */
export function rejectRecommendation(
  result: BlueprintIntegrationResult,
  recId: string,
  reason: string
): BlueprintIntegrationResult {
  return {
    ...result,
    recommendations: result.recommendations.map((r) =>
      r.id === recId
        ? { ...r, status: "rejected" as ApprovalStatus, rejectionReason: reason }
        : r
    ),
  };
}

/**
 * Get all approved recommendations ready for rendering.
 */
export function getApprovedRecommendations(
  result: BlueprintIntegrationResult
): TimelineRecommendation[] {
  return result.recommendations.filter((r) => r.status === "approved");
}

/**
 * Mark a B-roll recommendation as sourced with a real asset path.
 */
export function sourceBrollAsset(
  result: BlueprintIntegrationResult,
  recId: string,
  assetPath: string
): BlueprintIntegrationResult {
  return {
    ...result,
    recommendations: result.recommendations.map((r) => {
      if (r.id !== recId || r.kind !== "broll") return r;
      const broll = r.recommendation as BrollRecommendation;
      return {
        ...r,
        recommendation: {
          ...broll,
          asset: broll.asset
            ? { ...broll.asset, assetPath }
            : null,
          status: "pending" as ApprovalStatus,
          confidence: 0.9,
        },
        status: "pending" as ApprovalStatus,
      };
    }),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyHeadlineType(event: TimestampedEvent): HeadlineSfxContext["headlineType"] {
  const params = event.params as Record<string, unknown>;
  if (params.headlineType) return params.headlineType as HeadlineSfxContext["headlineType"];

  const label = event.label.toLowerCase();
  if (label.includes("cta") || label.includes("action") || label.includes("register")) {
    return "cta";
  }
  if (/^\d+[\s\w]*$/.test(event.label)) {
    return "number";
  }
  if (event.category === "highlight") {
    return "keyword";
  }
  return "headline";
}

function getSceneIndex(event: TimestampedEvent, events: TimestampedEvent[]): number {
  let sceneIdx = 0;
  for (const e of events) {
    if (e === event) break;
    if (e.category === "transition" || (e.category === "caption" && e.kind === "show")) {
      sceneIdx++;
    }
  }
  return Math.max(0, sceneIdx);
}

function countScenes(events: TimestampedEvent[]): number {
  let count = 0;
  for (const e of events) {
    if (e.category === "transition" || (e.category === "caption" && e.kind === "show")) {
      count++;
    }
  }
  return Math.max(1, count);
}

/**
 * Generate a human-readable report of all recommendations.
 */
export function generateRecommendationReport(
  result: BlueprintIntegrationResult
): string {
  const lines: string[] = [];

  lines.push("=".repeat(70));
  lines.push("TIMELINE RECOMMENDATIONS REPORT");
  lines.push("=".repeat(70));
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push(`Blueprint duration: ${result.blueprint.duration.toFixed(2)}s`);
  lines.push("");

  lines.push("STATISTICS");
  lines.push("-".repeat(40));
  lines.push(`  Total recommendations:   ${result.stats.totalRecommendations}`);
  lines.push(`  SFX recommendations:     ${result.stats.sfxCount}`);
  lines.push(`  B-roll recommendations:  ${result.stats.brollCount}`);
  lines.push(`  Auto-approved:          ${result.stats.autoApproved}`);
  lines.push(`  Pending review:         ${result.stats.pendingReview}`);
  lines.push(`  Needs asset sourcing:   ${result.stats.needsAsset}`);
  lines.push(`  Rejected:               ${result.stats.rejected}`);
  lines.push(`  Average confidence:     ${(result.stats.averageConfidence * 100).toFixed(0)}%`);
  lines.push("");

  lines.push("RECOMMENDATIONS");
  lines.push("-".repeat(70));

  for (const rec of result.recommendations) {
    const statusIcon =
      rec.status === "approved" ? "✓"
      : rec.status === "pending" ? "?"
      : rec.status === "needs-asset" ? "!"
      : "✗";

    lines.push(`\n[${statusIcon}] ${rec.kind.toUpperCase()} @ ${formatTime(rec.timestamp)}`);
    lines.push(`  Trigger:  ${rec.trigger.text}`);
    lines.push(`  Confidence: ${(rec.confidence * 100).toFixed(0)}%`);
    lines.push(`  Status:   ${rec.status}`);
    lines.push(`  Reason:   ${rec.reason}`);

    if (rec.kind === "sfx") {
      const sfx = rec.recommendation as HeadlineSfxDecision;
      if (sfx.asset) {
        lines.push(`  SFX:      ${sfx.asset.name} (${sfx.asset.id})`);
        lines.push(`  Volume:   ${(rec.placement.volume ?? sfx.volume).toFixed(2)}`);
        lines.push(`  Lead:     ${rec.placement.leadMs}ms`);
      } else {
        lines.push(`  SFX:      (silence)`);
      }
    }

    if (rec.kind === "broll") {
      const broll = rec.recommendation as BrollRecommendation;
      if (broll.asset) {
        lines.push(`  Asset:    ${broll.asset.name} (${broll.asset.id})`);
        lines.push(`  Position: ${rec.placement.position}`);
      } else if (broll.searchQuery) {
        lines.push(`  Search:   "${broll.searchQuery}"`);
      }
      lines.push(`  Duration: ${rec.placement.durationSec.toFixed(1)}s`);
    }
  }

  lines.push("");
  lines.push("=".repeat(70));
  lines.push("END OF REPORT");
  lines.push("=".repeat(70));

  return lines.join("\n");
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(2);
  return `${m.toString().padStart(2, "0")}:${s.padStart(5, "0")}`;
}

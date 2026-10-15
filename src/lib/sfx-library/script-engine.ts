/**
 * script-engine.ts — Replaces inline SFX logic in Pipeline, Render, and Studio.
 *
 * Instead of hand-writing SFX instructions in each render (e.g., "a light whoosh
 * at the zoom punch, a medium impact at the slam"), we build a ScriptSceneList
 * from the blueprint → SFX decisions → MixConfig pipeline.
 *
 * The Studio reads the ScriptSceneList and generates its SFX-CUES.txt directly.
 * The Pipeline generates a WAV file from the same data so it can be muxed into
 * the final MP4.
 *
 * This is the single place where SFX logic lives. Nothing else reaches into it.
 */

import {
  SFX_LIBRARY,
  searchLibrary,
  selectSfxForEvent,
  type VisualEvent,
} from "./sfx-library";
import { SfxLibraryMixer, type MixConfig } from "./mixer";
import type {
  ScriptSceneList,
  ScriptScene,
  ScriptAction,
  SfxCue,
  SFX_CUES,
} from "./types";

// ─── Config ────────────────────────────────────────────────────────────────────

export interface ScriptEngineConfig {
  outputDir: string;
  peakDb?: number;        // Target peak level (default: -14 LUFS headroom = -6 dBFS)
  voiceDuckDb?: number;   // Duck SFX under voice by this many dB (default: 6)
}

const DEFAULT_CONFIG: ScriptEngineConfig = {
  outputDir: "work/sfx",
  peakDb: -6,
  voiceDuckDb: 6,
};

// ─── Event → SFX Mapping ───────────────────────────────────────────────────────

interface EventMapEntry {
  eventType: VisualEvent["type"];
  selector: (event: VisualEvent, asset: (typeof SFX_LIBRARY)[number]) => boolean;
  priority: number; // lower = preferred
}

const EVENT_MAP: EventMapEntry[] = [
  {
    eventType: "text_slam",
    selector: (e, a) => a.category === "impact" && a.intensity === e.intensity,
    priority: 1,
  },
  {
    eventType: "word_highlight",
    selector: (e, a) =>
      a.category === "highlight" && a.intensity === (e.intensity ?? "medium"),
    priority: 1,
  },
  {
    eventType: "word_entrance",
    selector: (e, a) =>
      (a.category === "whoosh" || a.category === "transition") && a.intensity === e.intensity,
    priority: 1,
  },
  {
    eventType: "word_exit",
    selector: (e, a) =>
      a.category === "whoosh" && a.tonal && e.intensity === "light",
    priority: 2,
  },
  {
    eventType: "number_reveal",
    selector: (e, a) =>
      a.category === "data" && a.tags.some((t) => t.includes("counter") || t.includes("tick")),
    priority: 1,
  },
  {
    eventType: "scene_transition",
    selector: (e, a) =>
      (a.category === "transition" || a.category === "riser") && e.intensity === e.intensity,
    priority: 1,
  },
  {
    eventType: "icon_appear",
    selector: (e, a) => a.category === "ui" && a.tonal,
    priority: 1,
  },
  {
    eventType: "cta_appear",
    selector: (e, a) => a.category === "ui" && a.intensity === "medium",
    priority: 1,
  },
  {
    eventType: "logo_reveal",
    selector: (e, a) => a.category === "riser" && a.intensity === "heavy",
    priority: 1,
  },
  {
    eventType: "zoom_punch",
    selector: (e, a) => a.category === "whoosh" && !a.tonal,
    priority: 1,
  },
  {
    eventType: "success_event",
    selector: (e, a) => a.category === "highlight" && a.tags.includes("success"),
    priority: 1,
  },
  {
    eventType: "checkmark",
    selector: (e, a) => a.category === "ui" && a.tags.some((t) => t.includes("confirm") || t.includes("check")),
    priority: 1,
  },
];

/**
 * Map a visual event to an SFX asset ID.
 * Falls back to the decision engine if no direct match is found.
 */
export function mapEventToSfx(event: VisualEvent): string | null {
  // Try direct event map first
  for (const entry of EVENT_MAP) {
    if (entry.eventType === event.type) {
      const matches = SFX_LIBRARY.filter((a) => entry.selector(event, a));
      if (matches.length > 0) {
        return matches[0].id;
      }
    }
  }

  // Fall back to decision engine
  const decision = selectSfxForEvent(event.type, event.intensity);
  return decision.asset?.id ?? null;
}

// ─── Script Scene List Builder ─────────────────────────────────────────────────

export interface BuildSceneListOptions {
  scenes: ScriptScene[];
  config?: Partial<ScriptEngineConfig>;
}

/**
 * Convert raw scene data into a ScriptSceneList with SFX decisions.
 *
 * Each scene can contain actions with SFX annotations:
 *
 *   {
 *     name: "SIGNIFICANTLY MORE",
 *     from: 0,
 *     to: 160,
 *     actions: [
 *       { type: "slam", frame: 88, sfx: "impact_heavy_01", intensity: "heavy" },
 *       { type: "word_highlight", frame: 95, sfx: "highlight_pop_01", intensity: "medium" },
 *     ]
 *   }
 *
 * If an action doesn't specify an `sfx` id, the engine picks one from the library.
 */
export function buildSceneList(options: BuildSceneListOptions): ScriptSceneList {
  const config = { ...DEFAULT_CONFIG, ...options.config };
  const sfxCues: SfxCue[] = [];

  const scenes: ScriptScene[] = options.scenes.map((scene) => {
    const actions: ScriptAction[] = (scene.actions ?? []).map((action) => {
      let sfxId: string | undefined;

      if (action.sfx) {
        // Author-specified SFX — verify it exists in the library
        sfxId = SFX_LIBRARY.some((a) => a.id === action.sfx)
          ? action.sfx
          : undefined;
      }

      if (!sfxId) {
        // Auto-select from library
        const visualEvent: VisualEvent = {
          type: action.type as VisualEvent["type"],
          intensity: action.intensity ?? "medium",
          atFrame: action.frame,
        };
        sfxId = mapEventToSfx(visualEvent) ?? undefined;
      }

      // Build SFX cue if we found one
      if (sfxId) {
        const asset = SFX_LIBRARY.find((a) => a.id === sfxId);
        if (asset) {
          const cue = buildCue(action, asset, config);
          sfxCues.push(cue);
        }
      }

      return { ...action, sfxId };
    });

    return { ...scene, actions };
  });

  return {
    version: "1.0.0",
    scenes,
    sfxCues,
    generatedAt: new Date().toISOString(),
  };
}

function buildCue(
  action: ScriptAction,
  asset: (typeof SFX_LIBRARY)[number],
  config: ScriptEngineConfig
): SfxCue {
  const midDuration = (asset.durationMs[0] + asset.durationMs[1]) / 2;
  const durationMs = midDuration;
  const startMs = (action.frame / 24) * 1000; // Assume 24fps for now — caller should override
  const endMs = startMs + durationMs;

  return {
    id: `${asset.id}_${action.frame}`,
    assetId: asset.id,
    assetName: asset.name,
    category: asset.category,
    frame: action.frame,
    startMs,
    endMs,
    durationMs,
    gain: asset.defaultGain,
    duckUnderVoice: true,
    duckAmountDb: config.voiceDuckDb ?? 6,
    notes: action.notes ?? "",
  };
}

// ─── WAV Generation ────────────────────────────────────────────────────────────

/**
 * Generate the SFX WAV file from a ScriptSceneList.
 *
 * Produces a single WAV with all SFX placed at their correct frame positions,
 * ready to be muxed into the final video.
 */
export async function generateSfxWav(
  script: ScriptSceneList,
  config: Partial<ScriptEngineConfig> = {}
): Promise<{ path: string; durationMs: number } | null> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (script.sfxCues.length === 0) {
    return null;
  }

  // Ensure output directory exists
  const { mkdirSync, existsSync } = await import("fs");
  if (!existsSync(cfg.outputDir)) {
    mkdirSync(cfg.outputDir, { recursive: true });
  }

  const outputPath = `${cfg.outputDir}/sfx.wav`;

  const mixConfig: MixConfig = {
    cues: script.sfxCues.map((cue) => ({
      assetId: cue.assetId,
      atFrame: cue.frame,
      durationMs: cue.durationMs,
      gain: cue.gain,
      duckUnderVoice: cue.duckUnderVoice,
      duckAmountDb: cue.duckAmountDb,
    })),
    peakDb: cfg.peakDb,
    fadeInMs: 0,
    fadeOutMs: 0,
  };

  const result = await SfxLibraryMixer.renderSfx(mixConfig);
  return { path: outputPath, durationMs: result.durationMs };
}

// ─── SFX-CUES.txt Generation ───────────────────────────────────────────────────

/**
 * Generate the SFX-CUES.txt file from a ScriptSceneList.
 *
 * This is what the user reads to understand every sound effect in the video.
 * Format: numbered list with frame, timecode, and asset name.
 */
export function generateSfxCuesTxt(script: ScriptSceneList): string {
  const lines: string[] = [];
  const header = `SFX CUES — ${script.scenes[0]?.name ?? "Untitled"}
Generated: ${script.generatedAt}
Total cues: ${script.sfxCues.length}
`;

  lines.push(header);
  lines.push("─".repeat(50));
  lines.push("");

  // Group cues by scene
  let cueIndex = 1;
  for (const scene of script.scenes) {
    lines.push(`[SCENE] ${scene.name}`);
    lines.push("");

    const sceneCues = script.sfxCues.filter(
      (c) => c.frame >= scene.from && c.frame <= scene.to
    );

    if (sceneCues.length === 0) {
      lines.push("  (no SFX)");
    } else {
      for (const cue of sceneCues) {
        const tc = frameToTimecode(cue.frame);
        lines.push(
          `  ${String(cueIndex).padStart(3)}. ${tc} — ${cue.assetName} (${cue.category})`
        );
        if (cue.notes) {
          lines.push(`       ${cue.notes}`);
        }
        cueIndex++;
      }
    }

    lines.push("");
  }

  lines.push("─".repeat(50));
  lines.push(`TOTAL: ${script.sfxCues.length} sound effects`);

  return lines.join("\n");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function frameToTimecode(frame: number, fps = 24): string {
  const totalSeconds = frame / fps;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const frames = Math.floor(frame % fps);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

// ─── Re-export ─────────────────────────────────────────────────────────────────

export { buildCue };

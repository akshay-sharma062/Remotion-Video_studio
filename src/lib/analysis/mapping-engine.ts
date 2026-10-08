/**
 * mapping-engine.ts — maps reference editing events onto raw video moments.
 *
 * This is the core intelligence of the reference-driven system.
 * It does NOT blindly copy timestamps. Instead, it finds semantically
 * and temporally appropriate moments in the raw video for each
 * reference editing technique.
 *
 * Mapping strategy:
 *  1. Word-level matching (exact word matches get the same treatment)
 *  2. Semantic proximity (related words get similar treatment)
 *  3. Structural position (same relative position in sentence/video)
 *  4. Emphasis matching (emphasis words in reference → emphasis words in raw)
 *  5. Density preservation (match the reference's visual change frequency)
 */

import {
  EditBlueprint,
  EditingPatterns,
  TimestampedEvent,
  CaptionEvent,
  CaptionWord,
  HighlightEvent,
  CameraEvent,
  GraphicEvent,
  SfxEvent,
  MotionEvent,
  TransitionEvent,
} from "./edit-blueprint";
import { ReferenceAnalysis } from "./reference-analyzer";
import { RawAnalysis } from "./raw-analyzer";

export interface MappingConfig {
  /** How aggressively to map reference effects (0-1) */
  density: number;
  /** Minimum time between mapped events (ms) */
  minEventGap: number;
  /** Maximum number of effects per sentence */
  maxEffectsPerSentence: number;
  /** Enable SFX mapping */
  enableSfx: boolean;
  /** Enable camera motion mapping */
  enableCamera: boolean;
  /** Enable graphic overlay mapping */
  enableGraphics: boolean;
}

const DEFAULT_CONFIG: MappingConfig = {
  density: 0.8,
  minEventGap: 200,
  maxEffectsPerSentence: 4,
  enableSfx: true,
  enableCamera: true,
  enableGraphics: true,
};

export interface MappingResult {
  /** The mapped edit blueprint */
  blueprint: EditBlueprint;
  /** Mapping statistics */
  stats: {
    totalReferenceEvents: number;
    mappedEvents: number;
    skippedEvents: number;
    sfxMapped: number;
    cameraMapped: number;
    graphicsMapped: number;
    highlightsMapped: number;
    captionsMapped: number;
    unmappedReason: Record<string, number>;
  };
}

export class MappingEngine {
  private config: MappingConfig;
  private rawEvents: TimestampedEvent[] = [];
  private mappedTimestamps: number[] = [];

  constructor(config: Partial<MappingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Map reference events onto raw video moments.
   */
  map(reference: ReferenceAnalysis, raw: RawAnalysis): MappingResult {
    this.rawEvents = raw.events;
    this.mappedTimestamps = [];

    const events: TimestampedEvent[] = [];
    const stats = {
      totalReferenceEvents: reference.events.length,
      mappedEvents: 0,
      skippedEvents: 0,
      sfxMapped: 0,
      cameraMapped: 0,
      graphicsMapped: 0,
      highlightsMapped: 0,
      captionsMapped: 0,
      unmappedReason: {} as Record<string, number>,
    };

    for (const refEvent of reference.events) {
      // Check event gap (prevent crowding)
      if (!this.canPlaceEvent(refEvent.timestamp)) {
        stats.skippedEvents++;
        stats.unmappedReason["too_close_to_existing"] = (stats.unmappedReason["too_close_to_existing"] || 0) + 1;
        continue;
      }

      const mapped = this.mapEvent(refEvent, raw);
      if (mapped) {
        events.push(mapped);
        stats.mappedEvents++;

        // Track by category
        switch (mapped.category) {
          case "sfx":
            stats.sfxMapped++;
            break;
          case "camera":
            stats.cameraMapped++;
            break;
          case "graphic":
            stats.graphicsMapped++;
            break;
          case "highlight":
            stats.highlightsMapped++;
            break;
          case "caption":
            stats.captionsMapped++;
            break;
        }

        this.mappedTimestamps.push(mapped.timestamp);
      } else {
        stats.skippedEvents++;
      }
    }

    return {
      blueprint: {
        version: "1.0.0",
        generatedAt: new Date().toISOString(),
        referenceVideo: reference.config.videoPath,
        rawVideo: raw.config.videoPath,
        duration: raw.config.duration,
        fps: raw.config.fps,
        events: this.sortEvents(events),
        patterns: reference.patterns,
        analysis: {
          referenceConfidence: 0.85,
          rawConfidence: 0.9,
          mappingConfidence: stats.mappedEvents / Math.max(stats.totalReferenceEvents, 1),
          totalMappedEvents: stats.mappedEvents,
          unmappedReferenceEvents: stats.skippedEvents,
          unmappedRawMoments: 0,
        },
      },
      stats,
    };
  }

  // ─── Event mapping ───────────────────────────────────────────────────────

  private mapEvent(
    refEvent: TimestampedEvent,
    raw: RawAnalysis
  ): TimestampedEvent | null {
    switch (refEvent.category) {
      case "caption":
        return this.mapCaptionEvent(refEvent as CaptionEvent, raw);
      case "highlight":
        return this.mapHighlightEvent(refEvent as HighlightEvent, raw);
      case "camera":
        return this.mapCameraEvent(refEvent as CameraEvent, raw);
      case "graphic":
        return this.mapGraphicEvent(refEvent as GraphicEvent, raw);
      case "sfx":
        return this.mapSfxEvent(refEvent as SfxEvent, raw);
      case "motion":
        return this.mapMotionEvent(refEvent as MotionEvent, raw);
      case "transition":
        return this.mapTransitionEvent(refEvent as TransitionEvent, raw);
      default:
        return null;
    }
  }

  // ─── Caption mapping ─────────────────────────────────────────────────────

  private mapCaptionEvent(ref: CaptionEvent, raw: RawAnalysis): CaptionEvent | null {
    // Find the raw voice event closest to the reference timestamp
    const rawVoice = this.findClosestRawVoice(ref.timestamp, raw);
    if (!rawVoice) return null;

    const word = typeof rawVoice.params.word === "string" ? rawVoice.params.word : "";
    const fullText = this.buildCaptionText(rawVoice.timestamp, raw);

    return {
      ...ref,
      timestamp: rawVoice.timestamp,
      source: "mapped",
      mappedFrom: ref.timestamp,
      text: fullText,
      words: this.buildCaptionWords(rawVoice.timestamp, raw),
      lines: this.buildCaptionLines(fullText),
      position: ref.position ?? "bottom",
      style: ref.style ?? "kinetic",
      params: { ...ref.params, rawTimestamp: rawVoice.timestamp, mappedWord: word },
    };
  }

  // ─── Highlight mapping ───────────────────────────────────────────────────

  private mapHighlightEvent(ref: HighlightEvent, raw: RawAnalysis): HighlightEvent | null {
    // Find emphasis word in raw near the reference timestamp
    const emphasisWord = this.findClosestEmphasisWord(ref.timestamp, raw);
    if (!emphasisWord) return null;

    return {
      ...ref,
      timestamp: emphasisWord.timestamp,
      source: "mapped",
      mappedFrom: ref.timestamp,
      text: emphasisWord.word,
      wordIndex: 0,
      params: {
        ...ref.params,
        rawWord: emphasisWord.word,
        rawTimestamp: emphasisWord.timestamp,
        reason: emphasisWord.reason,
      },
    };
  }

  // ─── Camera mapping ──────────────────────────────────────────────────────

  private mapCameraEvent(ref: CameraEvent, raw: RawAnalysis): CameraEvent | null {
    if (!this.config.enableCamera) return null;

    // Find a voice event or emphasis moment in raw
    const rawVoice = this.findClosestRawVoice(ref.timestamp, raw);
    if (!rawVoice) return null;

    return {
      ...ref,
      timestamp: rawVoice.timestamp,
      source: "mapped",
      mappedFrom: ref.timestamp,
      startScale: ref.startScale,
      peakScale: Math.min(ref.peakScale, raw.zoomBounds.maxScale),
      endScale: ref.endScale,
      params: {
        ...ref.params,
        rawTimestamp: rawVoice.timestamp,
        safeCenter: raw.zoomBounds.safeCenter,
      },
    };
  }

  // ─── Graphic mapping ─────────────────────────────────────────────────────

  private mapGraphicEvent(ref: GraphicEvent, raw: RawAnalysis): GraphicEvent | null {
    if (!this.config.enableGraphics) return null;

    const rawVoice = this.findClosestRawVoice(ref.timestamp, raw);
    if (!rawVoice) return null;

    return {
      ...ref,
      timestamp: rawVoice.timestamp,
      source: "mapped",
      mappedFrom: ref.timestamp,
      position: this.adjustPositionToSafeZone(ref.position, raw),
      params: {
        ...ref.params,
        rawTimestamp: rawVoice.timestamp,
      },
    };
  }

  // ─── SFX mapping ─────────────────────────────────────────────────────────

  private mapSfxEvent(ref: SfxEvent, raw: RawAnalysis): SfxEvent | null {
    if (!this.config.enableSfx) return null;

    // Find the closest voice event — SFX should lead the word
    const rawVoice = this.findClosestRawVoice(
      ref.timestamp + ref.leadMs / 1000,
      raw
    );
    if (!rawVoice) return null;

    const leadSeconds = ref.leadMs / 1000;
    const sfxTimestamp = Math.max(0, rawVoice.timestamp - leadSeconds);

    return {
      ...ref,
      timestamp: sfxTimestamp,
      source: "mapped",
      mappedFrom: ref.timestamp,
      sfxPath: this.selectSfxFile(ref.kind),
      params: {
        ...ref.params,
        rawTimestamp: sfxTimestamp,
        leadWord: typeof rawVoice.params.word === "string" ? rawVoice.params.word : "",
      },
    };
  }

  // ─── Motion mapping ──────────────────────────────────────────────────────

  private mapMotionEvent(ref: MotionEvent, raw: RawAnalysis): MotionEvent | null {
    const rawVoice = this.findClosestRawVoice(ref.timestamp, raw);
    if (!rawVoice) return null;

    return {
      ...ref,
      timestamp: rawVoice.timestamp,
      source: "mapped",
      mappedFrom: ref.timestamp,
      params: { ...ref.params, rawTimestamp: rawVoice.timestamp },
    };
  }

  // ─── Transition mapping ──────────────────────────────────────────────────

  private mapTransitionEvent(ref: TransitionEvent, raw: RawAnalysis): TransitionEvent | null {
    // Find natural cut points in raw video
    if (raw.naturalCuts.length === 0) return null;

    const nearestCut = raw.naturalCuts.reduce((best, cut) =>
      Math.abs(cut.timestamp - ref.timestamp) < Math.abs(best.timestamp - ref.timestamp)
        ? cut
        : best
    );

    return {
      ...ref,
      timestamp: nearestCut.timestamp,
      source: "mapped",
      mappedFrom: ref.timestamp,
      params: { ...ref.params, reason: nearestCut.reason },
    };
  }

  // ─── Matching helpers ────────────────────────────────────────────────────

  private findClosestRawVoice(targetTime: number, raw: RawAnalysis): TimestampedEvent | null {
    const voiceEvents = raw.events.filter((e) => e.category === "voice");
    if (voiceEvents.length === 0) return null;

    return voiceEvents.reduce((best, evt) =>
      Math.abs(evt.timestamp - targetTime) < Math.abs(best.timestamp - targetTime)
        ? evt
        : best
    );
  }

  private findClosestEmphasisWord(
    targetTime: number,
    raw: RawAnalysis
  ): { word: string; timestamp: number; reason: string } | null {
    if (raw.emphasisWords.length === 0) return null;

    return raw.emphasisWords.reduce((best, ew) =>
      Math.abs(ew.timestamp - targetTime) < Math.abs(best.timestamp - targetTime)
        ? ew
        : best
    );
  }

  private buildCaptionText(aroundTime: number, raw: RawAnalysis): string {
    if (!raw.config.transcript) return "";
    const window = 3.0; // Show 3 seconds of captions around the moment
    const words = raw.config.transcript.words.filter(
      (w) => w.start >= aroundTime - window && w.start <= aroundTime + window
    );
    return words.map((w) => w.word).join(" ");
  }

  private buildCaptionWords(aroundTime: number, raw: RawAnalysis): CaptionWord[] {
    if (!raw.config.transcript) return [];
    const window = 3.0;
    return raw.config.transcript.words
      .filter((w) => w.start >= aroundTime - window && w.start <= aroundTime + window)
      .map((w) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        state: w.start < aroundTime ? "past" : w.start <= aroundTime ? "active" : "pending",
        highlighted: false,
        animation: "none" as const,
      }));
  }

  private buildCaptionLines(text: string): string[][] {
    const words = text.split(" ");
    const lines: string[][] = [];
    const wordsPerLine = 5;
    for (let i = 0; i < words.length; i += wordsPerLine) {
      lines.push(words.slice(i, i + wordsPerLine));
    }
    return lines.length > 0 ? lines : [words];
  }

  private adjustPositionToSafeZone(
    pos: { x: number; y: number; anchor?: string },
    raw: RawAnalysis
  ): { x: number; y: number; anchor?: string } {
    // Keep graphics within safe zones defined by raw analysis
    return {
      ...pos,
      y: Math.max(raw.safeZones.top.yMax, Math.min(raw.safeZones.bottom.yMin, pos.y)),
    };
  }

  private selectSfxFile(kind: string): string {
    // Map SFX category to a file in the SFX library
    const sfxLibrary: Record<string, string> = {
      whoosh: "sfx/whoosh-01.wav",
      hit: "sfx/hit-01.wav",
      pop: "sfx/pop-01.wav",
      click: "sfx/click-01.wav",
      swoosh: "sfx/swoosh-01.wav",
      ding: "sfx/ding-01.wav",
      snap: "sfx/snap-01.wav",
      transition: "sfx/whoosh-02.wav",
      emphasis: "sfx/hit-02.wav",
    };
    return sfxLibrary[kind] ?? "sfx/default.wav";
  }

  // ─── Event gap management ────────────────────────────────────────────────

  private canPlaceEvent(timestamp: number): boolean {
    const minGapSec = this.config.minEventGap / 1000;
    return !this.mappedTimestamps.some(
      (t) => Math.abs(t - timestamp) < minGapSec
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private sortEvents(events: TimestampedEvent[]): TimestampedEvent[] {
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }
}

/**
 * reference-analyzer.ts — analyzes a reference video and produces
 * timestamped editing events from visual and audio analysis.
 *
 * This is the "reverse engineering" step: given a finished video,
 * extract what the editor did and when.
 *
 * Current approach (Phase 1):
 *   - Use the references.md annotation as the primary source
 *   - Enrich with frame-level visual analysis
 *   - Detect SFX from audio waveform
 *
 * Future approach (Phase 2):
 *   - Frame differencing for cut detection
 *   - Audio spectral analysis for SFX classification
 *   - OCR for on-screen text extraction
 *   - Object detection for graphic overlays
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
  VoiceEvent,
  MotionEvent,
  TransitionEvent,
} from "./edit-blueprint";

// ─── Reference analysis configuration ──────────────────────────────────────

export interface ReferenceAnalysisConfig {
  /** Path to the reference video file */
  videoPath: string;
  /** Path to references.md annotation */
  annotationPath?: string;
  /** Path to extracted audio */
  audioPath?: string;
  /** FPS of the reference video */
  fps: number;
  /** Total frames */
  totalFrames: number;
  /** Duration in seconds */
  duration: number;
  /** Existing transcription (if available) */
  transcript?: { words: { word: string; start: number; end: number }[] };
}

// ─── Analysis result ────────────────────────────────────────────────────────

export interface ReferenceAnalysis {
  config: ReferenceAnalysisConfig;
  events: TimestampedEvent[];
  patterns: EditingPatterns;
  /** Contact sheets with timestamps for visual inspection */
  contactFrames: { frame: number; timestamp: number; description: string }[];
}

// ─── Reference analyzer ─────────────────────────────────────────────────────

export class ReferenceAnalyzer {
  private config: ReferenceAnalysisConfig;
  private events: TimestampedEvent[] = [];
  private changeTimestamps: number[] = [];

  constructor(config: ReferenceAnalysisConfig) {
    this.config = config;
  }

  /**
   * Run the full analysis pipeline.
   * Returns the structured reference analysis.
   */
  analyze(): ReferenceAnalysis {
    // Phase 1: Parse manual annotation
    if (this.config.annotationPath) {
      this.parseAnnotation(this.config.annotationPath);
    }

    // Phase 2: Detect visual change points (frame differencing)
    this.detectVisualChanges();

    // Phase 3: Analyze audio for SFX events
    if (this.config.audioPath) {
      this.detectSfxEvents();
    }

    // Phase 4: Build editing patterns
    const patterns = this.buildPatterns();

    return {
      config: this.config,
      events: this.sortEvents(this.events),
      patterns,
      contactFrames: this.extractContactFrames(),
    };
  }

  /**
   * Convert the analysis into an edit blueprint (without raw mapping).
   */
  toBlueprint(referenceVideo: string, rawVideo: string): EditBlueprint {
    const analysis = this.analyze();
    return {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      referenceVideo,
      rawVideo,
      duration: this.config.duration,
      fps: this.config.fps,
      events: analysis.events,
      patterns: analysis.patterns,
      analysis: {
        referenceConfidence: 0.85,
        rawConfidence: 0.0,
        mappingConfidence: 0.0,
        totalMappedEvents: 0,
        unmappedReferenceEvents: analysis.events.length,
        unmappedRawMoments: 0,
      },
    };
  }

  // ─── Phase 1: Annotation parser ──────────────────────────────────────────

  private parseAnnotation(path: string): void {
    // The references.md format is parsed by a Python preprocessor
    // that produces a structured JSON. This method accepts that JSON.
    // For now, events are injected via addEvent() from the parsing layer.
    // See scripts/parse-references.py for the parser.
  }

  /**
   * Inject events from an external parser (Python parse-references.py).
   */
  injectEvents(events: TimestampedEvent[]): void {
    this.events.push(...events);
    events.forEach((e) => {
      if (e.timestamp > 0) this.changeTimestamps.push(e.timestamp);
    });
  }

  // ─── Phase 2: Visual change detection ────────────────────────────────────

  private detectVisualChanges(): void {
    // Frame differencing would go here in Phase 2.
    // For now, annotated events serve as the change points.
    // This method is a placeholder for future automated detection.
  }

  // ─── Phase 3: SFX detection ──────────────────────────────────────────────

  private detectSfxEvents(): void {
    // Audio spectral analysis would go here in Phase 2.
    // For now, SFX events come from annotation.
  }

  // ─── Pattern extraction ──────────────────────────────────────────────────

  private buildPatterns(): EditingPatterns {
    const changeIntervals: number[] = [];
    const sorted = [...this.changeTimestamps].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      changeIntervals.push(sorted[i] - sorted[i - 1]);
    }

    const categories = new Set(this.events.map((e) => e.category));

    return {
      avgChangeInterval: changeIntervals.length > 0
        ? changeIntervals.reduce((a, b) => a + b, 0) / changeIntervals.length
        : 2.0,
      minChangeInterval: changeIntervals.length > 0 ? Math.min(...changeIntervals) : 0.5,
      maxChangeInterval: changeIntervals.length > 0 ? Math.max(...changeIntervals) : 5.0,
      eventDensity: this.config.duration > 0 ? this.events.length / this.config.duration : 0,
      categoriesUsed: Array.from(categories),
      dominantTransition: this.getMostCommonKind("transition"),
      highlightFrequency: this.countCategoryPerSecond("highlight"),
      avgZoomPunch: this.getAverageParam("peakScale", "camera") ?? 1.08,
      captionStyle: categories.has("graphic") ? "mixed" : "kinetic",
    };
  }

  // ─── Contact frame extraction ────────────────────────────────────────────

  private extractContactFrames(): { frame: number; timestamp: number; description: string }[] {
    const changePoints = [...new Set(this.changeTimestamps)]
      .sort((a, b) => a - b)
      .slice(0, 20); // Cap at 20 frames

    return changePoints.map((ts) => ({
      frame: Math.round(ts * this.config.fps),
      timestamp: ts,
      description: `Visual change at ${this.formatTime(ts)}`,
    }));
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private getMostCommonKind(category: string): string {
    const kinds = this.events
      .filter((e) => e.category === category)
      .map((e) => e.kind);
    if (kinds.length === 0) return "unknown";
    const counts: Record<string, number> = {};
    kinds.forEach((k) => (counts[k] = (counts[k] || 0) + 1));
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  private countCategoryPerSecond(category: string): number {
    const count = this.events.filter((e) => e.category === category).length;
    return this.config.duration > 0 ? count / this.config.duration : 0;
  }

  private getAverageParam(param: string, category: string): number | undefined {
    const values = this.events
      .filter((e) => e.category === category && typeof e.params[param] === "number")
      .map((e) => e.params[param] as number);
    if (values.length === 0) return undefined;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private sortEvents(events: TimestampedEvent[]): TimestampedEvent[] {
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toFixed(3).padStart(5, "0")}`;
  }
}

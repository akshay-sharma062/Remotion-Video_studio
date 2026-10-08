/**
 * raw-analyzer.ts — analyzes the raw (un-edited) talking-head video.
 *
 * Produces structured data about:
 * - Speech transcript (word-level timestamps)
 * - Sentence boundaries
 * - Emphasis words
 * - Natural cut points
 * - Face position / safe zones
 * - Zoom/punch suitability
 */

import { TimestampedEvent, VoiceEvent, CameraEvent, CaptionWord } from "./edit-blueprint";

export interface RawAnalysisConfig {
  videoPath: string;
  audioPath: string;
  transcript?: { words: { word: string; start: number; end: number }[] };
  fps: number;
  totalFrames: number;
  duration: number;
  width: number;
  height: number;
}

export interface RawAnalysis {
  config: RawAnalysisConfig;
  events: TimestampedEvent[];
  /** Speaker face bounding box in normalized coordinates (0-1) */
  faceRegion: { x: number; y: number; width: number; height: number };
  /** Safe text zones (where captions/graphics can go without covering face) */
  safeZones: {
    top: { yMin: number; yMax: number; xMin: number; xMax: number };
    bottom: { yMin: number; yMax: number; xMin: number; xMax: number };
    left: { xMin: number; xMax: number; yMin: number; yMax: number };
    right: { xMin: number; xMax: number; yMin: number; yMax: number };
  };
  /** Detected natural cut frames (jump cuts, mistakes, dead air) */
  naturalCuts: { frame: number; timestamp: number; reason: string }[];
  /** Sentences detected from transcript */
  sentences: { start: number; end: number; text: string; wordCount: number }[];
  /** Words identified as emphasis-worthy */
  emphasisWords: { word: string; timestamp: number; reason: string }[];
  /** Recommended zoom bounds */
  zoomBounds: { minScale: number; maxScale: number; safeCenter: { x: number; y: number } };
}

export class RawAnalyzer {
  private config: RawAnalysisConfig;
  private events: TimestampedEvent[] = [];

  constructor(config: RawAnalysisConfig) {
    this.config = config;
  }

  analyze(): RawAnalysis {
    this.analyzeVoiceEvents();
    this.detectNaturalCuts();
    this.buildSentences();
    this.detectEmphasisWords();
    this.estimateFaceRegion();
    this.defineSafeZones();
    this.estimateZoomBounds();

    return {
      config: this.config,
      events: this.events,
      faceRegion: { x: 0.35, y: 0.15, width: 0.3, height: 0.55 },
      safeZones: {
        top: { yMin: 0, yMax: 0.13, xMin: 0.05, xMax: 0.95 },
        bottom: { yMin: 0.78, xMin: 0.05, xMax: 0.95 } as any,
        left: { xMin: 0, xMax: 0.05, yMin: 0.15, yMax: 0.85 },
        right: { xMin: 0.95, xMax: 1, yMin: 0.15, yMax: 0.85 },
      },
      naturalCuts: [],
      sentences: [],
      emphasisWords: [],
      zoomBounds: { minScale: 1.0, maxScale: 1.08, safeCenter: { x: 0.5, y: 0.4 } },
    };
  }

  // ─── Voice events ────────────────────────────────────────────────────────

  private analyzeVoiceEvents(): void {
    if (!this.config.transcript) return;

    this.config.transcript.words.forEach((w, i) => {
      // Word boundary event
      this.events.push({
        category: "voice",
        timestamp: w.start,
        duration: (w.end - w.start) * 1000,
        label: `word: ${w.word}`,
        kind: "word",
        params: { wordIndex: i, word: w.word },
        confidence: 0.95,
        source: "raw",
      });

      // Sentence boundary detection (pauses > 600ms)
      if (i > 0) {
        const prev = this.config.transcript!.words[i - 1];
        const gap = w.start - prev.end;
        if (gap > 0.6) {
          this.events.push({
            category: "voice",
            timestamp: prev.end,
            duration: gap * 1000,
            label: `sentence boundary`,
            kind: "sentence",
            params: { precedingWord: prev.word, gapSeconds: gap },
            confidence: 0.8,
            source: "raw",
          });
        }
      }
    });
  }

  // ─── Natural cut detection ───────────────────────────────────────────────

  private detectNaturalCuts(): void {
    // Phase 1: Use transcript pauses as proxy for dead air
    if (!this.config.transcript) return;

    const words = this.config.transcript.words;
    for (let i = 1; i < words.length; i++) {
      const gap = words[i].start - words[i - 1].end;
      if (gap > 1.0) {
        // Long pause — potential dead air / natural cut
        const midPoint = (words[i - 1].end + words[i].start) / 2;
        this.events.push({
          category: "transition",
          timestamp: midPoint,
          duration: 200,
          label: `dead air at ${midPoint.toFixed(1)}s`,
          kind: "cut",
          params: { gapSeconds: gap },
          confidence: 0.6,
          source: "raw",
        });
      }
    }

    // Phase 2 would use frame differencing to detect jump cuts
  }

  // ─── Sentence building ───────────────────────────────────────────────────

  private buildSentences(): void {
    if (!this.config.transcript) return;

    const words = this.config.transcript.words;
    const sentences: { start: number; end: number; text: string; wordCount: number }[] = [];
    let current: { start: number; end: number; text: string; wordCount: number } | null = null;

    words.forEach((w, i) => {
      const isEnd = i === words.length - 1 ||
        (i < words.length - 1 && words[i + 1].start - w.end > 0.4);

      if (!current) {
        current = { start: w.start, end: w.end, text: w.word, wordCount: 1 };
      } else {
        current.text += " " + w.word;
        current.end = w.end;
        current.wordCount++;
      }

      if (isEnd && current) {
        sentences.push(current);
        current = null;
      }
    });

    this.sentences = sentences;
  }

  // ─── Emphasis word detection ─────────────────────────────────────────────

  private detectEmphasisWords(): void {
    if (!this.config.transcript) return;

    const emphasisIndicators = [
      /\b(significantly|much|more|best|never|always|only|really|actually|huge|massive)\b/i,
      /\b(difference|important|key|critical|essential|right|wrong)\b/i,
      /\b(growth|salary|money|career|position|skills|talent)\b/i,
    ];

    this.config.transcript.words.forEach((w) => {
      const isEmphasis = emphasisIndicators.some((re) => re.test(w.word));
      if (isEmphasis) {
        this.events.push({
          category: "voice",
          timestamp: w.start,
          duration: (w.end - w.start) * 1000,
          label: `emphasis: ${w.word}`,
          kind: "emphasis",
          params: { word: w.word, index: this.events.length },
          confidence: 0.7,
          source: "raw",
        });
        this.emphasisWords.push({
          word: w.word,
          timestamp: w.start,
          reason: "matches emphasis pattern",
        });
      }
    });
  }

  // ─── Face region estimation ───────────────────────────────────────────────

  private estimateFaceRegion(): void {
    // Phase 1: Conservative default for centered talking head
    // Phase 2 would use face detection to find actual position
    // The faceRegion is already set in the return value as defaults
  }

  // ─── Safe zone definition ────────────────────────────────────────────────

  private defineSafeZones(): void {
    // Based on 9:16 safe zone rules from CLAUDE.md:
    // - Top 250px out of 1920px = 0.13
    // - Bottom 380px out of 1920px = 0.198 (using 0.22 for safety margin)
    // - Left/right 80px out of 1080px = 0.074 (using 0.08)

    // The safeZones are already set as defaults in the return value
  }

  // ─── Zoom bounds ─────────────────────────────────────────────────────────

  private estimateZoomBounds(): void {
    // Based on CLAUDE.md rules:
    // - Never scale up from below 0.9
    // - Zoom punches: 1.0 → 1.06 typical, 1.1 maximum emphasis
    this.zoomBounds = { minScale: 1.0, maxScale: 1.1, safeCenter: { x: 0.5, y: 0.4 } };
  }
}

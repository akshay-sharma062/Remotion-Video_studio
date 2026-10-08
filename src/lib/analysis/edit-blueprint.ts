/**
 * edit-blueprint.ts — schema for the machine-readable edit blueprint.
 *
 * This is the intermediate representation between reference analysis
 * and the Remotion composition. Every field is concrete and timestamped.
 *
 * Flow:
 *   Reference video → ReferenceAnalyzer → edit blueprint
 *   Raw video      → RawAnalyzer       → raw analysis
 *   ReferenceAnalyzer + RawAnalyzer → MappingEngine → edit blueprint (mapped to raw)
 *   Edit blueprint → ReferenceDrivenComposition → rendered video
 */

// ─── Event types ────────────────────────────────────────────────────────────

export type EventCategory =
  | "caption"           // text appears/disappears/changes on screen
  | "highlight"         // word/color/scale emphasis within caption
  | "camera"            // zoom/punch/pull
  | "graphic"           // overlay graphic (arrow, icon, card, b-roll insert)
  | "sfx"               // sound effect
  | "music"             // beat/drop
  | "voice"             // spoken word boundary
  | "transition"        // clip transition (cut, fade, wipe)
  | "motion"            // element movement (slide, scale, rotate)
  | "blur"              // blur/mask reveal
  | "color_grade";      // visual style shift

// ─── Primitive events ───────────────────────────────────────────────────────

export interface TimestampedEvent {
  category: EventCategory;
  /** Absolute time in seconds */
  timestamp: number;
  /** Duration in ms. 0 for instantaneous events. */
  duration: number;
  /** Human-readable label for debugging */
  label: string;
  /** Sub-type discriminator */
  kind: string;
  /** Free-form parameters (effect-specific) */
  params: Record<string, unknown>;
  /** Confidence 0-1 (how sure the analysis is) */
  confidence: number;
  /** Source: "reference" or "raw" */
  source: "reference" | "raw" | "mapped";
  /** If mapped, which reference event this came from */
  mappedFrom?: number;
}

// ─── Caption events ─────────────────────────────────────────────────────────

export interface CaptionEvent extends TimestampedEvent {
  category: "caption";
  kind: "show" | "hide" | "change" | "word_active" | "word_exit";
  /** Full caption text for this frame */
  text: string;
  /** Words currently active with per-word state */
  words: CaptionWord[];
  /** Line grouping */
  lines: string[][];
  /** Position in safe zone */
  position: "top" | "middle" | "bottom";
  /** Whether this is a kinetic (large) caption or subtitle (small) */
  style: "kinetic" | "subtitle";
}

export interface CaptionWord {
  word: string;
  start: number;   // seconds
  end: number;     // seconds
  state: "pending" | "active" | "past" | "exiting";
  highlighted: boolean;
  highlightColor?: string;
  scale?: number;  // 1 = normal, >1 = emphasized
  animation?: "none" | "slam" | "punch" | "fade";
}

// ─── Highlight events ───────────────────────────────────────────────────────

export interface HighlightEvent extends TimestampedEvent {
  category: "highlight";
  kind: "word_highlight" | "phrase_highlight" | "highlight_remove";
  text: string;
  /** Word index within the caption */
  wordIndex: number;
  color: string;
  scale: number;
  /** Entrance animation */
  animation: "slam" | "punch" | "fade" | "pop";
  /** How long the highlight stays visible (ms) */
  holdDuration: number;
}

// ─── Camera events ──────────────────────────────────────────────────────────

export interface CameraEvent extends TimestampedEvent {
  category: "camera";
  kind: "punch_in" | "punch_out" | "hold" | "pan" | "shake";
  /** Zoom scale at event start */
  startScale: number;
  /** Zoom scale at event peak */
  peakScale: number;
  /** Zoom scale at event end */
  endScale: number;
  /** Direction/offset if applicable */
  offsetX?: number;
  offsetY?: number;
}

// ─── Graphic events ─────────────────────────────────────────────────────────

export interface GraphicEvent extends TimestampedEvent {
  category: "graphic";
  kind: "broll_insert" | "arrow" | "icon" | "card" | "bar_chart" | "diagram"
    | "split_screen" | "text_overlay" | "puzzle" | "magnifier";
  /** SVG description or image reference */
  asset?: string;
  /** Position on screen */
  position: { x: number; y: number; anchor?: string };
  /** Size */
  size?: { width: number; height: number };
  /** Entrance animation */
  entrance: "fade" | "slide" | "scale" | "none";
  /** Entrance duration in ms */
  entranceDuration: number;
  color?: string;
}

// ─── SFX events ─────────────────────────────────────────────────────────────

export interface SfxEvent extends TimestampedEvent {
  category: "sfx";
  kind: "whoosh" | "hit" | "pop" | "click" | "swoosh" | "ding" | "snap"
    | "transition" | "emphasis" | "custom";
  /** Path to the audio file in the SFX library */
  sfxPath?: string;
  /** Lead time before the associated event (negative = before) */
  leadMs: number;
  /** Duck volume under voice (dB) */
  duckDb: number;
  /** High-pass filter frequency (Hz) */
  highPassHz: number;
}

// ─── Voice events ───────────────────────────────────────────────────────────

export interface VoiceEvent extends TimestampedEvent {
  category: "voice";
  kind: "word" | "sentence" | "pause" | "emphasis" | "question";
  word?: string;
  /** Word index in transcript */
  wordIndex?: number;
  /** Sentence index */
  sentenceIndex?: number;
}

// ─── Motion events ──────────────────────────────────────────────────────────

export interface MotionEvent extends TimestampedEvent {
  category: "motion";
  kind: "slide_in" | "slide_out" | "scale_in" | "scale_out" | "rotate"
    | "bounce" | "overshoot" | "pulse";
  /** Target element identifier */
  target: string;
  /** Start value */
  from: Record<string, number>;
  /** End value */
  to: Record<string, number>;
  /** Easing function name */
  easing: string;
}

// ─── Transition events ──────────────────────────────────────────────────────

export interface TransitionEvent extends TimestampedEvent {
  category: "transition";
  kind: "cut" | "fade" | "dissolve" | "wipe_left" | "wipe_right" | "zoom_through";
  duration: number;
  /** Source clip identifier */
  fromClip?: string;
  /** Destination clip identifier */
  toClip?: string;
}

// ─── Complete edit blueprint ────────────────────────────────────────────────

export interface EditBlueprint {
  /** Schema version */
  version: string;
  /** When this blueprint was generated */
  generatedAt: string;
  /** Source reference video path */
  referenceVideo: string;
  /** Source raw video path */
  rawVideo: string;
  /** Total duration in seconds */
  duration: number;
  /** Frame rate */
  fps: number;

  /** All timestamped events in chronological order */
  events: TimestampedEvent[];

  /** Detected editing patterns for density matching */
  patterns: EditingPatterns;

  /** Analysis metadata */
  analysis: {
    referenceConfidence: number;
    rawConfidence: number;
    mappingConfidence: number;
    totalMappedEvents: number;
    unmappedReferenceEvents: number;
    unmappedRawMoments: number;
  };
}

export interface EditingPatterns {
  /** Average time between visual changes (seconds) */
  avgChangeInterval: number;
  /** Minimum change interval (seconds) */
  minChangeInterval: number;
  /** Maximum change interval (seconds) */
  maxChangeInterval: number;
  /** Event density: events per second */
  eventDensity: number;
  /** Which event categories are used */
  categoriesUsed: EventCategory[];
  /** Most common transition type */
  dominantTransition: string;
  /** Highlight frequency (per second of speech) */
  highlightFrequency: number;
  /** Average zoom punch scale */
  avgZoomPunch: number;
  /** Typical caption style */
  captionStyle: "kinetic" | "subtitle" | "mixed";
}

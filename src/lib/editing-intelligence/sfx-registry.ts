/**
 * sfx-registry.ts — the canonical manifest of available SFX assets.
 *
 * This is the single source of truth for what SFX sounds exist,
 * what they're for, and how they should be used.
 *
 * DO NOT invent SFX paths. If a needed SFX is not in this registry,
 * the system reports "MISSING SFX ASSET" instead of guessing.
 */

// ─── SFX Asset Definition ────────────────────────────────────────────────────

export interface SfxAsset {
  /** Machine ID: lowercase_with_underscores */
  id: string;
  /** Human-readable name */
  name: string;
  /** Category this SFX belongs to */
  category: SfxCategory;
  /** Sub-type within the category */
  kind: string;
  /** Typical duration range (ms) */
  durationMs: [number, number];
  /** Intensity: 1=subtle, 5=maximum impact */
  intensity: 1 | 2 | 3 | 4 | 5;
  /** Tonal character */
  tonal: "bright" | "dark" | "neutral" | "warm" | "sharp";
  /** Recommended use cases */
  useFor: string[];
  /** Default gain (0-1) relative to 0dB peak */
  defaultGain: number;
  /** Fade in (ms). 0 = instant. */
  fadeInMs: number;
  /** Fade out (ms). */
  fadeOutMs: number;
  /** Duck this many dB under voice when played during speech */
  duckDb: number;
  /** High-pass filter frequency (Hz). 0 = no filter. */
  highPassHz: number;
  /** Whether this can be generated programmatically */
  generative: boolean;
  /** Path relative to public/sfx/ (null if generative-only) */
  assetPath: string | null;
}

// ─── SFX Categories ──────────────────────────────────────────────────────────

export type SfxCategory =
  | "impact"       // Hits, slams, punches
  | "whoosh"       // Movement, zoom, transitions
  | "ui"           // Clicks, pops, ticks
  | "chime"        // Dings, bells, alerts
  | "swoosh"       // Large movement, scene transitions
  | "ambience"     // Room tone, background
  | "voice_fx";    // Vocal effects

// ─── The Registry ────────────────────────────────────────────────────────────

/**
 * Available SFX assets.
 *
 * To add a new SFX:
 * 1. Place the audio file in public/sfx/
 * 2. Add an entry here
 * 3. If generative, ensure the generator exists in sfx-generators.ts
 */
export const SFX_REGISTRY: SfxAsset[] = [
  // ── Impact ──────────────────────────────────────────────────────────────────

  {
    id: "impact_light",
    name: "Light Hit",
    category: "impact",
    kind: "hit",
    durationMs: [200, 400],
    intensity: 2,
    tonal: "neutral",
    useFor: [
      "small graphic appearing",
      "icon pop",
      "minor emphasis word",
      "small UI element entrance",
    ],
    defaultGain: 0.6,
    fadeInMs: 0,
    fadeOutMs: 80,
    duckDb: 8,
    highPassHz: 200,
    generative: true,
    assetPath: null,
  },
  {
    id: "impact_medium",
    name: "Medium Hit",
    category: "impact",
    kind: "hit",
    durationMs: [250, 500],
    intensity: 3,
    tonal: "dark",
    useFor: [
      "kinetic text slam",
      "word highlight",
      "lower third entrance",
      "data card appearing",
    ],
    defaultGain: 0.7,
    fadeInMs: 0,
    fadeOutMs: 100,
    duckDb: 6,
    highPassHz: 130,
    generative: true,
    assetPath: null,
  },
  {
    id: "impact_heavy",
    name: "Heavy Hit",
    category: "impact",
    kind: "hit",
    durationMs: [300, 600],
    intensity: 5,
    tonal: "dark",
    useFor: [
      "major kinetic slam",
      "scene transition impact",
      "CTA appearance",
      "major emphasis word",
    ],
    defaultGain: 0.8,
    fadeInMs: 0,
    fadeOutMs: 120,
    duckDb: 4,
    highPassHz: 80,
    generative: true,
    assetPath: null,
  },

  // ── Whoosh ──────────────────────────────────────────────────────────────────

  {
    id: "whoosh_light",
    name: "Light Whoosh",
    category: "whoosh",
    kind: "whoosh",
    durationMs: [300, 500],
    intensity: 2,
    tonal: "neutral",
    useFor: [
      "small slide animation",
      "caption transition",
      "text entering quickly",
    ],
    defaultGain: 0.4,
    fadeInMs: 20,
    fadeOutMs: 100,
    duckDb: 8,
    highPassHz: 500,
    generative: true,
    assetPath: null,
  },
  {
    id: "whoosh_medium",
    name: "Medium Whoosh",
    category: "whoosh",
    kind: "whoosh",
    durationMs: [400, 700],
    intensity: 3,
    tonal: "neutral",
    useFor: [
      "text entering quickly",
      "graphic entrance",
      "zoom punch",
      "scene transition",
    ],
    defaultGain: 0.5,
    fadeInMs: 20,
    fadeOutMs: 120,
    duckDb: 6,
    highPassHz: 400,
    generative: true,
    assetPath: null,
  },
  {
    id: "whoosh_heavy",
    name: "Heavy Whoosh",
    category: "whoosh",
    kind: "whoosh",
    durationMs: [500, 800],
    intensity: 4,
    tonal: "dark",
    useFor: [
      "major scene transition",
      "B-roll transition",
      "large zoom-through",
      "montage beat cut",
    ],
    defaultGain: 0.6,
    fadeInMs: 30,
    fadeOutMs: 150,
    duckDb: 4,
    highPassHz: 300,
    generative: true,
    assetPath: null,
  },

  // ── Swoosh ──────────────────────────────────────────────────────────────────

  {
    id: "swoosh_wipe",
    name: "Wipe Swoosh",
    category: "swoosh",
    kind: "swoosh",
    durationMs: [300, 600],
    intensity: 3,
    tonal: "neutral",
    useFor: [
      "wipe transition",
      "slide transition",
      "text sliding in/out",
    ],
    defaultGain: 0.5,
    fadeInMs: 0,
    fadeOutMs: 120,
    duckDb: 6,
    highPassHz: 400,
    generative: true,
    assetPath: null,
  },

  // ── UI / Click ──────────────────────────────────────────────────────────────

  {
    id: "ui_pop",
    name: "UI Pop",
    category: "ui",
    kind: "pop",
    durationMs: [100, 250],
    intensity: 2,
    tonal: "bright",
    useFor: [
      "button appearing",
      "icon appearing",
      "tag appearing",
      "status indicator",
    ],
    defaultGain: 0.5,
    fadeInMs: 0,
    fadeOutMs: 60,
    duckDb: 10,
    highPassHz: 1000,
    generative: true,
    assetPath: null,
  },
  {
    id: "ui_click",
    name: "UI Click",
    category: "ui",
    kind: "click",
    durationMs: [50, 150],
    intensity: 1,
    tonal: "bright",
    useFor: [
      "input field focus",
      "toggle switch",
      "small interaction",
      "dropdown",
    ],
    defaultGain: 0.4,
    fadeInMs: 0,
    fadeOutMs: 40,
    duckDb: 12,
    highPassHz: 2000,
    generative: true,
    assetPath: null,
  },
  {
    id: "ui_tick",
    name: "UI Tick",
    category: "ui",
    kind: "click",
    durationMs: [30, 80],
    intensity: 1,
    tonal: "sharp",
    useFor: [
      "checkmark appearing",
      "step indicator advance",
      "progress tick",
    ],
    defaultGain: 0.3,
    fadeInMs: 0,
    fadeOutMs: 30,
    duckDb: 12,
    highPassHz: 3000,
    generative: true,
    assetPath: null,
  },

  // ── Chime / Ding ────────────────────────────────────────────────────────────

  {
    id: "chime_soft",
    name: "Soft Chime",
    category: "chime",
    kind: "ding",
    durationMs: [200, 400],
    intensity: 2,
    tonal: "warm",
    useFor: [
      "word highlight",
      "emphasis highlight",
      "diagram element appearing",
      "soft graphic entrance",
    ],
    defaultGain: 0.4,
    fadeInMs: 10,
    fadeOutMs: 150,
    duckDb: 8,
    highPassHz: 800,
    generative: true,
    assetPath: null,
  },
  {
    id: "chime_bell",
    name: "Bell Ding",
    category: "chime",
    kind: "ding",
    durationMs: [300, 600],
    intensity: 3,
    tonal: "bright",
    useFor: [
      "CTA appearing",
      "registration prompt",
      "key takeaway highlight",
      "important graphic",
    ],
    defaultGain: 0.5,
    fadeInMs: 0,
    fadeOutMs: 200,
    duckDb: 6,
    highPassHz: 600,
    generative: true,
    assetPath: null,
  },
  {
    id: "chime_success",
    name: "Success Chime",
    category: "chime",
    kind: "ding",
    durationMs: [200, 500],
    intensity: 3,
    tonal: "bright",
    useFor: [
      "positive result graphic",
      "success indicator",
      "completion event",
    ],
    defaultGain: 0.5,
    fadeInMs: 0,
    fadeOutMs: 180,
    duckDb: 6,
    highPassHz: 600,
    generative: true,
    assetPath: null,
  },

  // ── Snap ────────────────────────────────────────────────────────────────────

  {
    id: "snap_sharp",
    name: "Sharp Snap",
    category: "impact",
    kind: "snap",
    durationMs: [100, 250],
    intensity: 3,
    tonal: "sharp",
    useFor: [
      "text slam with overshoot",
      "punctuation emphasis",
      "quick cut emphasis",
    ],
    defaultGain: 0.5,
    fadeInMs: 0,
    fadeOutMs: 60,
    duckDb: 8,
    highPassHz: 1500,
    generative: true,
    assetPath: null,
  },
];

// ─── Lookup Helpers ───────────────────────────────────────────────────────────

/**
 * Get an SFX asset by ID. Returns null if not found.
 */
export function getSfxAsset(id: string): SfxAsset | undefined {
  return SFX_REGISTRY.find((a) => a.id === id);
}

/**
 * Get all SFX assets in a category.
 */
export function getSfxByCategory(category: SfxCategory): SfxAsset[] {
  return SFX_REGISTRY.filter((a) => a.category === category);
}

/**
 * Get SFX assets by intensity level.
 */
export function getSfxByIntensity(intensity: number): SfxAsset[] {
  return SFX_REGISTRY.filter((a) => a.intensity === intensity);
}

/**
 * Get SFX assets suitable for a given use case (fuzzy match).
 */
export function getSfxForUse(useCase: string): SfxAsset[] {
  const lower = useCase.toLowerCase();
  return SFX_REGISTRY.filter((a) =>
    a.useFor.some((u) => lower.includes(u) || u.includes(lower))
  );
}

/**
 * Find the best SFX for a specific event type and intensity.
 * Returns "MISSING" if no suitable SFX exists.
 */
export function findBestSfx(
  eventType: string,
  intensity: 1 | 2 | 3 | 4 | 5 = 3
): SfxAsset | "MISSING" {
  const candidates = SFX_REGISTRY.filter((a) => {
    const matchesIntensity = a.intensity <= intensity + 1 && a.intensity >= intensity - 1;
    const matchesUse = a.useFor.some((u) =>
      eventType.toLowerCase().includes(u) || u.includes(eventType.toLowerCase())
    );
    return matchesIntensity && matchesUse;
  });

  if (candidates.length === 0) return "MISSING";

  // Sort by intensity match (closest first), then by fewer use-For matches (more specific)
  candidates.sort((a, b) => {
    const aDiff = Math.abs(a.intensity - intensity);
    const bDiff = Math.abs(b.intensity - intensity);
    if (aDiff !== bDiff) return aDiff - bDiff;
    return a.useFor.length - b.useFor.length;
  });

  return candidates[0];
}

/**
 * Validate that all SFX IDs referenced in a blueprint exist in the registry.
 */
export function validateSfxReferences(ids: string[]): { valid: string[]; missing: string[] } {
  const valid: string[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    if (getSfxAsset(id)) {
      valid.push(id);
    } else {
      missing.push(id);
    }
  }
  return { valid, missing };
}

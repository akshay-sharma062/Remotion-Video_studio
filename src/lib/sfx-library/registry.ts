/**
 * sfx-library/registry.ts — the canonical manifest of the SFX Library.
 *
 * This is the single source of truth for what SFX sounds exist,
 * what they're for, and how they should be used.
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  CATEGORY LEGEND                                          │
 * │  1. whoosh      — Soft whooshes and airy sweeps          │
 * │  2. impact      — Text slams, premium impacts            │
 * │  3. ui          — Clicks, ticks, taps, subtle pops       │
 * │  4. highlight   — Keyword highlights and markers         │
 * │  5. riser       — Smooth risers and tonal accents        │
 * │  6. data        — Number counters and data reveals       │
 * │  7. transition  — Transitions, zooms, movement           │
 * │  8. reveal      — Icons, diagrams, infographic reveals   │
 * │  9. cta         — CTA and logo endings                   │
 * │ 10. ambience    — Ambient textures and background         │
 * │ 11. accent      — Light comedic and playful accents      │
 * │ 12. cinematic   — Cinematic and emotional accents         │
 * │ 13. reverse     — Reverse whooshes and transition tails  │
 * │ 14. notification — Gentle notification and confirmation   │
 * └──────────────────────────────────────────────────────────┘
 *
 * Strict exclusions for default corporate library:
 *   ✗ Gunshots / weapon sounds
 *   ✗ Explosions / aggressive impacts
 *   ✗ Harsh bangs / excessively loud transients
 *   ✗ Repetitive / cartoonish / cheap-sounding effects
 *
 * DO NOT invent SFX paths. If a needed SFX is not in this registry,
 * the system reports "MISSING SFX ASSET" with the required description.
 */

import type {
  SfxAsset,
  SfxCategory,
  SfxProvenance,
  SfxSource,
  SfxLicense,
  VisualEventType,
} from "./types";

const CC0 = "cc0" as SfxLicense;
const CC_BY = "cc-by" as SfxLicense;
const GENERATED = "generated" as SfxSource;
const MIXKIT = "mixkit" as SfxSource;
const FREESOUND = "freesound" as SfxLicense;
const PIXABAY = "pixabay" as SfxSource;

function asset(
  id: string,
  name: string,
  category: SfxCategory,
  kind: string,
  tags: string[],
  durationMs: [number, number],
  intensity: 1 | 2 | 3 | 4 | 5,
  tonal: "bright" | "dark" | "neutral" | "warm" | "sharp",
  useFor: string[],
  recommendedFor: VisualEventType[],
  generative = true,
  assetPath: string | null = null,
  provenance: Partial<SfxProvenance> = {},
): SfxAsset {
  return {
    id,
    name,
    category,
    kind,
    tags,
    durationMs,
    intensity,
    tonal,
    useFor,
    recommendedFor,
    defaultGain: provenance.defaultGain ?? 0.5,
    fadeInMs: provenance.fadeInMs ?? 10,
    fadeOutMs: provenance.fadeOutMs ?? 120,
    duckDb: provenance.duckDb ?? 6,
    highPassHz: provenance.highPassHz ?? 130,
    generative,
    assetPath,
    provenance: {
      source: provenance.source ?? (generative ? "generated" : "custom"),
      sourceUrl: provenance.sourceUrl ?? null,
      creator: provenance.creator ?? null,
      license: provenance.license ?? "proprietary",
      attribution: provenance.attribution ?? null,
      commercialUse: provenance.commercialUse ?? true,
      modificationPermitted: provenance.modificationPermitted ?? true,
      attributionRequired: provenance.attributionRequired ?? false,
      downloadedAt: provenance.downloadedAt ?? null,
      fileHash: provenance.fileHash ?? null,
      fileSizeBytes: provenance.fileSizeBytes ?? null,
      sampleRate: provenance.sampleRate ?? null,
      notes: provenance.notes ?? null,
    },
  };
}

export const SFX_LIBRARY: SfxAsset[] = [
  // ═══════════════════════════════════════════════════════════════════════════════
  // 1. WHOOSH — Soft whooshes and airy sweeps
  // ═══════════════════════════════════════════════════════════════════════════════

  asset("whoosh_light",
    "Light Whoosh",
    "whoosh", "whoosh",
    ["gentle", "air", "soft", "pass"],
    [300, 500], 2, "neutral",
    ["small slide animation", "caption transition", "soft text entrance"],
    ["text_entrance", "slide", "broll_transition"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 500, defaultGain: 0.4 }
  ),

  asset("whoosh_medium",
    "Medium Whoosh",
    "whoosh", "whoosh",
    ["standard", "balanced", "movement", "pass"],
    [400, 700], 3, "neutral",
    ["text entering quickly", "graphic entrance", "zoom punch", "standard scene transition"],
    ["text_entrance", "zoom_punch", "scene_transition", "icon_appear"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 400, defaultGain: 0.5 }
  ),

  asset("whoosh_heavy",
    "Heavy Whoosh",
    "whoosh", "whoosh",
    ["big", "broad", "sweep", "power"],
    [500, 800], 4, "dark",
    ["major scene transition", "B-roll transition", "large zoom-through", "montage beat cut"],
    ["zoom_through", "broll_transition", "scene_transition"],
    true, null, { source: GENERATED, duckDb: 4, highPassHz: 300, defaultGain: 0.6 }
  ),
  asset("whoosh_heavy_06",
    "Heavy Whoosh 06 (Audition)",
    "whoosh", "whoosh",
    ["heavy", "mid-weight", "deep", "alternative"],
    [500, 800], 4, "dark",
    ["punch zoom headline slam", "audition alternative to whoosh_heavy", "text slam with deep rumble"],
    ["text_entrance", "zoom_punch", "headline_slam"],
    true, null, { source: GENERATED, duckDb: 4, highPassHz: 300, defaultGain: 0.6, isAlternative: true, alternativeOf: "whoosh_heavy" }
  ),

  asset("whoosh_soft",
    "Soft Airy Sweep",
    "whoosh", "sweep",
    ["airy", "ethereal", "delicate", "breath"],
    [500, 1200], 1, "warm",
    ["gentle scene transition", "soft element reveal", "dreamy passage"],
    ["scene_transition", "reveal_moment", "reflection"],
    true, null, { source: GENERATED, duckDb: 10, highPassHz: 400, defaultGain: 0.3 }
  ),

  asset("whoosh_rising",
    "Rising Whoosh",
    "whoosh", "whoosh",
    ["rising", "building", "ascending", "anticipation"],
    [600, 1000], 3, "neutral",
    ["building momentum before a reveal", "intro sweep", "countdown feel"],
    ["text_entrance", "reveal_moment", "number_reveal"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 400, defaultGain: 0.4 }
  ),

  // ═══════════════════════════════════════════════════════════════════════════════
  // 2. IMPACT — Text slams, premium impacts (soft, modern corporate only)
  // ═══════════════════════════════════════════════════════════════════════════════

  asset("impact_light",
    "Light Hit",
    "impact", "hit",
    ["subtle", "small", "premium", "tap"],
    [200, 400], 2, "neutral",
    ["small graphic appearing", "icon pop", "minor emphasis word", "small UI element entrance"],
    ["icon_appear", "word_emphasis", "button_appear", "card_appear"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 200, defaultGain: 0.6 }
  ),

  asset("impact_medium",
    "Medium Hit",
    "impact", "hit",
    ["corporate", "slam", "premium", "balanced"],
    [250, 500], 3, "dark",
    ["kinetic text slam", "word highlight", "lower third entrance", "data card appearing"],
    ["text_slam", "word_highlight", "lower_third", "card_appear"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 130, defaultGain: 0.7 }
  ),

  asset("impact_soft",
    "Soft Impact",
    "impact", "hit",
    ["premium", "muffled", "warm", "thud"],
    [150, 350], 2, "warm",
    ["premium text entrance", "soft card appearance", "refined emphasis"],
    ["text_entrance", "card_appear", "word_emphasis"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 150, defaultGain: 0.5 }
  ),

  asset("impact_premium",
    "Premium Slam",
    "impact", "hit",
    ["premium", "weighty", "modern", "cinematic"],
    [300, 600], 4, "dark",
    ["major kinetic slam", "premium headline", "stat reveal", "key data point"],
    ["text_slam", "number_reveal", "data", "diagram_build"],
    true, null, { source: GENERATED, duckDb: 4, highPassHz: 100, defaultGain: 0.75 }
  ),

  // ═══════════════════════════════════════════════════════════════════════════════
  // 3. UI — Clicks, ticks, taps, subtle pops
  // ═══════════════════════════════════════════════════════════════════════════════

  asset("ui_pop",
    "UI Pop",
    "ui", "pop",
    ["bright", "rounded", "soft", "appear"],
    [100, 250], 2, "bright",
    ["button appearing", "icon appearing", "tag appearing", "status indicator"],
    ["button_appear", "icon_appear", "card_appear"],
    true, null, { source: GENERATED, duckDb: 10, highPassHz: 1000, defaultGain: 0.5 }
  ),

  asset("ui_click",
    "UI Click",
    "ui", "click",
    ["crisp", "clear", "interactive", "micro"],
    [50, 150], 1, "bright",
    ["input field focus", "toggle switch", "small interaction", "dropdown open"],
    ["toggle", "dropdown", "checkmark"],
    true, null, { source: GENERATED, duckDb: 12, highPassHz: 2000, defaultGain: 0.4 }
  ),

  asset("ui_tick",
    "UI Tick",
    "ui", "tick",
    ["subtle", "micro", "step", "progress"],
    [30, 80], 1, "sharp",
    ["checkmark appearing", "step indicator advance", "progress tick", "checklist item"],
    ["checkmark", "progress_step"],
    true, null, { source: GENERATED, duckDb: 12, highPassHz: 3000, defaultGain: 0.3 }
  ),

  asset("ui_tap",
    "UI Tap",
    "ui", "tap",
    ["gentle", "soft", "touch", "minimal"],
    [40, 120], 1, "warm",
    ["soft button tap", "minimal interaction", "touch feedback"],
    ["button_appear", "toggle", "pull_to_refresh"],
    true, null, { source: GENERATED, duckDb: 12, highPassHz: 2000, defaultGain: 0.35 }
  ),

  asset("ui_notification",
    "UI Notification",
    "ui", "notification",
    ["clean", "alert", "informative", "short"],
    [150, 300], 2, "bright",
    ["in-app notification appearing", "alert banner", "info tooltip"],
    ["notification", "button_appear", "lower_third"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 1500, defaultGain: 0.45 }
  ),

  // ═══════════════════════════════════════════════════════════════════════════════
  // 4. HIGHLIGHT — Keyword highlights and markers
  // ═══════════════════════════════════════════════════════════════════════════════

  asset("highlight_soft",
    "Soft Highlight Chime",
    "highlight", "chime",
    ["warm", "gentle", "emphasize", "underline"],
    [200, 400], 2, "warm",
    ["word highlight", "emphasis highlight", "soft graphic entrance", "keyword marker"],
    ["word_highlight", "word_emphasis"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 800, defaultGain: 0.4 }
  ),

  asset("highlight_marker",
    "Marker Ping",
    "highlight", "marker",
    ["short", "bright", "attention", "focus"],
    [100, 250], 2, "bright",
    ["keyword being discussed", "marker point", "underline highlight"],
    ["word_highlight", "word_emphasis", "diagram_build"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 1500, defaultGain: 0.4 }
  ),

  asset("highlight_underline",
    "Underline Swish",
    "highlight", "underline",
    ["sweeping", "underline", "emphasis", "text"],
    [200, 500], 1, "neutral",
    ["text being underlined", "sentence highlight", "passage marker"],
    ["word_highlight", "text_entrance"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 1000, defaultGain: 0.35 }
  ),

  // ═══════════════════════════════════════════════════════════════════════════════
  // 5. RISER — Smooth risers and tonal accents
  // ═══════════════════════════════════════════════════════════════════════════════

  asset("riser_subtle",
    "Subtle Riser",
    "riser", "riser",
    ["building", "rising", "tension", "soft"],
    [2000, 4000], 2, "neutral",
    ["building anticipation before reveal", "mood build-up", "soft tension"],
    ["reveal_moment", "emotional_peak", "number_reveal"],
    true, null, { source: GENERATED, duckDb: 10, highPassHz: 300, defaultGain: 0.25 }
  ),

  asset("riser_bright",
    "Bright Tonal Riser",
    "riser", "riser",
    ["ascending", "hopeful", "positive", "buildup"],
    [1500, 3500], 3, "bright",
    ["positive momentum build", "hopeful transition", "data revealing"],
    ["number_reveal", "success_event", "data"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 400, defaultGain: 0.3 }
  ),

  asset("riser_tension",
    "Tension Riser",
    "riser", "riser",
    ["dark", "building", "suspense", "ominous"],
    [2000, 5000], 3, "dark",
    ["building tension before reveal", "problem statement", "contrast setup"],
    ["emotional_peak", "reveal_moment", "text_slam"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 200, defaultGain: 0.25 }
  ),

  asset("riser_click",
    "Riser with Click",
    "riser", "riser",
    ["click", "build", "peak", "anticipation"],
    [1000, 2000], 2, "neutral",
    ["countdown feel", "building to a point", "list count-up"],
    ["number_count", "infographic_step", "progress_step"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 500, defaultGain: 0.3 }
  ),

  // ═══════════════════════════════════════════════════════════════════════════════
  // 6. DATA — Number counters and data reveals
  // ═══════════════════════════════════════════════════════════════════════════════

  asset("data_count",
    "Number Count Tick",
    "data", "counter",
    ["mechanical", "counting", "digital", "precise"],
    [80, 200], 2, "sharp",
    ["number incrementing", "counter ticking", "stat counting up", "percentage reveal"],
    ["number_count", "number_reveal"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 1500, defaultGain: 0.4 }
  ),

  asset("data_reveal",
    "Data Reveal Chime",
    "data", "reveal",
    ["crisp", "revealing", "insight", "sparkle"],
    [200, 500], 3, "bright",
    ["chart data appearing", "insight reveal", "comparison metric"],
    ["number_reveal", "diagram_build", "data"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 1000, defaultGain: 0.4 }
  ),

  asset("data_whoosh",
    "Data Slide Whoosh",
    "data", "slide",
    ["smooth", "data", "movement", "professional"],
    [300, 600], 2, "neutral",
    ["bar chart bar growing", "graph line extending", "data point appearing"],
    ["data", "diagram_build", "infographic_step"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 500, defaultGain: 0.35 }
  ),

  asset("data_emphasis",
    "Data Emphasis Hit",
    "data", "hit",
    ["punch", "emphasis", "key", "stat"],
    [200, 400], 3, "dark",
    ["key statistic emphasized", "big number slam", "stat punch"],
    ["number_reveal", "text_slam", "data"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 130, defaultGain: 0.6 }
  ),

  // ═══════════════════════════════════════════════════════════════════════════════
  // 7. TRANSITION — Transitions, zooms, movement
  // ═══════════════════════════════════════════════════════════════════════════════

  asset("transition_wipe",
    "Wipe Swoosh",
    "transition", "swoosh",
    ["directional", "wipe", "slide", "clean"],
    [300, 600], 3, "neutral",
    ["wipe transition", "slide transition", "text sliding in/out"],
    ["wipe_transition", "scene_transition"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 400, defaultGain: 0.5 }
  ),

  asset("transition_soft",
    "Soft Fade Transition",
    "transition", "fade",
    ["gentle", "fade", "smooth", "passage"],
    [400, 800], 1, "warm",
    ["soft dissolve between scenes", "gentle passage", "dreamy cut"],
    ["scene_transition", "wipe_transition"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 400, defaultGain: 0.3 }
  ),

  asset("transition_punch",
    "Zoom Punch Whoosh",
    "transition", "zoom",
    ["fast", "zoom", "push", "dynamic"],
    [300, 500], 3, "neutral",
    ["quick zoom punch", "push-in emphasis", "dynamic zoom-through"],
    ["zoom_punch", "zoom_through"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 400, defaultGain: 0.45 }
  ),

  asset("transition_cut",
    "Cut Sting",
    "transition", "sting",
    ["short", "cut", "sharp", "jump"],
    [50, 150], 2, "sharp",
    ["hard cut emphasis", "jump cut marker", "quick scene change"],
    ["scene_transition", "text_exit"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 2000, defaultGain: 0.35 }
  ),

  // ═══════════════════════════════════════════════════════════════════════════════
  // 8. REVEAL — Icons, diagrams, infographic reveals
  // ═══════════════════════════════════════════════════════════════════════════════

  asset("reveal_icon",
    "Icon Reveal Pop",
    "reveal", "pop",
    ["positive", "appear", "icon", "clean"],
    [100, 250], 2, "bright",
    ["icon appearing on screen", "infographic icon entry", "check icon reveal"],
    ["icon_appear", "infographic_step"],
    true, null, { source: GENERATED, duckDb: 10, highPassHz: 1000, defaultGain: 0.5 }
  ),

  asset("reveal_diagram",
    "Diagram Build Sweep",
    "reveal", "sweep",
    ["building", "progressive", "diagram", "professional"],
    [400, 800], 2, "neutral",
    ["chart building element by element", "graph building up", "flow chart step"],
    ["diagram_build", "infographic_step", "data"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 400, defaultGain: 0.35 }
  ),

  asset("reveal_step",
    "Infographic Step",
    "reveal", "step",
    ["sequential", "step", "process", "building"],
    [200, 400], 2, "neutral",
    ["numbered list item appearing", "process step entering", "bullet point"],
    ["infographic_step", "progress_step"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 1000, defaultGain: 0.35 }
  ),

  asset("reveal_magnifier",
    "Magnifier / Focus",
    "reveal", "magnifier",
    ["zooming", "focus", "detail", "attention"],
    [200, 500], 2, "bright",
    ["detail being magnified", "focus area highlighting", "close-up reveal"],
    ["icon_appear", "word_highlight", "reveal_moment"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 800, defaultGain: 0.4 }
  ),

  // ═══════════════════════════════════════════════════════════════════════════════
  // 9. CTA — CTA and logo endings
  // ═══════════════════════════════════════════════════════════════════════════════

  asset("cta_bell",
    "CTA Bell",
    "cta", "bell",
    ["inviting", "clear", "action", "prompt"],
    [300, 600], 3, "bright",
    ["CTA appearing", "registration prompt", "subscribe button", "key takeaway"],
    ["cta_appear", "logo_reveal"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 600, defaultGain: 0.5 }
  ),

  asset("cta_success",
    "CTA Success Chime",
    "cta", "chime",
    ["positive", "complete", "success", "rewarding"],
    [200, 500], 3, "bright",
    ["positive result after CTA", "completion confirmation", "success state"],
    ["cta_appear", "success_event"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 600, defaultGain: 0.5 }
  ),

  asset("cta_logo",
    "Logo Reveal",
    "cta", "logo",
    ["premium", "branding", "confident", "swoosh"],
    [500, 1200], 4, "neutral",
    ["logo appearing at end", "brand stamp", "closing identity"],
    ["logo_reveal"],
    true, null, { source: GENERATED, duckDb: 4, highPassHz: 400, defaultGain: 0.55 }
  ),

  asset("cta_attention",
    "Attention Pull",
    "cta", "attention",
    ["pulling", "focused", "clear", "direct"],
    [200, 400], 3, "bright",
    ["pulling attention to CTA", "directional cue", "focus puller"],
    ["cta_appear"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 1000, defaultGain: 0.45 }
  ),

  // ═══════════════════════════════════════════════════════════════════════════════
  // 10. AMBIENCE — Ambient textures and subtle background accents
  // ═══════════════════════════════════════════════════════════════════════════════

  asset("ambience_room",
    "Room Tone",
    "ambience", "room",
    ["neutral", "silence", "space", "background"],
    [2000, 5000], 1, "neutral",
    ["filling silence gaps", "room ambience bed", "background texture"],
    ["background_accent"],
    true, null, { source: GENERATED, duckDb: 0, highPassHz: 0, defaultGain: 0.08 }
  ),

  asset("ambience_pulse",
    "Subtle Pulse",
    "ambience", "pulse",
    ["underlying", "pulse", "rhythm", "subtle"],
    [1000, 3000], 1, "warm",
    ["underlying pulse during talking head", "breathing room", "subtle presence"],
    ["background_accent"],
    true, null, { source: GENERATED, duckDb: 0, highPassHz: 0, defaultGain: 0.06 }
  ),

  asset("ambience_texture",
    "Texture Bed",
    "ambience", "texture",
    ["atmospheric", "depth", "space", "roomy"],
    [3000, 8000], 1, "warm",
    ["filling negative space", "atmospheric bed", "depth under speech"],
    ["background_accent"],
    true, null, { source: GENERATED, duckDb: 0, highPassHz: 80, defaultGain: 0.05 }
  ),

  // ═══════════════════════════════════════════════════════════════════════════════
  // 11. ACCENT — Light comedic and playful accents (corporate-appropriate only)
  // ═══════════════════════════════════════════════════════════════════════════════

  asset("accent_playful",
    "Playful Accent",
    "accent", "playful",
    ["light", "fun", "positive", "sparkle"],
    [100, 300], 2, "bright",
    ["light moment in video", "friendly emphasis", "positive surprise"],
    ["word_highlight", "playful_note"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 1000, defaultGain: 0.35 }
  ),

  asset("accent_rise",
    "Rise Accent",
    "accent", "rise",
    ["upbeat", "rising", "positive", "hopeful"],
    [150, 400], 2, "bright",
    ["positive turn in story", "upbeat moment", "good news reveal"],
    ["success_event", "celebration", "reveal_moment"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 800, defaultGain: 0.35 }
  ),

  asset("accent_chime",
    "Accent Chime",
    "accent", "chime",
    ["delightful", "light", "warm", "pleasant"],
    [200, 500], 2, "warm",
    ["pleasant discovery", "nice to know moment", "warm emphasis"],
    ["word_highlight", "word_emphasis", "success_event"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 800, defaultGain: 0.35 }
  ),

  // ═══════════════════════════════════════════════════════════════════════════════
  // 12. CINEMATIC — Cinematic and emotional accents
  // ═══════════════════════════════════════════════════════════════════════════════

  asset("cinematic_rise",
    "Cinematic Rise",
    "cinematic", "rise",
    ["epic", "building", "grand", "emotional"],
    [2000, 5000], 3, "dark",
    ["emotional build-up", "story climax approach", "grand reveal"],
    ["emotional_peak", "reveal_moment", "text_slam"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 200, defaultGain: 0.2 }
  ),

  asset("cinematic_emote",
    "Emotional Hit",
    "cinematic", "hit",
    ["emotional", "weighty", "serious", "impact"],
    [300, 700], 3, "dark",
    ["emotional statement", "serious point landing", "personal moment"],
    ["emotional_peak", "reflection", "word_emphasis"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 130, defaultGain: 0.5 }
  ),

  asset("cinematic_drift",
    "Cinematic Drift",
    "cinematic", "drift",
    ["floating", "ethereal", "deep", "spacious"],
    [3000, 6000], 2, "warm",
    ["transitional drift", "reflection moment", "story pause"],
    ["reflection", "scene_transition", "emotional_peak"],
    true, null, { source: GENERATED, duckDb: 4, highPassHz: 80, defaultGain: 0.12 }
  ),

  asset("cinematic_sting",
    "Cinematic Sting",
    "cinematic", "sting",
    ["short", "punchy", "dramatic", "emphasis"],
    [100, 300], 3, "dark",
    ["dramatic punctuation", "emphasis moment", "story beat"],
    ["text_slam", "word_emphasis", "emotional_peak"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 300, defaultGain: 0.5 }
  ),

  // ═══════════════════════════════════════════════════════════════════════════════
  // 13. REVERSE — Reverse whooshes and transition tails
  // ═══════════════════════════════════════════════════════════════════════════════

  asset("reverse_whoosh",
    "Reverse Whoosh",
    "reverse", "reverse",
    ["reverse", "sucking", "retreating", "smooth"],
    [400, 800], 3, "neutral",
    ["element pulling back", "reverse zoom out", "text retreating"],
    ["zoom_punch", "text_exit", "wipe_transition"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 400, defaultGain: 0.4 }
  ),

  asset("reverse_swoosh",
    "Reverse Swoosh",
    "reverse", "reverse",
    ["large", "sucking", "scene", "retreat"],
    [500, 1000], 3, "dark",
    ["scene pulling away", "large reverse transition", "exit sweep"],
    ["scene_transition", "wipe_transition"],
    true, null, { source: GENERATED, duckDb: 6, highPassHz: 300, defaultGain: 0.45 }
  ),

  asset("reverse_tail",
    "Reverse Tail",
    "reverse", "tail",
    ["ending", "tail", "fade", "trailing"],
    [300, 600], 1, "warm",
    ["end of transition tail", "exit trail", "departure trail"],
    ["text_exit", "scene_transition"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 400, defaultGain: 0.3 }
  ),

  // ═══════════════════════════════════════════════════════════════════════════════
  // 14. NOTIFICATION — Gentle notification and confirmation sounds
  // ═══════════════════════════════════════════════════════════════════════════════

  asset("notification_soft",
    "Soft Notification",
    "notification", "notification",
    ["gentle", "informative", "soft", "clean"],
    [200, 400], 1, "warm",
    ["gentle alert", "soft notification", "informative nudge"],
    ["notification", "success_event"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 1000, defaultGain: 0.35 }
  ),

  asset("notification_confirm",
    "Confirmation Ding",
    "notification", "confirm",
    ["positive", "done", "clear", "reassuring"],
    [200, 500], 2, "warm",
    ["action confirmed", "task completed", "positive feedback"],
    ["success_event", "checkmark", "cta_appear"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 800, defaultGain: 0.4 }
  ),

  asset("notification_ding",
    "Notification Ding",
    "notification", "ding",
    ["clean", "informative", "attention", "alert"],
    [150, 400], 2, "bright",
    ["new info appearing", "alert appearing", "update notification"],
    ["notification", "lower_third", "button_appear"],
    true, null, { source: GENERATED, duckDb: 8, highPassHz: 1000, defaultGain: 0.4 }
  ),

  asset("notification_subtle",
    "Subtle Confirm",
    "notification", "confirm",
    ["barely", "there", "micro", "reassurance"],
    [80, 200], 1, "warm",
    ["micro-confirmation", "almost subliminal success", "barely-noticeable feedback"],
    ["checkmark", "progress_step", "success_event"],
    true, null, { source: GENERATED, duckDb: 10, highPassHz: 2000, defaultGain: 0.25 }
  ),
];

// ─── Category Metadata ─────────────────────────────────────────────────────────

export const CATEGORY_META: Record<SfxCategory, { label: string; description: string; icon: string }> = {
  whoosh:        { label: "Whooshes",         description: "Soft whooshes and airy sweeps",                    icon: "💨" },
  impact:        { label: "Impacts",           description: "Text slams and premium impacts",                   icon: "💥" },
  ui:            { label: "UI Sounds",         description: "Clicks, ticks, taps, and subtle pops",            icon: "🖱️" },
  highlight:     { label: "Highlights",        description: "Keyword highlights and markers",                  icon: "✨" },
  riser:         { label: "Risers",            description: "Smooth risers and tonal accents",                 icon: "📈" },
  data:          { label: "Data Sounds",       description: "Number counters and data reveals",                icon: "📊" },
  transition:    { label: "Transitions",       description: "Transitions, zooms, and movement",                icon: "🔄" },
  reveal:        { label: "Reveals",           description: "Icons, diagrams, and infographic reveals",         icon: "🖼️" },
  cta:           { label: "CTA & Logos",       description: "CTA and logo endings",                            icon: "🎯" },
  ambience:      { label: "Ambience",          description: "Ambient textures and subtle backgrounds",         icon: "🌊" },
  accent:        { label: "Accents",           description: "Light comedic and playful accents",               icon: "🎵" },
  cinematic:     { label: "Cinematic",         description: "Cinematic and emotional accents",                 icon: "🎬" },
  reverse:       { label: "Reverse",           description: "Reverse whooshes and transition tails",           icon: "⏪" },
  notification:  { label: "Notifications",     description: "Gentle notification and confirmation sounds",     icon: "🔔" },
};

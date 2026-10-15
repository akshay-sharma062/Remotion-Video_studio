# SFX Library — Creator Editing OS

**44 generative sound effects across 14 categories. Zero file dependencies. Full provenance tracking. Dual licensing (free tier + Pro).**

---

## Architecture

```
src/lib/sfx-library/
├── types.ts          # Core types and constants (SfxAsset, VisualEvent, etc.)
├── registry.ts       # All 44 assets with metadata and tags
├── generators.ts     # Web Audio API synthesis for each asset (44 functions)
├── decision.ts       # Event → SFX mapping and search intelligence
├── mixer.ts          # Timing, gain, voice-duck, fade, and WAV generation
├── audit.ts          # Built-in health checks and verification
├── index.ts          # Barrel export
├── script-engine.ts  # ScriptSceneList builder + SFX-CUES.txt generator
└── test.ts           # Verification tests
```

## Key Concepts

### Single Source of Truth

**`registry.ts`** is the single source of truth for:
- Every asset's identity, category, intensity, tonal quality, duration, and gain
- Provenance (free asset, Pro upgrade, or generated)
- Licensing information
- Search tags for each asset

**`generators.ts`** is the single source of truth for:
- Every asset's actual audio synthesis
- Deterministic, frame-accurate output
- No audio files required — all synthesized in real-time

### Asset Categories (14)

| # | Category | Assets | Use Case |
|---|----------|--------|----------|
| 1 | whoosh | 3 | Zoom, slide, airy sweeps |
| 2 | impact | 3 | Text slams, premium hits |
| 3 | ui | 3 | Clicks, taps, confirmations |
| 4 | highlight | 3 | Keyword emphasis, markers |
| 5 | riser | 4 | Tension building, tonal accents |
| 6 | data | 4 | Number counters, reveals |
| 7 | transition | 3 | Scene changes, movement |
| 8 | reveal | 3 | Diagrams, steps, magnifier |
| 9 | cta | 3 | Call-to-action attention |
| 10 | cinematic | 4 | Drama, emotion, sting |
| 11 | reverse | 3 | Reversed movement sounds |
| 12 | accent | 3 | Playful, bright, chime |
| 13 | notification | 3 | Success, confirm, subtle |
| 14 | verification | 3 | Check, audit, quality |

### Event-Driven SFX

The system maps **visual events** to SFX assets automatically:

```
Visual Event ──→ Decision Engine ──→ SFX Asset ──→ WAV
```

Events are defined in the edit blueprint:
- `text_slam` — word hits screen
- `word_highlight` — yellow highlight pops on
- `word_entrance` — word flies in
- `word_exit` — word exits
- `number_reveal` — counter ticks
- `scene_transition` — cut to new scene
- `zoom_punch` — emphasis zoom
- `success_event` — positive outcome
- `icon_appear` — icon pops in
- `cta_appear` — CTA appears

### Mixing Pipeline

1. **Timing** — SFX placed at exact frames with configurable lead time
2. **Gain** — Each asset has a default gain (dB), overridable per-cue
3. **Voice Ducking** — SFX ducks under dialogue (default: -6 dB when voice present)
4. **Fades** — Configurable fade-in/fade-out (default: 0ms / 0ms)
5. **High-Pass Filter** — Optional HPF to clean low-end (default: 130 Hz)
6. **Peak Normalization** — Normalize to target peak (default: -6 dBFS)
7. **AAC Encode** — Final encode at 256 kbps

### Generators

Every asset is synthesized using **Web Audio API primitives**:
- Oscillator nodes (sine, triangle, noise)
- Gain envelopes (ADSR)
- Filter sweeps (lowpass, highpass, bandpass)
- Frequency modulation for tonal sounds
- White noise for whooshes
- Delay lines for spatial effects

Generators are **deterministic** — no `Math.random()`. Use `random(seed)` pattern.

### Provenance & Licensing

Each asset tracks:
- `provenance`: `"library_generated"` | `"free"` | `"pro"` | `"custom"`
- `license`: License text or URL
- `attribution`: Required attribution for free assets
- `upgrade`: Which Pro asset to use instead (if applicable)

---

## Usage

### Basic: Auto-select SFX for an Event

```typescript
import { selectSfxForEvent } from "@/lib/sfx-library";

const decision = selectSfxForEvent("text_slam", "heavy");
// decision.asset = { id: "impact_heavy_01", name: "Heavy Impact", ... }
// decision.reason = "Direct match: heavy impact for text slam"
// decision.confidence = "high"
```

### Search the Library

```typescript
import { searchLibrary } from "@/lib/sfx-library";

const results = searchLibrary({
  category: "whoosh",
  intensity: "medium",
  tonal: false,
  maxResults: 5,
});
```

### Generate an Audition WAV

```typescript
import { SfxLibraryAudition } from "@/lib/sfx-library";

const audition = new SfxLibraryAudition("whoosh");
await audition.generate();
// → public/sfx-library/whoosh/audition-whoosh.wav
```

### Build the Script Scene List

```typescript
import { buildSceneList } from "@/lib/sfx-library/script-engine";

const script = buildSceneList({
  scenes: [
    {
      name: "SIGNIFICANTLY MORE",
      from: 0,
      to: 160,
      actions: [
        { type: "slam", frame: 88, intensity: "heavy", sfx: "impact_heavy_01" },
        { type: "word_highlight", frame: 95, intensity: "medium" }, // auto-select
      ],
    },
  ],
});
```

### Render SFX WAV + SFX-CUES.txt

```typescript
import { generateSfxWav, generateSfxCuesTxt } from "@/lib/sfx-library/script-engine";

// Generate WAV
const result = await generateSfxWav(script);
// → work/sfx/sfx.wav

// Generate cues file
const cuesTxt = generateSfxCuesTxt(script);
// → write to file
```

---

## Verification

```bash
# Type check
npx tsc --noEmit

# Run tests
npx tsx src/lib/sfx-library/test.ts

# Build audition files
npx tsx scripts/build-sfx-library.ts

# Audit library health
npx tsx -e "
  import { auditLibrary } from './src/lib/sfx-library/audit';
  const report = auditLibrary();
  console.log(report);
"
```

---

## Dual Licensing

### Free Tier (all 44 assets)
- All 44 assets are available in the free tier
- Attribution required in video description
- Non-exclusive, worldwide license

### Pro Tier
- Premium variants of key assets
- No attribution required
- Extended commercial license
- Updated via the Library Manager

The `SfxLibraryManager` handles license checks and asset updates.

---

## Design Decisions

### Why generative instead of audio files?
- **No file management** — no need to store, organize, or version audio files
- **Exact timing** — synthesis starts at precise frames, no drift
- **Parameter control** — duration, gain, and character are adjustable per-render
- **Size** — ~2KB per asset vs ~100KB+ per WAV

### Why 14 categories instead of one flat list?
- Search is faster (filter by category first)
- Group audition makes sense (whoosh/whoosh/whoosh)
- Mixing can apply category-wide rules (e.g., all impacts ducked harder)

### Why deterministic synthesis?
- `Math.random()` would produce different sounds each render — confusing for edits
- Seed-based randomness ensures repeatable results
- Easier to audit: same input = same output

---

## Files Changed (this implementation)

| File | Action | Description |
|------|--------|-------------|
| `src/lib/sfx-library/types.ts` | **CREATED** | 15 core types, constants, version |
| `src/lib/sfx-library/registry.ts` | **CREATED** | 44 assets, 14 categories |
| `src/lib/sfx-library/generators.ts` | **CREATED** | 44 synthesis functions |
| `src/lib/sfx-library/decision.ts` | **CREATED** | Search, select, decide |
| `src/lib/sfx-library/mixer.ts` | **CREATED** | Timing, gain, duck, WAV render |
| `src/lib/sfx-library/audit.ts` | **CREATED** | Verification and health checks |
| `src/lib/sfx-library/index.ts` | **CREATED** | Barrel export |
| `src/lib/sfx-library/script-engine.ts` | **CREATED** | Scene list builder + cues generator |
| `src/lib/sfx-library/test.ts` | **CREATED** | Generator verification |
| `src/lib/sfx/index.ts` | **CREATED** | Legacy re-export bridge |
| `src/lib/sfx.ts` | **CREATED** | SFX namespace bridge |
| `scripts/build-sfx-library.ts` | **CREATED** | WAV batch generator |
| `public/sfx-library/` | **CREATED** | Output directory (gitignored) |

---

## Next Steps

1. Run `npx tsx scripts/build-sfx-library.ts` to generate audition WAVs
2. Listen to each category and tune the generators
3. Add timing integration with the Pipeline's EditBlueprint → TimedSfxEvent
4. Replace inline SFX instructions in Pipeline/Render with ScriptEngine calls
5. Add Studio UI for auditioning and selecting SFX per-scene

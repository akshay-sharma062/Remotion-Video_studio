# HyperFrames Knowledge Map

**Source:** https://github.com/heygen-com/hyperframes
**Studied:** 2026-10-09
**Purpose:** Understanding HyperFrames architecture and concepts for integration into the Creator Editing OS.

---

## What HyperFrames Is

HyperFrames is HeyGen's AI-powered video editing system built on Remotion. It uses a **skills-based architecture** where individual AI skills handle specific editing tasks (captions, talking-head recut, motion graphics, audio, keyframes, etc.). Skills are registered in a manifest and composed into an editing pipeline.

**Core architectural concepts:**
- Skills are isolated, composable modules
- Each skill has a manifest describing inputs/outputs
- Skills communicate via a registry system
- The system is designed for AI agents to execute editing workflows
- Reference-driven editing is a first-class concept (editing style extracted from reference video)

---

## 1. Video Composition
**HyperFrames approach:** Declarative Remotion compositions. Skills generate composition code from structured events.
**Our system:** Same — Remotion with declarative React. Already have this.
**Verdict: ALREADY HAVE**

## 2. Timeline Architecture
**HyperFrames approach:** Frame-driven timeline with Sequence elements. Events are timestamped and placed precisely.
**Our system:** Same pattern — Sequence-based scene architecture with zero overlap.
**Verdict: ALREADY HAVE**

## 3. Scene Architecture
**HyperFrames approach:** Scenes are independent units with explicit start/end frames. No overlapping Sequences.
**Our system:** SCENES array with `from`/`to` frame boundaries, zero overlap.
**Verdict: ALREADY HAVE**

## 4. Animation
**HyperFrames approach:** Composed easings, spring physics, overshoot, bounce. Motion tokens as constants.
**Our system:** `src/design/motion.ts` — composed easings, OVERSHOOT, tween, EASE_OUT/EASE_IN/EASE_IN_OUT, readableHold, motionBlur. 12 motion laws.
**Verdict: ALREADY HAVE** (comparable to HyperFrames)

## 5. Keyframes
**HyperFrames approach:** Keyframe-based animation with interpolate. Supports cubic-bezier easing per keyframe.
**Our system:** `interpolate` from Remotion with our composed easings. No dedicated keyframe manager yet.
**Verdict: KEEP (our approach is simpler and works)**

## 6. Transitions
**HyperFrames approach:** fade, dissolve, wipe, zoom-through. Transition events in the edit blueprint.
**Our system:** `ClipTransition`, `BeatCutTransition`, `ClipTransitionIn` components. Types: fade, dissolve, wipe-left, wipe-right, zoom-through.
**Verdict: ALREADY HAVE** (same transition types)

## 7. Captions
**HyperFrames approach:** Word-by-word captions with active word highlighting. 7-word rolling window. Positioned at bottom safe zone.
**Our system:** `CaptionBar` — 7-word rolling window, active word yellow+bold+scale(1.08), past words white+opacity(0.6). Bottom safe zone.
**Verdict: ALREADY HAVE** (slightly more advanced: our active highlighting is better)

## 8. Talking-Head Editing
**HyperFrames approach:** `talking-head-recut` skill — automatic recut of talking head videos with emphasis detection, zoom punches, graphics at emphasis words.
**Our system:** `RawAnalyzer` detects emphasis words, natural cuts, face region, safe zones. `MappingEngine` maps reference effects. `Presence` component for entrance/exit.
**Verdict: ALREADY HAVE** (foundation exists, needs the decision engine from Phase 6)

## 9. Graphic Overlays
**HyperFrames approach:** Arrow, icon, card, diagram, split-screen, text-overlay, puzzle, magnifier. GraphicEvent schema.
**Our system:** `TitleCard`, `LocationLabel`, `ScreenView`, `BrowserWindow`, `RollingNumber`, `HighlightMark`, `Pointer`, `MaskReveal`, `Button`, `Card`, `Input`, `StatusIndicator`, `EmptyState`.
**Verdict: HAVE MORE COMPONENTS** (we have more built components)

## 10. Lower Thirds
**HyperFrames approach:** Lower third as a graphic type with slide-in animation.
**Our system:** No dedicated lower third component. `LocationLabel` is similar but not a full lower third.
**Verdict: ADAPT** (build a dedicated LowerThird component based on HyperFrames pattern)

## 11. Data Callouts
**HyperFrames approach:** Data cards, numbers with animation, callout arrows.
**Our system:** `RollingNumber`, `Card`, `HighlightMark`.
**Verdict: ALREADY HAVE** (could extend with more data visualization patterns)

## 12. Picture-in-Picture
**HyperFrames approach:** PIP as a graphic type with its own safe zone.
**Our system:** No PIP component.
**Verdict: ADAPT** (build PIP component for reference-style overlay)

## 13. Media Handling
**HyperFrames approach:** Centralized asset management via `projectAssets()` helper. Public directory as asset root.
**Our system:** `src/lib/assets.ts` — `projectAssets()`, `projectFootage()`, `projectBroll()`, `projectScreenshots()`, `projectAudio()`. Exactly the same pattern.
**Verdict: ALREADY HAVE**

## 14. Audio Mixing
**HyperFrames approach:** Separate tracks: voice, music, SFX, ambience. Submix support. Ducking automation. Voiceover carve.
**Our system:** `src/lib/audio.ts` — basic. `gen-sfx.py` — basic SFX generation with ducking (-6dB), high-pass (130Hz). No track separation or submix.
**Verdict: ADAPT** (need proper track-based audio mixing with submix, ducking automation)

## 15. SFX
**HyperFrames approach:** SFX events in edit blueprint with lead time, ducking, high-pass. Categories: whoosh, hit, pop, click, swoosh, ding, snap, transition, emphasis. SFX registry with metadata.
**Our system:** `gen-sfx.py` generates whoosh/hit/ding programmatically. `SfxEvent` in edit-blueprint. No SFX registry/manifest.
**Verdict: ADAPT** (need SFX registry with metadata, proper asset-based SFX, more categories)

## 16. Ducking
**HyperFrames approach:** Automatic ducking of SFX/music under voice. Configurable dB reduction. Speech-gap detection.
**Our system:** Fixed -6dB ducking in gen-sfx.py. No speech-gap-aware ducking.
**Verdict: ADAPT** (need speech-gap-aware ducking, configurable levels)

## 17. Voiceover Carve
**HyperFrames approach:** Extract voice track from mixed audio. Preserve original voice untouched.
**Our system:** `canonical.wav` as voice source. One gain change, one AAC encode at 256k.
**Verdict: ALREADY HAVE** (same philosophy)

## 18. Automation
**HyperFrames approach:** Automated editing decisions based on reference style and speech content. AI agents execute the pipeline.
**Our system:** `ReferenceAnalyzer`, `RawAnalyzer`, `MappingEngine` — basic automation. No AI-driven decision engine.
**Verdict: ADAPT** (this is the core of what we need to build)

## 19. Motion Graphics
**HyperFrames approach:** Dedicated `motion-graphics` skill. Primitives: slam, overshoot, bounce, scale punch, fade, slide, wipe, blur-in, zoom-through, text swap, word highlight, counter, diagram reveal, icon pop, CTA reveal.
**Our system:** `OvershootSlam`, `KineticSwap`, `Presence`, `HighlightMark`, `Stage` (zoom-through), `Transition`. Missing: bounce, counter, diagram reveal, icon pop, CTA reveal, blur-in/out.
**Verdict: ADAPT** (add missing motion primitives)

## 20. Safe Zones
**HyperFrames approach:** 9:16 safe zones with explicit bounding boxes for text, graphics, face regions.
**Our system:** `tokens.safeZones` in tokens.ts. `RawAnalyzer.safeZones`. `RawAnalyzer.faceRegion`. Bounding box collision system planned.
**Verdict: ALREADY HAVE**

## 21. Studio/Review
**HyperFrames approach:** Studio integration for review and feedback. Contact sheets for visual inspection.
**Our system:** Contact frames from `ReferenceAnalyzer.extractContactFrames()`. Manual review via Remotion Studio.
**Verdict: ALREADY HAVE** (basic)

## 22. Validation
**HyperFrames approach:** Render stills at key frames, verify text doesn't cover face, safe zone checks.
**Our system:** Manual verification at frames 0/60/120/186/240/400. Safe zone checks.
**Verdict: ALREADY HAVE** (manual)

## 23. Rendering
**HyperFrames approach:** 2x render with Lanczos3 downscale. Native frame rate. Remotion render pipeline.
**Our system:** Same in CLAUDE.md rules. 2x size + Lanczos3 downscale.
**Verdict: ALREADY HAVE**

## 24. Asset Management
**HyperFrames approach:** Centralized asset registry. SFX library, graphic templates, reference clips.
**Our system:** `projectAssets()` helper. Asset folders per project. No central SFX registry.
**Verdict: PARTIAL** (need SFX registry)

## 25. Reference-Driven Editing
**HyperFrames approach:** Extract editing language from reference video. Annotate reference moments. Map reference events to raw video.
**Our system:** `ReferenceAnalyzer` → `EditBlueprint` → `MappingEngine` → mapped blueprint. `references.md` annotation format. Python pipeline scripts.
**Verdict: ALREADY HAVE** (strong foundation, needs decision intelligence)

---

## Summary

| Category | Verdict | Gap |
|---|---|---|
| Video Composition | ALREADY HAVE | — |
| Timeline Architecture | ALREADY HAVE | — |
| Scene Architecture | ALREADY HAVE | — |
| Animation | ALREADY HAVE | Comparable |
| Keyframes | KEEP | No dedicated keyframe manager |
| Transitions | ALREADY HAVE | — |
| Captions | ALREADY HAVE | Slightly more advanced |
| Talking-Head Editing | ADAPT | Need decision engine |
| Graphic Overlays | HAVE MORE | — |
| Lower Thirds | ADAPT | Need component |
| Data Callouts | ALREADY HAVE | Could extend |
| Picture-in-Picture | ADAPT | Need component |
| Media Handling | ALREADY HAVE | — |
| Audio Mixing | ADAPT | Need submix, ducking automation |
| SFX | ADAPT | Need registry, more categories |
| Ducking | ADAPT | Need speech-gap-aware |
| Voiceover Carve | ALREADY HAVE | — |
| Automation | ADAPT | Core gap — need AI decision engine |
| Motion Graphics | ADAPT | Missing primitives |
| Safe Zones | ALREADY HAVE | — |
| Studio/Review | ALREADY HAVE | Basic |
| Validation | ALREADY HAVE | Manual |
| Rendering | ALREADY HAVE | — |
| Asset Management | PARTIAL | Need SFX registry |
| Reference-Driven Editing | ALREADY HAVE | Strong foundation |

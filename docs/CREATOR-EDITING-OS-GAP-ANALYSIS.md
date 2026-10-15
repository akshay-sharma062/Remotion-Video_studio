# Creator Editing OS — Gap Analysis

**Compared against:** HyperFrames (HeyGen)
**Date:** 2026-10-09
**Purpose:** Identify what we have, what we're missing, and what to integrate.

---

## What Our System Does Better

1. **Stronger visual design system** — We have a complete design token system (tokens.ts), type scales for both 9:16 and 16:9, colour system, shadows, radii. HyperFrames has none of this.

2. **More components built** — We have 20+ production components (Button, Card, Input, StatusIndicator, EmptyState, BrowserWindow, RollingNumber, TitleCard, LocationLabel, etc.). HyperFrames is skill definitions, not built components.

3. **Better transcript foundation** — Our `transcript.json` is the single source of truth. Every word has exact timestamps. Captions derive from it. HyperFrames uses whatever transcription service is available.

4. **Complete motion law system** — We have 12 explicit motion laws, smoothness rules, and a motion token system. HyperFrames has easing and springs but no explicit law system.

5. **Audio standard** — Our CLAUDE.md defines precise audio specs: −14 LUFS, −1 dB true peak, 256k AAC, 6dB SFX duck, 130Hz high-pass. HyperFrames has general audio concepts but no specific standards.

6. **Safe zone precision** — Our system uses exact pixel values (top 250px, bottom 420px for 9:16) with bounding box collision detection planned. HyperFrames uses percentages.

---

## What HyperFrames Does Better

1. **AI-driven editing decisions** — HyperFrames has AI agents that decide when to add effects, where to place graphics, which words to highlight. Our system has rule-based mapping only.

2. **Skills registry** — HyperFrames has a manifest-driven skill registration system. Skills are isolated, testable, composable. Our system has modules but no registry.

3. **SFX intelligence** — HyperFrames maps events to SFX categories (whoosh/hit/pop/click/swoosh/ding/snap) with lead time, ducking, and fade. We have hardcoded SFX events.

4. **Talking-head recut** — HyperFrames has a dedicated skill for automatic talking-head recutting with emphasis detection, zoom punches, and graphic insertion. We have the foundation but not the decision intelligence.

5. **Audio submix architecture** — HyperFrames supports separate voice/music/SFX/ambience tracks with submix control. We have a single voice track.

6. **Automated validation** — HyperFrames has automated frame inspection and validation. We have manual checks.

---

## What We Are Missing

### Critical (blocking reference-driven editing at scale)
1. **Edit Decision Engine** — The core intelligence that decides WHICH effects to apply WHERE. Currently we manually specify every effect.
2. **SFX Registry** — No manifest of available SFX assets with metadata. The system invents SFX paths.
3. **SFX Decision Engine** — No logic for choosing SFX type, timing, volume, fade based on event type.
4. **Motion Primitive Library** — Missing: bounce, counter, diagram reveal, icon pop, CTA reveal, blur-in/out primitives.

### Important (needed for production quality)
5. **Audio Submix System** — No voice/music/SFX/ambience separation.
6. **Speech-Gap-Aware Ducking** — Fixed -6dB ducking instead of gap-aware.
7. **Lower Third Component** — No dedicated component.
8. **Picture-in-Picture Component** — No PIP support.
9. **Automated Quality Check** — Manual frame inspection only.
10. **Reference Style Engine** — No system for extracting and storing a reference's editing language as reusable patterns.

### Nice to Have
11. **Keyframe Manager** — For complex multi-property animations.
12. **B-Roll Manager** — For managing B-roll assets and insertion points.
13. **Diagram/Data Visualization Primitives** — For corporate/educational content.
14. **Beat Detection Integration** — For music-synced editing.

---

## What Should Be Integrated (from HyperFrames)

### Integrate Directly
- **Skills registry pattern** — Adapt to our module architecture
- **SFX event schema** — Extend our existing SfxEvent with HyperFrames categories
- **Audio submix concept** — Adapt to our existing audio.ts
- **Speech-gap detection** — Already in RawAnalyzer, need to use it for ducking
- **Reference style extraction** — Extend our ReferenceAnalyzer patterns

### Adapt and Extend
- **Motion primitives** — Build as React components in src/components/ using our motion.ts
- **Talking-head decision engine** — Build as src/lib/editing-intelligence/edit-decision-engine.ts
- **SFX registry** — Build as JSON manifest + TypeScript types
- **Automated validation** — Build on our existing frame verification workflow

### Do NOT Integrate
- HyperFrames' AI agent orchestration (we use direct function calls, not agents)
- HyperFrames' prompt-based skill execution (we use TypeScript)
- HyperFrames' Remotion-to-HyperFrames bridge (we ARE Remotion)
- HyperFrames' media-use skill (we have our own asset management)
- HyperFrames' studio integration (we use Remotion Studio)

### Keep Remotion-Specific
- All our Remotion components (AbsoluteFill, Sequence, interpolate, useCurrentFrame)
- Our 12 motion laws
- Our frame-driven animation approach (no CSS transitions)
- Our 2x render + Lanczos3 downscale pipeline

---

## Architecture Recommendations

```
src/lib/editing-intelligence/
├── edit-decision-engine.ts    ← CORE: decides what effects to apply
├── sfx/
│   ├── sfx-registry.ts        ← SFX asset manifest + metadata
│   ├── sfx-decision.ts        ← Event → SFX mapping
│   └── sfx-mixer.ts           ← Track mixing + ducking
├── motion/
│   ├── motion-primitives.ts   ← Reusable animation primitives
│   └── motion-decision.ts     ← When to use which primitive
├── audio/
│   ├── audio-mixer.ts         ← Submix system
│   └── ducking-engine.ts      ← Speech-gap-aware ducking
├── captions/
│   └── caption-decision.ts    ← When/where/how to show captions
├── graphics/
│   └── graphic-decision.ts    ← When to add overlays, lower thirds, PIP
├── reference/
│   └── style-engine.ts        ← Extract + apply reference editing style
├── quality/
│   └── quality-check.ts       ← Automated frame verification
└── index.ts                   ← Public API
```

# STYLE.md — Creator house style

This file grows with you. Every effect you approve or reject gets added here.
`CLAUDE.md` rules override everything here except your direct instructions.

---

## Identity

| Item | Value |
|---|---|
| Brand | VideoStudio / Creator Editing OS |
| Font family | Inter (Google Fonts, SIL OFL — free for commercial use) |
| Weights used | 400 regular, 500 medium, 600 semibold, 700 bold |
| Primary accent | `#FF4D2D` — one signature colour, used sparingly |
| Background | Warm off-white `#F8F7F4` |
| Surface | `#FFFFFF` |
| Text primary | Near-black `#1A1A1A` |
| Text secondary | `#6B6B6B` |
| Status green | `#16A34A` success |
| Status amber | `#D97706` warning |
| Status red | `#DC2626` error |
| Caption text | White `#FFFFFF` |
| Caption shadow | Soft dark `rgba(0,0,0,0.55)` |

**Emphasis style:** HighlightMark — an accent-coloured bar wipes in behind the key phrase. One accent, one motion, used only on the 2–3 most important words per scene. Everything else is plain type.

**Numbers:** Rolling digit-by-digit animation. No ticking.

---

## Type scale

All text uses Inter. Sizes are in pixels.

### 9:16 (1080×1920)

| Role | Size | Weight | Line height | Notes |
|---|---|---|---|---|
| Hero word | 180 | 700 | 1.0 | Single impactful word |
| Headline | 100 | 700 | 1.1 | Main title, letter spacing -0.02em |
| Big number | 150 | 600 | 1.0 | Rolling counters, tabular-nums |
| Label | 32 | 500 | 1.3 | Uppercase, wide tracking 0.1em |
| Caption | 42 | 600 | 1.2 | Word-by-word captions |
| Body | 20 | 400 | 1.5 | Long-form text |

### 16:9 (1920×1080)

| Role | Size | Weight | Line height | Notes |
|---|---|---|---|---|
| Hero word | 260 | 700 | 1.0 | Single impactful word |
| Headline | 116 | 700 | 1.1 | Main title, letter spacing -0.02em |
| Big number | 170 | 600 | 1.0 | Rolling counters |
| Label | 40 | 500 | 1.3 | Uppercase, wide tracking 0.1em |
| Caption | 46 | 600 | 1.2 | Word captions |
| Body | 22 | 400 | 1.5 | Long-form text |

**Rules:**
- Never use more than 2 type sizes in one composition.
- Headlines never wrap to more than 2 lines.
- Numbers use `fontVariantNumeric: "tabular-nums"` for clean digit animation.
- Caption text: white fill + dark shadow. Never plain white on bright footage.

---

## Layout

- 4px base grid for all spacing.
- Corner radius: 8px tags, 12px standard, 24px large, 40px hero, full for pills.
- Speaker is full screen by default.
- Text sits in the clear space of the shot, never on top of the speaker's face.
- Safe zones: in 9:16 keep text out of top 250px and bottom 420px.
- Use one accent sparingly. It earns its attention.
- Add shadow before adding borders.

---

## Motion

Frame-driven only (no CSS transitions or animations). All timing from `motion.ts`:
- Entrance: ease-out, scale 0.94→1, translateY 24px, blur 12px→0. Duration 400–800ms.
- Hover: 133ms colour, 267ms shadow/transform.
- Stagger: 100ms between grouped items.
- `prefers-reduced-motion`: swap all easings to instant.

---

## Colour

| Token | Value | Use |
|---|---|---|
| accent | `#FF4D2D` | CTAs, highlights, active states, HighlightMark |
| accentHover | `#E04425` | Hover/focus on accent elements |
| accentMuted | `rgba(255,77,45,0.12)` | Tags, badges, active indicators, HighlightMark bg |
| bg | `#F8F7F4` | Warm off-white canvas |
| surface | `#FFFFFF` | Cards, panels, modals |
| surfaceRaised | `#FFFFFF` | Floating elements, dropdowns |
| surfaceSunken | `#F0EFEA` | Inset areas, disabled inputs |
| text | `#1A1A1A` | Headlines, body, primary text |
| textSecondary | `#6B6B6B` | Labels, hints, secondary text |
| success | `#16A34A` | Checkmarks, render complete, pass states |
| warning | `#D97706` | Alerts, missing footage, attention |
| error | `#DC2626` | Failures, render errors, destructive actions |
| border | `rgba(0,0,0,0.08)` | Dividers, input borders, card edges |
| overlay | `rgba(0,0,0,0.35)` | Backdrops, scrims |
| captionText | `#FFFFFF` | Caption text over footage |
| captionShadow | `rgba(0,0,0,0.55)` | Caption shadow for legibility |

**Contrast notes:**
- `text` on `bg`: 15.2:1 — passes AAA
- `textSecondary` on `bg`: 4.6:1 — passes AA
- `accent` on `surface`: ~3.5:1 — use for large text only (headlines, buttons)
- `success`, `warning`, `error` on `surface`: all pass AA for labels and icons

---

## Approved effects

| Name | What it is | Approved on |
|---|---|---|
| Word-by-word captions | Captions timed to each spoken word | test-clip |
| Zoom-through cut | Push-in centred on jump cut, hides edit | test-clip |
| Rolling number | Digits roll from old to new value | test-clip |
| HighlightMark | Accent bar wipes behind key phrase | DESIGN-SYSTEM.md |
| Selective HighlightMark | Accent bar wipes behind a single operative word within a phrase | references-clip |
| Pivot HighlightMark | Transitional phrase gets a single-word emphasis to signal an argument shift | references-clip |
| Browser mockup | Clean browser frame around a screenshot | test-clip |
| Status indicator | Coloured circle + label for render/process state | DESIGN-SYSTEM.md |
| Headline + emphasis | Large headline with HighlightMark behind key word | DESIGN-SYSTEM.md |
| Stacked headline | Clean multi-line typographic card, no decoration | references-clip |
| Kinetic text swap | Words exit with overshoot while new words enter simultaneously, staggered per word | references-clip |
| Kinetic slam | Text slams in with overshoot bounce and heavy stroke weight | references-clip |
| Card with stat | Surface card with accent left border + big number | DESIGN-SYSTEM.md |
| B-roll illustration | Vector cartoon drops behind speaker without replacing them | references-clip |
| Metaphor icon | Simple vector icon embodying a concept, placed alongside text | references-clip |
| Comparison diagram | Speaker stays visible while a diagram overlays with arrow graphics guiding the eye | references-clip |
| B-roll beat | Speaker exits to full-screen footage for a beat with text overlay | references-clip |
| Word over footage | Single impactful word enters over matching B-roll, timed to entrance | references-clip |
| Empty state | Centered icon + text + optional CTA | DESIGN-SYSTEM.md |
| Pointer click | Arrow glides to a point, clicks with a ripple | *(pending)* |
| Side card | Footage slides into a card beside text | *(pending)* |
| Counter race | Two numbers compete side by side | *(pending)* |
| Colour flip | Background flips between two palette colours | *(pending)* |
| Beat cut | Clips cut on detected music beats | *(pending)* |
| Title card | Clean typographic opening card for montages | *(pending)* |

---

## Rejected

| What | Why | Which video |
|---|---|---|
| *(none yet — add when something doesn't land)* | | |

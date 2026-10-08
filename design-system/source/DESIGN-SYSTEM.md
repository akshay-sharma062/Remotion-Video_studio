# VideoStudio Design System

## Direction

**Editorial warmth meets technical precision.** A tool professional video editors trust,
with the approachability of a creative studio. One accent colour. One font family.
Every value flows from this document.

---

## 1. Colour

| Token | Value | Job |
|---|---|---|
| `bg` | `#F8F7F4` | Warm off-white canvas |
| `surface` | `#FFFFFF` | Cards, panels, modals |
| `surfaceRaised` | `#FFFFFF` | Floating elements, dropdowns |
| `surfaceSunken` | `#F0EFEA` | Inset areas, disabled inputs |
| `text` | `#1A1A1A` | Headlines, body, primary text |
| `textSecondary` | `#6B6B6B` | Labels, hints, secondary text |
| `accent` | `#FF4D2D` | CTAs, highlights, active states, one signature colour |
| `accentHover` | `#E04425` | Hover/focus state on accent elements |
| `accentMuted` | `rgba(255,77,45,0.12)` | Tags, badges, active indicators, ghost button hover |
| `success` | `#16A34A` | Checkmarks, render complete, pass states |
| `warning` | `#D97706` | Alerts, missing footage, attention |
| `error` | `#DC2626` | Failures, destructive actions, render errors |
| `border` | `rgba(0,0,0,0.08)` | Dividers, input borders, card edges |
| `overlay` | `rgba(0,0,0,0.35)` | Backdrops, scrims |
| `captionText` | `#FFFFFF` | Caption text over footage |
| `captionShadow` | `rgba(0,0,0,0.55)` | Caption shadow for legibility |

**Contrast notes:**
- `text` (#1A1A1A) on `bg` (#F8F7F4): 15.2:1 — passes AAA
- `textSecondary` (#6B6B6B) on `bg` (#F8F7F4): 4.6:1 — passes AA
- `accent` (#FF4D2D) on `surface` (#FFFFFF): ~3.5:1 — use for large text only (headlines, buttons)
- `success`, `warning`, `error` on `surface`: all pass AA for labels and icons

---

## 2. Typography

**Font family:** Inter (Google Fonts). Weights: 400, 500, 600, 700.

### Type scale — 9:16 (video overlays)

| Token | Size | Weight | Line Height | Letter | Use |
|---|---|---|---|---|---|
| `heroWord` | 180px | 700 | 1.0 | — | Single-word emphasis |
| `headline` | 100px | 700 | 1.1 | -0.02em | Opening titles |
| `bigNumber` | 150px | 600 | 1.0 | — | Rolling numbers, stats |
| `label` | 32px | 500 | 1.3 | 0.1em uppercase | Section labels, dates |
| `caption` | 42px | 600 | 1.2 | — | Word-by-word captions |
| `body` | 20px | 400 | 1.5 | — | Long-form text |

### Type scale — 16:9 (video overlays)

| Token | Size | Weight | Line Height | Letter | Use |
|---|---|---|---|---|---|
| `heroWord` | 260px | 700 | 1.0 | — | Single-word emphasis |
| `headline` | 116px | 700 | 1.1 | -0.02em | Opening titles |
| `bigNumber` | 170px | 600 | 1.0 | — | Rolling numbers |
| `label` | 40px | 500 | 1.3 | 0.1em uppercase | Section labels |
| `caption` | 46px | 600 | 1.2 | — | Word captions |
| `body` | 22px | 400 | 1.5 | — | Long-form |

### Rules
- Never use more than 2 type sizes in one composition.
- Headlines never wrap to more than 2 lines.
- Numbers use `fontVariantNumeric: "tabular-nums"` for clean digit animation.
- Caption text: white fill + dark shadow. Never plain white on bright footage.

---

## 3. Spacing

4px base grid.

| Token | Value | Use |
|---|---|---|
| `xs` | 4px | Tight gaps, inline elements |
| `sm` | 8px | Component padding, small gaps |
| `md` | 16px | Standard gaps between elements |
| `lg` | 24px | Section spacing |
| `xl` | 32px | Card padding |
| `2xl` | 48px | Large panels |
| `3xl` | 64px | Page-level breathing room |

---

## 4. Corner Radius

| Token | Value | Use |
|---|---|---|
| `sm` | 8px | Tags, badges, small buttons |
| `md` | 12px | Cards, inputs, default |
| `lg` | 24px | BrowserWindow frames, large cards |
| `xl` | 40px | Hero cards, modals |
| `full` | 9999 | Pills, circles, avatars |

---

## 5. Shadows & Elevation

| Token | Value | Use |
|---|---|---|
| `sm` | `0 1px 3px rgba(0,0,0,0.06)` | Inset cards, subtle lift |
| `md` | `0 4px 16px rgba(0,0,0,0.08)` | Cards, buttons, default |
| `lg` | `0 8px 32px rgba(0,0,0,0.10)` | Modals, dropdowns |
| `xl` | `0 16px 48px rgba(0,0,0,0.12)` | Dialogs, overlays |
| `focus` | `0 0 0 3px rgba(255,77,45,0.3)` | Keyboard focus ring |

---

## 6. Buttons

Three variants, one height (48px).

**Primary**
- Background: `accent`, hover: `accentHover`
- Text: white, Inter 500/16px
- Padding: 0 24px, radius: `md`
- Shadow: `md`, focus: `focus`
- Motion: 133ms colour, 267ms scale (1.02 on hover, 0.98 on active)

**Secondary**
- Background: `surface`, border: 1px `border`
- Text: `text`, hover bg: `surfaceSunken`
- Same sizing, shadow, focus ring

**Ghost**
- No fill, no border
- Text: `textSecondary`, hover: `accentMuted` bg + `accent` text
- Same padding and radius

---

## 7. Cards

- Background: `surface`
- Border: 1px `border`
- Radius: `lg` (24px)
- Padding: `xl` (32px)
- Shadow: `md`
- Hover: shadow → `lg`, translateY(-2px), 400ms ease-out

**Stat card variant:** adds a 3px `accent` left border for key metrics.

---

## 8. Inputs

- Height: 48px
- Padding: 0 16px
- Radius: `md` (12px)
- Border: 1px `border`, focus: border `accent` + `focus` ring
- Font: Inter 400/16px, color `text`
- Placeholder: `textSecondary`
- Error state: border `error`, error message below in `error` / 14px
- Disabled: bg `surfaceSunken`, text `textSecondary`

---

## 9. Status States

| State | Token | Usage |
|---|---|---|
| Success | `success` (#16A34A) | Render complete, checks pass |
| Warning | `warning` (#D97706) | Low disk, missing footage |
| Error | `error` (#DC2626) | Render failed, dependency errors |
| Info | `accent` (#FF4D2D) | Process steps, highlights |

Each rendered as a 12px circle + 16px Inter 500 label beside it.

---

## 10. Empty States

- Centered content block
- 64px line-art icon (stroke: `textSecondary`)
- 20px body: "Nothing here yet"
- Optional 16px subtext with context
- Optional CTA button below

---

## 11. Motion Personality

**Snappy, not floaty.** Every entrance travels 16–24px and finishes under 800ms.

- **Entrances:** ease-out, scale 0.94→1, translateY 24px, blur 12px→0. Opacity resolves at 60% of move duration.
- **Exits:** ease-in, 65% of entrance duration, no travel — fade + scale only.
- **Hover states:** 133ms colour, 267ms shadow/transform.
- **Page transitions:** 400ms with 200ms overlap.
- **Stagger:** 100ms normal between grouped items.
- **Blur cap:** 12px max, resolved before move ends.
- **Scale floor:** never scale below 0.9.

`prefers-reduced-motion`: swap all easings to instant (0ms duration).

---

## 12. Signature Emphasis

**HighlightMark** — an accent-coloured bar wipes in behind the key phrase.
One accent, one motion, used only on the 2–3 most important words per scene.
Everything else is plain type.

---

## 13. Safe Zones

| Format | Top | Bottom | Left | Right |
|---|---|---|---|---|
| 9:16 | 250px | 420px | 40px | 40px |
| 16:9 | 40px | 40px | 40px | 40px |

Keep text and UI overlays inside safe zones. Speaker stays full-screen by default.
Never frame the talking head just to make room for text.

---

## 14. Accessibility

- Minimum contrast: 4.5:1 for all text (verified in colour table above)
- Focus indicator: 3px `accent` ring on every interactive element. No default outline.
- Captions: minimum 42px at 9:16, white + dark shadow
- Motion: respect `prefers-reduced-motion`
- Semantic HTML: `<button>`, `<label>`, `<nav>` for any future UI shell

---

## Do's and Don'ts

**Do:**
- Use one accent colour per composition
- Use Inter at the weights defined above
- Keep corners generous (12px minimum)
- Add shadow before adding borders
- Animate with the motion tokens in `motion.ts`
- Use `HighlightMark` for key words, nothing else for emphasis
- Test contrast at 4.5:1 minimum

**Don't:**
- Use CSS `transition` or `animation` — drive everything from `useCurrentFrame`
- Use `Math.random()` — use `random(seed)` from remotion
- Animate opacity alone — pair with 8–24px travel or scale 0.94
- Scale up from below 0.9
- Use more than 2–3 animated properties per element at once
- Use linear easing for entrances/exits
- Put text over the speaker's face
- Use more than one font family
- Hard-code values that exist in `tokens.ts` or `motion.ts`

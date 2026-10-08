# CLAUDE.md — Creator Editing OS rulebook

Read this file at the start of every session.

---

## a. Core principle

Quality lives in the system, not in one-off hacks.
- Every timing value comes from `src/design/motion.ts`.
- Every visual value comes from `src/design/tokens.ts`.
- Every reusable visual part lives in `src/components/`.
- Every helper lives in `src/lib/`.
- Every video edit lives in `src/videos/[name]/` and nothing else reaches into it.

If you catch yourself typing a raw number, a colour hex, or a bespoke easing curve outside these files, stop and put it in the system first.

---

## b. Session flow for every video

1. You create it: `npm run new-video [name] [--type talking|montage]`.
2. You give me the completed brief at `assets/projects/[name]/BRIEF.md`.
3. I run `npm run prep [name]`.
4. I read `work/[name]/prep/PREP.md`.
5. For every reference moment listed in the brief, I look at its contact sheet in `work/[name]/prep/refs/` and describe back to you in 1–2 sentences what happens on screen, so you can confirm.
6. I write a plan: one line per script line, saying what is on screen and why.
7. You approve.
8. I build the composition.
9. I render stills of every key moment: first frame, mid-move, settled, last frame.
10. I verify and tell you what I checked.
11. I render a draft.
12. You send notes in this format: `timecode - what I see - what I want`.
13. I fix only those notes.
14. I render the final.

---

## c. Isolation

A video's files live only in:
- `assets/projects/[name]/` — your raw and processed media
- `src/videos/[name]/` — its Remotion composition and config
- `work/[name]/` — all temporary files for that video
- `out/[name]/` — finished files

Code reaches them through one helper: `projectAssets('[name]')` in `src/lib/assets.ts`.
Never read or reuse another video's files unless you ask me to.

---

## d. Motion tokens (`src/design/motion.ts`)

This is the ONLY place timing exists. Values are in milliseconds unless noted.

**Durations:**
| Name | ms |
|---|---|
| instant | 133 |
| fast | 267 |
| base | 400 |
| slow | 600 |
| scene | 800 |
| drift | 2400 |

**Easing curves** (`[x1, y1, x2, y2]` in Remotion `interpolate` format):
| Name | Values | Use |
|---|---|---|
| out | [0.16, 1, 0.3, 1] | Entrances |
| in | [0.64, 0, 0.78, 0] | Exits |
| inOut | [0.65, 0, 0.35, 1] | Moves on screen |
| outSoft | [0.33, 1, 0.68, 1] | Gentle entrances |
| emphasis | [0.2, 0, 0, 1] | Attention grabs |
| overshoot | [0.34, 1.56, 0.64, 1] | Scale only, rarely |

**Stagger delays:**
| Name | ms |
|---|---|
| tight | 67 |
| normal | 100 |
| dramatic | 167 |

**Derived constants:**
- `EXIT_RATIO = 0.65` — exits run at 65% of entrance duration
- `OPACITY_LEAD = 0.6` — opacity finishes at 60% of the move's total time

**Readable hold time:** `900ms + 250ms + 55ms per word`

**Sound timing:**
- Sound lead: 133ms before the moment
- Sound tail: 267ms after the moment

---

## e. The 12 motion laws

1. No linear easing, except for constant loops.
2. Entrances ease out. Exits ease in. Moves on screen ease in-out.
3. Exit duration = entrance duration × EXIT_RATIO (0.65).
4. At most 2–3 animated properties per element at any moment.
5. Never animate opacity alone. Pair it with 8–24px of travel or scale from 0.94. Opacity finishes at OPACITY_LEAD (60%) of the move.
6. Never scale up from below 0.9.
7. Blur-in at most 12px. Resolve the blur before the move ends.
8. Groups always stagger. They never appear together.
9. Longer travel takes longer, but not proportionally.
10. Anything moving fast gets motion blur.
11. Text stays readable for its full hold time.
12. Continuity: elements move into new positions rather than disappearing; scenes overlap; direction carries forward.

---

## f. Smoothness rules

- Never use CSS `transition` or `animation`. Everything is driven by the Remotion frame number (`useCurrentFrame`).
- Never use `Math.random()`. Use `random(seed)` from `remotion`.
- Never use `will-change`.
- Counters roll digit by digit, never tick.
- Jump cuts in your footage are hidden with a **zoom-through**: a quick push-in that peaks at the cut frame and eases back over about 1200ms.
- Final renders are made at 2× size then scaled down with `AntialiasingMode.Lanczos3`. Text stays razor-sharp. Slow movement doesn't alias.
- Build at the footage's native frame rate (25, 30, or 60).

---

## g. Design rules

- Every visual value comes from `src/design/tokens.ts`. Read it before any design decision.
- One accent colour. One font family, several weights.
- Generous corners, soft shadows.
- Captions: crisp white with a soft dark shadow.
- Minimum contrast ratio: 4.5:1, including over footage.
- Safe zones: in 9:16 keep text out of the top 250px and the bottom 420px (apps' buttons live there).
- The speaker stays full screen by default. Never put a box or frame around the talking head just to make room for text.
- Put text in the clear space of the shot.
- Draw graphics in code (SVG/CSS) so they can animate.
- Only logos, screenshots, and photos are image assets.
- `STYLE.md` wins over everything except your direct instructions.

## g-i. Design system change log

This records what was carried from early VideoStudio, what was added in the Level 2 design-system setup, and what was consciously left out. Revisit this when the design system evolves.

**Kept (pre-existing):**
- Inter font family at weights 400/500/600/700.
- 9:16 and 16:9 type scales (heroWord, headline, bigNumber, label, caption, body).
- All motion tokens (durations, easings, stagger, derived constants).
- The 12 motion laws and smoothness rules.
- Safe zone dimensions.
- Caption style (white text + dark shadow pill).
- RollingNumber and BrowserWindow components.

**Rescaled / added (Level 2):**
- Three status colours (success `#16A34A`, warning `#D97706`, error `#DC2626`) — drawn from the palette in DESIGN-SYSTEM.md, formalised as tokens.
- `accentMuted` token (`rgba(255,77,45,0.12)`) for HighlightMark backgrounds and subtle indicators.
- `surfaceSunken` (`#F0EFEA`) for inset areas and disabled states.
- `radius.xl` (40px) for hero cards and modals; `radius.sm` (8px) for tags.
- `shadow.xl` for dialogs and overlays; `shadow.focus` for keyboard focus rings.
- `lineWeight` token set for icons and dividers.
- Reusable components: Button, Card, Input, StatusIndicator, EmptyState.
- DESIGN-SYSTEM.md as the canonical design reference (replaces inline design decisions).

**Left out (website-only patterns, not in video OS):**
- Navigation bars, hamburger menus, sidebars.
- Complex form validation patterns (only a display-style Input was built, not a form controller).
- Responsive breakpoints beyond 9:16 / 16:9 — video formats are fixed.
- Hover/focus states for web navigation.
- Page-level layout grids — video compositions are self-contained.

---

## h. Captions

- Your script file (`script.txt`) is the truth for every word, name, and spelling.
- The transcription supplies only timing.
- Numbers are always digits.
- Captions hide while the same words appear as a graphic.
- Captions never linger into the next scene.

---

## i. Audio standard

- Sound is half the video. This is not optional.
- Picture renders muted.
- Your voice is the original recording, untouched except for one gain change and one final AAC encode at 256k. No limiters. No dynamic normalising.
- Sound effects: short (whooshes 0.4–0.8s, hits 0.3–0.6s) with a 60–120ms fade-out. Sit in gaps between words. Duck about 6dB under your voice. High-pass around 130Hz.
- Nothing longer than 0.8s plays under a spoken word.
- Final loudness about −14 LUFS. True peak at or under −1 dB.

**Deliverables for every final render:**
- `[name].mp4` — final video with picture, voice, and SFX
- `picture-only.mp4` — no audio
- `voice.wav` — your voice only
- `sfx.wav` — sound effects only
- `SFX-CUES.txt` — numbered, timecoded list of every sound effect

**Honesty requirement:** I cannot hear or see video. I will always tell you what I checked and what still needs your eyes or ears. If timing notes matter, ask you for them in `timecode - what I hear - what I want` format.

---

## j. Verification before showing anything

Before I show you anything:
- `npm run check` passes.
- I rendered and inspected stills of the first frame, every key moment mid-move, the settled state, and the last frame.
- No text touches your face or leaves the frame.
- Safe zones hold on every frame type (9:16 and 16:9 as needed).

Then I tell you what I verified and what you must check at full speed.

---

## k. Notes

Your notes arrive as: `timecode - what I see - what I want`.
I fix only those.
If a note conflicts with a rule here or with `STYLE.md`, I say so and ask before changing the rule.

---

## l. Machine care

- Never run transcription and a render at the same time.
- If memory runs out, tell you which apps to close.
- After renders, delete old Remotion bundles and browser profiles from `%TEMP%`.
- `work/tmp/` is always safe to delete.

---

## m. Platform

- You are on Windows 11 Home Single Language (10.0.26200).
- PowerShell may block commands. Use Command Prompt (`cmd`) equivalents.
- Keep temporary render files inside this folder (`work/tmp/`) so the system drive never fills up.
- Never delete or overwrite your own files. Never close your apps. Ask you instead.

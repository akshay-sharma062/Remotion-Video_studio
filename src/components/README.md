# src/components/

Reusable animated parts. Every component reads from `src/design/tokens.ts` and `src/design/motion.ts` only.
No hard-coded colours, sizes, or timings.

Components (added as built):
- `Presence.tsx` — entrance and exit wrapper with velocity motion blur
- `VelocityBlur.tsx` — directional blur sized to this frame's movement
- `MaskReveal.tsx` — text that wipes in from behind a soft-edged mask
- `HighlightMark.tsx` — accent marker wipes behind a key phrase
- `RollingNumber.tsx` — digits roll from one value to another
- `Captions.tsx` — word-by-word captions driven by word timings
- `Stage.tsx` — full-screen footage with zoom-through for jump cuts
- `BrowserWindow.tsx` + `ScreenView.tsx` — clean browser frame with pan and zoom
- `Pointer.tsx` — arrow that glides and clicks with a ripple
- `TitleCard.tsx` + `LocationLabel.tsx` — clean titles for montages
- `BeatCut.tsx` — beat-aligned clip sequencer helper
- `Transition.tsx` — clip transitions (fade, dissolve, wipe, zoom-through) with beat-cut support

One-line usage comment is at the top of every file.

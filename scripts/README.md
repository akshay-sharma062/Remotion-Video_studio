# scripts/

Helper scripts run with `npm run`.

| Script | Command | Purpose |
|---|---|---|
| `new-video` | `npm run new-video [name] [--type talking\|montage]` | Create folders and brief for a new video |
| `prep` | `npm run prep [name]` | Probe, convert, transcribe (talking head) |
| `prep-montage` | `npm run prep-montage [name]` | Probe b-roll, generate contact sheets, shot list, beat map |
| `beat-map` | `npm run beat-map [name]` | Detect music beats, output beat-map.json |
| `refs` | `npm run refs` | Build contact sheets from `references.md` |
| `stills` | `npm run stills [Composition] --every=N` | Render labelled contact sheets |
| `render-final` | `npm run render-final [name] [--format 9:16\|16:9]` | Final render with audio mix |
| `clean` | `npm run clean` | Delete temp files, bundles, browser profiles |
| `check` | `npm run check` | Typecheck, lint, and motion lint |

## Montage workflow (Prompt 13)

1. `npm run new-video my-trip --type montage`
2. Drop b-roll clips into `assets/projects/my-trip/broll/`
3. Drop music into `assets/projects/my-trip/audio/`
4. `npm run prep-montage my-trip` — contact sheets + shot list + beat map
5. Fill `assets/projects/my-trip/BRIEF.md` with shot list and transitions
6. Copy `src/videos/montage-template/` to `src/videos/my-trip/`
7. Fill `SHOT_LIST` with clip paths and beat positions
8. Register composition in `Root.tsx`
9. Build in Studio, iterate, then `npm run render-final my-trip --format 9:16`

These are safe to delete and regenerate.

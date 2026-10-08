# src/videos/

One folder per video. Each contains:
- `index.tsx` — the Remotion composition
- `config.ts` — composition metadata (id, dimensions, fps, duration)
- `assets.ts` — typed list of assets used by this video (imported via `projectAssets`)
- `Root.tsx` — the top-level composition component

Never share code between videos. Never import from another video's folder.

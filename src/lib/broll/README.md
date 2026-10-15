/**
 * README.md — Automatic B-Roll Pipeline
 *
 * A self-contained pipeline that:
 *   1. Reads a project's transcript.json
 *   2. Decides which phrases need B-roll vs talking-head
 *   3. Searches Pexels / Pixabay / Mixkit for footage
 *   4. Downloads and validates assets
 *   5. Generates a Remotion-ready manifest
 *
 * Usage
 * ─────
 *   # Generate a plan (no download)
 *   npm run broll corporate-career-growth-amana --plan-only
 *
 *   # Full pipeline (requires API keys)
 *   PEXELS_API_KEY=xxx npm run broll corporate-career-growth-amana
 *
 *   # Overwrite existing assets
 *   npm run broll corporate-career-growth-amana --overwrite
 *
 * API Keys
 * ────────
 *   Pexels:      https://www.pexels.com/api/
 *   Pixabay:     https://pixabay.com/api/docs/
 *   Mixkit:      https://mixkit.co
 *
 *   Keys can be set as environment variables or in a .env file:
 *     PEXELS_API_KEY=your_key_here
 *     PIXABAY_API_KEY=your_key_here
 *     MIXKIT_API_KEY=your_key_here
 *
 * Output Files
 * ────────────
 *   work/[project]/broll/plan.json          — Full plan with segments + assets
 *   work/[project]/broll/BROLL-CUES.txt     — Human-readable report
 *   work/[project]/broll/broll-metadata.json — Provenance metadata
 *   src/videos/[project]/broll-manifest.ts   — Remotion manifest array
 *   public/projects/[project]/b-roll/        — Downloaded MP4 files
 *
 * Integration with Remotion
 * ──────────────────────────
 *   In your composition's index.tsx:
 *   ```tsx
 *   import BROLL_MANIFEST from "./broll-manifest";
 *   import { BrollLayer } from "../../components/broll";
 *
 *   export const MyVideo: React.FC = () => {
 *     return (
 *       <AbsoluteFill>
 *         <VideoLayer src={src("test-video.mp4")} />
 *         <BrollLayer manifest={BROLL_MANIFEST} />
 *         <HeadlineLayer />
 *         <Captions />
 *       </AbsoluteFill>
 *     );
 *   };
 *   ```
 *
 * Architecture
 * ─────────────
 *   src/lib/broll/
 *     types.ts            — Shared types
 *     schemas.ts          — Zod validation schemas
 *     config.ts           — Environment / .env config loading
 *     planner.ts          — Segment planning + B-roll decision logic
 *     providers/
 *       base.ts           — Base provider interface
 *       pexels.ts         — Pexels API integration
 *       pixabay.ts        — Pixabay API integration
 *       mixkit.ts         — Mixkit API integration
 *     downloader.ts       — Asset download with retry + timeout
 *     validator.ts        — Asset validation (license, format, hash)
 *     manifest-generator.ts — Remotion manifest + report generation
 *     pipeline.ts         — Orchestrator
 *   src/components/broll/
 *     BrollLayer.tsx      — Remotion component that renders B-roll
 *     index.ts            — Exports
 *   scripts/
 *     broll-auto.ts       — CLI entry point
 *
 * Decision Logic
 * ──────────────
 *   The planner analyzes each transcript segment and decides:
 *     • "talking-head" — for greetings, negations ("not", "no", "without")
 *     • "broll" — for concrete visual entities (salary, career, office)
 *     • "animated-graphic" — for abstract concepts (mindset, strategy)
 *     • "highlight-only" — short segments, no background change
 *
 * Known visual entities are mapped to search queries in planner.ts.
 * Over 40+ entities are pre-mapped with optimized search terms.
 *
 * Design System Compliance
 * ─────────────────────────
 *   Motion: All easing curves come from src/design/motion.ts
 *   Types: All types defined in src/lib/broll/types.ts
 *   Assets: Accessed through projectAssets() in src/lib/assets.ts
 *   Components: Reusable components in src/components/broll/
 */

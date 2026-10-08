/**
 * Analysis module index.
 *
 * This module provides the complete reference-driven editing pipeline:
 *
 * 1. reference-analyzer.ts — Analyzes a reference video, producing
 *    timestamped editing events from annotations and frame analysis.
 *
 * 2. raw-analyzer.ts — Analyzes the raw (un-edited) talking-head video,
 *    producing voice events, emphasis words, face regions, and safe zones.
 *
 * 3. edit-blueprint.ts — The canonical schema for the intermediate
 *    representation between analysis and rendering.
 *
 * 4. mapping-engine.ts — Maps reference editing events onto raw video
 *    moments using semantic matching, structural position, and density
 *    preservation.
 *
 * Usage:
 *
 *   // In a pipeline script:
 *   import { ReferenceAnalyzer } from "./lib/analysis/reference-analyzer";
 *   import { RawAnalyzer } from "./lib/analysis/raw-analyzer";
 *   import { MappingEngine } from "./lib/analysis/mapping-engine";
 *
 *   // 1. Analyze reference
 *   const refAnalyzer = new ReferenceAnalyzer({
 *     videoPath: "references/references-clip.mp4",
 *     annotationPath: "references/references.md",
 *     fps: 30,
 *     totalFrames: 450,
 *     duration: 15,
 *   });
 *   refAnalyzer.injectEvents(parsedEvents); // from parse-references.py
 *   const refAnalysis = refAnalyzer.analyze();
 *
 *   // 2. Analyze raw
 *   const rawAnalyzer = new RawAnalyzer({
 *     videoPath: "work/.../testing-video.mp4",
 *     audioPath: "work/.../audio.wav",
 *     transcript: { words: [...] },
 *     fps: 23.976,
 *     totalFrames: 513,
 *     duration: 21.4,
 *     width: 1080,
 *     height: 1920,
 *   });
 *   const rawAnalysis = rawAnalyzer.analyze();
 *
 *   // 3. Map reference → raw
 *   const mapper = new MappingEngine({ density: 0.8 });
 *   const result = mapper.map(refAnalysis, rawAnalysis);
 *   const blueprint = result.blueprint;
 *
 *   // 4. Render
 *   // The blueprint JSON feeds into the Remotion composition:
 *   // src/videos/[name]-v2/index.tsx
 */

export { ReferenceAnalyzer } from "./reference-analyzer";
export { RawAnalyzer } from "./raw-analyzer";
export { MappingEngine } from "./mapping-engine";
export * from "./edit-blueprint";

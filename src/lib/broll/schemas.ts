/**
 * schemas.ts — Zod schemas for validating B-roll data structures.
 *
 * Used to validate:
 *   - Transcript data (word timings)
 *   - Provider API responses
 *   - Plan JSON files
 *   - Manifest entries
 */

import { z } from "zod";

// ─── Transcript Schemas ───────────────────────────────────────────────────────

export const TranscriptWordSchema = z
  .object({
    word: z.string().min(1),
    // Timing comes in one of two shapes: raw seconds (`start`/`end`) as
    // produced by faster-whisper, or canonical ms (`start_ms`/`end_ms`) as
    // written by gen-transcript.py. Exactly one pair must be present.
    start: z.number().nonnegative().optional(),
    end: z.number().nonnegative().optional(),
    start_ms: z.number().nonnegative().optional(),
    end_ms: z.number().nonnegative().optional(),
  })
  .refine((w) => (w.start_ms ?? w.start) !== undefined && (w.end_ms ?? w.end) !== undefined, {
    message: "Word timing missing: provide start/end (seconds) or start_ms/end_ms (ms)",
  });

export const TranscriptSchema = z.object({
  language: z.string().optional(),
  duration_ms: z.number().nonnegative().optional(),
  fps: z.number().positive().optional(),
  words: z.array(TranscriptWordSchema).min(1),
  segments: z.array(
    z.object({
      id: z.string().optional(),
      start: z.number().nonnegative().optional(),
      end: z.number().nonnegative().optional(),
      start_ms: z.number().nonnegative().optional(),
      end_ms: z.number().nonnegative().optional(),
      text: z.string().optional(),
      words: z.array(TranscriptWordSchema).optional(),
    })
  ).optional(),
  corrections: z.array(z.string()).optional(),
});

export type TranscriptData = z.infer<typeof TranscriptSchema>;
export type TranscriptWord = z.infer<typeof TranscriptWordSchema>;

// ─── Provider Response Schemas ────────────────────────────────────────────────

export const PexelsVideoResponseSchema = z.object({
  videos: z.array(
    z.object({
      id: z.number(),
      url: z.string().url(),
      duration: z.number().positive(),
      image: z.string().url().optional(),
      user: z.object({
        name: z.string(),
        url: z.string().url().optional(),
      }),
      video_files: z.array(
        z.object({
          id: z.number(),
          quality: z.string(),
          file_type: z.string(),
          width: z.number().positive(),
          height: z.number().positive(),
          link: z.string().url(),
        })
      ).min(1),
      tags: z.array(z.object({ name: z.string() })).optional(),
    })
  ),
});

export const PixabayVideoResponseSchema = z.object({
  totalHits: z.number(),
  hits: z.array(
    z.object({
      id: z.number(),
      pageURL: z.string().url(),
      type: z.string(),
      tags: z.string(),
      duration: z.number().nonnegative(),
      videos: z.object({
        large: z.object({
          url: z.string().url(),
          width: z.number().positive(),
          height: z.number().positive(),
        }).optional(),
        medium: z.object({
          url: z.string().url(),
          width: z.number().positive(),
          height: z.number().positive(),
        }).optional(),
        small: z.object({
          url: z.string().url(),
          width: z.number().positive(),
          height: z.number().positive(),
        }).optional(),
        tiny: z.object({
          url: z.string().url(),
          width: z.number().positive(),
          height: z.number().positive(),
        }).optional(),
      }),
      user: z.string(),
      userImageURL: z.string().url().optional(),
    })
  ).optional(),
});

// ─── Plan / Manifest Schemas ──────────────────────────────────────────────────

export const VisualSegmentSchema = z.object({
  id: z.string(),
  from: z.number().int().nonnegative(),
  to: z.number().int().nonnegative(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  transcriptText: z.string().min(1),
  visualDescription: z.string(),
  searchQuery: z.string(),
  treatment: z.enum([
    "broll",
    "talking-head",
    "animated-graphic",
    "still-image",
    "highlight-only",
  ]),
  brollConfidence: z.number().min(0).max(1),
  entities: z.array(z.string()),
  priority: z.number().int(),
});

export const DownloadedAssetSchema = z.object({
  id: z.string(),
  segmentId: z.string(),
  provider: z.string(),
  providerAssetId: z.string(),
  localPath: z.string().min(1),
  sourceUrl: z.string().url(),
  creator: z.string(),
  license: z.string(),
  attributionRequired: z.boolean(),
  attribution: z.string().nullable(),
  fileSizeBytes: z.number().nonnegative(),
  resolution: z.string(),
  durationSec: z.number().positive(),
  fileHash: z.string(),
  downloadedAt: z.string().datetime(),
});

export const BrollPlanSchema = z.object({
  projectName: z.string().min(1),
  generatedAt: z.string().datetime(),
  totalFrames: z.number().int().nonnegative(),
  fps: z.number().positive(),
  segments: z.array(VisualSegmentSchema),
  downloadedAssets: z.array(DownloadedAssetSchema),
  failedDownloads: z.array(
    z.object({
      segmentId: z.string(),
      provider: z.string(),
      providerAssetId: z.string(),
      reason: z.string(),
      attemptedAt: z.string().datetime(),
    })
  ),
  stats: z.object({
    totalSegments: z.number().int().nonnegative(),
    brollSegments: z.number().int().nonnegative(),
    talkingHeadSegments: z.number().int().nonnegative(),
    animatedSegments: z.number().int().nonnegative(),
    downloadedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    pendingCount: z.number().int().nonnegative(),
  }),
});

export const ManifestEntrySchema = z.object({
  phraseIndex: z.number().int().nonnegative(),
  file: z.string().min(1),
  from: z.number().int().nonnegative(),
  to: z.number().int().nonnegative(),
  zoomRange: z.tuple([z.number(), z.number()]),
});

// ─── Validation Helpers ───────────────────────────────────────────────────────

export interface ValidationIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

/**
 * Validate a transcript file's contents.
 */
export function validateTranscript(data: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const result = TranscriptSchema.safeParse(data);
  if (!result.success) {
    for (const err of result.error.issues) {
      issues.push({
        path: err.path.join("."),
        message: err.message,
        severity: "error",
      });
    }
    return issues;
  }

  const transcript = result.data;

  // The schema's refine guarantees a timing pair; resolve ms-first then seconds.
  const timing = (w: {
    start_ms?: number;
    end_ms?: number;
    start?: number;
    end?: number;
  }) => ({
    start: w.start_ms ?? w.start ?? 0,
    end: w.end_ms ?? w.end ?? 0,
  });

  // Check word ordering
  for (let i = 1; i < transcript.words.length; i++) {
    const prev = timing(transcript.words[i - 1]);
    const curr = timing(transcript.words[i]);

    if (curr.start < prev.end) {
      issues.push({
        path: `words[${i}]`,
        message: `Word "${transcript.words[i].word}" starts before previous word ends (overlap)`,
        severity: "warning",
      });
    }
  }

  // Check word durations
  for (let i = 0; i < transcript.words.length; i++) {
    const w = timing(transcript.words[i]);
    const word = transcript.words[i].word;

    if (w.end <= w.start) {
      issues.push({
        path: `words[${i}]`,
        message: `Word "${word}" has invalid duration (end <= start)`,
        severity: "error",
      });
    }
  }

  return issues;
}

/**
 * Validate a plan file's contents.
 */
export function validatePlan(data: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const result = BrollPlanSchema.safeParse(data);
  if (!result.success) {
    for (const err of result.error.issues) {
      issues.push({
        path: err.path.join("."),
        message: err.message,
        severity: "error",
      });
    }
    return issues;
  }

  const plan = result.data;

  // Check segment ordering
  const sorted = [...plan.segments].sort((a, b) => a.from - b.from);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].from !== plan.segments[i].from) {
      issues.push({
        path: `segments[${i}]`,
        message: "Segments are not sorted by frame",
        severity: "warning",
      });
    }
  }

  // Check for frame gaps
  for (let i = 1; i < plan.segments.length; i++) {
    const prev = plan.segments[i - 1];
    const curr = plan.segments[i];
    if (curr.from > prev.to + 5) {
      issues.push({
        path: `segments[${i - 1}].to → segments[${i}].from`,
        message: `Gap of ${curr.from - prev.to} frames between segments`,
        severity: "warning",
      });
    }
  }

  return issues;
}

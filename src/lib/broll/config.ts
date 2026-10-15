/**
 * config.ts — load B-roll pipeline configuration from environment / config files.
 *
 * Credential sources (in priority order):
 *   1. Environment variables
 *   2. .env file in project root
 *   3. Defaults (no providers without credentials)
 *
 * Usage:
 *   const config = loadBrollConfig("corporate-career-growth-amana");
 */

import fs from "fs";
import path from "path";

import type { BrollPipelineConfig, ProviderName } from "./types";

// ─── .env Loading ─────────────────────────────────────────────────────────────

function loadDotEnv(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};

  if (!fs.existsSync(filePath)) return env;

  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) {
      const key = match[1];
      let value = match[2].trim();
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  }

  return env;
}

// ─── Environment Variable Loading ─────────────────────────────────────────────

function envVar(name: string): string | undefined {
  return process.env[name] || undefined;
}

// ─── Config Builder ──────────────────────────────────────────────────────────

/**
 * Absolute project root (the folder holding `package.json`).
 *
 * config.ts lives at src/lib/broll/, so exactly THREE levels up reach the
 * root. A miscounted depth silently resolves to the user's home directory,
 * which makes .env appear to be missing — every API key reads as unset and
 * the pipeline aborts with "No providers configured".
 */
export const PROJECT_ROOT = path.resolve(__dirname, "../../..");

/** Absolute path of the public/ directory that Remotion serves from. */
export const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");

/**
 * Load B-roll pipeline config for a given project.
 */
export function loadBrollConfig(
  projectName: string,
  overrides?: Partial<Omit<BrollPipelineConfig, "output">> & {
    /** Partially override output paths (e.g. redirect the manifest only) */
    output?: Partial<BrollPipelineConfig["output"]>;
  }
): BrollPipelineConfig {  // Try .env file
  const envPath = path.join(PROJECT_ROOT, ".env");
  const dotEnv = loadDotEnv(envPath);

  const credentials = {
    pexels: {
      apiKey: envVar("PEXELS_API_KEY") ?? dotEnv.PEXELS_API_KEY,
    },
    pixabay: {
      apiKey: envVar("PIXABAY_API_KEY") ?? dotEnv.PIXABAY_API_KEY,
    },
    mixkit: {
      apiKey: envVar("MIXKIT_API_KEY") ?? dotEnv.MIXKIT_API_KEY,
    },
  };

  // Build preferred providers list based on available credentials
  const preferredProviders: ProviderName[] = [];
  if (credentials.pexels?.apiKey) preferredProviders.push("pexels");
  if (credentials.pixabay?.apiKey) preferredProviders.push("pixabay");
  if (credentials.mixkit?.apiKey) preferredProviders.push("mixkit");

  const config: BrollPipelineConfig = {
    projectName,
    credentials,
    preferredProviders: preferredProviders.length > 0
      ? preferredProviders
      : ["pexels"],
    minBrollConfidence: 0.5,
    minBrollFrames: 15,
    maxResultsPerQuery: 10,
    downloadDir: path.join("public", "projects", projectName, "b-roll"),
    output: {
      planPath: path.join("work", projectName, "broll", "plan.json"),
      manifestPath: path.join(
        "src", "videos", projectName, "broll-manifest.ts"
      ),
    },
    planOnly: false,
    overwrite: false,
    // No phrase alignment by default: the flat manifest is the historical
    // behaviour. Pass `phrases` to constrain entries to phrase boundaries.
    phrases: undefined,
  };

  // Apply overrides
  if (overrides) {
    config.credentials = { ...config.credentials, ...overrides.credentials };
    if (overrides.preferredProviders) {
      config.preferredProviders = overrides.preferredProviders;
    }
    if (overrides.minBrollConfidence !== undefined) {
      config.minBrollConfidence = overrides.minBrollConfidence;
    }
    if (overrides.minBrollFrames !== undefined) {
      config.minBrollFrames = overrides.minBrollFrames;
    }
    if (overrides.maxResultsPerQuery !== undefined) {
      config.maxResultsPerQuery = overrides.maxResultsPerQuery;
    }
    if (overrides.planOnly !== undefined) config.planOnly = overrides.planOnly;
    if (overrides.overwrite !== undefined) config.overwrite = overrides.overwrite;
    if (overrides.downloadDir) config.downloadDir = overrides.downloadDir;
    if (overrides.output) config.output = { ...config.output, ...overrides.output };
    if (overrides.phrases) {
      assertValidPhrases(overrides.phrases);
      config.phrases = overrides.phrases;
    }
  }

  // Guard: validate ONLY the paths the caller actually overrode.
  //
  // The default manifest path for a project lives inside that project's own
  // directory, which for the production composition is a protected directory —
  // and that default is correct and must keep working. Validating the whole
  // config here would break every ordinary production call (including a plain
  // `--overwrite`), so each override is checked on its own instead.
  if (overrides) {
    if (overrides.output?.manifestPath) {
      assertSafeManifestPath(overrides.output.manifestPath);
    }
    if (overrides.downloadDir) {
      assertSafeDownloadDir(overrides.downloadDir);
    }
  }

  return config;
}

/**
 * Projects whose source trees are protected from automated writes.
 *
 * `corporate-career-growth-amana` is the approved production composition.
 * The experimental 9:16 variant (`...-premium-916`) lives beside it and shares
 * the same name prefix, so any path check MUST be directory-segment exact — a
 * naive `startsWith("src/videos/corporate-career-growth-amana")` would wrongly
 * flag the Premium directory as protected.
 */
const PROTECTED_VIDEO_DIRS = ["corporate-career-growth-amana"] as const;

/**
 * Resolve a path to a normalised absolute path for comparison.
 * Relative paths are resolved against the project root.
 */
function toAbsolute(p: string): string {
  return path.resolve(PROJECT_ROOT, p);
}

/**
 * Return true if `target` is at or inside `dir`, comparing on whole path
 * segments so that a shared prefix cannot produce a false positive.
 *
 * `isInsideDir("src/videos/prod/broll-manifest.ts", "src/videos/prod")` → true
 * `isInsideDir("src/videos/prod", "src/videos/prod")`                → true
 * `isInsideDir("src/videos/prod-premium/file.ts", "src/videos/prod")`→ false
 */
function isInsideDir(target: string, dir: string): boolean {
  const rel = path.relative(toAbsolute(dir), toAbsolute(target));
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Validate phrase definitions supplied for phrase-aligned manifest generation.
 *
 * A malformed phrase set would silently produce a manifest that activates B-roll
 * during the wrong scene — or not at all — so this throws early, before any
 * download begins.
 */
export function assertValidPhrases(
  phrases: NonNullable<BrollPipelineConfig["phrases"]>
): void {
  if (!Array.isArray(phrases) || phrases.length === 0) {
    throw new Error("B-roll config: phrases must be a non-empty array.");
  }

  const seenIndices = new Set<number>();

  for (const phrase of phrases) {
    if (!Number.isInteger(phrase.phraseIndex) || phrase.phraseIndex < 0) {
      throw new Error(
        `B-roll config: phraseIndex must be a non-negative integer, got ${phrase.phraseIndex}.`
      );
    }
    if (seenIndices.has(phrase.phraseIndex)) {
      throw new Error(
        `B-roll config: duplicate phraseIndex ${phrase.phraseIndex} in phrases.`
      );
    }
    seenIndices.add(phrase.phraseIndex);

    if (!Number.isInteger(phrase.from) || phrase.from < 0) {
      throw new Error(
        `B-roll config: phrase ${phrase.phraseIndex} has invalid from=${phrase.from}.`
      );
    }
    if (!Number.isInteger(phrase.to) || phrase.to <= phrase.from) {
      throw new Error(
        `B-roll config: phrase ${phrase.phraseIndex} must have to > from, ` +
          `got from=${phrase.from} to=${phrase.to}.`
      );
    }
    if (!Array.isArray(phrase.words) || phrase.words.length === 0) {
      throw new Error(
        `B-roll config: phrase ${phrase.phraseIndex} must have at least one word.`
      );
    }
  }

  // Phrases must not overlap: an overlapping pair would let one planner segment
  // map to two phrases and produce a duplicate entry.
  const sorted = [...phrases].sort((a, b) => a.from - b.from);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].from < sorted[i - 1].to) {
      throw new Error(
        `B-roll config: phrases ${sorted[i - 1].phraseIndex} ` +
          `(${sorted[i - 1].from}-${sorted[i - 1].to}) and ` +
          `${sorted[i].phraseIndex} (${sorted[i].from}-${sorted[i].to}) overlap.`
      );
    }
  }
}

/**
 * Guard a manifest path supplied by an override.
 *
 * Throws before any download begins if a redirect would write a manifest into
 * a protected production composition directory. This is the last line of
 * defence behind the explicit `--manifest-path` flag.
 */
export function assertSafeManifestPath(manifestPath: string): void {
  if (!manifestPath) {
    throw new Error("B-roll config: output.manifestPath is empty.");
  }

  for (const protectedName of PROTECTED_VIDEO_DIRS) {
    const protectedDir = path.join("src", "videos", protectedName);
    if (isInsideDir(manifestPath, protectedDir)) {
      throw new Error(
        `Refusing to write B-roll manifest to the protected production ` +
          `composition directory.\n  manifestPath: ${manifestPath}\n  ` +
          `protected dir: ${protectedDir}\n` +
          `Use --manifest-path to target a different composition.`
      );
    }
  }
}

/**
 * Guard a download directory supplied by an override.
 *
 * Every check is done on RESOLVED absolute paths with a segment-aware
 * containment test, never on the raw string. String-prefix checks are unsafe
 * on Windows: `..\\..\\evil` starts with a harmless-looking prefix after
 * slash normalisation, `C:\\...\\other-project\\public` contains "public"
 * without being inside ours, and an absolute path outside the project passes
 * any relative check outright.
 */
export function assertSafeDownloadDir(downloadDir: string): void {
  if (!downloadDir) {
    throw new Error("B-roll config: downloadDir is empty.");
  }

  // Resolve against the project root first: relative paths, `..` traversal and
  // separator variations all collapse to one canonical absolute path here.
  const resolved = path.resolve(PROJECT_ROOT, downloadDir);

  // Assets must not land in a protected video's own media directory. That tree
  // exists in two places: the raw/processed originals under assets/projects/
  // and the Remotion-served copies under public/projects/. Both are checked,
  // since either would mix another video's files into the production project.
  for (const protectedName of PROTECTED_VIDEO_DIRS) {
    for (const protectedMedia of [
      path.join("assets", "projects", protectedName),
      path.join("public", "projects", protectedName),
    ]) {
      if (isInsideDir(resolved, protectedMedia)) {
        throw new Error(
          `Refusing to download B-roll assets into the protected project media ` +
            `directory.\n  downloadDir: ${downloadDir}\n  protected dir: ` +
            `${protectedMedia}`
        );
      }
    }
  }

  // Assets are served to Remotion from public/, so downloads must live inside
  // this project's public/ directory. Resolved containment rejects absolute
  // paths outside the project and any `..` traversal in one test.
  if (!isInsideDir(resolved, PUBLIC_DIR)) {
    throw new Error(
      `B-roll downloadDir must stay inside this project's public/ directory ` +
        `so Remotion can serve it.\n  downloadDir: ${downloadDir}\n  ` +
        `resolved: ${resolved}\n  public dir: ${PUBLIC_DIR}\n  ` +
        `example: --download-dir projects/<project>/b-roll`
    );
  }
}

/**
 * Validate a whole config's paths. Exported for callers that build a config
 * themselves rather than via loadBrollConfig; note that the production
 * project's own default manifest path IS inside its protected directory by
 * design, so prefer the targeted assertSafe* helpers for overrides.
 */
export function validateConfigPaths(config: BrollPipelineConfig): void {
  if (!config.output.manifestPath) {
    throw new Error("B-roll config: output.manifestPath is empty.");
  }
  assertSafeDownloadDir(config.downloadDir);
}

/**
 * Print available providers and their status.
 */
export function printProviderStatus(config: BrollPipelineConfig): void {
  console.log("\nProvider Status:");
  console.log("─".repeat(40));

  const allProviders = [
    { name: "Pexels", key: "pexels", envVar: "PEXELS_API_KEY" },
    { name: "Pixabay", key: "pixabay", envVar: "PIXABAY_API_KEY" },
    { name: "Mixkit", key: "mixkit", envVar: "MIXKIT_API_KEY" },
  ];

  for (const p of allProviders) {
    const hasCreds = !!config.credentials[p.key as keyof typeof config.credentials]?.apiKey;
    const isPreferred = config.preferredProviders.includes(p.key as ProviderName);
    const status = hasCreds
      ? (isPreferred ? "✓ Active" : "○ Available (not preferred)")
      : "✗ Missing credentials";
    const keyStatus = hasCreds ? "configured" : "not set";
    console.log(`  ${p.name.padEnd(10)} ${status} (${p.envVar}: ${keyStatus})`);
  }

  console.log("");
}

/**
 * Check if at least one provider has credentials.
 */
export function hasAnyProvider(config: BrollPipelineConfig): boolean {
  return config.preferredProviders.length > 0;
}

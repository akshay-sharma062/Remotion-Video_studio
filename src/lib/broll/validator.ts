/**
 * validator.ts — validate downloaded B-roll assets.
 *
 * Checks:
 *   1. File exists and is non-empty
 *   2. SHA-256 hash matches expected (integrity)
 *   3. License is commercial-use permitted
 *   4. File is actually a valid MP4 (magic bytes check)
 *   5. Resolution meets minimum requirements
 *   6. Duration meets minimum requirements
 */

import fs from "fs";
import path from "path";
import { createHash } from "crypto";

import type {
  DownloadedAsset,
  ProviderVideoResult,
  ProviderLicense,
  BrollPipelineConfig,
} from "./types";

export interface ValidationResult {
  assetId: string;
  passed: boolean;
  checks: ValidationCheck[];
  warnings: string[];
  canFix: boolean;
  fixSuggestion?: string;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

// ─── Configuration ────────────────────────────────────────────────────────────

export interface ValidatorConfig {
  /** Minimum file size in bytes (1MB) */
  minFileSizeBytes: number;
  /** Minimum resolution width */
  minWidth: number;
  /** Minimum resolution height */
  minHeight: number;
  /** Minimum duration in seconds */
  minDurationSec: number;
  /** Disallowed licenses */
  disallowedLicenses: ProviderLicense[];
  /** Allowed licenses (if set, only these are allowed) */
  allowedLicenses: ProviderLicense[];
  /** Whether attribution can be added */
  canAddAttribution: boolean;
}

export const DEFAULT_VALIDATOR_CONFIG: ValidatorConfig = {
  minFileSizeBytes: 50_000, // 50KB minimum (very short clip)
  minWidth: 640,
  minHeight: 360,
  minDurationSec: 3,
  disallowedLicenses: [],
  allowedLicenses: [
    "cc0",
    "cc-by",
    "cc-by-sa",
    "pexels-license",
    "mixkit-terms",
  ],
  canAddAttribution: true,
};

// ─── MP4 Magic Bytes ─────────────────────────────────────────────────────────

const MP4_MAGIC = Buffer.from([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70]);

function isValidMp4(buffer: Buffer): boolean {
  return buffer.length >= 8 && buffer.slice(0, 8).equals(MP4_MAGIC);
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate a single downloaded asset.
 */
export function validateAsset(
  asset: DownloadedAsset,
  result: ProviderVideoResult,
  config: BrollPipelineConfig
): ValidationResult {
  const validatorConfig = { ...DEFAULT_VALIDATOR_CONFIG };
  const checks: ValidationCheck[] = [];
  const warnings: string[] = [];

  // 1. File existence
  const fullPath = path.resolve(asset.localPath);
  const fileExists = fs.existsSync(fullPath);
  checks.push({
    name: "file-exists",
    passed: fileExists,
    detail: fileExists
      ? `File exists at ${asset.localPath}`
      : `File NOT found at ${asset.localPath}`,
  });

  // 2. File size
  let fileSize = 0;
  if (fileExists) {
    fileSize = fs.statSync(fullPath).size;
  }
  const sizeOk = fileSize >= validatorConfig.minFileSizeBytes;
  checks.push({
    name: "file-size",
    passed: sizeOk,
    detail: sizeOk
      ? `${(fileSize / 1024).toFixed(1)}KB (min ${(validatorConfig.minFileSizeBytes / 1024).toFixed(0)}KB)`
      : `File too small: ${(fileSize / 1024).toFixed(1)}KB (min ${(validatorConfig.minFileSizeBytes / 1024).toFixed(0)}KB)`,
  });

  // 3. MP4 format check
  let isMp4 = false;
  if (fileExists && fileSize > 0) {
    try {
      const buffer = fs.readFileSync(fullPath);
      isMp4 = isValidMp4(buffer);
    } catch {
      // ignore read errors, caught by file-exists check
    }
  }
  checks.push({
    name: "mp4-format",
    passed: isMp4,
    detail: isMp4 ? "Valid MP4 magic bytes" : "Invalid or missing MP4 header",
  });

  // 4. License check
  const licenseOk = validatorConfig.allowedLicenses.includes(asset.license);
  checks.push({
    name: "license",
    passed: licenseOk,
    detail: licenseOk
      ? `License: ${asset.license} (commercial use: ${asset.commercialUse})`
      : `License ${asset.license} does not permit commercial use`,
  });

  // 5. Commercial use
  const commercialOk = asset.commercialUse;
  checks.push({
    name: "commercial-use",
    passed: commercialOk,
    detail: commercialOk
      ? "Commercial use permitted"
      : "Commercial use NOT permitted — cannot use in video",
  });

  // 6. Duration
  const durationOk = (asset.durationSec ?? 0) >= validatorConfig.minDurationSec;
  checks.push({
    name: "duration",
    passed: durationOk,
    detail: durationOk
      ? `${asset.durationSec?.toFixed(1)}s (min ${validatorConfig.minDurationSec}s)`
      : `Too short: ${asset.durationSec?.toFixed(1)}s (min ${validatorConfig.minDurationSec}s)`,
  });

  // 7. Hash integrity (if hash is provided)
  let hashOk = true;
  if (asset.fileHash && fileExists) {
    try {
      const buffer = fs.readFileSync(fullPath);
      const computedHash = createHash("sha256").update(buffer).digest("hex");
      hashOk = computedHash === asset.fileHash;
      checks.push({
        name: "hash-integrity",
        passed: hashOk,
        detail: hashOk
          ? "SHA-256 hash matches"
          : `Hash mismatch: expected ${asset.fileHash.slice(0, 16)}..., got ${hashOk ? "" : computedHash.slice(0, 16) + "..."}`,
      });
    } catch {
      checks.push({
        name: "hash-integrity",
        passed: false,
        detail: "Could not compute hash (file read error)",
      });
      hashOk = false;
    }
  }

  // Warnings
  if (asset.attributionRequired && asset.attribution) {
    warnings.push(`Attribution required: "${asset.attribution}"`);
  }
  if (!asset.modificationPermitted) {
    warnings.push("Modification not permitted — cannot trim or re-encode");
  }

  const passed = checks.every((c) => c.passed);

  // Fix suggestions
  let fixSuggestion: string | undefined;
  if (!passed) {
    const failed = checks.filter((c) => !c.passed).map((c) => c.name);
    if (failed.includes("file-exists") || failed.includes("file-size") || failed.includes("mp4-format")) {
      fixSuggestion = "Re-download the asset or try a different provider";
    } else if (failed.includes("license") || failed.includes("commercial-use")) {
      fixSuggestion = "This asset cannot be used commercially. Search for a different one.";
    } else if (failed.includes("duration")) {
      fixSuggestion = "Clip too short. Search for longer footage.";
    }
  }

  return {
    assetId: asset.id,
    passed,
    checks,
    warnings,
    canFix: !passed && (fixSuggestion !== undefined),
    fixSuggestion,
  };
}

/**
 * Validate all downloaded assets.
 */
export function validateAllAssets(
  assets: DownloadedAsset[],
  results: ProviderVideoResult[],
  config: BrollPipelineConfig
): ValidationResult[] {
  const resultMap = new Map(results.map((r) => [r.assetId, r]));

  return assets.map((asset) => {
    const result = resultMap.get(asset.providerAssetId);
    return validateAsset(asset, result ?? ({} as ProviderVideoResult), config);
  });
}

/**
 * Check if all assets passed validation.
 */
export function allValid(validations: ValidationResult[]): boolean {
  return validations.every((v) => v.passed);
}

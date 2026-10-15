/**
 * downloader.ts — download B-roll assets from providers.
 *
 * Features:
 *   - Sequential provider fallback (try Pexels, then Pixabay, then Mixkit)
 *   - Timeout handling (30s default)
 *   - Resume support (skip existing files unless overwrite)
 *   - SHA-256 hash verification
 *   - Proxy support
 *   - Progress reporting via callback
 */

import fs from "fs";
import path from "path";
import http from "http";
import https from "https";
import { createHash } from "crypto";

import type {
  ProviderVideoResult,
  ProviderCredentials,
  DownloadedAsset,
  FailedDownload,
  ProviderName,
  BrollPipelineConfig,
} from "./types";
import { pexelsProvider } from "./providers/pexels";
import { pixabayProvider } from "./providers/pixabay";
import { mixkitProvider } from "./providers/mixkit";
import type { BrollProvider } from "./providers/base";
import { isPortraitResolution } from "./providers/base";
import { brollAssetLocalPath } from "./asset-path";
import { PROJECT_ROOT } from "./config";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DownloadProgress {
  segmentId: string;
  provider: string;
  bytesDownloaded: number;
  totalBytes: number | null;
  percent: number | null;
  status: "searching" | "downloading" | "hashing" | "complete" | "error";
  error?: string;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

export interface DownloadResult {
  downloaded: DownloadedAsset[];
  failed: FailedDownload[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_USER_AGENT = "VideoStudio-Broll/1.0";

/**
 * Download all B-roll assets needed for a plan.
 *
 * Providers are tried in order for each segment.
 * If a provider has no credentials, it's skipped.
 */
export async function downloadBrollAssets(
  segments: Array<{ id: string; searchQuery: string; treatment: string; brollConfidence: number }>,
  config: BrollPipelineConfig,
  onProgress?: ProgressCallback
): Promise<DownloadResult> {
  const providers = getProviders(config);
  const downloaded: DownloadedAsset[] = [];
  const failed: FailedDownload[] = [];

  // Only process segments that need B-roll
  const brollSegments = segments.filter(
    (s) => s.treatment === "broll" && s.searchQuery.length > 0
  );

  for (const segment of brollSegments) {
    let found = false;

    for (const provider of providers) {
      if (found) break;

      onProgress?.({
        segmentId: segment.id,
        provider: provider.name,
        bytesDownloaded: 0,
        totalBytes: null,
        percent: null,
        status: "searching",
      });

      try {
        const results = await searchAndDownload(
          segment,
          provider,
          config,
          onProgress
        );

        if (results) {
          downloaded.push(results);
          found = true;
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        onProgress?.({
          segmentId: segment.id,
          provider: provider.name,
          bytesDownloaded: 0,
          totalBytes: null,
          percent: null,
          status: "error",
          error: reason,
        });

        // Try next provider
        continue;
      }
    }

    if (!found) {
      failed.push({
        segmentId: segment.id,
        provider: providers.map((p) => p.name).join("+") || "none",
        providerAssetId: "",
        reason: "No providers available or all searches failed",
        attemptedAt: new Date().toISOString(),
      });
    }
  }

  return { downloaded, failed };
}

// ─── Provider Selection ───────────────────────────────────────────────────────

interface ProviderEntry {
  name: ProviderName;
  instance: BrollProvider;
}

function getProviders(config: BrollPipelineConfig): ProviderEntry[] {
  const all: ProviderEntry[] = [
    { name: "pexels", instance: pexelsProvider },
    { name: "pixabay", instance: pixabayProvider },
    { name: "mixkit", instance: mixkitProvider },
  ];

  return all.filter((p) => {
    const creds = config.credentials[p.name];
    return !!creds && p.instance.hasCredentials(creds);
  });
}

// ─── Search + Download ────────────────────────────────────────────────────────

async function searchAndDownload(
  segment: { id: string; searchQuery: string },
  provider: ProviderEntry,
  config: BrollPipelineConfig,
  onProgress?: ProgressCallback
): Promise<DownloadedAsset | null> {
  const credentials = config.credentials[provider.name]!;

  // Search
  const results = await provider.instance.searchVideos(
    {
      query: segment.searchQuery,
      orientation: "portrait",
      minDurationSec: 5,
      maxDurationSec: 30,
    },
    credentials
  );

  if (results.length === 0) {
    throw new Error(`No results for "${segment.searchQuery}" from ${provider.name}`);
  }

  // Pick best result: prefer portrait, highest relevance.
  //
  // Portrait is decided from the real width/height via isPortraitResolution, NOT
  // by string-matching "1080x1920". The old string test missed 1080x1904,
  // 1080x1905, 2160x3840 and 2160x4096 — every portrait size except one
  // canonical value — so the 9:16 Premium composition was being handed landscape
  // clips even when portrait ones were available.
  //
  // The provider already returns results portrait-first (see
  // selectPixabayResults), so this sort is a second, provider-independent guard:
  // a provider that returns results in a different order still gets corrected
  // here rather than silently feeding a landscape clip to a 9:16 composition.
  //
  // Non-mutating: `results` belongs to the caller, and `.sort()` in place would
  // reorder the provider's array as a side effect.
  const sorted = [...results].sort((a, b) => {
    const aIsPortrait = isPortraitResolution(a.resolution) ? 1 : 0;
    const bIsPortrait = isPortraitResolution(b.resolution) ? 1 : 0;
    if (aIsPortrait !== bIsPortrait) return bIsPortrait - aIsPortrait;
    return b.relevance - a.relevance;
  });

  const chosen = sorted[0];

  // Download. The filename and destination both come from asset-path.ts, the
  // single definition of where a clip lives. The manifest generator derives
  // its `file:` value from the same function, so the two can never disagree.
  const localPath = brollAssetLocalPath(segment.id, provider.name, config.downloadDir);
  const destPath = path.resolve(PROJECT_ROOT, localPath);

  // Ensure directory exists
  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  // Skip if exists and not overwriting
  if (fs.existsSync(destPath) && !config.overwrite) {
    const existingSize = fs.statSync(destPath).size;
    const hash = createHash("sha256")
      .update(fs.readFileSync(destPath))
      .digest("hex");

    return {
      id: segment.id,
      segmentId: segment.id,
      provider: provider.name,
      providerAssetId: chosen.assetId,
      localPath,
      sourceUrl: chosen.downloadUrl,
      creator: chosen.creator,
      license: chosen.license,
      attributionRequired: chosen.attributionRequired,
      attribution: chosen.attribution,
      commercialUse: chosen.commercialUse,
      modificationPermitted: chosen.modificationPermitted,
      fileSizeBytes: existingSize,
      resolution: chosen.resolution,
      durationSec: chosen.durationSec,
      fileHash: hash,
      downloadedAt: new Date().toISOString(),
    };
  }

  onProgress?.({
    segmentId: segment.id,
    provider: provider.name,
    bytesDownloaded: 0,
    totalBytes: null,
    percent: null,
    status: "downloading",
  });

  // Download the file
  const fileBuffer = await downloadFile(chosen.downloadUrl, (downloaded, total) => {
    onProgress?.({
      segmentId: segment.id,
      provider: provider.name,
      bytesDownloaded: downloaded,
      totalBytes: total,
      percent: total ? Math.round((downloaded / total) * 100) : null,
      status: "downloading",
    });
  });

  fs.writeFileSync(destPath, fileBuffer);

  // Hash
  onProgress?.({
    segmentId: segment.id,
    provider: provider.name,
    bytesDownloaded: fileBuffer.length,
    totalBytes: fileBuffer.length,
    percent: 100,
    status: "hashing",
  });

  const hash = createHash("sha256").update(fileBuffer).digest("hex");

  onProgress?.({
    segmentId: segment.id,
    provider: provider.name,
    bytesDownloaded: fileBuffer.length,
    totalBytes: fileBuffer.length,
    percent: 100,
    status: "complete",
  });

  return {
    id: segment.id,
    segmentId: segment.id,
    provider: provider.name,
    providerAssetId: chosen.assetId,
    localPath,
    sourceUrl: chosen.downloadUrl,
    creator: chosen.creator,
    license: chosen.license,
    attributionRequired: chosen.attributionRequired,
    attribution: chosen.attribution,
    commercialUse: chosen.commercialUse,
    modificationPermitted: chosen.modificationPermitted,
    fileSizeBytes: fileBuffer.length,
    resolution: chosen.resolution,
    durationSec: chosen.durationSec,
    fileHash: hash,
    downloadedAt: new Date().toISOString(),
  };
}

// ─── HTTP Download Helper ─────────────────────────────────────────────────────

function downloadFile(
  url: string,
  onProgress?: (downloaded: number, total: number | null) => void
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes: number | null = null;

    const mod = url.startsWith("https") ? https : http;

    const req = mod.get(url, { timeout: DEFAULT_TIMEOUT_MS }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        downloadFile(res.headers.location, onProgress)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      totalBytes = res.headers["content-length"]
        ? parseInt(res.headers["content-length"], 10)
        : null;

      res.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
        onProgress?.(chunks.reduce((sum, c) => sum + c.length, 0), totalBytes);
      });

      res.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Download timeout after ${DEFAULT_TIMEOUT_MS}ms`));
    });
  });
}

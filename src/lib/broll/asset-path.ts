/**
 * asset-path.ts — the single definition of where a B-roll clip lives on disk and
 * how Remotion addresses it.
 *
 * Both the downloader (which writes the file) and the manifest generator (which
 * names it in `file:`) MUST go through here. Before this module existed the
 * downloader built `path.join(downloadDir, provider, id + ".mp4")` inline while
 * the generator derived its own path from the same inputs — two copies of one
 * rule, which is exactly how a manifest ends up pointing at a file the
 * downloader never wrote.
 */

import path from "path";

import { PROJECT_ROOT, PUBLIC_DIR } from "./config";
import type { ProviderName } from "./types";

/**
 * The on-disk filename the downloader writes for a segment.
 *
 * THIS IS THE ONLY PLACE THE FILENAME IS DECIDED. The downloader imports it to
 * name the file it writes; the manifest generator imports it to reference that
 * same file. When both sides call this function, a generated manifest can never
 * point at a filename the downloader did not create.
 *
 * Deliberately keyed on the planner segment id (`seg-6`), NOT on a descriptive
 * name. The segment id is the one identifier that is stable across planner runs,
 * unique per segment, and already carried on DownloadedAsset.segmentId.
 */
export function brollAssetFilename(segmentId: string): string {
  return `${segmentId}.mp4`;
}

/**
 * Absolute-or-relative local path a downloaded clip is written to.
 *
 * Mirrors the downloader's destination exactly:
 *   `<downloadDir>/<provider>/<segmentId>.mp4`
 */
export function brollAssetLocalPath(
  segmentId: string,
  provider: ProviderName,
  downloadDir: string
): string {
  return path.join(
    downloadDir,
    provider,
    brollAssetFilename(segmentId)
  );
}

/**
 * Convert a downloaded file's local path into the path Remotion's
 * `staticFile()` expects: relative to `public/`, forward slashes.
 *
 * `localPath` may arrive as the default relative form
 * (`public/projects/x/b-roll`), a CLI-supplied relative form, or a valid
 * absolute path inside public/. Stripping a literal "public/" prefix only
 * handles the first case — and would strip it twice if downloadDir were
 * already `public/...`. Resolving against the project root and computing the
 * path relative to public/ handles every case, and never duplicates public/,
 * the provider folder, or the segment id.
 */
export function toStaticFilePath(localPath: string): string {
  const resolved = path.resolve(PROJECT_ROOT, localPath);
  const relative = path.relative(PUBLIC_DIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `Downloaded asset is outside public/ and cannot be served by ` +
        `staticFile().\n  localPath: ${localPath}\n  resolved: ${resolved}\n  ` +
        `public dir: ${PUBLIC_DIR}`
    );
  }
  return relative.split(path.sep).join("/");
}

/**
 * The `file:` value a manifest entry must carry for a given segment, provider
 * and download directory. This is the contract the tests assert against.
 */
export function brollAssetStaticPath(
  segmentId: string,
  provider: ProviderName,
  downloadDir: string
): string {
  return toStaticFilePath(brollAssetLocalPath(segmentId, provider, downloadDir));
}

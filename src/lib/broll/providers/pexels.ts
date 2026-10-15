/**
 * pexels.ts — Pexels video provider.
 *
 * Pexels API docs: https://www.pexels.com/api/documentation/
 * - Free API key required (sign up at pexels.com/api)
 * - Rate limit: 200 requests/hour, 20,000 requests/month
 * - License: Pexels License (free for commercial use, no attribution required but appreciated)
 * - Videos: MP4, various resolutions up to 4K
 *
 * Required env var or config: PEXELS_API_KEY
 */

import type {
  VideoSearchQuery,
  ProviderVideoResult,
  ProviderCredentials,
} from "../types";
import type { BrollProvider } from "./base";

const PEXELS_API_BASE = "https://api.pexels.com/videos";

/**
 * Parse the Pexels API response into our standard format.
 */
function parsePexelsResponse(data: unknown): ProviderVideoResult[] {
  const response = data as {
    videos: Array<{
      id: number;
      url: string;
      duration: number;
      image: string;
      user: {
        name: string;
        url: string;
      };
      video_files: Array<{
        id: number;
        quality: string;
        file_type: string;
        width: number;
        height: number;
        link: string;
      }>;
      tags?: Array<{ name: string }>;
    }>;
  };

  return response.videos.map((video) => {
    // Prefer the highest quality file that's still reasonable in size
    const sortedFiles = video.video_files
      .filter((f) => f.file_type === "video/mp4")
      .sort((a, b) => {
        const qualityOrder = { hd: 0, sd: 1 };
        return (qualityOrder[a.quality as keyof typeof qualityOrder] ?? 2) -
               (qualityOrder[b.quality as keyof typeof qualityOrder] ?? 2);
      });

    const bestFile = sortedFiles[0];

    return {
      assetId: `pexels-${video.id}`,
      downloadUrl: bestFile?.link ?? video.video_files[0]?.link ?? "",
      pageUrl: video.url,
      thumbnailUrl: video.image,
      title: video.url.split("/").pop() ?? `Pexels video ${video.id}`,
      creator: video.user.name,
      durationSec: video.duration,
      resolution: bestFile
        ? `${bestFile.width}x${bestFile.height}`
        : "unknown",
      license: "pexels-license",
      attribution: `Video by ${video.user.name} on Pexels`,
      attributionRequired: false,
      commercialUse: true,
      modificationPermitted: true,
      relevance: 0.8,
      tags: video.tags?.map((t) => t.name) ?? [],
    };
  });
}

/**
 * Map our orientation to Pexels's query modifier.
 */
function buildPexelsQuery(baseQuery: string, orientation?: string): string {
  if (orientation && orientation !== "any") {
    const map: Record<string, string> = {
      portrait: "vertical",
      landscape: "horizontal",
    };
    return `${baseQuery} ${map[orientation] ?? ""}`.trim();
  }
  return baseQuery;
}

export const pexelsProvider: BrollProvider = {
  name: "pexels",

  hasCredentials(credentials: ProviderCredentials): boolean {
    return !!credentials.apiKey && credentials.apiKey.length > 0;
  },

  async searchVideos(
    query: VideoSearchQuery,
    credentials: ProviderCredentials
  ): Promise<ProviderVideoResult[]> {
    const params = new URLSearchParams({
      query: buildPexelsQuery(query.query, query.orientation),
      per_page: String(Math.min(query.maxDurationSec ? 10 : 20, 80)),
      orientation: query.orientation ?? "any",
    });

    // Add min_duration filter if specified
    if (query.minDurationSec) {
      params.set("min_duration", String(query.minDurationSec));
    }

    const response = await fetch(`${PEXELS_API_BASE}/search?${params}`, {
      headers: {
        Authorization: credentials.apiKey,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Pexels API error ${response.status}: ${response.statusText} — ${body.slice(0, 200)}`
      );
    }

    const data = await response.json();
    return parsePexelsResponse(data);
  },
};

export default pexelsProvider;

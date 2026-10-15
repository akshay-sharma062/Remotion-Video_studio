/**
 * mixkit.ts — Mixkit video provider.
 *
 * Mixkit API docs: https://mixkit.co/api/
 * - Free API key required (sign up at mixkit.co)
 * - Rate limit: Varies by plan
 * - License: Mixkit Free License (free for commercial use, attribution appreciated)
 * - Videos: MP4, up to 4K
 *
 * Required env var or config: MIXKIT_API_KEY
 */

import type {
  VideoSearchQuery,
  ProviderVideoResult,
  ProviderCredentials,
} from "../types";
import type { BrollProvider } from "./base";

const MIXKIT_API_BASE = "https://api.mixkit.co/api/v1";

/**
 * Parse the Mixkit API response into our standard format.
 */
interface MixkitAttributes {
  title?: string;
  slug?: string;
  duration: number;
  preview_url?: string;
  thumbnail_url?: string;
  hd_video_url?: string;
  sd_video_url?: string;
  tags?: Array<{ name: string }>;
  user?: { name: string };
}

function parseMixkitResponse(data: unknown): ProviderVideoResult[] {
  const response = data as {
    data?: Array<{ id: number | string; attributes?: MixkitAttributes }>;
  };

  const items = response.data ?? [];

  return items.map((item) => {
    const attrs: MixkitAttributes = item.attributes ?? { duration: 0 };
    const id = String(item.id);

    return {
      assetId: `mixkit-${id}`,
      downloadUrl: attrs.hd_video_url ?? attrs.sd_video_url ?? attrs.preview_url ?? "",
      pageUrl: `https://mixkit.co/free-stock-video/${attrs.slug ?? id}/`,
      thumbnailUrl: attrs.thumbnail_url ?? attrs.preview_url ?? "",
      title: attrs.title ?? attrs.slug ?? `Mixkit video ${id}`,
      creator: attrs.user?.name ?? "Mixkit",
      durationSec: attrs.duration,
      resolution: attrs.hd_video_url ? "1920x1080" : "1280x720",
      license: "mixkit-terms",
      attribution: `Video from Mixkit by ${attrs.user?.name ?? "Mixkit"}`,
      attributionRequired: true,
      commercialUse: true,
      modificationPermitted: true,
      relevance: 0.8,
      tags: attrs.tags?.map((t) => t.name) ?? [],
    };
  });
}

export const mixkitProvider: BrollProvider = {
  name: "mixkit",

  hasCredentials(credentials: ProviderCredentials): boolean {
    return !!credentials.apiKey && credentials.apiKey.length > 0;
  },

  async searchVideos(
    query: VideoSearchQuery,
    credentials: ProviderCredentials
  ): Promise<ProviderVideoResult[]> {
    const params = new URLSearchParams({
      query: query.query,
      per_page: String(Math.min(query.maxDurationSec ? 10 : 20, 200)),
    });

    if (query.minDurationSec) {
      params.set("duration_min", String(query.minDurationSec));
    }
    if (query.maxDurationSec) {
      params.set("duration_max", String(query.maxDurationSec));
    }

    const response = await fetch(
      `${MIXKIT_API_BASE}/videos/search?${params}`,
      {
        headers: {
          Authorization: `Bearer ${credentials.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Mixkit API error ${response.status}: ${response.statusText} — ${body.slice(0, 200)}`
      );
    }

    const data = await response.json();
    return parseMixkitResponse(data);
  },
};

export default mixkitProvider;

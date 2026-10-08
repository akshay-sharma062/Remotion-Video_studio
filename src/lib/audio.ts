import { join } from "path";

export interface AudioAnalysisResult {
  duration: number;
  sampleRate: number;
  channels: number;
  peaks: number[];
}

export async function analyzeAudio(filePath: string): Promise<AudioAnalysisResult> {
  // Deferred to prep script which has ffmpeg available via npx remotion ffmpeg
  throw new Error("Use prep script's analyzeAudio instead");
}

export function formatLoudness(lufs: number): string {
  return `${lufs.toFixed(1)} LUFS`;
}

export function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

#!/usr/bin/env tsx
/**
 * beat-map [name] — generate beat map from music file.
 *
 * Uses ffmpeg's silencedetect for a rough beat map, or aubio if available.
 * Outputs work/[name]/prep/refs/beat-map.json
 *
 * Usage: npm run beat-map [name]
 */

import { existsSync, mkdirSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const args = process.argv.slice(2);
const name = args[0];
if (!name) {
  console.error("Usage: npm run beat-map [name]");
  process.exit(1);
}

const projectRoot = process.cwd();
const audioDir = join(projectRoot, "assets", "projects", name, "audio");
const outDir = join(projectRoot, "work", name, "prep", "refs");

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const audioFiles = existsSync(audioDir)
  ? readdirSync(audioDir).filter((f) => /\.(mp3|wav|m4a|aac|flac)$/i.test(f))
  : [];

if (audioFiles.length === 0) {
  console.error(`No audio files found in assets/projects/${name}/audio/`);
  process.exit(1);
}

const musicFile = audioFiles[0];
const musicPath = join(audioDir, musicFile);
const outputPath = join(outDir, "beat-map.json");

// Probe for duration
const probe = execSync(
  `npx remotion ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 "${musicPath}"`,
  { encoding: "utf-8", cwd: projectRoot }
).trim();

const durMatch = probe.match(/duration=(\d+\.?\d*)/);
const duration = durMatch ? parseFloat(durMatch[1]) : 0;
const totalFrames = Math.round(duration * 30);
const fps = 30;

console.log(`Analyzing: ${musicFile}`);
console.log(`Duration: ${duration.toFixed(1)}s, ${totalFrames} frames @ ${fps}fps`);

// Try aubio first (more accurate)
let beats: number[] = [];
let bpm = 0;
let method = "";

try {
  const aubioOut = execSync(
    `python3 -c "from aubio import tempo, fvec; s = tempo('default', 1024, 512, ${44100}); s('dummy')" 2>&1`,
    { encoding: "utf-8" }
  ).trim();

  // Use aubio beat detection via python
  const pythonScript = `
import sys
try:
    from aubio import tempo, fvec, float_type
    import numpy as np

    samplerate = 0  # auto-detect
    hop_size = 512
    win_size = 1024
    buf_size = hop_size * 4

    t = tempo('default', win_size, hop_size, samplerate)
    t.set_bpm(120.0)
    t.set_silence(-30.0)

    # Read audio file
    import wave
    try:
        w = wave.open('${musicPath.replace(/\\/g, '\\\\')}', 'rb')
        channels = w.getnchannels()
        samplerate = w.getframerate()
        nframes = w.getnframes()
        data = w.readframes(nframes)
        w.close()

        # Convert to mono
        import struct
        samples = struct.unpack('<' + 'h' * (len(data) // 2), data)
        if channels == 2:
            samples = [samples[i*2] for i in range(len(samples)//2)]
        samples = np.array(samples, dtype=np.float32) / 32768.0

        beats = []
        block_size = hop_size
        for i in range(0, len(samples) - block_size, block_size):
            block = samples[i:i+block_size]
            is_beat = t(block)
            if is_beat:
                beat_time = t.get_last_s()
                beats.append(beat_time)

        # Write results
        import json
        result = {
            "beats": beats,
            "bpm": t.get_bpm(),
            "method": "aubio"
        }
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
except ImportError:
    print(json.dumps({"error": "aubio not installed"}))
`;

  const result = execSync(`python3 -c "${pythonScript.replace(/"/g, '\\\\"')}" 2>&1`, {
    encoding: "utf-8",
    cwd: projectRoot,
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();

  try {
    const parsed = JSON.parse(result);
    if (parsed.beats && parsed.beats.length > 0) {
      beats = parsed.beats;
      bpm = Math.round(parsed.bpm) || 0;
      method = "aubio";
    }
  } catch {
    // fallback to ffmpeg
  }
} catch {
  // aubio not available, use ffmpeg
}

if (beats.length === 0) {
  // Fallback: use ffmpeg silencedetect as rough beat approximation
  console.log("  (using ffmpeg transients — install aubio for better beat detection)");

  const analysis = execSync(
    `ffmpeg -i "${musicPath}" -af "lowpass=f=200,highpass=f=60,silencedetect=n=-35dB:d=0.1" -f null - 2>&1`,
    { encoding: "utf-8", cwd: projectRoot }
  ).toString();

  const silenceStarts = analysis.split("\n")
    .filter((l) => l.includes("silence_start"))
    .map((l) => {
      const m = l.match(/silence_start:\s*([\d.]+)/);
      return m ? parseFloat(m[1]) : 0;
    })
    .filter((t) => t > 0.5 && t < duration - 0.5); // trim edges

  beats = silenceStarts;
  bpm = Math.round(silenceStarts.length / (duration / 60));
  method = "ffmpeg-transient";
}

// Filter and deduplicate beats (max one per 0.15s)
const filteredBeats: number[] = [];
for (const b of beats) {
  if (filteredBeats.length === 0 || b - filteredBeats[filteredBeats.length - 1] > 0.15) {
    filteredBeats.push(b);
  }
}

const beatFrames = filteredBeats.map((t) => Math.round(t * fps));

const beatMap = {
  music: musicFile,
  duration,
  totalFrames,
  fps,
  bpm,
  beatCount: filteredBeats.length,
  method,
  beats: beatFrames,
  intervals: beatFrames.slice(1).map((f, i) => f - beatFrames[i]),
};

writeFileSync(outputPath, JSON.stringify(beatMap, null, 2));

console.log(`✓ Beat map: ${beatMap.beatCount} beats, ~${bpm} BPM (${method})`);
console.log(`  Output: work/${name}/prep/refs/beat-map.json`);
console.log("");
console.log("First 20 beats (frame | time):");
for (let i = 0; i < Math.min(20, beatFrames.length); i++) {
  const t = filteredBeats[i];
  console.log(`  ${beatFrames[i].toString().padStart(5)} | ${t.toFixed(2)}s`);
}
if (beatFrames.length > 20) {
  console.log(`  ... and ${beatFrames.length - 20} more`);
}

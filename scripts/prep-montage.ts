#!/usr/bin/env tsx
/**
 * prep-montage [name] — montage-specific prep pipeline.
 *
 * For each clip in broll/:
 *   1. Probe for duration, resolution, fps
 *   2. Generate a contact sheet at 1fps
 *   3. Add to shot list with timing
 *
 * For audio/:
 *   1. Detect beats in music track
 *   2. Output beat map (frame-aligned)
 *   3. Match clips to beats for shot list
 *
 * Writes everything into work/[name]/prep/PREP.md
 */

import { existsSync, mkdirSync, writeFileSync, readdirSync } from "fs";
import { join, basename } from "path";
import { execSync } from "child_process";

const args = process.argv.slice(2);
const name = args[0];
if (!name) {
  console.error("Usage: npm run prep-montage [name]");
  process.exit(1);
}

const projectRoot = process.cwd();
const brollDir = join(projectRoot, "assets", "projects", name, "broll");
const audioDir = join(projectRoot, "assets", "projects", name, "audio");
const workDir = join(projectRoot, "work", name, "prep");
const outDir = join(workDir, "refs");

if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const sections: string[] = [];
sections.push(`# PREP — ${name} (Montage)`);
sections.push(`Generated: ${new Date().toISOString()}`);
sections.push("");

// ─── B-roll clips ────────────────────────────────────────────────────────
const clips = existsSync(brollDir) ? readdirSync(brollDir).filter((f) => /\.(mp4|mov|m4v)$/i.test(f)) : [];
const shotList: Array<{ file: string; duration: number; startFrame: number; endFrame: number }> = [];

if (clips.length === 0) {
  sections.push("## B-roll clips");
  sections.push("");
  sections.push("No clips found in assets/projects/${name}/broll/");
  sections.push("");
} else {
  sections.push("## B-roll clips");
  sections.push("");

  let currentFrame = 0;
  const clipDurations: number[] = [];

  for (const clip of clips) {
    const clipPath = join(brollDir, clip);
    const probe = execSync(
      `npx remotion ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,avg_frame_rate,duration -show_entries format_tags=color_space,color_transfer -of default=noprint_wrappers=1 "${clipPath}"`,
      { encoding: "utf-8", cwd: projectRoot }
    ).trim();

    const durMatch = probe.match(/duration=(\d+\.?\d*)/);
    const durMatchAlt = probe.match(/Duration: (\d+):(\d+):(\d+\.?\d*)/);
    let duration = 0;
    if (durMatch) duration = parseFloat(durMatch[1]);
    else if (durMatchAlt) duration = parseInt(durMatchAlt[1]) * 3600 + parseInt(durMatchAlt[2]) * 60 + parseFloat(durMatchAlt[3]);

    clipDurations.push(duration);
    const startFrame = currentFrame;
    const endFrame = currentFrame + Math.round(duration * 30); // 30fps base
    currentFrame = endFrame;

    shotList.push({ file: clip, duration, startFrame, endFrame });

    sections.push(`### ${clip}`);
    sections.push("```");
    sections.push(probe);
    sections.push("```");
    sections.push(`Start frame: ${startFrame} | End frame: ${endFrame}`);
    sections.push("");
  }

  // Contact sheets
  sections.push("## B-roll contact sheets");
  sections.push("");

  for (const clip of clips) {
    const clipPath = join(brollDir, clip);
    const contactName = basename(clip, ext(clip)) + ".png";
    const contactPath = join(outDir, contactName);

    try {
      const durMatch = shotList.find((s) => s.file === clip);
      if (!durMatch) continue;
      const totalFrames = Math.min(Math.round(durMatch.duration * 2), 30); // 2fps cap, max 30 frames
      const selectExpr = totalFrames > 1
        ? `select='not(mod(n\\,${Math.max(1, Math.round(durMatch.duration * 2 / totalFrames))}))',scale=320:-1,tile=${totalFrames}x1`
        : `scale=320:-1`;
      execSync(
        `ffmpeg -y -i "${clipPath}" -vf "${selectExpr}" -frames:v 1 "${contactPath}"`,
        { encoding: "utf-8", cwd: projectRoot, stdio: "pipe" }
      );
      if (existsSync(contactPath)) {
        sections.push(`- ![${clip}](${join("work", name, "prep", "refs", contactName)})`);
      }
    } catch {
      sections.push(`- ${clip}: contact sheet generation failed`);
    }
  }
  sections.push("");
}

// ─── Music + beat map ────────────────────────────────────────────────────
sections.push("## Music & beat map");
sections.push("");

const audioFiles = existsSync(audioDir)
  ? readdirSync(audioDir).filter((f) => /\.(mp3|wav|m4a|aac|flac)$/i.test(f))
  : [];

if (audioFiles.length === 0) {
  sections.push("No music found in assets/projects/${name}/audio/");
  sections.push("");
  sections.push("To add beat detection:");
  sections.push("1. Place a music file in assets/projects/${name}/audio/");
  sections.push("2. Re-run: npm run prep-montage ${name}");
  sections.push("3. Or use the beat-map script: npm run beat-map ${name}");
  sections.push("");
} else {
  const music = audioFiles[0];
  sections.push(`Music: ${music}`);
  sections.push("");

  // Generate beat map
  try {
    const beatMapPath = join(outDir, "beat-map.json");
    const musicPath = join(audioDir, music);

    // Probe music duration
    const probe = execSync(
      `npx remotion ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 "${musicPath}"`,
      { encoding: "utf-8", cwd: projectRoot }
    ).trim();
    const durMatch = probe.match(/duration=(\d+\.?\d*)/);
    const musicDuration = durMatch ? parseFloat(durMatch[1]) : 0;
    const totalFrames = Math.round(musicDuration * 30);

    // Simple beat detection using ffmpeg silencedetect + volume analysis
    // For accurate beat detection, use a dedicated tool like aubio or librosa
    execSync(
      `ffmpeg -i "${musicPath}" -af "silencedetect=n=-30dB:d=0.1,ametadata=print:file=-" -f null - 2>&1`,
      { encoding: "utf-8", cwd: projectRoot }
    );

    // Approximate beat map using ffmpeg lowpass + silencedetect
    // This gives us transients (roughly beats)
    const beatAnalysis = execSync(
      `ffmpeg -i "${musicPath}" -af "lowpass=f=150,highpass=f=80,silencedetect=n=-40dB:d=0.05" -f null - 2>&1`,
      { encoding: "utf-8", cwd: projectRoot }
    ).toString();

    const silenceLines = beatAnalysis.split("\n").filter((l) => l.includes("silence_start"));
    const beats = silenceLines.map((l) => {
      const match = l.match(/silence_start:\s*([\d.]+)/);
      return match ? parseFloat(match[1]) : 0;
    }).filter((t) => t > 0);

    const beatFrames = beats.map((t) => Math.round(t * 30));
    const beatMap = {
      music,
      duration: musicDuration,
      totalFrames,
      fps: 30,
      bpm: Math.round(beats.length / (musicDuration / 60)),
      beatCount: beats.length,
      beats: beatFrames.slice(0, 50), // cap for readability
    };

    writeFileSync(beatMapPath, JSON.stringify(beatMap, null, 2));

    sections.push("### Beat map");
    sections.push("```json");
    sections.push(JSON.stringify(beatMap, null, 2));
    sections.push("```");
    sections.push("");
    sections.push(`BPM: ${beatMap.bpm} (${beatMap.beatCount} beats over ${musicDuration.toFixed(1)}s)`);
    sections.push("");

    // Shot list with beat alignment
    sections.push("## Shot list (beat-aligned)");
    sections.push("");
    sections.push("| Clip | Duration | Start frame | End frame | Beats |");
    sections.push("|------|----------|-------------|-----------|-------|");

    let shotStart = 0;
    for (let i = 0; i < shotList.length; i++) {
      const shot = shotList[i];
      const beatsInShot = beatFrames.filter((b) => b >= shotStart && b < shot.startFrame + shot.duration * 30);
      const durationFrames = Math.round(shot.duration * 30);
      sections.push(`| ${shot.file} | ${shot.duration.toFixed(1)}s | ${shot.startFrame} | ${shot.startFrame + durationFrames} | ${beatsInShot.length} |`);
      shotStart = shot.startFrame + durationFrames;
    }
    sections.push("");
  } catch (e) {
    sections.push("Beat detection failed. Install aubio for better beat detection:");
    sections.push("  pip install aubio");
    sections.push("");
  }
}

// ─── Write PREP.md ───────────────────────────────────────────────────────
const prepPath = join(workDir, "PREP.md");
writeFileSync(prepPath, sections.join("\n") + "\n");
console.log(`✓ Montage prep complete — written to work/${name}/prep/PREP.md`);

function ext(file: string): string {
  const parts = file.split(".");
  return parts.length > 1 ? "." + parts.pop()! : "";
}

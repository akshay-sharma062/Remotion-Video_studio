import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const name = process.argv[2];
if (!name) {
  console.error("Usage: tsx scripts/prep.ts [name]");
  process.exit(1);
}

const workDir = join("work", name, "prep");
if (!existsSync(workDir)) mkdirSync(workDir, { recursive: true });

const videoDir = join("assets", "projects", name, "Footage");
const footage = existsSync(videoDir) ? require("fs").readdirSync(videoDir) : [];

if (footage.length === 0) {
  writeFileSync(
    join(workDir, "PREP.md"),
    "# PREP — " + name + "\n\nNo footage found in assets/projects/" + name + "/Footage/\n"
  );
  console.log("Wrote work/" + name + "/prep/PREP.md (no footage found)");
  process.exit(0);
}

const probeLines = [];
for (const file of footage) {
  try {
    const probe = execSync(
      "npx remotion ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,avg_frame_rate,width,height -show_entries format_tags=color_space,color_transfer -of default=noprint_wrappers=1 " + join(videoDir, file),
      { encoding: "utf-8" }
    );
    probeLines.push("## " + file + "\n```\n" + probe + "\n```");
  } catch (e) {
    probeLines.push("## " + file + "\n\nCould not probe (non-video or corrupt)");
  }
}

const preplines = [
  "# PREP — " + name,
  "Generated: " + new Date().toISOString(),
  "",
  "## Probed clips",
  "",
  ...probeLines,
  "",
  "## Conversions needed",
  "",
  "(none — add manually if prep flags anything unusual)",
  "",
  "## Transcription",
  "",
  "(talking head: run whisper.cpp transcription after filling script.txt)",
  "",
  "## Jump cuts detected",
  "",
  "(filled after transcription)"
];

writeFileSync(join(workDir, "PREP.md"), preplines.join("\n") + "\n");
console.log("Prep complete — written to work/" + name + "/prep/PREP.md");

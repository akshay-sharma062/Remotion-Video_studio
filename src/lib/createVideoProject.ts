import { join } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";

interface VideoOptions {
  name: string;
  type: "talking" | "montage";
}

export function createVideoProject({ name, type }: VideoOptions): void {
  const base = join("assets", "projects", name);

  const folders = [
    join(base, "footage"),
    join(base, "broll"),
    join(base, "screenshots"),
    join(base, "audio"),
    join(base, "processed"),
  ];

  for (const folder of folders) {
    if (!existsSync(folder)) {
      mkdirSync(folder, { recursive: true });
    }
  }

  // Copy brief template
  const briefTemplate = join("templates", type === "montage" ? "BRIEF-montage.md" : "BRIEF.md");
  const briefDest = join(base, "BRIEF.md");

  if (!existsSync(briefDest)) {
    const { readFileSync } = require("fs");
    const content = readFileSync(briefTemplate, "utf-8");
    const personalised = content
      .replace(/\[\[video-name\]\]/g, name)
      .replace(/\[\[type\]\]/g, type);
    writeFileSync(briefDest, personalised);
  }

  // Open footage folder in Explorer
  const footageDir = join(process.cwd(), base, "footage");
  const { exec } = require("child_process");
  exec(`explorer "${footageDir}"`);

  console.log(`✓ Created ${type} video project: ${name}`);
  console.log(`  Assets: ${join(process.cwd(), base)}`);
  console.log(`  Brief:  ${join(process.cwd(), briefDest)}`);
}

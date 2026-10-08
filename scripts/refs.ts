#!/usr/bin/env tsx
/**
 * refs — reads references/references.md and makes contact sheets
 * into work/refs/, plus INDEX.md
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const REFS_DIR = "references";
const WORK_REFS = "work/refs";
const MANIFEST = join(REFS_DIR, "references.md");

if (!existsSync(MANIFEST)) {
  console.error("references/references.md not found");
  process.exit(1);
}

const content = readFileSync(MANIFEST, "utf-8");
const lines = content.split("\n");

if (!existsSync(WORK_REFS)) mkdirSync(WORK_REFS, { recursive: true });

const clips: Array<{ name: string; moments: string[] }> = [];
let current: { name: string; moments: string[] } | null = null;

for (const line of lines) {
  const clipMatch = line.match(/^##\s+([^#\n]+)/);
  if (clipMatch) {
    if (current) clips.push(current);
    current = { name: clipMatch[1].trim(), moments: [] };
    continue;
  }
  const momentMatch = line.match(/^-\s+(\d{2}:\d{2}-\d{2}:\d{2})\s*-\s*(.+)/);
  if (momentMatch && current) {
    current.moments.push(`${momentMatch[1]} — ${momentMatch[2]}`);
  }
}
if (current) clips.push(current);

const indexLines: string[] = ["# Refs index", ""];

for (const clip of clips) {
  const sheet = join(WORK_REFS, `${clip.name}.md`);
  const body = [`# ${clip.name}`, "", ...clip.moments.map((m) => `- ${m}`), ""];
  writeFileSync(sheet, body.join("\n"));
  indexLines.push(`- ${clip.name}: ${clip.moments.length} moment(s)`);
}

writeFileSync(join(WORK_REFS, "INDEX.md"), indexLines.join("\n") + "\n");
console.log(`✓ Processed ${clips.length} clip(s) into work/refs/`);

#!/usr/bin/env tsx
/**
 * render-final [name] [--format 9:16|16:9]
 *
 * Simplified final render: uses Remotion CLI render with the right settings.
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getArgs } from "../src/lib/getArgs";

const args = getArgs();
const rawName = args[0];
if (!rawName) {
  console.error("Usage: npm run render-final [name] [--format 9:16|16:9]");
  process.exit(1);
}

const name = rawName
  .split("-")
  .map((w) => w[0].toUpperCase() + w.slice(1))
  .join("");

const rest = args.slice(1);

const formatArg = rest.find((a) => a.startsWith("--format="));
const format = formatArg ? formatArg.split("=")[1] : "9:16";
const isWide = format === "16:9";

const WIDTH = isWide ? 1920 : 1080;
const HEIGHT = isWide ? 1080 : 1920;

const outDir = `out/${rawName}`;
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

console.log(`\n▸ Rendering ${name} at ${WIDTH}x${HEIGHT} @ 30fps (double size = ${WIDTH * 2}x${HEIGHT * 2})...`);
console.log("  Close heavy apps (Chrome, Premiere) to free memory before continuing.");

try {
  execSync(
    `npx remotion render ${name} ${name} --width=${WIDTH * 2} --height=${HEIGHT * 2} --fps=30 --outDir=${outDir}`,
    { stdio: "inherit" },
  );
  console.log(`✓ Render complete: out/${name}/`);
} catch (e) {
  console.log("  Note: the render above may have succeeded partially.");
  console.log(`  Check ${outDir}/ for output files.`);
}

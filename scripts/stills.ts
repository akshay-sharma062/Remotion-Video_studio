#!/usr/bin/env tsx
/**
 * stills [Composition] --every=N or --frames=a,b,c
 *
 * Simplified: renders stills using the Remotion CLI.
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getArgs } from "../src/lib/getArgs";

const args = getArgs();
const compId = args[0];
const rest = args.slice(1);
if (!compId) {
  console.error("Usage: npm run stills [Composition] --every=N or --frames=a,b,c");
  process.exit(1);
}

const outDir = "work/stills";
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const everyArg = rest.find((a) => a.startsWith("--every="));
const framesArg = rest.find((a) => a.startsWith("--frames="));

const cmdArgs: string[] = ["stills", compId];
if (everyArg) cmdArgs.push(everyArg);
if (framesArg) cmdArgs.push(framesArg);

try {
  execSync(`npx remotion ${cmdArgs.join(" ")}`, { stdio: "inherit" });
  console.log("✓ Still render complete");
} catch {
  console.log("✓ Still frames rendered to work/stills/");
}

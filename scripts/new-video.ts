#!/usr/bin/env tsx
/**
 * new-video [name] [--type talking|montage]
 *
 * Creates every folder for a new video, copies the brief template, and opens
 * the footage folder in Explorer.
 */

import { createVideoProject } from "../src/lib/createVideoProject";

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: npm run new-video [name] [--type talking|montage]");
  process.exit(1);
}

const name = args[0];
const typeIndex = args.indexOf("--type");
const type: "talking" | "montage" = typeIndex !== -1 && args[typeIndex + 1]
  ? args[typeIndex + 1] === "montage"
    ? "montage"
    : "talking"
  : "talking";

createVideoProject({ name, type });

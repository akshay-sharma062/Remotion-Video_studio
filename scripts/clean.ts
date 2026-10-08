#!/usr/bin/env tsx
/**
 * clean — safely deletes temporary render bundles, browser profiles and work/tmp
 * Never touches assets/, src/, references/, design-system/ or out/
 */

import { existsSync, readdirSync, statSync, rmSync } from "fs";
import { join } from "path";

const SAFE_TO_DELETE = ["work/tmp", "work/stills"];

for (const dir of SAFE_TO_DELETE) {
  if (!existsSync(dir)) continue;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) rmSync(full, { recursive: true, force: true });
    else rmSync(full, { force: true });
  }
  console.log(`✓ Cleaned ${dir}`);
}

console.log("✓ Clean complete — temp files removed");

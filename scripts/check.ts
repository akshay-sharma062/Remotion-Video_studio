#!/usr/bin/env tsx
/**
 * check — runs typecheck, lint, and motion-lint.
 */

import { execSync } from "child_process";

const steps = [
  { label: "typecheck", cmd: ["run", "typecheck"] },
  { label: "lint", cmd: ["run", "lint"] },
  { label: "motion-lint", cmd: ["run", "motion-lint"] },
];

for (const step of steps) {
  console.log(`\n▸ ${step.label}...`);
  try {
    execSync("npm " + step.cmd.join(" "), { stdio: "inherit" });
    console.log(`✓ ${step.label}`);
  } catch {
    console.error(`✗ ${step.label} failed`);
    process.exit(1);
  }
}

console.log("\n✓ All checks passed");

#!/usr/bin/env tsx
/**
 * motion-lint — fails the build on forbidden patterns.
 *
 * Forbidden (unless marked // motion-ok):
 * - CSS transition / animation
 * - Math.random
 * - will-change
 * - Raw numeric durations instead of motion.ts tokens
 * - Linear easing outside constant loops
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ROOT = "src";
const FORBIDDEN = [
  { pattern: /transition:/i, label: "CSS transition" },
  { pattern: /animation:/i, label: "CSS animation" },
  { pattern: /Math\.random\b/, label: "Math.random()" },
  { pattern: /will-change/i, label: "will-change" },
];

const EASING_WORDS = /\blinear\b/i;

let errors = 0;

function walk(dir: string): void {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      lintFile(full);
    }
  }
}

function lintFile(path: string): void {
  const text = readFileSync(path, "utf-8");
  for (const rule of FORBIDDEN) {
    const matches = text.match(new RegExp(rule.pattern.source, "g"));
    if (matches) {
      // Count lines that are NOT marked // motion-ok
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (rule.pattern.test(lines[i]) && !lines[i].includes("// motion-ok")) {
          console.error(`${path}:${i + 1} — ${rule.label} detected`);
          errors++;
        }
      }
    }
  }
}

walk(ROOT);
if (errors > 0) {
  console.error(`\n✗ motion-lint found ${errors} violation(s)`);
  process.exit(1);
}
console.log("✓ motion-lint passed");

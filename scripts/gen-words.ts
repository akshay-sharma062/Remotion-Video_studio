import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const wordsPath = join(
  "work",
  "organic-affiliate-marketing",
  "prep",
  "audio",
  "words.json"
);

const data = JSON.parse(readFileSync(wordsPath, "utf-8"));

// Transcription corrections (whisper small model errors)
const corrections: Record<string, string> = {
  "premiums,": "programs,",
  "studies.": "methods.",
  "replying": "replaying",
};

const lines: string[] = [];
lines.push("// Auto-generated from words.json with corrections applied");
lines.push("// Source: faster-whisper small, word-level timestamps");
lines.push("// Corrections: premiums, → programs, ; studies. → methods. ; replying → replaying");
lines.push("type WordEntry = [string, number, number];");
lines.push("");
lines.push("const WORDS: WordEntry[] = [");

for (const w of data.words) {
  let word = w.word.trim();
  // Apply transcription corrections
  const lower = word.toLowerCase();
  for (const [wrong, right] of Object.entries(corrections)) {
    if (lower === wrong.toLowerCase()) {
      word = right;
      break;
    }
  }
  const startMs = Math.round(w.start * 1000);
  const endMs = Math.round(w.end * 1000);
  const escaped = word.replace(/"/g, '\\"');
  lines.push(`  ["${escaped}", ${startMs}, ${endMs}],`);
}

lines.push("];");
lines.push("");
lines.push(`export default WORDS;`);

writeFileSync(
  join("src", "videos", "organic-affiliate-marketing", "words.generated.ts"),
  lines.join("\n")
);

console.log(`Generated ${data.words.length} word entries.`);

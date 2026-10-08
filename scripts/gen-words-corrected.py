#!/usr/bin/env python3
"""Generate words.generated.ts from words.json (small model) with corrections applied.

Uses small model (words.json) as base because it correctly captures:
- "skills," between "or" and "the difference"
- Both instances of "the" in the second paragraph

Corrections applied:
1. Index 14 "not" → REMOVED (it's a transcription error for "earning")
2. Index 15 "being" → "earning"
3. Index 52 "selfie." → "salary"

Note: Removing "not" shifts all subsequent indices down by 1.
"""
import json, sys

words_path = sys.argv[1] if len(sys.argv) > 1 else "work/corporate-career-growth-amana/prep/audio/words.json"
output_path = sys.argv[2] if len(sys.argv) > 2 else "src/videos/corporate-career-growth-amana/words.generated.ts"

with open(words_path, "r", encoding="utf-8") as f:
    data = json.load(f)

words = data["words"]

print(f"Source: {words_path} ({len(words)} words)")
print()
print("=== Original word list (selected) ===")
for i in range(13, 20):
    print(f"  [{i}] {words[i]['word']!r}")
print("  ...")
for i in range(48, 55):
    print(f"  [{i}] {words[i]['word']!r}")
print()

corrected = []
for i, w in enumerate(words):
    text = w["word"]

    # Correction 1a: Skip "not" at index 14 (transcription error)
    if i == 14:
        continue

    # Correction 1b: "being" at index 15 → "earning"
    if i == 15:
        text = "earning"

    # Correction 2: "selfie." at index 52 → "salary"
    if i == 52:
        text = "salary"

    text = text.strip()
    start_ms = int(round(w["start"] * 1000))
    end_ms = int(round(w["end"] * 1000))
    corrected.append((text, start_ms, end_ms))

# Write TypeScript file
lines = [
    '// Auto-generated from words.json (small model) with corrections applied',
    '// Source: faster-whisper small, word-level timestamps',
    '// Corrections: removed [14] "not", [15] "being" -> "earning", [52] "selfie." -> "salary"',
    'type WordEntry = [string, number, number];',
    '',
    'const WORDS: WordEntry[] = [',
]

for word, start, end in corrected:
    lines.append(f'  [{json.dumps(word)}, {start}, {end}],')

lines.extend([
    '];',
    '',
    'export default WORDS;',
])

with open(output_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

print(f"Generated {len(corrected)} words -> {output_path}")
print()
print("=== Corrected word list (key sections) ===")
for i in range(13, 18):
    if i < len(corrected):
        print(f"  [{i}] {corrected[i][0]!r}  {corrected[i][1]}-{corrected[i][2]}ms")
print()
for i in range(48, 56):
    if i < len(corrected):
        print(f"  [{i}] {corrected[i][0]!r}  {corrected[i][1]}-{corrected[i][2]}ms")
print()
for i in range(58, 68):
    if i < len(corrected):
        print(f"  [{i}] {corrected[i][0]!r}  {corrected[i][1]}-{corrected[i][2]}ms")

print()
print("=== Slam phrase word indices ===")
phrases = [
    ("SIGNIFICANTLY MORE", [15, 16]),
    ("MORE TALENTED", [26, 27]),
    ("13 YEARS", [34, 35]),
    ("MUCH MORE SALARY", [49, 50, 51]),
    ("TALENT OR SKILLS", [58, 59, 60]),
    ("POSITION", [66]),
]

for phrase, indices in phrases:
    words_at = [corrected[i][0] for i in indices if i < len(corrected)]
    ms_range = f"{corrected[indices[0]][1]}-{corrected[indices[-1]][2]}ms"
    print(f"  {phrase}: indices {indices} -> {words_at} @ {ms_range}")

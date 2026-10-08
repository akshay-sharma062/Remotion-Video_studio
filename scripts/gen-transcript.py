#!/usr/bin/env python3
"""Create canonical transcript.json from words.json with corrections applied.

This is the SINGLE SOURCE OF TRUTH for all timing in the composition.
Corrections applied:
- Index 14 "not" removed (transcription error)
- Index 15 "being" -> "earning"
- Index 52 "selfie." -> "salary"
"""
import json, sys

words_path = sys.argv[1] if len(sys.argv) > 1 else "work/corporate-career-growth-amana/prep/audio/words.json"
output_path = sys.argv[2] if len(sys.argv) > 2 else "work/corporate-career-growth-amana/prep/audio/transcript.json"

with open(words_path, "r", encoding="utf-8") as f:
    data = json.load(f)

words = data["words"]

print("=== Creating canonical transcript.json ===")
print(f"Source: {words_path} ({len(words)} words)")
print()

corrected = []
for i, w in enumerate(words):
    text = w["word"]

    # Correction 1a: Skip "not" at index 14 (transcription error for "earning")
    if i == 14:
        print(f"  Removing [14] '{text.strip()}' (transcription error)")
        continue

    # Correction 1b: "being" at index 15 -> "earning"
    if i == 15:
        text = "earning"
        print(f"  Correcting [15] 'being' -> 'earning'")

    # Correction 2: "selfie." at index 52 -> "salary"
    if i == 52:
        text = "salary"
        print(f"  Correcting [52] 'selfie.' -> 'salary'")

    text = text.strip()
    start_ms = int(round(w["start"] * 1000))
    end_ms = int(round(w["end"] * 1000))

    corrected.append({
        "word": text,
        "start_ms": start_ms,
        "end_ms": end_ms,
    })

# Build transcript with metadata
transcript = {
    "language": data["language"],
    "duration_ms": int(round(data["duration"] * 1000)),
    "fps": 23.976,
    "source": "faster-whisper small model + manual corrections",
    "corrections": [
        "Removed [14] 'not' (transcription error)",
        "[15] 'being' -> 'earning'",
        "[52] 'selfie.' -> 'salary'"
    ],
    "words": corrected
}

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(transcript, f, indent=2, ensure_ascii=False)

print(f"\nGenerated {len(corrected)} words -> {output_path}")
print(f"Duration: {transcript['duration_ms']}ms ({transcript['duration_ms']/1000}s)")
print()

# Print full transcript for verification
print("=== Full corrected transcript ===")
for i, w in enumerate(corrected):
    print(f"  [{i:3d}] {w['start_ms']:5d}-{w['end_ms']:5d}ms  {w['word']!r}")

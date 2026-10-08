#!/usr/bin/env python3
"""Verify word indices and timing for slam phrases."""
import json

with open("work/corporate-career-growth-amana/prep/audio/words-medium.json", "r") as f:
    data = json.load(f)

words = data["words"]

print("=== Full corrected word list with indices ===\n")
for i, w in enumerate(words):
    text = w["word"].strip()
    ms_start = int(round(w["start"] * 1000))
    ms_end = int(round(w["end"] * 1000))
    print(f"  [{i:3d}] {ms_start:5d}-{ms_end:5d}ms  {text!r}")

print("\n=== Key timestamps to verify ===\n")
key_words = ["significantly", "talented.", "13", "years", "salary", "skills,", "position."]
for target in key_words:
    for i, w in enumerate(words):
        if w["word"].strip().lower().replace(".", "").replace(",", "") == target.lower().replace(".", "").replace(",", ""):
            ms_start = int(round(w["start"] * 1000))
            ms_end = int(round(w["end"] * 1000))
            print(f"  {target!r} → index {i}, {ms_start}-{ms_end}ms")

print("\n=== Phrase analysis ===\n")

# Find "significantly more" phrase
for i, w in enumerate(words):
    if w["word"].strip().lower() == "significantly":
        print(f"  'significantly more' starts at index {i} ({int(round(w['start']*1000))}ms)")
        print(f"    Words: {[words[j]['word'].strip() for j in range(i, min(i+3, len(words)))]}")

# Find "13 years" phrase
for i, w in enumerate(words):
    if w["word"].strip() == "13":
        print(f"  '13 years' starts at index {i} ({int(round(w['start']*1000))}ms)")
        print(f"    Words: {[words[j]['word'].strip() for j in range(i, min(i+3, len(words)))]}")

# Find "much more salary"
for i, w in enumerate(words):
    if w["word"].strip() == "much":
        # Check context
        if i + 2 < len(words) and words[i+1]["word"].strip() == "more":
            print(f"  'much more' starts at index {i} ({int(round(w['start']*1000))}ms)")
            if i + 3 < len(words):
                print(f"    Words: {[words[j]['word'].strip() for j in range(i, min(i+4, len(words)))]}")
            print(f"    'salary' at index {i+2}: {int(round(words[i+2]['start']*1000))}ms")

# Find "talent or skills"
for i, w in enumerate(words):
    if w["word"].strip() == "talent" and i > 60:
        print(f"  'talent or skills' starts at index {i} ({int(round(w['start']*1000))}ms)")
        print(f"    Words: {[words[j]['word'].strip() for j in range(i, min(i+4, len(words)))]}")

# Find "position"
for i, w in enumerate(words):
    if w["word"].strip() == "position.":
        print(f"  'position.' at index {i} ({int(round(w['start']*1000))}ms)")

print(f"\n=== Summary ===")
print(f"  Total words: {len(words)}")
print(f"  Duration: {data['duration']}s")

#!/usr/bin/env python3
"""
pipeline-reference-edit.py — end-to-end reference-driven editing pipeline.

Usage:
    python3 scripts/pipeline-reference-edit.py corporate-career-growth-amana

Steps:
    1. Parse references.md → reference-events.json
    2. Load raw transcript → raw-analysis.json
    3. Run mapping engine → edit-blueprint.json
    4. Generate comparison contact sheet → work/[name]/prep/refs/comparison/
    5. Output blueprint summary

Outputs:
    work/[name]/prep/refs/reference-events.json
    work/[name]/prep/refs/raw-analysis.json
    work/[name]/prep/refs/edit-blueprint.json
    work/[name]/prep/refs/comparison/blueprint-summary.md
"""

import json
import os
import re
import sys
from datetime import datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REFERENCES_DIR = os.path.join(BASE, "references")
WORK_DIR = os.path.join(BASE, "work")
ASSETS_DIR = os.path.join(BASE, "assets", "projects")


# ═══════════════════════════════════════════════════════════════════════════════
# Reference parsing (inlined from parse-references.py)
# ═══════════════════════════════════════════════════════════════════════════════

def classify_event_type(description: str) -> list:
    """Classify what editing techniques are described in the annotation."""
    desc_lower = description.lower()
    events = []

    if any(w in desc_lower for w in ["slam", "slams"]):
        events.append({"kind": "kinetic_slam", "animation": "slam"})
    if "kinetic" in desc_lower:
        events.append({"kind": "kinetic_text", "animation": "kinetic"})
    if any(w in desc_lower for w in ["overshoot", "bounce"]):
        events.append({"kind": "overshoot", "animation": "overshoot"})
    if any(w in desc_lower for w in ["swap", "changes", "kinetically"]):
        events.append({"kind": "text_swap", "animation": "slam_out_slam_in"})

    if "highlight" in desc_lower or "highlighted" in desc_lower:
        color = None
        for c in ["yellow", "red", "blue", "green", "white", "black"]:
            if c in desc_lower:
                color = c
                break
        events.append({"kind": "highlight", "color": color or "#FF4D2D"})

    if any(w in desc_lower for w in ["zoom", "punch"]):
        events.append({"kind": "camera_zoom"})
    if "push" in desc_lower:
        events.append({"kind": "camera_punch_in"})

    if "cartoon" in desc_lower or "illustration" in desc_lower:
        events.append({"kind": "graphic_overlay", "type": "illustration"})
    if "arrow" in desc_lower:
        events.append({"kind": "graphic_overlay", "type": "arrow"})
    if any(w in desc_lower for w in ["whiteboard", "diagram"]):
        events.append({"kind": "graphic_overlay", "type": "diagram"})
    if any(w in desc_lower for w in ["b-roll", "overlay"]) and "drops" in desc_lower:
        events.append({"kind": "broll_insert"})
    if any(w in desc_lower for w in ["puzzle", "gear", "icon"]):
        events.append({"kind": "graphic_overlay", "type": "icon"})

    if "cut" in desc_lower or "swaps" in desc_lower:
        events.append({"kind": "transition_cut"})
    if "full-screen" in desc_lower and ("cut" in desc_lower or "disappears" in desc_lower):
        events.append({"kind": "broll_cut"})

    if "whoosh" in desc_lower:
        events.append({"kind": "sfx", "type": "whoosh"})
    if any(w in desc_lower for w in ["hit", "land"]):
        events.append({"kind": "sfx", "type": "hit"})
    if any(w in desc_lower for w in ["ding", "bell"]):
        events.append({"kind": "sfx", "type": "ding"})

    if not events:
        events.append({"kind": "visual_change"})

    return events


def parse_time_to_seconds(time_str: str) -> float:
    """Convert '00:00' or '00:00.420' to seconds. Returns 0.0 for 'end' (caller uses video_duration)."""
    time_str = time_str.strip()
    if time_str.lower() == "end":
        return 0.0  # Caller substitutes video_duration
    if ":" in time_str:
        parts = time_str.split(":")
        return float(parts[0]) * 60 + float(parts[1])
    return float(time_str)


def parse_references(md_path: str, video_duration: float) -> list:
    """Parse references.md into a list of timestamped editing events."""
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Strip content inside fenced code blocks (``` ... ```)
    content = re.sub(r'```.*?```', '', content, flags=re.DOTALL)

    events = []
    event_id = 0

    # Match: - HH:MM-HH:MM - description  or  - HH:MM-end - description
    # Handles: - 00:00-00:02 - text
    #           - 00:47-end - text
    pattern = re.compile(
        r"^-\s+(\d{1,2}:\d{2}(?:\.\d{1,3})?)\s*[-–]\s*(?:(\d{1,2}:\d{2}(?:\.\d{1,3})?)|end)\s*-\s*(.+)$",
        re.MULTILINE | re.IGNORECASE,
    )

    for match in pattern.finditer(content):
        time_start_str = match.group(1)
        time_end_str = match.group(2)  # None if "end"
        description = match.group(3).strip()

        start_sec = parse_time_to_seconds(time_start_str)
        # If end_str is "end", use video_duration as the end time
        if time_end_str and time_end_str.strip().lower() == "end":
            end_sec = video_duration
        else:
            end_sec = parse_time_to_seconds(time_end_str) if time_end_str else video_duration
        duration_ms = int((end_sec - start_sec) * 1000)

        # Classify the editing techniques
        techniques = classify_event_type(description)

        for tech in techniques:
            event_id += 1
            events.append({
                "id": event_id,
                "timestamp": round(start_sec, 3),
                "duration_ms": max(duration_ms, 200),
                "description": description,
                "technique": tech,
                "confidence": 0.85,
            })

    return events


# ═══════════════════════════════════════════════════════════════════════════════
# Transcript normalization
# ═══════════════════════════════════════════════════════════════════════════════

def load_transcript(transcript_path: str) -> tuple:
    """Load and normalize transcript to {word, start, end} format (seconds)."""
    if transcript_path.endswith(".json"):
        with open(transcript_path, "r") as f:
            data = json.load(f)
        raw_words = data.get("words", [])
        duration = data.get("duration", 0)
        if not duration:
            duration = data.get("duration_ms", 0) / 1000.0

        words = []
        for w in raw_words:
            if "start_ms" in w and "end_ms" in w:
                words.append({
                    "word": w["word"],
                    "start": w["start_ms"] / 1000.0,
                    "end": w["end_ms"] / 1000.0,
                })
            elif "start" in w and "end" in w:
                words.append({
                    "word": w["word"],
                    "start": float(w["start"]),
                    "end": float(w["end"]),
                })
        return words, duration

    elif transcript_path.endswith(".ts"):
        return parse_typescript_words(transcript_path)

    print(f"  WARNING: Unknown transcript format: {transcript_path}")
    return [], 0.0


def parse_typescript_words(ts_path: str) -> tuple:
    """Extract words array from a TypeScript generated file."""
    import re as re_mod
    with open(ts_path, "r") as f:
        content = f.read()

    words = []
    pattern = re_mod.compile(r'\{\s*word:\s*"([^"]+)"\s*,\s*start:\s*([\d.]+)\s*,\s*end:\s*([\d.]+)\s*\}')
    for word, start, end in pattern.findall(content):
        words.append({"word": word, "start": float(start), "end": float(end)})

    duration = words[-1]["end"] if words else 0.0
    return words, duration


# ═══════════════════════════════════════════════════════════════════════════════
# Raw analysis
# ═══════════════════════════════════════════════════════════════════════════════

def detect_sentences(words: list) -> list:
    """Detect sentence boundaries from word timestamps (gaps > 500ms)."""
    sentences = []
    current = None
    for i, w in enumerate(words):
        is_end = (i == len(words) - 1 or
                  (i < len(words) - 1 and words[i + 1]["start"] - w["end"] > 0.5))
        if not current:
            current = {"start": w["start"], "end": w["end"], "text": w["word"], "wordCount": 1}
        else:
            current["text"] += " " + w["word"]
            current["end"] = w["end"]
            current["wordCount"] += 1
        if is_end and current:
            sentences.append(current)
            current = None
    return sentences


def detect_emphasis_words(words: list) -> list:
    """Detect emphasis-worthy words by pattern matching."""
    patterns = ["significantly", "much", "more", "best", "never", "always", "only",
                "really", "huge", "difference", "important", "key", "critical",
                "growth", "salary", "career", "position", "skills", "talent", "years"]
    return [{"word": w["word"], "timestamp": w["start"], "reason": "emphasis pattern match"}
            for w in words if any(p in w["word"].lower() for p in patterns)]


def build_raw_analysis(words: list, duration: float) -> dict:
    """Build raw analysis from normalized transcript."""
    return {
        "source": "transcript",
        "word_count": len(words),
        "duration": round(duration, 3),
        "sample_words": [{"word": w["word"], "start": w["start"], "end": w["end"]} for w in words[:5]],
        "sentences": detect_sentences(words),
        "sentence_count": len(detect_sentences(words)),
        "emphasis_words": detect_emphasis_words(words),
        "emphasis_count": len(detect_emphasis_words(words)),
        "face_region": {"x": 0.35, "y": 0.15, "width": 0.3, "height": 0.55, "note": "default for centered talking head"},
        "safe_zones": {
            "top": {"y_max": 0.13, "note": "250px of 1920px"},
            "bottom": {"y_min": 0.80, "note": "Above 380px bottom safe zone"},
            "left": {"x_max": 0.08, "note": "80px of 1080px"},
            "right": {"x_min": 0.92, "note": "80px of 1080px"},
        },
        "zoom_bounds": {"min_scale": 1.0, "max_scale": 1.1, "safe_center": {"x": 0.5, "y": 0.4}},
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Mapping engine
# ═══════════════════════════════════════════════════════════════════════════════

SFX_LIBRARY = {
    "whoosh": "sfx/whoosh-01.wav",
    "hit": "sfx/hit-01.wav",
    "pop": "sfx/pop-01.wav",
    "click": "sfx/click-01.wav",
    "swoosh": "sfx/swoosh-01.wav",
    "ding": "sfx/ding-01.wav",
    "snap": "sfx/snap-01.wav",
    "transition": "sfx/whoosh-02.wav",
    "emphasis": "sfx/hit-02.wav",
}

EMPHASIS_PATTERNS = ["significantly", "much", "more", "best", "never", "always", "only",
                     "really", "huge", "difference", "important", "key", "critical",
                     "growth", "salary", "career", "position", "skills", "talent", "years"]

# Priority for choosing which animation to keep when multiple describe the same caption
CAPTION_ANIM_PRIORITY = ["slam_out_slam_in", "overshoot", "slam", "kinetic"]


def extract_quoted_text(description: str) -> list:
    """Extract text inside double quotes from a reference description."""
    return re.findall(r'"([^"]+)"', description)


def extract_highlight_target(description: str) -> str | None:
    """Extract an explicitly highlighted word from a reference description.

    Patterns like: 'highlight bar behind "Paying"', '"Having" highlighted in yellow'
    """
    matches = re.findall(r'(?:highlight(?:ed|ing)?\s+(?:bar\s+)?(?:behind\s+)?["\']?(\w+)["\']?|["\'](\w+)["\']\s+highlighted?)', description, re.IGNORECASE)
    for pair in matches:
        for m in pair:
            if m:
                return m
    quoted = extract_quoted_text(description)
    for q in quoted:
        words_in_quote = q.split()
        if len(words_in_quote) <= 3:
            return words_in_quote[0]
    return None


def _texts_match_semantically(reference_texts: list, raw_text: str) -> bool:
    """Check if any reference quoted text shares significant words with raw text."""
    raw_words_set = set(raw_text.lower().split())
    for ref_text in reference_texts:
        ref_words = set(ref_text.lower().split())
        # If 2+ words overlap, consider it a semantic match
        if len(ref_words & raw_words_set) >= 2:
            return True
    return False


def find_closest_word(words: list, target_time: float) -> dict:
    """Find the word closest to a target timestamp."""
    if not words:
        return {"word": "", "start": target_time, "end": target_time + 0.5, "idx": 0}
    return min(words, key=lambda w: abs(w["start"] - target_time))


def find_closest_emphasis(target: dict, all_words: list) -> dict | None:
    """Find the closest emphasis-type word."""
    candidates = [w for w in all_words if any(p in w["word"].lower() for p in EMPHASIS_PATTERNS)]
    if not candidates:
        return None
    return min(candidates, key=lambda w: abs(w["start"] - target["start"]))


def find_closest_emphasis_proximity(center: dict, all_words: list, max_dist: float = 2.0) -> dict | None:
    """Find the closest emphasis-type word within max_dist seconds of center."""
    candidates = [w for w in all_words
                  if any(p in w["word"].lower() for p in EMPHASIS_PATTERNS)
                  and abs(w["start"] - center["start"]) <= max_dist]
    if not candidates:
        return None
    return min(candidates, key=lambda w: abs(w["start"] - center["start"]))


def find_word_near(target_word: str, center: dict, all_words: list, window: float = 2.0) -> dict | None:
    """Find a specific word within window seconds of the center timestamp."""
    target_lower = target_word.lower()
    candidates = [w for w in all_words
                  if w["word"].lower() == target_lower
                  and abs(w["start"] - center["start"]) <= window]
    if not candidates:
        return None
    return min(candidates, key=lambda w: abs(w["start"] - center["start"]))


def get_caption_words_around(words: list, center_idx: int, window: int = 6) -> list:
    """Get words for a caption around a center word."""
    start = max(0, center_idx - window // 2)
    end = min(len(words), start + window)
    return [{"word": w["word"], "startSec": round(w["start"], 2), "endSec": round(w["end"], 2),
             "highlighted": False, "color": "#FFFFFF"}
            for w in words[start:end]]


def build_edit_blueprint(ref_events: list, raw_words: list, raw_duration: float, ref_duration: float) -> dict:
    """Map reference events onto raw video to produce the edit blueprint."""

    events = []
    raw_words_idxed = [{"word": w["word"], "start": w["start"], "end": w["end"], "idx": i}
                       for i, w in enumerate(raw_words)]

    # Sort reference events by timestamp so gap filter works correctly
    ref_events_sorted = sorted(ref_events, key=lambda e: e["timestamp"])

    min_gap = 0.2
    last_raw_timestamp = -1  # Track actual emitted raw timestamps
    mapped_count = 0
    unmapped_gap = 0
    unmapped_no_word = 0
    unmapped_no_emphasis = 0

    # Pre-extract quoted text and highlight targets from each reference event
    for ref_evt in ref_events_sorted:
        ref_ts = ref_evt["timestamp"]
        technique = ref_evt.get("technique", {})
        kind = technique.get("kind", "visual_change")
        ref_desc = ref_evt.get("description", "")

        # Event gap management — compare against actual emitted raw timestamps
        proportional_ts = (ref_ts / ref_duration) * raw_duration if ref_duration > 0 else ref_ts
        proportional_ts = min(proportional_ts, raw_duration - 0.5)

        closest_word = find_closest_word(raw_words_idxed, proportional_ts)

        # ── Caption events ─────────────────────────────────────────────
        if kind in ("kinetic_slam", "text_swap", "kinetic_text", "overshoot", "visual_change"):
            cw_idx = closest_word["idx"] if closest_word else 0
            caption_words = get_caption_words_around(raw_words_idxed, cw_idx)
            anim = technique.get("animation", "kinetic")

            # Collect all animation kinds at this timestamp for dedup
            # (multiple kinds describe the same text swap — pick most descriptive)
            existing = next((e for e in events
                             if e["category"] == "caption"
                             and abs(e["timestamp"] - proportional_ts) < 0.01), None)

            if existing:
                # Merge: update animation if this one is more descriptive
                current_anim = existing["kind"]
                current_idx = CAPTION_ANIM_PRIORITY.index(current_anim) if current_anim in CAPTION_ANIM_PRIORITY else 99
                new_idx = CAPTION_ANIM_PRIORITY.index(anim) if anim in CAPTION_ANIM_PRIORITY else 99
                if new_idx < current_idx:
                    existing["kind"] = anim
                    existing["label"] = f"{anim}: {existing['params']['words'][0]['word'] if existing['params']['words'] else ''}"
                    existing["params"]["style"] = anim
                # Update quoted text if current raw text has no semantic match
                quoted_texts = extract_quoted_text(ref_desc)
                if quoted_texts and not _texts_match_semantically(quoted_texts, existing["params"]["text"]):
                    existing["params"]["text"] = quoted_texts[0]
                    existing["params"]["rawWordText"] = existing["params"]["text"]
            else:
                # New caption event
                raw_text = " ".join(w["word"] for w in caption_words)
                quoted_texts = extract_quoted_text(ref_desc)
                display_text = raw_text
                if quoted_texts and not _texts_match_semantically(quoted_texts, raw_text):
                    display_text = quoted_texts[0]

                events.append({
                    "category": "caption",
                    "timestamp": round(proportional_ts, 3),
                    "duration": 3000,
                    "kind": anim,
                    "label": f"{anim}: {caption_words[0]['word'] if caption_words else ''}",
                    "params": {
                        "text": display_text,
                        "words": caption_words,
                        "style": anim,
                        "fontSize": 80,
                        "rawWordText": raw_text,
                    },
                    "confidence": 0.8,
                    "source": "mapped",
                    "mappedFrom": round(ref_ts, 3),
                })
                mapped_count += 1
                last_raw_timestamp = proportional_ts

        # ── Highlight events ───────────────────────────────────────────
        elif kind == "highlight":
            # Priority: explicit reference target > nearby matching word > emphasis pattern
            highlight_target = extract_highlight_target(ref_desc)
            emphasis = None
            is_overlay = False  # True when using reference text not present in raw transcript

            if highlight_target:
                # Look for the explicitly named word near the mapped timestamp
                emphasis = find_word_near(highlight_target, closest_word, raw_words_idxed, window=2.0)
            if not emphasis:
                # Word not in transcript within window — use reference text as overlay
                if highlight_target:
                    is_overlay = True
                    emphasis = closest_word  # Use position of closest spoken word
                else:
                    emphasis = find_closest_emphasis_proximity(closest_word, raw_words_idxed, max_dist=2.0)
            if not emphasis and not is_overlay:
                emphasis = find_closest_emphasis(closest_word, raw_words_idxed)

            if emphasis:
                # Use reference target text if it's an overlay, otherwise use matched word
                highlight_text = highlight_target if (is_overlay and highlight_target) else emphasis["word"]
                highlight_ts = proportional_ts if is_overlay else round(emphasis["start"], 3)
                events.append({
                    "category": "highlight",
                    "timestamp": highlight_ts,
                    "duration": 1500,
                    "kind": "word_highlight",
                    "label": f"highlight: {highlight_text}" + (" (overlay)" if is_overlay else ""),
                    "params": {
                        "text": highlight_text,
                        "wordIndex": emphasis.get("idx", 0),
                        "color": technique.get("color", "#FF4D2D"),
                        "scale": 1.08,
                        "animation": technique.get("animation", "punch"),
                        "holdDuration": 1500,
                        "isOverlay": is_overlay,
                        "referenceText": highlight_target or "",
                    },
                    "confidence": 0.75,
                    "source": "mapped",
                    "mappedFrom": round(ref_ts, 3),
                })
                mapped_count += 1
            else:
                unmapped_no_word += 1

        # ── Camera events ──────────────────────────────────────────────
        if kind in ("camera_punch_in", "camera_punch_out", "camera_zoom"):
            events.append({
                "category": "camera",
                "timestamp": round(closest_word["start"], 3),
                "duration": 1200,
                "kind": kind.replace("camera_", ""),
                "label": f"zoom at {proportional_ts:.1f}s",
                "params": {"startScale": 1.0, "peakScale": 1.08, "endScale": 1.0},
                "confidence": 0.7,
                "source": "mapped",
                "mappedFrom": round(ref_ts, 3),
            })
            mapped_count += 1

        # ── SFX events ────────────────────────────────────────────────
        if kind == "sfx":
            sfx_ts = max(0, closest_word["start"] - 0.02) if closest_word else max(0, proportional_ts - 0.02)
            events.append({
                "category": "sfx",
                "timestamp": round(sfx_ts, 3),
                "duration": 400,
                "kind": technique.get("type", "whoosh"),
                "label": f"sfx: {technique.get('type', 'whoosh')}",
                "params": {
                    "sfxPath": SFX_LIBRARY.get(technique.get("type", "whoosh"), "sfx/whoosh-01.wav"),
                    "leadMs": -20,
                    "duckDb": 6,
                    "highPassHz": 130,
                },
                "confidence": 0.6,
                "source": "mapped",
                "mappedFrom": round(ref_ts, 3),
            })
            mapped_count += 1

        # ── Graphic events ────────────────────────────────────────────
        if kind in ("graphic_overlay", "broll_insert"):
            events.append({
                "category": "graphic",
                "timestamp": round(closest_word["start"], 3),
                "duration": 2500,
                "kind": technique.get("type", "overlay"),
                "label": f"graphic: {technique.get('type', 'overlay')}",
                "params": {
                    "type": technique.get("type", "overlay"),
                    "position": {"x": 0.5, "y": 0.5},
                    "entrance": "fade",
                    "entranceDuration": 400,
                },
                "confidence": 0.5,
                "source": "mapped",
                "mappedFrom": round(ref_ts, 3),
            })
            mapped_count += 1

        # ── Transition events ─────────────────────────────────────────
        if kind in ("broll_cut", "transition_cut"):
            events.append({
                "category": "transition",
                "timestamp": round(proportional_ts, 3),
                "duration": 400,
                "kind": "zoom_through" if kind == "broll_cut" else "cut",
                "label": "B-roll cut via zoom-through" if kind == "broll_cut" else "transition cut",
                "params": {"maxZoom": 1.12, "duration": 400},
                "confidence": 0.5,
                "source": "mapped",
                "mappedFrom": round(ref_ts, 3),
            })
            mapped_count += 1

        last_raw_timestamp = proportional_ts

    # Build blueprint
    categories_used = list(set(e["category"] for e in events))
    blueprint = {
        "version": "1.0.0",
        "generatedAt": datetime.now().isoformat(),
        "referenceVideo": "references/references-clip.mp4",
        "rawVideo": "testing-video.mp4",
        "duration": raw_duration,
        "fps": 23.976,
        "events": events,
        "patterns": {
            "avgChangeInterval": 1.5,
            "minChangeInterval": 0.3,
            "maxChangeInterval": 4.0,
            "eventDensity": round(len(events) / raw_duration, 2) if raw_duration > 0 else 0,
            "categoriesUsed": categories_used,
            "dominantTransition": "slam",
            "highlightFrequency": round(sum(1 for e in events if e["category"] == "highlight") / raw_duration, 2) if raw_duration > 0 else 0,
            "avgZoomPunch": 1.06,
            "captionStyle": "kinetic",
        },
        "analysis": {
            "referenceConfidence": 0.85,
            "rawConfidence": 0.9,
            "mappingConfidence": round(mapped_count / max(len(ref_events), 1), 2),
            "totalMappedEvents": mapped_count,
            "unmappedReferenceEvents": unmapped_gap + unmapped_no_word,
            "unmappedRawMoments": 0,
            "unmappedReason_gap": unmapped_gap,
            "unmappedReason_no_emphasis_word": unmapped_no_word,
        },
    }

    return blueprint


# ═══════════════════════════════════════════════════════════════════════════════
# Comparison / contact sheet generation
# ═══════════════════════════════════════════════════════════════════════════════

def generate_comparison(project_name: str, blueprint: dict, output_dir: str) -> None:
    """Generate comparison contact sheet and summary."""
    os.makedirs(output_dir, exist_ok=True)

    events = blueprint.get("events", [])

    # Select representative moments
    sample_events = []
    if len(events) >= 3:
        sample_events.append(("first", events[0]))
        sample_events.append(("midpoint", events[len(events) // 2]))
        sample_events.append(("last", events[-1]))
    for i in range(4, len(events), max(5, len(events) // 10)):
        sample_events.append((f"sample-{i}", events[i]))

    # Write blueprint summary
    summary_path = os.path.join(output_dir, "blueprint-summary.md")
    with open(summary_path, "w") as f:
        f.write("# Edit Blueprint Summary\n\n")
        f.write(f"**Version:** {blueprint.get('version')}\n")
        f.write(f"**Generated:** {blueprint.get('generatedAt')}\n")
        f.write(f"**Duration:** {blueprint.get('duration', 0):.1f}s\n")
        f.write(f"**FPS:** {blueprint.get('fps')}\n")
        f.write(f"**Total Events:** {len(events)}\n\n")

        f.write("## Analysis\n\n")
        analysis = blueprint.get("analysis", {})
        f.write(f"- Reference events detected: {analysis.get('totalMappedEvents', 0) + analysis.get('unmappedReferenceEvents', 0)}\n")
        f.write(f"- Successfully mapped: {analysis.get('totalMappedEvents', 0)}\n")
        f.write(f"- Unmapped: {analysis.get('unmappedReferenceEvents', 0)}\n")
        f.write(f"- Mapping confidence: {analysis.get('mappingConfidence', 0):.0%}\n")
        f.write(f"- Unmapped (too close to existing): {analysis.get('unmappedReason_gap', 0)}\n")
        f.write(f"- Unmapped (no emphasis word): {analysis.get('unmappedReason_no_emphasis_word', 0)}\n\n")

        f.write("## Patterns\n\n")
        patterns = blueprint.get("patterns", {})
        f.write(f"- Event density: {patterns.get('eventDensity', 0):.2f} events/sec\n")
        f.write(f"- Caption style: {patterns.get('captionStyle', 'unknown')}\n")
        f.write(f"- Highlight frequency: {patterns.get('highlightFrequency', 0):.2f}/sec\n")
        f.write(f"- Avg zoom punch: {patterns.get('avgZoomPunch', 0):.2f}x\n")
        f.write(f"- Categories used: {', '.join(patterns.get('categoriesUsed', []))}\n\n")

        f.write("## Event Breakdown\n\n")
        categories: dict = {}
        for e in events:
            cat = e["category"]
            categories[cat] = categories.get(cat, 0) + 1
        for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
            f.write(f"- **{cat}:** {count}\n")

        f.write(f"\n## First 20 Mapped Events\n\n")
        for i, evt in enumerate(events[:20]):
            f.write(f"### Event {i + 1}: {evt.get('label', evt.get('kind', '?'))}\n\n")
            f.write(f"- **Category:** {evt.get('category')}\n")
            f.write(f"- **Kind:** {evt.get('kind')}\n")
            f.write(f"- **Timestamp:** {evt.get('timestamp', 0):.3f}s (frame {int(evt.get('timestamp', 0) * 23.976)})\n")
            f.write(f"- **Mapped from reference:** {evt.get('mappedFrom', 'N/A')}s\n")
            f.write(f"- **Duration:** {evt.get('duration', 0)}ms\n")
            f.write(f"- **Confidence:** {evt.get('confidence', 0):.0%}\n")
            params = evt.get("params", {})
            if params:
                f.write(f"- **Params:** ```json\n  {json.dumps(params, indent=2, default=str)}\n```\n")
            f.write("\n")

        f.write(f"\n## Representative Moments ({len(sample_events)})\n\n")
        for label, evt in sample_events:
            f.write(f"### {label}: {evt.get('label', evt.get('kind', '?'))}\n\n")
            f.write(f"- **Time:** {evt.get('timestamp', 0):.3f}s\n")
            f.write(f"- **Category:** {evt.get('category')}\n")
            f.write(f"- **Kind:** {evt.get('kind')}\n\n")

    print(f"  Summary: {summary_path}")


# ═══════════════════════════════════════════════════════════════════════════════
# Project file discovery
# ═══════════════════════════════════════════════════════════════════════════════

def find_project(video_name: str) -> dict:
    """Find project files."""
    video_dir = os.path.join(BASE, "src", "videos", video_name)
    assets_dir = os.path.join(ASSETS_DIR, video_name)
    work_dir = os.path.join(WORK_DIR, video_name)

    # Find testing video
    testing_video = None
    if os.path.isdir(assets_dir):
        for root, dirs, files in os.walk(assets_dir):
            for f in files:
                if f.startswith("testing") and f.endswith(".mp4"):
                    testing_video = os.path.join(root, f)
                    break
            if testing_video:
                break

    # Find transcript
    transcript_path = None
    if os.path.isdir(work_dir):
        for root, dirs, files in os.walk(os.path.join(work_dir, "prep")):
            for f in files:
                if f in ("transcript.json", "words.json", "words.generated.ts"):
                    transcript_path = os.path.join(root, f)
                    break
            if transcript_path:
                break

    return {
        "video_name": video_name,
        "testing_video": testing_video,
        "reference_video": os.path.join(REFERENCES_DIR, "references-clip.mp4"),
        "references_md": os.path.join(REFERENCES_DIR, "references.md"),
        "transcript": transcript_path,
        "work_dir": work_dir,
    }


def get_video_duration(video_path: str) -> float:
    """Get video duration via ffprobe."""
    try:
        import subprocess
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", video_path],
            capture_output=True, text=True, timeout=30
        )
        return float(r.stdout.strip())
    except Exception:
        return 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# Main pipeline
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    if len(sys.argv) < 2:
        print("Usage: pipeline-reference-edit.py <video-name>")
        sys.exit(1)

    video_name = sys.argv[1]
    print(f"{'='*60}")
    print(f"Reference-Driven Edit Pipeline")
    print(f"{'='*60}")
    print(f"Target: {video_name}\n")

    project = find_project(video_name)
    print(f"Files found:")
    print(f"  Testing video:   {project.get('testing_video', 'NOT FOUND')}")
    print(f"  Reference video:  {project.get('reference_video', 'NOT FOUND')}")
    print(f"  Transcript:       {project.get('transcript', 'NOT FOUND')}")
    print(f"  References.md:    {project.get('references_md', 'NOT FOUND')}")
    print()

    refs_dir = os.path.join(project["work_dir"], "prep", "refs")
    comparison_dir = os.path.join(refs_dir, "comparison")
    os.makedirs(refs_dir, exist_ok=True)

    # ─── Step 1: Parse references ────────────────────────────────────
    print("=" * 60)
    print("STEP 1: Parse reference annotations")
    print("=" * 60)

    ref_md = project.get("references_md")
    ref_video = project.get("reference_video")
    ref_duration = 47.6  # Known from previous analysis

    if ref_md and os.path.exists(ref_md):
        if ref_video and os.path.exists(ref_video):
            ref_duration = get_video_duration(ref_video)
            print(f"  Reference video duration: {ref_duration:.1f}s")

        ref_events = parse_references(ref_md, ref_duration)

        ref_output = os.path.join(refs_dir, "reference-events.json")
        with open(ref_output, "w", encoding="utf-8") as f:
            json.dump({
                "source_file": ref_md,
                "video_file": ref_video,
                "video_duration": ref_duration,
                "total_events": len(ref_events),
                "events": ref_events,
            }, f, indent=2, ensure_ascii=False)

        print(f"  Parsed {len(ref_events)} events from references.md")
        print(f"  Output: {ref_output}")

        # Print technique breakdown
        techniques: dict = {}
        for e in ref_events:
            k = e["technique"]["kind"]
            techniques[k] = techniques.get(k, 0) + 1
        print(f"\n  Techniques detected:")
        for k, v in sorted(techniques.items(), key=lambda x: -x[1]):
            print(f"    {k}: {v}")
    else:
        print("  SKIP: No references.md or reference video found")
        ref_events = []

    # ─── Step 2: Analyze raw video ───────────────────────────────────
    print(f"\n{'='*60}")
    print("STEP 2: Analyze raw video transcript")
    print("=" * 60)

    transcript_path = project.get("transcript")
    raw_words = []
    raw_duration = 0.0

    if transcript_path and os.path.exists(transcript_path):
        raw_words, raw_duration = load_transcript(transcript_path)
        print(f"  Transcript: {len(raw_words)} words, {raw_duration:.1f}s")
        print(f"  Format: {'start_ms/end_ms → normalized to seconds' if 'start_ms' in str(open(transcript_path).read()[:200]) else 'seconds'}")

        raw_analysis = build_raw_analysis(raw_words, raw_duration)

        raw_output = os.path.join(refs_dir, "raw-analysis.json")
        with open(raw_output, "w", encoding="utf-8") as f:
            json.dump(raw_analysis, f, indent=2)

        print(f"  Sentences: {raw_analysis['sentence_count']}")
        print(f"  Emphasis words: {raw_analysis['emphasis_count']}")
        print(f"  Output: {raw_output}")
    else:
        print("  SKIP: No transcript found")
        raw_analysis = {}

    # ─── Step 3: Map reference → raw ────────────────────────────────
    print(f"\n{'='*60}")
    print("STEP 3: Map reference events → raw video")
    print("=" * 60)

    if ref_events and raw_words:
        ref_dur = ref_duration if ref_duration > 0 else raw_duration
        blueprint = build_edit_blueprint(ref_events, raw_words, raw_duration, ref_dur)

        bp_output = os.path.join(refs_dir, "edit-blueprint.json")
        with open(bp_output, "w", encoding="utf-8") as f:
            json.dump(blueprint, f, indent=2)

        print(f"  Reference events: {len(ref_events)}")
        print(f"  Mapped events: {blueprint['analysis']['totalMappedEvents']}")
        print(f"  Unmapped: {blueprint['analysis']['unmappedReferenceEvents']}")
        print(f"    - Too close to existing: {blueprint['analysis']['unmappedReason_gap']}")
        print(f"    - No emphasis word found: {blueprint['analysis']['unmappedReason_no_emphasis_word']}")
        print(f"  Mapping confidence: {blueprint['analysis']['mappingConfidence']:.0%}")
        print(f"  Event density: {blueprint['patterns']['eventDensity']:.2f} events/sec")

        # Category breakdown
        categories: dict = {}
        for e in blueprint["events"]:
            cat = e["category"]
            categories[cat] = categories.get(cat, 0) + 1
        print(f"\n  Mapped event breakdown:")
        for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
            print(f"    {cat}: {count}")

        print(f"\n  Output: {bp_output}")

        # ─── Step 4: Generate comparison ─────────────────────────────
        print(f"\n{'='*60}")
        print("STEP 4: Generate comparison contact sheet")
        print("=" * 60)

        generate_comparison(video_name, blueprint, comparison_dir)
        print(f"  Output directory: {comparison_dir}")

        # ─── Step 5: Print first 10 mapped events ────────────────────
        print(f"\n{'='*60}")
        print("FIRST 10 MAPPED EVENTS (detailed)")
        print("=" * 60)

        for i, evt in enumerate(blueprint["events"][:10]):
            print(f"\n  [{i+1}] {evt['label']}")
            print(f"      Category:   {evt['category']}")
            print(f"      Kind:       {evt['kind']}")
            print(f"      Ref time:   {evt.get('mappedFrom', 'N/A')}s")
            print(f"      Raw time:   {evt['timestamp']}s")
            print(f"      Duration:   {evt['duration']}ms")
            params = evt.get("params", {})
            if "text" in params:
                print(f"      Text:       {params['text'][:60]}")
            if "sfxPath" in params:
                print(f"      SFX:        {params['sfxPath']}")
            if "peakScale" in params:
                print(f"      Zoom:       {params['peakScale']}x peak")
            if "color" in params:
                print(f"      Color:      {params['color']}")

        # ─── Summary ─────────────────────────────────────────────────
        print(f"\n{'='*60}")
        print("PIPELINE COMPLETE")
        print("=" * 60)
        print(f"\nOutput files:")
        print(f"  1. {ref_output}")
        print(f"  2. {raw_output}")
        print(f"  3. {bp_output}")
        print(f"  4. {os.path.join(comparison_dir, 'blueprint-summary.md')}")
        print(f"\nNext step: Review blueprint-summary.md, then render via Studio.")

    else:
        print("  SKIP: Missing reference events or raw words")


if __name__ == "__main__":
    main()

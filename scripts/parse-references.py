#!/usr/bin/env python3
"""
parse-references.py — parses references.md into structured JSON events.

Reads a references.md file with annotated time ranges and produces
a JSON file with timestamped editing events suitable for the
reference-analyzer.ts pipeline.

Usage:
    python3 scripts/parse-references.py \
        references/references.md \
        references/references-clip.mp4 \
        work/[name]/prep/refs/reference-events.json
"""

import json
import re
import sys
import os
import subprocess


def get_video_duration(video_path: str) -> float:
    """Extract duration in seconds from video file."""
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", video_path],
            capture_output=True, text=True, timeout=30
        )
        return float(r.stdout.strip())
    except Exception:
        return 0.0


def parse_time_range(range_str: str, total_duration: float) -> tuple:
    """Parse '00:07-00:09' or '00:07.420-00:09.180' into (start, end) seconds."""
    parts = range_str.strip().split("-")
    if len(parts) != 2:
        return (0, total_duration)

    def to_seconds(t: str) -> float:
        t = t.strip()
        if ":" in t:
            m, s = t.split(":")
            return float(m) * 60 + float(s)
        return float(t)

    return (to_seconds(parts[0]), to_seconds(parts[1]) if parts[1] != "end" else total_duration)


def classify_event_type(description: str) -> dict:
    """Classify what editing techniques are described in the annotation."""
    description_lower = description.lower()
    events = []

    # Text animations
    if "slam" in description_lower or "slams" in description_lower:
        events.append({"kind": "kinetic_slam", "animation": "slam"})
    if "kinetic" in description_lower:
        events.append({"kind": "kinetic_text", "animation": "kinetic"})
    if "overshoot" in description_lower or "bounce" in description_lower:
        events.append({"kind": "overshoot", "animation": "overshoot"})
    if "swap" in description_lower or "changes" in description_lower or "kinetically" in description_lower:
        events.append({"kind": "text_swap", "animation": "slam_out_slam_in"})

    # Highlighting
    if "highlight" in description_lower or "highlighted" in description_lower:
        color = None
        for c in ["yellow", "red", "blue", "green", "white", "black"]:
            if c in description_lower:
                color = c
                break
        events.append({"kind": "highlight", "color": color or "#FF4D2D"})

    # Camera motion
    if "zoom" in description_lower or "punch" in description_lower:
        if "in" in description_lower:
            events.append({"kind": "camera_punch_in"})
        elif "out" in description_lower:
            events.append({"kind": "camera_punch_out"})
        else:
            events.append({"kind": "camera_zoom"})
    if "push" in description_lower:
        events.append({"kind": "camera_punch_in"})

    # Graphics/overlays
    if "cartoon" in description_lower or "illustration" in description_lower:
        events.append({"kind": "graphic_overlay", "type": "illustration"})
    if "arrow" in description_lower:
        events.append({"kind": "graphic_overlay", "type": "arrow"})
    if "whiteboard" in description_lower or "diagram" in description_lower:
        events.append({"kind": "graphic_overlay", "type": "diagram"})
    if "b-roll" in description_lower or "overlay" in description_lower and "drops" in description_lower:
        events.append({"kind": "broll_insert"})
    if "puzzle" in description_lower or "gear" in description_lower:
        events.append({"kind": "graphic_overlay", "type": "icon"})

    # Transitions
    if "cut" in description_lower or "swaps" in description_lower:
        events.append({"kind": "transition_cut"})
    if "full-screen" in description_lower and ("cut" in description_lower or "disappears" in description_lower):
        events.append({"kind": "broll_cut"})

    # Caption style
    if "two-line" in description_lower or "stacked" in description_lower:
        events.append({"kind": "caption_style", "layout": "two_line"})
    if "full-screen" in description_lower:
        events.append({"kind": "caption_style", "layout": "full_screen"})

    # SFX
    if "whoosh" in description_lower:
        events.append({"kind": "sfx", "type": "whoosh"})
    if "hit" in description_lower or "land" in description_lower:
        events.append({"kind": "sfx", "type": "hit"})
    if "ding" in description_lower or "bell" in description_lower:
        events.append({"kind": "sfx", "type": "ding"})

    if not events:
        events.append({"kind": "visual_change"})

    return events


def parse_references(md_path: str, video_path: str) -> dict:
    """Parse references.md into structured JSON."""
    duration = get_video_duration(video_path)

    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    events = []
    event_id = 0

    # Pattern: - HH:MM-HH:MM - description
    # Also handles: - HH:MM-HH:MM.SSS-HH:MM.SSS - description (sub-second)
    pattern = re.compile(
        r"^-\s+(\d{1,2}:\d{2}(?:\.\d{1,3})?)\s*[-–]\s*(\d{1,2}:\d{2}(?:\.\d{1,3})?|end)\s*-\s*(.+)$",
        re.MULTILINE | re.IGNORECASE,
    )

    for match in pattern.finditer(content):
        time_start_str = match.group(1)
        time_end_str = match.group(2)
        description = match.group(3).strip()

        start = parse_time_range(time_start_str + "-" + time_end_str, duration)[0]

        # Classify the editing techniques in this moment
        technique_events = classify_event_type(description)

        for tech in technique_events:
            event_id += 1
            events.append({
                "id": event_id,
                "timestamp": start,
                "duration_ms": estimate_duration(start, time_end_str, duration),
                "description": description,
                "technique": tech,
                "confidence": 0.85,
            })

    return {
        "source_file": md_path,
        "video_file": video_path,
        "video_duration": duration,
        "total_events": len(events),
        "events": events,
    }


def estimate_duration(start_str: str, end_str: str, total_duration: float) -> int:
    """Estimate event duration in ms."""
    def to_sec(t):
        t = t.strip()
        if ":" in t:
            m, s = t.split(":")
            return float(m) * 60 + float(s)
        return float(t)

    start = to_sec(start_str)
    end = to_sec(end_str) if end_str != "end" else total_duration
    return int((end - start) * 1000)


def main():
    if len(sys.argv) < 4:
        print("Usage: parse-references.py <references.md> <video.mp4> <output.json>")
        sys.exit(1)

    md_path = sys.argv[1]
    video_path = sys.argv[2]
    output_path = sys.argv[3]

    if not os.path.exists(md_path):
        print(f"Error: {md_path} not found")
        sys.exit(1)

    if not os.path.exists(video_path):
        print(f"Error: {video_path} not found")
        sys.exit(1)

    result = parse_references(md_path, video_path)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Parsed {result['total_events']} events from {md_path}")
    print(f"Output: {output_path}")

    # Print summary
    techniques = {}
    for e in result["events"]:
        k = e["technique"]["kind"]
        techniques[k] = techniques.get(k, 0) + 1
    print("\nTechniques detected:")
    for k, v in sorted(techniques.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()

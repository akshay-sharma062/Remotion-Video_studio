#!/usr/bin/env python3
"""
Analyze transcript timing and compute exact frame boundaries for each scene/slam.
This ensures NO overlap between headline layers.
"""
import json, math

FPS = 23.976
TOTAL_MS = 21397

with open("work/corporate-career-growth-amana/prep/audio/transcript.json") as f:
    data = json.load(f)

words = data["words"]

def ms_to_frame(ms):
    return round((ms / 1000) * FPS)

def frame_to_ms(frame):
    return (frame / FPS) * 1000

# Define slam phrases with their word indices and timing offsets
SLAMS = [
    {"name": "SIGNIFICANTLY MORE", "start_idx": 15, "end_idx": 16},
    {"name": "MORE TALENTED", "start_idx": 26, "end_idx": 27},
    {"name": "13 YEARS", "start_idx": 35, "end_idx": 36},
    {"name": "MUCH MORE SALARY", "start_idx": 49, "end_idx": 51},
    {"name": "TALENT OR SKILLS", "start_idx": 59, "end_idx": 61},
    {"name": "POSITION", "start_idx": 67, "end_idx": 67},
]

ANIM_DURATION_MS = 600   # overshoot slam animation duration
HOLD_DURATION_MS = 1200  # how long text stays visible after animation
PRE_START_MS = 150       # start animation slightly before word

print(f"FPS: {FPS}")
print(f"Total frames: {ms_to_frame(TOTAL_MS)}")
print()

# Compute each slam's exact frame range
slam_frames = []
for slam in SLAMS:
    w_start = words[slam["start_idx"]]["start_ms"]
    w_end = words[slam["end_idx"]]["end_ms"]

    # Animation starts PRE_START_MS before the word
    anim_start_ms = max(0, w_start - PRE_START_MS)
    anim_end_ms = anim_start_ms + ANIM_DURATION_MS
    hold_end_ms = w_end + HOLD_DURATION_MS

    anim_start_frame = ms_to_frame(anim_start_ms)
    anim_end_frame = ms_to_frame(anim_end_ms)
    hold_end_frame = ms_to_frame(hold_end_ms)

    slam_frames.append({
        "name": slam["name"],
        "word_start_ms": w_start,
        "word_end_ms": w_end,
        "anim_start_frame": anim_start_frame,
        "anim_end_frame": anim_end_frame,
        "hold_end_frame": hold_end_frame,
    })

    print(f"{slam['name']}:")
    print(f"  Word: {w_start}-{w_end}ms (frame {ms_to_frame(w_start)}-{ms_to_frame(w_end)})")
    print(f"  Anim: frame {anim_start_frame}-{anim_end_frame} ({ANIM_DURATION_MS}ms)")
    print(f"  Hold until: frame {hold_end_frame}")
    print()

# Now compute scene boundaries with ZERO overlap
# Each scene = one slam's hold period, with small gaps
scene_boundaries = [0]
current = 0
for i, sf in enumerate(slam_frames):
    if i == 0:
        # First scene ends after hold
        current = sf["hold_end_frame"] + 6  # 6 frame gap
    else:
        # Each subsequent scene starts when previous ended
        current = scene_boundaries[-1]
    scene_boundaries.append(current)

print("=== Scene boundaries (with 6-frame gaps) ===")
for i in range(len(scene_boundaries) - 1):
    start_ms = frame_to_ms(scene_boundaries[i])
    end_ms = frame_to_ms(scene_boundaries[i + 1])
    print(f"  Scene {i+1}: frame {scene_boundaries[i]}-{scene_boundaries[i+1]} ({start_ms:.0f}-{end_ms:.0f}ms) = {slam_frames[i]['name']}")

print()
print("=== Verification: no overlaps ===")
for i in range(len(slam_frames) - 1):
    curr_end = slam_frames[i]["hold_end_frame"]
    next_start = slam_frames[i + 1]["anim_start_frame"]
    gap = scene_boundaries[i + 1] - curr_end
    print(f"  {slam_frames[i]['name']} ends frame {curr_end}, next starts frame {next_start}, scene gap: {gap} frames")
    if gap < 0:
        print(f"  WARNING: OVERLAP!")
    else:
        print(f"  OK: {gap} frame gap")

# Check frame 186 specifically
print()
print(f"=== Frame 186 check ===")
frame_186_ms = frame_to_ms(186)
print(f"  Frame 186 = {frame_186_ms:.0f}ms")
for sf in slam_frames:
    visible = sf["anim_start_frame"] <= 186 <= sf["hold_end_frame"]
    print(f"  {sf['name']}: {'VISIBLE' if visible else 'not visible'} (anim {sf['anim_start_frame']}-{sf['anim_end_frame']}, hold to {sf['hold_end_frame']})")

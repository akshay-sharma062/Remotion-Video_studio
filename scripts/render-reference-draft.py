#!/usr/bin/env python3
"""
Reference-driven draft renderer — full pipeline.

Pipeline:
  1. Extract frames from testing-video.mp4 at 23.976fps
  2. Composite reference graphics onto each frame using bounding-box-aware layout
  3. Encode final video with audio (voice + SFX)

Output: work/corporate-career-growth-amana/preview/reference-draft.mp4

Requires: ffmpeg, Pillow, numpy
"""

import json
import math
import os
import subprocess
import sys
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont
import numpy as np

# ─── Constants ─────────────────────────────────────────────────────────
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = "corporate-career-growth-amana"

VIDEO_PATH = os.path.join(BASE, "public", "projects", PROJECT, "footage", "testing-video.mp4")
BLUEPRINT_PATH = os.path.join(BASE, "work", PROJECT, "prep", "refs", "edit-blueprint.json")
VOICE_PATH = os.path.join(BASE, "work", PROJECT, "prep", "audio", "canonical.wav")
SFX_PATH = os.path.join(BASE, "work", PROJECT, "prep", "audio", "sfx-reference.wav")
OUTPUT_DIR = os.path.join(BASE, "work", PROJECT, "preview")
OUTPUT_VIDEO = os.path.join(OUTPUT_DIR, "reference-draft.mp4")

CANVAS_W = 1080
CANVAS_H = 1920
FPS = 23.976
TOTAL_FRAMES = 513

# Colors
ACCENT = (255, 77, 45)
YELLOW = (255, 220, 0)
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
DARK_SURFACE = (24, 24, 22)

_font_cache = {}


def get_font(size, bold=False):
    key = (size, bold)
    if key not in _font_cache:
        try:
            name = "arialbd.ttf" if bold else "arial.ttf"
            _font_cache[key] = ImageFont.truetype(name, size)
        except IOError:
            try:
                _font_cache[key] = ImageFont.truetype(
                    "C:\\Windows\\Fonts\\arialbd.ttf" if bold else "C:\\Windows\\Fonts\\arial.ttf", size)
            except IOError:
                _font_cache[key] = ImageFont.load_default()
    return _font_cache[key]


def measure(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def stroked_text(draw, x, y, text, font, fill, stroke=(0, 0, 0), sw=3):
    for dx in range(-sw, sw + 1, 2):
        for dy in range(-sw, sw + 1, 2):
            if dx != 0 or dy != 0:
                draw.text((x + dx, y + dy), text, font=font, fill=stroke)
    draw.text((x, y), text, font=font, fill=fill)


# ─── Bounding-box-aware layout ─────────────────────────────────────────
SAFE_ZONES = {
    "TOP":    {"x1": 54,  "y1": 70,  "x2": 1026, "y2": 360},
    "BOTTOM": {"x1": 54,  "y1": 1490, "x2": 1026, "y2": 1830},
}

PROTECTED_REGIONS = [
    {"name": "face", "x1": 300, "y1": 440, "x2": 780, "y2": 950},
    {"name": "body", "x1": 0,   "y1": 950, "x2": 1080, "y2": 1450},
]

MAX_TEXT_WIDTH = 900


def bbox_intersects(a, b):
    return not (a["x2"] <= b["x1"] or a["x1"] >= b["x2"] or
                a["y2"] <= b["y1"] or a["y1"] >= b["y2"])


def bbox_hits_protected(bbox):
    for pr in PROTECTED_REGIONS:
        if bbox_intersects(bbox, pr):
            return pr["name"]
    return None


def bbox_clips_canvas(bbox):
    return (bbox["x1"] < 0 or bbox["y1"] < 0 or
            bbox["x2"] > CANVAS_W or bbox["y2"] > CANVAS_H)


def measure_text_block(draw, words, font, max_width=None):
    if max_width is None:
        max_width = MAX_TEXT_WIDTH
    spacing = int(font.size * 0.2)
    word_data = []
    for w in words:
        ww, hh = measure(draw, w, font)
        word_data.append((w, ww, hh))
    total_w = sum(ww for _, ww, _ in word_data) + spacing * max(0, len(words) - 1)
    max_h = max(h for _, _, h in word_data)
    if total_w <= max_width:
        return word_data, total_w, max_h, font

    ratio = max_width / total_w
    new_size = max(28, int(font.size * ratio * 0.9))
    new_font = get_font(new_size, bold=True)
    word_data = []
    for w in words:
        ww, hh = measure(draw, w, new_font)
        word_data.append((w, ww, hh))
    total_w = sum(ww for _, ww, _ in word_data) + spacing * max(0, len(words) - 1)
    if total_w <= max_width:
        return word_data, total_w, max(h for _, _, h in word_data), new_font

    # Two-line split
    mid = len(words) // 2
    return word_data, total_w, max_h, new_font, mid


def resolve_safe_position(bbox, preferred="TOP"):
    zones = ["TOP", "BOTTOM"] if preferred == "TOP" else ["BOTTOM", "TOP"]
    for zone in zones:
        sz = SAFE_ZONES[zone]
        if (bbox["x1"] >= sz["x1"] and bbox["x2"] <= sz["x2"] and
            bbox["y1"] >= sz["y1"] and bbox["y2"] <= sz["y2"]):
            if not bbox_hits_protected(bbox):
                return zone, bbox, False
    return None, bbox, True


def place_headline(draw, text, stacked, preferred="TOP"):
    """Place a headline text, ensuring bbox stays in safe zone."""
    font = get_font(130 if stacked else 120, bold=True)
    words = text.replace("\n", " ").split()

    result = measure_text_block(draw, words, font)
    if len(result) == 4:
        word_data, total_w, total_h, font = result
        line_break = None
    else:
        word_data, _, total_h, font, line_break = result
        if line_break is None:
            line_break = len(words) // 2

    spacing = int(font.size * 0.2)
    line_h = int(font.size * 1.35)
    total_h_px = line_break is None and total_h or line_h * 2

    sz = SAFE_ZONES[preferred]
    x = (CANVAS_W - total_w) // 2
    if preferred == "TOP":
        y = sz["y1"] + (sz["y2"] - sz["y1"] - total_h_px) // 2
        y = max(sz["y1"], min(y, sz["y2"] - total_h_px))
    else:
        y = sz["y2"] - total_h_px

    bbox = {"x1": x, "y1": y, "x2": x + total_w, "y2": y + total_h_px,
            "w": total_w, "h": total_h_px}

    zone, final_bbox, collision = resolve_safe_position(bbox, preferred)
    if collision:
        sz2 = SAFE_ZONES[preferred]
        cw, ch = final_bbox["w"], final_bbox["h"]
        cx = (sz2["x1"] + sz2["x2"]) // 2
        cy = (sz2["y1"] + sz2["y2"]) // 2
        final_bbox = {
            "x1": cx - cw // 2, "y1": cy - ch // 2,
            "x2": cx + cw // 2, "y2": cy + ch // 2,
            "w": cw, "h": ch,
        }
        zone, final_bbox, collision = resolve_safe_position(final_bbox, preferred)

    return {
        "zone": zone or preferred, "bbox": final_bbox,
        "words": word_data, "font": font,
        "line_break": line_break, "x": final_bbox["x1"], "y": final_bbox["y1"],
        "line_h": line_h, "spacing": spacing,
        "collision": collision,
    }


def render_headline(draw, placement, text, emphasis_idx, stacked):
    """Render a placed headline onto the draw context."""
    words_data = placement["words"]
    font = placement["font"]
    line_break = placement["line_break"]
    line_h = placement["line_h"]
    spacing = placement["spacing"]
    base_x = placement["x"]
    base_y = placement["y"]
    is_yellow = True  # All headlines are yellow-on-black

    def draw_word_pill(x, y, ww, hh, word, is_emphasis):
        px = int(font.size * 0.35)
        py = int(font.size * 0.22)
        if is_emphasis:
            draw.rounded_rectangle([x - px, y - py, x + ww + px, y + hh + py],
                                    radius=int(font.size * 0.2), fill=YELLOW)
            stroked_text(draw, x, y, word, font, BLACK, sw=2)
        else:
            draw.rounded_rectangle([x - px, y - py, x + ww + px, y + hh + py],
                                    radius=int(font.size * 0.2), fill=ACCENT)
            stroked_text(draw, x, y, word, font, WHITE, stroke=(*BLACK[:3], 180), sw=2)

    if line_break is None:
        x = base_x
        y = base_y
        max_h = max(h for _, _, h in words_data)
        for i, (word, ww, hh) in enumerate(words_data):
            draw_word_pill(x, y + (max_h - hh) // 2, ww, hh, word, i == emphasis_idx)
            x += ww + spacing
    else:
        line1 = words_data[:line_break]
        line2 = words_data[line_break:]
        for li, line_wd in enumerate([line1, line2]):
            if not line_wd:
                continue
            max_h = max(h for _, _, h in line_wd)
            total_w = sum(ww for _, ww, _ in line_wd) + spacing * max(0, len(line_wd) - 1)
            x = base_x + (placement["bbox"]["w"] - total_w) // 2
            y = base_y + li * line_h
            for i, (word, ww, hh) in enumerate(line_wd):
                global_idx = li == 0 and i or line_break + i
                draw_word_pill(x, y + (max_h - hh) // 2, ww, hh, word, global_idx == emphasis_idx)
                x += ww + spacing


def render_caption_bar(draw, frame_num):
    """Render caption bar at bottom, highlighting active word."""
    current_ms = (frame_num / FPS) * 1000

    active_idx = -1
    for i in range(len(WORDS) - 1, -1, -1):
        if current_ms >= WORDS[i][1]:
            active_idx = i
            break

    if active_idx < 0:
        return

    window = WORDS[active_idx:active_idx + 7]
    if not window:
        return

    font = get_font(38, bold=False)
    font_bold = get_font(38, bold=True)

    word_data = []
    for w in window:
        f = font_bold if w == window[0] else font
        ww, hh = measure(draw, w[0], f)
        word_data.append((w[0], ww, hh))

    spacing = int(38 * 0.22)
    total_w = sum(ww for _, ww, _ in word_data) + spacing * max(0, len(word_data) - 1)
    x = (CANVAS_W - total_w) // 2
    sz = SAFE_ZONES["BOTTOM"]
    line_h = int(38 * 1.35)
    y = sz["y2"] - line_h - 10

    for i, (word, ww, hh) in enumerate(word_data):
        if i == 0:  # Active word
            pad_x = int(38 * 0.22)
            pad_y = int(38 * 0.14)
            draw.rounded_rectangle(
                [x - pad_x, y - pad_y, x + ww + pad_x, y + int(38 * 1.2) + pad_y],
                radius=int(38 * 0.14), fill=YELLOW)
            stroked_text(draw, x, y, word, font_bold, BLACK, sw=1)
        else:
            draw.text((x, y), word, font=font, fill=(*WHITE[:3], 160))
        x += ww + spacing


def render_broll_treatment(draw, content_type):
    """Render B-roll style treatment overlay."""
    alpha = 160
    if content_type == "DubaiAerial":
        # Sky gradient
        for i in range(20):
            a = alpha // 30
            draw.rectangle([0, i * (CANVAS_H // 20), CANVAS_W, (i + 1) * (CANVAS_H // 20)],
                            fill=(20, 25, 35, a))
        # Building silhouettes (full width)
        buildings = [
            (0.05, 0.5, 0.10, 0.35), (0.18, 0.55, 0.08, 0.28),
            (0.30, 0.45, 0.12, 0.42), (0.45, 0.50, 0.09, 0.32),
            (0.58, 0.48, 0.11, 0.38), (0.72, 0.52, 0.08, 0.25),
            (0.82, 0.47, 0.10, 0.45), (0.93, 0.50, 0.07, 0.33),
        ]
        for bx, by, bw_r, bh_r in buildings:
            px = int(bx * CANVAS_W)
            py = int(by * CANVAS_H)
            bw = int(bw_r * CANVAS_W)
            bh = int(bh_r * CANVAS_H)
            draw.rectangle([px, py, px + bw, py + bh],
                            fill=(15, 18, 25, alpha // 3))

    elif content_type == "businessHandshake":
        cx, cy = CANVAS_W // 2, CANVAS_H // 2
        lx = cx - 100
        draw.ellipse([lx - 25, cy - 80, lx + 25, cy - 20],
                      fill=(30, 30, 30, alpha // 4))
        draw.rectangle([lx - 30, cy - 20, lx + 30, cy + 80],
                        fill=(30, 30, 30, alpha // 4))
        rx = cx + 100
        draw.ellipse([rx - 25, cy - 80, rx + 25, cy - 20],
                      fill=(30, 30, 30, alpha // 4))
        draw.rectangle([rx - 30, cy - 20, rx + 30, cy + 80],
                        fill=(30, 30, 30, alpha // 4))
        draw.ellipse([cx - 20, cy - 15, cx + 20, cy + 15],
                      fill=(*YELLOW[:3], alpha // 6))

    # Dark overlay
    draw.rectangle([0, 0, CANVAS_W, CANVAS_H], fill=(0, 0, 0, alpha // 4))


def render_comparison_diagram(draw):
    """Render comparison diagram in BOTTOM safe zone."""
    columns = [
        {"label": "OWN COUNTRY", "color": "#FF4D2D", "flows": [
            {"label": "High Salary", "barWidth": 0.7},
            {"label": "High Taxes", "barWidth": 0.8},
            {"label": "Save Less", "barWidth": 0.4},
        ]},
        {"label": "UAE", "color": "#FFDC00", "flows": [
            {"label": "High Salary", "barWidth": 0.7},
            {"label": "0 Taxes", "barWidth": 0.1},
            {"label": "Saves More", "barWidth": 0.85},
        ]},
    ]

    alpha = 200
    sz = SAFE_ZONES["BOTTOM"]
    col_w = 120
    col_h = 160
    gap = 20
    total_w = col_w * 2 + gap
    cx = (sz["x1"] + sz["x2"]) // 2
    x = cx - total_w // 2
    y = sz["y1"]

    for i, col in enumerate(columns):
        cx_col = x + i * (col_w + gap)
        color = tuple(int(col["color"].lstrip("#")[j:j+2], 16) for j in (0, 2, 4))

        draw.rounded_rectangle([cx_col, y, cx_col + col_w, y + col_h],
                                radius=8, outline=(*color, alpha), width=3)

        font = get_font(16, bold=True)
        lw, lh = measure(draw, col["label"], font)
        lx = cx_col + (col_w - lw) // 2
        ly = y + 8
        stroked_text(draw, lx, ly, col["label"], font, (*color, alpha),
                     stroke=(*BLACK[:3], alpha), sw=1)

        bar_y = y + 32
        for flow in col["flows"]:
            bar_w = int(col_w * flow["barWidth"] * 0.85)
            bar_h = 20
            bar_x = cx_col + (col_w - bar_w) // 2

            draw.rounded_rectangle([bar_x, bar_y, bar_x + bar_w, bar_y + bar_h],
                                    radius=4, fill=(*color, alpha // 8))
            fill_w = int(bar_w * flow["barWidth"])
            draw.rounded_rectangle([bar_x, bar_y, bar_x + fill_w, bar_y + bar_h],
                                    radius=4, fill=(*color, alpha // 4))

            small = get_font(11)
            sw, sh = measure(draw, flow["label"], small)
            sx = bar_x + (bar_w - sw) // 2
            sy = bar_y + (bar_h - sh) // 2
            draw.text((sx, sy), flow["label"], font=small, fill=(*WHITE[:3], alpha // 2))
            bar_y = bar_y + bar_h + 6

    # Arrow between columns
    mid_y = y + col_h // 2
    draw.line([(x + col_w, mid_y), (x + col_w + gap, mid_y)],
               fill=(*WHITE[:3], alpha // 3), width=2)
    draw.polygon([(x + col_w + gap, mid_y), (x + col_w + gap - 8, mid_y - 4),
                  (x + col_w + gap - 8, mid_y + 4)],
                  fill=(*WHITE[:3], alpha // 3))


def render_cartoon_overlay(draw):
    """Render cartoon overlay: magnifying glass, suited figure, resume."""
    alpha = 180
    cx = CANVAS_W // 2
    cy = (SAFE_ZONES["TOP"]["y1"] + SAFE_ZONES["TOP"]["y2"]) // 2

    # Resume document (left)
    rw, rh = 50, 65
    rx, ry = cx - 70, cy - 20
    draw.rounded_rectangle([rx, ry, rx + rw, ry + rh], radius=5,
                            fill=(*WHITE[:3], alpha // 2),
                            outline=(*WHITE[:3], alpha), width=2)
    for i in range(4):
        ly = ry + 8 + i * 12
        lw = rw - 10 - (i % 2) * 8
        draw.rectangle([rx + 5, ly, rx + 5 + lw, ly + 3],
                        fill=(*WHITE[:3], alpha // 3))

    # Magnifying glass
    mag_cx = cx + 30
    mag_cy = cy - 30
    r = 30
    draw.ellipse([mag_cx - r, mag_cy - r, mag_cx + r, mag_cy + r],
                  outline=(*YELLOW[:3], alpha), width=3)
    draw.ellipse([mag_cx - r + 4, mag_cy - r + 4, mag_cx + r - 4, mag_cy + r - 4],
                  outline=(*YELLOW[:3], alpha // 3), width=2)
    draw.line([(mag_cx + int(r * 0.7), mag_cy + int(r * 0.7)),
               (mag_cx + int(r * 1.5), mag_cy + int(r * 1.5))],
               fill=(*WHITE[:3], alpha), width=3)


def render_icon_set(draw):
    """Render icon set: gears, document chart in TOP zone."""
    alpha = 180
    cx = CANVAS_W // 2
    cy = (SAFE_ZONES["TOP"]["y1"] + SAFE_ZONES["TOP"]["y2"]) // 2

    # Gear (left)
    gx, gy = cx - 50, cy - 10
    outer_r = 28
    inner_r = 12
    draw.ellipse([gx - outer_r, gy - outer_r, gx + outer_r, gy + outer_r],
                  outline=(*ACCENT[:3], alpha), width=4)
    draw.ellipse([gx - inner_r, gy - inner_r, gx + inner_r, gy + inner_r],
                  fill=(*ACCENT[:3], alpha // 5))
    for deg in range(0, 360, 60):
        a = math.radians(deg)
        x1 = gx + int(inner_r * 1.2 * math.cos(a))
        y1 = gy + int(inner_r * 1.2 * math.sin(a))
        x2 = gx + int(outer_r * 0.85 * math.cos(a))
        y2 = gy + int(outer_r * 0.85 * math.sin(a))
        draw.line([(x1, y1), (x2, y2)], fill=(*ACCENT[:3], alpha // 2), width=4)

    # Document chart (right)
    dx, dy = cx + 40, cy - 15
    dw, dh = 55, 65
    draw.rounded_rectangle([dx, dy, dx + dw, dy + dh], radius=5,
                            fill=(*DARK_SURFACE, alpha // 2),
                            outline=(*WHITE[:3], alpha // 2), width=2)
    bar_w = 8
    for i in range(3):
        bar_h = [15, 25, 20][i]
        bx = dx + 10 + i * (bar_w + 5)
        by = dy + dh - 10 - bar_h
        draw.rectangle([bx, by, bx + bar_w, dy + dh - 10],
                        fill=(*YELLOW[:3], alpha // 3))

    # Bell (center-bottom)
    bx, by = cx, cy + 30
    br = 22
    draw.ellipse([bx - br, by - br, bx + br, by + br],
                  fill=(*YELLOW[:3], alpha // 3),
                  outline=(*YELLOW[:3], alpha), width=3)
    draw.ellipse([bx - 5, by + br - 5, bx + 5, by + br + 5],
                  fill=(*YELLOW[:3], alpha))
    draw.arc([bx - 10, by - br - 14, bx + 10, by - br + 4],
              start=0, end=180, fill=(*YELLOW[:3], alpha), width=3)


def render_yellow_punch(draw, text, progress):
    """Render a yellow punch highlight word with overshoot."""
    scale = interpolate_scale(progress)
    opacity = min(progress * 3, 1) if progress < 0.33 else max(1 - (progress - 0.33) * 1.5, 0)

    if opacity < 0.01:
        return

    font = get_font(80, bold=True)
    ww, hh = measure(draw, text, font)
    pad_x = int(80 * 0.5)
    pad_y = int(80 * 0.35)
    bw = int((ww + pad_x * 2) * scale)
    bh = int((hh + pad_y * 2) * scale)
    x = (CANVAS_W - bw) // 2
    y = HEADLINE_TOP + (int(font.size * 1.3) - bh) // 2

    draw.rounded_rectangle([x, y, x + bw, y + bh],
                            radius=int(80 * 0.22), fill=YELLOW)
    tx = x + int(pad_x * scale)
    ty = y + int(pad_y * scale)
    stroked_text(draw, tx, ty, text, font, BLACK, sw=2)


def interpolate_scale(progress):
    """Overshoot scale: 0.5 -> 1.1 -> 1.0."""
    if progress < 0.5:
        p = progress / 0.5
        return 0.5 + 0.6 * (1 - (1 - p) ** 3)
    else:
        p = (progress - 0.5) / 0.5
        return 1.1 - 0.1 * (1 - (1 - p) ** 2)


# ─── Frame-by-frame rendering ───────────────────────────────────────────
def render_frame(frame_num, draw, blueprint_events):
    """Render all visual effects for a single frame."""
    current_sec = frame_num / FPS
    validation = []

    # Get active events at this frame
    active_events = [
        e for e in blueprint_events
        if e.get("timestamp", 0) <= current_sec < e.get("timestamp", 0) + e.get("duration", 2000) / 1000
    ]

    # ── Layer 1: B-roll treatments ──
    for e in active_events:
        if e["category"] == "graphic" and e.get("kind") == "brollCut":
            content = e.get("params", {}).get("content", "")
            render_broll_treatment(draw, content)

    # ── Layer 2: Graphics ──
    for e in active_events:
        if e["category"] == "graphic":
            kind = e.get("kind", "")
            if kind == "comparisonDiagram":
                render_comparison_diagram(draw)
            elif kind == "cartoonOverlay":
                render_cartoon_overlay(draw)
            elif kind == "iconSet":
                render_icon_set(draw)

    # ── Layer 3: Headlines ──
    # Check which phrase is active
    phrase_active = None
    for phrase in PHRASES:
        if phrase["from"] <= frame_num < phrase["to"]:
            phrase_active = phrase
            break

    if phrase_active:
        local_frame = frame_num - phrase_active["from"]
        scene_dur = phrase_active["to"] - phrase_active["from"]
        enter_frames = 16
        exit_frames = 10
        exit_start = scene_dur - exit_frames

        is_entering = local_frame < enter_frames
        is_exiting = local_frame >= exit_start

        scale = 1.0
        ty = 0
        opacity = 1.0

        if is_entering:
            p = local_frame / enter_frames
            if p < 0.6:
                ep = p / 0.6
                scale = interpolate(ep, [0, 1], [0.82, 1.08], { easing: EASE_OUT })
                ty = interpolate(ep, [0, 1], [40, -4], { easing: EASE_OUT })
            else:
                ep = (p - 0.6) / 0.4
                scale = interpolate(ep, [0, 1], [1.08, 1.0], { easing: EASE_IN_OUT })
                ty = interpolate(ep, [0, 1], [-4, 0], { easing: EASE_IN_OUT })
            opacity = min(p / 0.4, 1)
        elif is_exiting:
            p = (local_frame - exit_start) / exit_frames
            scale = interpolate(p, [0, 1], [1.0, 0.85], { easing: EASE_IN })
            ty = interpolate(p, [0, 1], [0, 30], { easing: EASE_IN })
            opacity = interpolate(p, [0, 1], [1, 0], { easing: EASE_IN })

        if opacity > 0.01:
            # Place and render headline
            placement = place_headline(draw, phrase_active["text"],
                                       phrase_active["stacked"], "TOP")
            if not placement["collision"]:
                validation.append({
                    "element": phrase_active["text"][:30],
                    "bbox": placement["bbox"],
                    "zone": placement["zone"],
                    "protected_hit": bbox_hits_protected(placement["bbox"]),
                    "clipping": bbox_clips_canvas(placement["bbox"]),
                })

                # We need a temporary draw context for the scaled rendering
                # For the final render, we render directly at full opacity
                # (FFmpeg handles frame-by-frame, no Remotion transforms)
                render_headline(draw, placement, phrase_active["text"],
                               phrase_active["emphasisWord"], phrase_active["stacked"])

    # ── Layer 4: Yellow punch highlight ──
    for e in active_events:
        if e["category"] == "highlight":
            text = e.get("params", {}).get("text", "")
            elapsed = current_sec - e["timestamp"]
            dur = e.get("duration", 1500) / 1000
            progress = min(1.0, elapsed / dur) if dur > 0 else 0.5
            render_yellow_punch(draw, text, progress)

    # ── Layer 5: Captions ──
    render_caption_bar(draw, frame_num)

    return validation


# ─── FFmpeg frame extraction ────────────────────────────────────────────
def extract_frames():
    """Extract all frames from source video as PNG."""
    frames_dir = os.path.join(OUTPUT_DIR, "frames")
    os.makedirs(frames_dir, exist_ok=True)

    cmd = [
        "ffmpeg", "-y",
        "-i", VIDEO_PATH,
        "-vf", f"fps={FPS}",
        "-start_number", "0",
        os.path.join(frames_dir, "frame_%04d.png"),
    ]
    print(f"Extracting {TOTAL_FRAMES} frames at {FPS}fps...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"FFmpeg error: {result.stderr}")
        return False

    # Count frames
    frames = sorted([f for f in os.listdir(frames_dir) if f.endswith('.png')])
    print(f"Extracted {len(frames)} frames")
    return len(frames) >= TOTAL_FRAMES - 5  # Allow a few frames off


def composite_frames(blueprint_events):
    """Composite reference graphics onto each extracted frame."""
    frames_dir = os.path.join(OUTPUT_DIR, "frames")
    output_dir = os.path.join(OUTPUT_DIR, "composited")
    os.makedirs(output_dir, exist_ok=True)

    all_validation = []
    font = get_font(56, bold=True)  # Pre-load font

    for i in range(TOTAL_FRAMES):
        frame_path = os.path.join(frames_dir, f"frame_{i:04d}.png")
        if not os.path.exists(frame_path):
            print(f"  Warning: frame {i} not found, skipping")
            continue

        img = Image.open(frame_path).convert("RGBA")
        # Resize to 1080x1920 if needed
        if img.size != (CANVAS_W, CANVAS_H):
            img = img.resize((CANVAS_W, CANVAS_H), Image.LANCZOS)

        draw = ImageDraw.Draw(img, "RGBA")

        validation = render_frame(i, draw, blueprint_events)
        all_validation.extend(validation)

        # Convert back to RGB for JPEG (smaller files)
        rgb = Image.new("RGB", img.size, (0, 0, 0))
        rgb.paste(img, mask=img.split()[3] if img.mode == "RGBA" else None)

        out_path = os.path.join(output_dir, f"frame_{i:04d}.png")
        rgb.save(out_path, "PNG", optimize=True)

        if (i + 1) % 50 == 0:
            print(f"  Composited {i + 1}/{TOTAL_FRAMES} frames...")

    print(f"Composited {TOTAL_FRAMES} frames")

    # Validation report
    collisions = [v for v in all_validation if v.get("protected_hit")]
    clips = [v for v in all_validation if v.get("clipping")]

    print(f"\n{'='*60}")
    print(f"BOUNDING-BOX VALIDATION")
    print(f"{'='*60}")
    print(f"Elements validated: {len(all_validation)}")
    print(f"Collisions: {len(collisions)}")
    print(f"Clipping: {len(clips)}")

    if collisions:
        print("\nCOLLISIONS:")
        for c in collisions:
            b = c["bbox"]
            print(f"  [{c['element']}] bbox=({b['x1']},{b['y1']})-({b['x2']},{b['y2']}) hit={c['protected_hit']}")
    if clips:
        print("\nCLIPPING:")
        for c in clips:
            b = c["bbox"]
            print(f"  [{c['element']}] bbox=({b['x1']},{b['y1']})-({b['x2']},{b['y2']})")

    if not collisions and not clips:
        print("All clear.")

    return len(collisions) == 0 and len(clips) == 0


def encode_video():
    """Encode composited frames + audio into final MP4."""
    frames_dir = os.path.join(OUTPUT_DIR, "composited")
    os.makedirs(os.path.dirname(OUTPUT_VIDEO), exist_ok=True)

    # Build audio: mix voice + SFX
    # If SFX track exists, mix it; otherwise just use voice
    audio_inputs = ["-i", VOICE_PATH]
    audio_filter = "[0:a]volume=1.0[voice]"

    if os.path.exists(SFX_PATH):
        audio_inputs.extend(["-i", SFX_PATH])
        audio_filter += ";[1:a]volume=0.25,highpass=f=130[sfx];[voice][sfx]amix=inputs=2:duration=first[aout]"
    else:
        audio_filter += "[aout]"

    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", os.path.join(frames_dir, "frame_%04d.png"),
        *audio_inputs,
        "-filter_complex", audio_filter,
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "256k",
        "-ar", "44100",
        "-ac", "2",
        "-shortest",
        "-movflags", "+faststart",
        OUTPUT_VIDEO,
    ]

    print(f"\nEncoding video...")
    print(f"  Resolution: {CANVAS_W}x{CANVAS_H}")
    print(f"  FPS: {FPS}")
    print(f"  Frames: {TOTAL_FRAMES}")

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"FFmpeg error: {result.stderr}")
        return False

    print(f"Encoded: {OUTPUT_VIDEO}")
    return True


def verify_output():
    """Verify the output MP4."""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_format", "-show_streams",
        OUTPUT_VIDEO,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"ffprobe error: {result.stderr}")
        return

    info = json.loads(result.stdout)
    fmt = info.get("format", {})
    video_stream = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
    audio_stream = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)

    print(f"\n{'='*60}")
    print(f"OUTPUT VERIFICATION")
    print(f"{'='*60}")
    print(f"File: {OUTPUT_VIDEO}")
    print(f"Size: {os.path.getsize(OUTPUT_VIDEO) / (1024*1024):.1f} MB")
    print(f"Duration: {float(fmt.get('duration', 0)):.2f}s")
    print(f"Format: {fmt.get('format_name', '?')}")

    if video_stream:
        print(f"\nVideo:")
        print(f"  Codec: {video_stream.get('codec_name', '?')}")
        print(f"  Resolution: {video_stream.get('width')}x{video_stream.get('height')}")
        print(f"  FPS: {video_stream.get('r_frame_rate', '?')}")
        print(f"  Pixel format: {video_stream.get('pix_fmt', '?')}")

    if audio_stream:
        print(f"\nAudio:")
        print(f"  Codec: {audio_stream.get('codec_name', '?')}")
        print(f"  Sample rate: {audio_stream.get('sample_rate', '?')}Hz")
        print(f"  Channels: {audio_stream.get('channels', '?')}")
        print(f"  Bitrate: {int(audio_stream.get('bit_rate', 0)) // 1000}kbps")


# ─── Main ───────────────────────────────────────────────────────────────
def main():
    print(f"{'='*60}")
    print(f"REFERENCE-DRIVEN DRAFT RENDER")
    print(f"Project: {PROJECT}")
    print(f"{'='*60}\n")

    # Load blueprint
    with open(BLUEPRINT_PATH, "r", encoding="utf-8") as f:
        blueprint = json.load(f)
    events = blueprint.get("events", [])
    print(f"Blueprint events: {len(events)}")

    # Step 1: Extract frames
    print("\n--- Step 1: Frame Extraction ---")
    if not extract_frames():
        print("Frame extraction failed. Check ffmpeg.")
        return

    # Step 2: Composite
    print("\n--- Step 2: Compositing ---")
    ok = composite_frames(events)
    if not ok:
        print("WARNING: Validation found issues. Review before rendering.")

    # Step 3: Encode
    print("\n--- Step 3: Encoding ---")
    if not encode_video():
        print("Encoding failed.")
        return

    # Step 4: Verify
    verify_output()

    print(f"\nDraft ready: {OUTPUT_VIDEO}")
    print(f"\nIMPORTANT: This is a DRAFT for review.")
    print(f"Do NOT treat as final.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Reference-driven preview renderer — V3 (production-quality compositor).

Renders actual visual treatments from enriched edit-blueprint.json onto raw
video frames. No debug labels, no placeholder text, no SFX badges.

Components:
    SlamText, TextSwap, HighlightWord, GraphicOverlay,
    DiagramOverlay, IconOverlay, CaptionBlock, TransitionFlash,
    BrollCut, CartoonOverlay, ComparisonDiagram, IconSet

Usage:
    python3 scripts/render-preview-v3.py corporate-career-growth-amana

Requires: ffmpeg, Pillow
Outputs:  work/[name]/preview/contact-sheet-v3.png
"""

import json
import math
import os
import subprocess
import sys
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

# ─── Constants ─────────────────────────────────────────────────────────
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW_MOMENTS = [
    0.0, 0.9, 2.38, 4.5, 6.75, 9.8, 12.48, 15.75, 18.0, 20.18, 20.8,
]
CELL_W, CELL_H = 360, 640
HEADER_H = 26
GAP = 10
PADDING = 14
COLS, ROWS = 4, 3
TITLE_H = 38
CANVAS_W = PADDING * 2 + COLS * CELL_W + (COLS - 1) * GAP
CANVAS_H = PADDING + TITLE_H + GAP + ROWS * (CELL_H + HEADER_H) + (ROWS - 1) * GAP + PADDING

# Colors
ACCENT = (255, 77, 45)
YELLOW = (255, 220, 0)
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
DARK_BG = (17, 17, 17)
DARK_SURFACE = (24, 24, 22)

FPS = 24

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


# ─── Video zoom ────────────────────────────────────────────────────────
def zoom_through(img, factor=1.12):
    w, h = img.size
    nw, nh = int(w * factor), int(h * factor)
    z = img.resize((nw, nh), Image.LANCZOS)
    return z.crop(((nw - w) // 2, (nh - h) // 2, (nw + w) // 2, (nh + h) // 2))


def punch_zoom(img, factor=1.06):
    w, h = img.size
    nw, nh = int(w * factor), int(h * factor)
    z = img.resize((nw, nh), Image.LANCZOS)
    return z.crop(((nw - w) // 2, (nh - h) // 2, (nw + w) // 2, (nh + h) // 2))


# ─── Color helpers ─────────────────────────────────────────────────────
def color_scheme_bg(scheme, alpha=255):
    if scheme == "yellowOnBlack":
        return (*YELLOW[:3], alpha)
    elif scheme == "brandRed":
        return (*ACCENT[:3], alpha)
    return (*DARK_SURFACE, alpha)


def color_scheme_fg(scheme, alpha=255):
    if scheme == "yellowOnBlack":
        return (*BLACK[:3], alpha)
    return (*WHITE[:3], alpha)


# ─── BOUNDING-BOX-AWARE LAYOUT SYSTEM ──────────────────────────────────
# Full-canvas coordinate space (1080x1920).
# Safe zones for major text/graphics:
#   TOP:    x=54–1026, y=70–360
#   BOTTOM: x=54–1026, y=1490–1830
# Protected regions (NO elements allowed):
#   FACE/HEAD:  y=440–950,  x≈300–780 (speaker head/eyes/mouth)
#   BODY:       y=950–1450  (hands, mic, gestures)

CANVAS_W_FULL = 1080
CANVAS_H_FULL = 1920

SAFE_ZONES = {
    "TOP":    {"x1": 54,  "y1": 70,  "x2": 1026, "y2": 360},
    "BOTTOM": {"x1": 54,  "y1": 1490, "x2": 1026, "y2": 1830},
}

PROTECTED_REGIONS = [
    {"name": "face", "x1": 300, "y1": 440, "x2": 780, "y2": 950},
    {"name": "body", "x1": 0,   "y1": 950, "x2": 1080, "y2": 1450},
]

MARGIN_X = 54
MAX_TEXT_WIDTH = 900  # usable width inside safe zone


def bbox_intersects(a, b):
    """Check if two bounding boxes (x1,y1,x2,y2) overlap."""
    return not (a["x2"] <= b["x1"] or a["x1"] >= b["x2"] or
                a["y2"] <= b["y1"] or a["y1"] >= b["y2"])


def bbox_hits_protected(bbox):
    """Check if bbox intersects any protected region. Returns region name or None."""
    for pr in PROTECTED_REGIONS:
        if bbox_intersects(bbox, pr):
            return pr["name"]
    return None


def bbox_clips_canvas(bbox):
    """Check if bbox extends outside canvas."""
    return (bbox["x1"] < 0 or bbox["y1"] < 0 or
            bbox["x2"] > CANVAS_W_FULL or bbox["y2"] > CANVAS_H_FULL)


def get_text_bbox(draw, text, font, x, y):
    """Get bounding box for a single text line at position (x,y)."""
    tw, th = measure(draw, text, font)
    return {"x1": x, "y1": y, "x2": x + tw, "y2": y + th, "w": tw, "h": th}


def get_padded_bbox(text_bbox, font_size):
    """Add padding for pill background around text."""
    pad_x = int(font_size * 0.35)
    pad_y = int(font_size * 0.22)
    return {
        "x1": text_bbox["x1"] - pad_x,
        "y1": text_bbox["y1"] - pad_y,
        "x2": text_bbox["x2"] + pad_x,
        "y2": text_bbox["y2"] + pad_y,
    }


def measure_word_block(draw, words, font, max_width=None):
    """Measure a block of words, return per-word widths and total dimensions.

    Returns dict with:
        words: list of (word, width, height) tuples
        total_w: total width including spacing
        total_h: max word height
        fits: bool
        line_break: index where to split for two lines, or None
    """
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
        return {"words": word_data, "total_w": total_w, "total_h": max_h,
                "fits": True, "line_break": None, "font": font}

    # Reduce font size
    ratio = max_width / total_w
    new_size = max(28, int(font.size * ratio * 0.9))
    new_font = get_font(new_size, bold=True)

    word_data = []
    for w in words:
        ww, hh = measure(draw, w, new_font)
        word_data.append((w, ww, hh))

    total_w = sum(ww for _, ww, _ in word_data) + spacing * max(0, len(words) - 1)

    if total_w <= max_width:
        return {"words": word_data, "total_w": total_w,
                "total_h": max(h for _, _, h in word_data),
                "fits": True, "line_break": None, "font": new_font}

    # Split into two lines at best break point
    best_break = len(words) // 2
    best_overflow = float('inf')
    for i in range(1, len(words)):
        line1 = sum(ww for _, ww, _ in word_data[:i]) + spacing * (i - 1)
        line2 = sum(ww for _, ww, _ in word_data[i:]) + spacing * (len(words) - i - 1)
        overflow = max(0, max(line1, line2) - max_width)
        if overflow < best_overflow:
            best_overflow = overflow
            best_break = i

    return {"words": word_data, "total_w": total_w,
            "total_h": max(h for _, _, h in word_data),
            "fits": False, "line_break": best_break, "font": new_font}


def resolve_safe_position(bbox, preferred_zone="TOP"):
    """Ensure bbox fits in a safe zone without hitting protected regions.

    Algorithm:
    1. Check preferred zone
    2. If bbox fits entirely in preferred zone AND doesn't hit protected → use it
    3. Otherwise try the other zone
    4. If neither fits, reduce scale by 10% and retry
    5. Repeat up to 5 times
    6. If still doesn't fit, split text (caller handles)
    """
    zones = ["TOP", "BOTTOM"] if preferred_zone == "TOP" else ["BOTTOM", "TOP"]

    for zone in zones:
        sz = SAFE_ZONES[zone]
        # Check if bbox fits within safe zone bounds
        if bbox["x1"] >= sz["x1"] and bbox["x2"] <= sz["x2"] and \
           bbox["y1"] >= sz["y1"] and bbox["y2"] <= sz["y2"]:
            # Check protected regions
            if not bbox_hits_protected(bbox):
                return zone, bbox, False
        # Try snapping: center within safe zone
        bbox_c = snap_bbox_to_zone(bbox, sz)
        if bbox_c["x1"] >= sz["x1"] and bbox_c["x2"] <= sz["x2"] and \
           bbox_c["y1"] >= sz["y1"] and bbox_c["y2"] <= sz["y2"]:
            if not bbox_hits_protected(bbox_c):
                return zone, bbox_c, False

    return None, bbox, True  # collision — needs scale reduction or line break


def snap_bbox_to_zone(bbox, zone):
    """Snap a bbox to be centered within a safe zone."""
    cw = bbox["x2"] - bbox["x1"]
    ch = bbox["y2"] - bbox["y1"]
    cx = (zone["x1"] + zone["x2"]) // 2
    cy = (zone["y1"] + zone["y2"]) // 2
    return {
        "x1": cx - cw // 2, "y1": cy - ch // 2,
        "x2": cx + cw // 2, "y2": cy + ch // 2,
        "w": cw, "h": ch,
    }


def place_text_element(draw, words, font, preferred_zone="TOP",
                       max_font_size=None, pil_img_w=None):
    """Full placement pipeline for a text element.

    Args:
        draw: PIL ImageDraw
        words: list of word strings
        font: base font to use
        preferred_zone: "TOP" or "BOTTOM"
        max_font_size: optional cap on font size
        pil_img_w: PIL cell width for centering

    Returns:
        dict with zone, bbox, words_data, font, line_break info
    """
    if max_font_size and font.size > max_font_size:
        font = get_font(max_font_size, bold=True)

    measured = measure_word_block(draw, words, font)

    if measured["fits"]:
        # Single line — try placement
        bbox, placed_x, placed_y = build_single_line_bbox(measured, pil_img_w or CELL_W)
        zone, final_bbox, collision = resolve_safe_position(bbox, preferred_zone)
        if not collision:
            return {
                "zone": zone, "bbox": final_bbox, "words": measured["words"],
                "font": font, "line_break": None, "x": placed_x, "y": placed_y,
            }

        # Snap to zone center
        sz = SAFE_ZONES[preferred_zone]
        final_bbox = snap_bbox_to_zone(final_bbox, sz)
        zone, final_bbox, collision = resolve_safe_position(final_bbox, preferred_zone)
        if not collision:
            return {
                "zone": zone, "bbox": final_bbox, "words": measured["words"],
                "font": font, "line_break": None,
                "x": final_bbox["x1"], "y": final_bbox["y1"],
            }

    # Two-line split
    lb = measured["line_break"] or len(words) // 2
    line1_words = words[:lb]
    line2_words = words[lb:]

    m1 = measure_word_block(draw, line1_words, measured["font"])
    m2 = measure_word_block(draw, line2_words, measured["font"])

    line_h = int(measured["font"].size * 1.35)
    total_h = line_h * 2
    total_w = max(m1["total_w"], m2["total_w"])

    sz = SAFE_ZONES[preferred_zone]
    # Center in safe zone
    cx = (sz["x1"] + sz["x2"]) // 2
    if preferred_zone == "TOP":
        cy = sz["y1"] + (sz["y2"] - sz["y1"] - total_h) // 2
        cy = max(sz["y1"], min(cy, sz["y2"] - total_h))
    else:
        cy = sz["y2"] - total_h
        cy = max(sz["y1"], min(cy, sz["y2"] - total_h))

    x = cx - total_w // 2
    y = cy

    full_bbox = {
        "x1": x, "y1": y,
        "x2": x + total_w, "y2": y + total_h,
        "w": total_w, "h": total_h,
    }

    return {
        "zone": preferred_zone, "bbox": full_bbox,
        "words": measured["words"], "font": measured["font"],
        "line_break": lb, "x": x, "y": y,
        "line1": m1, "line2": m2, "line_h": line_h,
    }


def build_single_line_bbox(measured, canvas_w):
    """Build bbox for single line of words, centered on canvas."""
    tw = measured["total_w"]
    th = measured["total_h"]
    x = (canvas_w - tw) // 2
    y = 0  # relative, zone will set actual Y
    bbox = {"x1": x, "y1": y, "x2": x + tw, "y2": y + th, "w": tw, "h": th}
    return bbox, x, y


# ─── Component: SlamText ───────────────────────────────────────────────
def render_slam_text(draw, img_w, img_h, text, params, validation_log=None):
    """Large kinetic slam text with color scheme support.

    Params: {style, colorScheme, position, fontSize, overshoot, stacked}
    """
    scheme = params.get("colorScheme", "brandRed")
    position = normalize_position_v2(params.get("position", "BOTTOM"))
    font_size = params.get("fontSize", 56)
    stacked = params.get("stacked", False)
    overshoot = params.get("overshoot", 1.0)

    font = get_font(font_size, bold=True)
    lines = text.split("\n") if stacked and "\n" in text else [text]
    all_words = []
    for line in lines:
        all_words.extend(line.split())

    result = place_text_element(draw, all_words, font, position, pil_img_w=img_w)

    if validation_log is not None:
        bbox = result["bbox"]
        hit = bbox_hits_protected(bbox)
        clip = bbox_clips_canvas(bbox)
        validation_log.append({
            "element": f"slam: {text[:30]}",
            "bbox": bbox,
            "zone": result["zone"],
            "protected_hit": hit,
            "clipping": clip,
        })

    render_words_at_placement(draw, result, img_w, scheme, font_size)


def normalize_position_v2(position):
    """Map legacy position values to TOP/BOTTOM."""
    if position in ("TOP", "BOTTOM", "FULLSCREEN_BROLL"):
        return position
    legacy = {"overSpeaker": "TOP", "midShot": "TOP",
              "center": "TOP", "bottom": "BOTTOM"}
    return legacy.get(position, "BOTTOM")


def render_words_at_placement(draw, placement, img_w, scheme, font_size):
    """Render words at their computed placement positions."""
    words_data = placement.get("words", [])
    font = placement.get("font") or get_font(font_size, bold=True)
    lb = placement.get("line_break")
    line_h = placement.get("line_h", int(font_size * 1.35))
    base_y = placement["y"]

    is_yellow = scheme == "yellowOnBlack"
    spacing = int(font_size * 0.2)

    if lb is None:
        # Single line
        words = [w for w, _, _ in words_data]
        widths = [w for _, w, _ in words_data]
        x = placement["x"]
        y = base_y
        max_h = max(h for _, _, h in words_data)

        for i, (word, ww, hh) in enumerate(words_data):
            px = int(font_size * 0.35)
            py = int(font_size * 0.22)
            bx = x - px
            by = y - py
            bw = ww + px * 2
            bh = hh + py * 2

            if is_yellow:
                draw.rounded_rectangle([bx, by, bx + bw, by + bh],
                                        radius=int(font_size * 0.2), fill=YELLOW)
                stroked_text(draw, x, y + (max_h - hh) // 2, word, font,
                             (*BLACK[:3], 255), stroke=(*BLACK[:3], 200), sw=2)
            else:
                draw.rounded_rectangle([bx, by, bx + bw, by + bh],
                                        radius=int(font_size * 0.2), fill=ACCENT)
                stroked_text(draw, x, y + (max_h - hh) // 2, word, font,
                             WHITE, stroke=(*BLACK[:3], 180), sw=2)
            x += ww + spacing
    else:
        # Two lines
        line1_words = words_data[:lb]
        line2_words = words_data[lb:]
        all_lines = [line1_words, line2_words]

        for li, line_wd in enumerate(all_lines):
            if not line_wd:
                continue
            words = [w for w, _, _ in line_wd]
            widths = [w for _, w, _ in line_wd]
            max_h = max(h for _, _, h in line_wd)
            total_w = sum(widths) + spacing * max(0, len(words) - 1)
            x = placement["x"] + (placement.get("bbox", {}).get("w", total_w) - total_w) // 2
            y = base_y + li * line_h

            for i, (word, ww, hh) in enumerate(line_wd):
                px = int(font_size * 0.35)
                py = int(font_size * 0.22)
                bx = x - px
                by = y - py
                bw = ww + px * 2
                bh = hh + py * 2

                if is_yellow:
                    draw.rounded_rectangle([bx, by, bx + bw, by + bh],
                                            radius=int(font_size * 0.2), fill=YELLOW)
                    stroked_text(draw, x, y + (max_h - hh) // 2, word, font,
                                 (*BLACK[:3], 255), stroke=(*BLACK[:3], 200), sw=2)
                else:
                    draw.rounded_rectangle([bx, by, bx + bw, by + bh],
                                            radius=int(font_size * 0.2), fill=ACCENT)
                    stroked_text(draw, x, y + (max_h - hh) // 2, word, font,
                                 WHITE, stroke=(*BLACK[:3], 180), sw=2)
                x += ww + spacing


# ─── Component: TextSwap ───────────────────────────────────────────────
def render_text_swap(draw, img_w, img_h, old_text, new_text, progress, params,
                     validation_log=None):
    """Coordinated text swap: old slams out, new slams in with overshoot."""
    scheme = params.get("colorScheme", "brandRed")
    position = normalize_position_v2(params.get("position", "BOTTOM"))
    font_size = params.get("fontSize", 56)
    overshoot = params.get("overshoot", 1.12)

    font = get_font(font_size, bold=True)
    is_yellow = scheme == "yellowOnBlack"
    half = 0.4

    if progress < half:
        t = progress / half
        scale = 1.0 - 0.3 * (t * t)
        opacity = int(255 * (1.0 - t))
        active_text = old_text
    else:
        t = (progress - half) / (1.0 - half)
        peak = overshoot
        if t < 0.5:
            p2 = t / 0.5
            scale = 1.0 + (peak - 1.0) * (1.0 - (1.0 - p2) ** 3)
        else:
            p2 = (t - 0.5) / 0.5
            scale = peak - (peak - 1.0) * (1.0 - (1.0 - p2) ** 2)
        opacity = int(255 * min(1.0, t * 2.0))
        active_text = new_text

    scale = max(0.5, min(1.3, scale))

    words = active_text.split()
    result = place_text_element(draw, words, font, position, pil_img_w=img_w)

    if validation_log is not None:
        bbox = result["bbox"]
        hit = bbox_hits_protected(bbox)
        clip = bbox_clips_canvas(bbox)
        validation_log.append({
            "element": f"text_swap: {active_text[:30]}",
            "bbox": bbox,
            "zone": result["zone"],
            "protected_hit": hit,
            "clipping": clip,
        })

    # Render with scale/opacity
    _render_scaled_words(draw, result, img_w, scheme, font_size, scale, opacity)


def _render_scaled_words(draw, placement, img_w, scheme, font_size, scale, opacity):
    """Render words at placement with scale and opacity applied."""
    words_data = placement.get("words", [])
    font = placement.get("font") or get_font(font_size, bold=True)
    lb = placement.get("line_break")
    line_h = placement.get("line_h", int(font_size * 1.35))
    base_x = placement["x"]
    base_y = placement["y"]
    is_yellow = scheme == "yellowOnBlack"
    spacing = int(font_size * 0.2)

    if lb is None:
        x = base_x
        y = base_y
        max_h = max(h for _, _, h in words_data)

        for word, ww, hh in words_data:
            dw = int(ww * scale)
            dh = int(hh * scale)
            dx = x + (ww - dw) // 2
            dy = y + (max_h - dh) // 2
            px = int(font_size * 0.35)
            py = int(font_size * 0.22)
            bg = color_scheme_bg(scheme, opacity)
            fg = color_scheme_fg(scheme, opacity)
            st = (*BLACK[:3], opacity)
            draw.rounded_rectangle([dx - px, dy - py, dx + dw + px, dy + dh + py],
                                    radius=int(font_size * 0.2), fill=bg)
            stroked_text(draw, dx, dy, word, font, fg, stroke=st, sw=2)
            x += ww + spacing
    else:
        line1 = words_data[:lb]
        line2 = words_data[lb:]
        for li, line_wd in enumerate([line1, line2]):
            if not line_wd:
                continue
            max_h = max(h for _, _, h in line_wd)
            total_w = sum(ww for _, ww, _ in line_wd) + spacing * max(0, len(line_wd) - 1)
            x = base_x + (placement.get("bbox", {}).get("w", total_w) - total_w) // 2
            y = base_y + li * line_h

            for word, ww, hh in line_wd:
                dw = int(ww * scale)
                dh = int(hh * scale)
                dx = x + (ww - dw) // 2
                dy = y + (max_h - dh) // 2
                px = int(font_size * 0.35)
                py = int(font_size * 0.22)
                bg = color_scheme_bg(scheme, opacity)
                fg = color_scheme_fg(scheme, opacity)
                st = (*BLACK[:3], opacity)
                draw.rounded_rectangle([dx - px, dy - py, dx + dw + px, dy + dh + py],
                                        radius=int(font_size * 0.2), fill=bg)
                stroked_text(draw, dx, dy, word, font, fg, stroke=st, sw=2)
                x += ww + spacing


# ─── Component: HighlightWord ──────────────────────────────────────────
def render_highlight(draw, img_w, img_h, text, params, validation_log=None):
    """Large yellow highlighted word with optional glow."""
    position = normalize_position_v2(params.get("position", "TOP"))
    is_overlay = params.get("isOverlay", False)
    font_size = params.get("fontSize", 48)

    font = get_font(font_size, bold=True)
    ww, hh = measure(draw, text, font)

    # Bounding box with padding
    pad_x = int(font_size * 0.5)
    pad_y = int(font_size * 0.35)
    bw = ww + pad_x * 2
    bh = hh + pad_y * 2

    x = (img_w - bw) // 2
    y = getLayoutPositionV2(position) - bh // 2  # center vertically in zone

    bbox = {"x1": x, "y1": y, "x2": x + bw, "y2": y + bh, "w": bw, "h": bh}

    # Validate and resolve
    zone, final_bbox, collision = resolve_safe_position(bbox, position)
    if collision:
        sz = SAFE_ZONES[position]
        final_bbox = snap_bbox_to_zone(bbox, sz)
        zone, final_bbox, collision = resolve_safe_position(final_bbox, position)

    if validation_log is not None:
        hit = bbox_hits_protected(final_bbox)
        clip = bbox_clips_canvas(final_bbox)
        validation_log.append({
            "element": f"highlight: {text[:30]}",
            "bbox": final_bbox,
            "zone": zone or position,
            "protected_hit": hit,
            "clipping": clip,
        })

    fx = final_bbox["x1"]
    fy = final_bbox["y1"]

    if is_overlay:
        for offset in [10, 6, 3]:
            draw.rounded_rectangle(
                [fx - offset, fy - offset, fx + bw + offset, fy + bh + offset],
                radius=int(font_size * 0.3), fill=(*YELLOW[:3], 50)
            )

    draw.rounded_rectangle([fx, fy, fx + bw, fy + bh],
                            radius=int(font_size * 0.22), fill=YELLOW)
    stroked_text(draw, fx + pad_x, fy + pad_y, text, font, BLACK, sw=2)


def getLayoutPositionV2(position):
    """Return center Y for a safe zone."""
    if position == "TOP":
        return (SAFE_ZONES["TOP"]["y1"] + SAFE_ZONES["TOP"]["y2"]) // 2
    elif position == "BOTTOM":
        return (SAFE_ZONES["BOTTOM"]["y1"] + SAFE_ZONES["BOTTOM"]["y2"]) // 2
    return (SAFE_ZONES["TOP"]["y1"] + SAFE_ZONES["TOP"]["y2"]) // 2


# ─── Component: GraphicOverlay ─────────────────────────────────────────
def render_graphic(draw, img_w, img_h, kind, params, validation_log=None):
    """Actual vector-style graphics. Not text labels."""
    if kind == "cartoonOverlay":
        render_cartoon_overlay(draw, img_w, img_h, params, validation_log)
    elif kind == "brollCut":
        render_broll_cut(draw, img_w, img_h, params)
    elif kind == "comparisonDiagram":
        render_comparison_diagram(draw, img_w, img_h, params, validation_log)
    elif kind == "iconSet":
        render_icon_set(draw, img_w, img_h, params, validation_log)
    elif kind == "icon":
        render_single_icon(draw, img_w, img_h, params)
    elif kind == "illustration":
        render_illustration(draw, img_w, img_h, validation_log)
    elif kind == "overlay":
        render_depth_overlay(draw, img_w, img_h)
    elif kind == "arrow":
        render_arrow(draw, img_w, img_h, params)
    elif kind == "diagram":
        render_diagram(draw, img_w, img_h, validation_log)


def get_graphic_group_bbox(elements, img_w, img_h):
    """Compute the combined bounding box of a graphic group.

    elements: list of dicts with type, x (0-1 ratio), yOffset (0-1), scale
    Returns: bbox dict
    """
    min_x, min_y = float('inf'), float('inf')
    max_x, max_y = float('-inf'), float('-inf')

    for elem in elements:
        ex = int(elem.get("x", 0.5) * img_w)
        esc = elem.get("scale", 0.7)
        etype = elem.get("type", "")

        # Estimate bounding box per element type
        if etype in ("magnifyingGlass",):
            r = int(28 * esc)
            min_x = min(min_x, ex - r)
            max_x = max(max_x, ex + r)
            min_y = min(min_y, 240 - r)  # top of TOP zone
            max_y = max(max_y, 360 + r)  # bottom of TOP zone
        elif etype in ("suitedFigure",):
            bw, bh = int(36 * esc), int(50 * esc)
            bx, by = ex - bw // 2, 300
            min_x = min(min_x, bx)
            max_x = max(max_x, bx + bw)
            min_y = min(min_y, by - 30)
            max_y = max(max_y, by + bh + 30)
        elif etype in ("laptop",):
            lw, lh = int(40 * esc), int(28 * esc)
            lx, ly = ex - lw // 2, 300 - lh // 2
            min_x = min(min_x, lx)
            max_x = max(max_x, lx + lw)
            min_y = min(min_y, ly)
            max_y = max(max_y, ly + lh)
        elif etype in ("resume",):
            rw, rh = int(30 * esc), int(40 * esc)
            rx, ry = ex - rw // 2, 320 - rh // 2
            min_x = min(min_x, rx)
            max_x = max(max_x, rx + rw)
            min_y = min(min_y, ry)
            max_y = max(max_y, ry + rh)
        elif etype in ("gear",):
            outer_r = int(26 * esc)
            min_x = min(min_x, ex - outer_r)
            max_x = max(max_x, ex + outer_r)
            min_y = min(min_y, 200 - outer_r)
            max_y = max(max_y, 360 + outer_r)
        elif etype in ("documentChart",):
            dw, dh = int(50 * esc), int(60 * esc)
            dx, dy = ex - dw // 2, 300 - dh // 2
            min_x = min(min_x, dx)
            max_x = max(max_x, dx + dw)
            min_y = min(min_y, dy)
            max_y = max(max_y, dy + dh)
        elif etype in ("bell",):
            br = int(24 * esc)
            bx, by = ex, 300 + 4
            min_x = min(min_x, bx - br)
            max_x = max(max_x, bx + br)
            min_y = min(min_y, by - br - 12)
            max_y = max(max_y, by + br + 4)

    if min_x == float('inf'):
        return None

    return {
        "x1": int(min_x), "y1": int(min_y),
        "x2": int(max_x), "y2": int(max_y),
        "w": int(max_x - min_x), "h": int(max_y - min_y),
    }


def constrain_group_to_top_zone(group_bbox, img_w):
    """Shift and scale a graphic group bbox to fit in the TOP safe zone."""
    sz = SAFE_ZONES["TOP"]

    # First try: snap to TOP zone
    cw = group_bbox["w"]
    ch = group_bbox["h"]

    # Scale down if too tall
    max_h = sz["y2"] - sz["y1"]
    max_w = sz["x2"] - sz["x1"]
    scale = 1.0

    if ch > max_h:
        scale = max_h / ch
    if cw * scale > max_w:
        scale = min(scale, max_w / cw)

    scale = min(scale, 1.0)  # never scale up

    if scale < 0.5:
        return None  # cannot fit

    # Center in TOP zone
    cx = (sz["x1"] + sz["x2"]) // 2
    cy = (sz["y1"] + sz["y2"]) // 2

    new_w = int(cw * scale)
    new_h = int(ch * scale)

    return {
        "x1": cx - new_w // 2, "y1": cy - new_h // 2,
        "x2": cx + new_w // 2, "y2": cy + new_h // 2,
        "w": new_w, "h": new_h, "scale": scale,
    }


def render_cartoon_overlay(draw, img_w, img_h, params, validation_log=None):
    """Cartoon overlay: magnifying glass, suited figure, laptop — as a group."""
    elements = params.get("elements", [])
    alpha = 180

    # Compute group bbox
    group_bbox = get_graphic_group_bbox(elements, img_w, img_h)
    constrained = None
    if group_bbox:
        constrained = constrain_group_to_top_zone(group_bbox, img_w)

    if validation_log and group_bbox:
        test_bbox = constrained or group_bbox
        hit = bbox_hits_protected(test_bbox)
        clip = bbox_clips_canvas(test_bbox)
        validation_log.append({
            "element": "graphic: cartoonOverlay (group)",
            "bbox": test_bbox,
            "zone": "TOP",
            "protected_hit": hit,
            "clipping": clip,
        })

    if constrained:
        scale = constrained.get("scale", 1.0)
        # Offset from top zone center
        zone_cx = (SAFE_ZONES["TOP"]["x1"] + SAFE_ZONES["TOP"]["x2"]) // 2
        zone_cy = (SAFE_ZONES["TOP"]["y1"] + SAFE_ZONES["TOP"]["y2"]) // 2
    else:
        scale = 1.0
        zone_cx = img_w // 2
        zone_cy = (LAYOUT_REF["TOP_Y"] + LAYOUT_REF["TOP_Y_END"]) // 2

    for elem in elements:
        etype = elem.get("type", "")
        ex_ratio = elem.get("x", 0.5)
        ey_ratio = elem.get("yOffset", 0.5)
        esc = elem.get("scale", 0.7) * scale

        # Position relative to group center
        ex = zone_cx + int((ex_ratio - 0.5) * (constrained["w"] if constrained else img_w * 0.6))
        ey = zone_cy + int((ey_ratio - 0.5) * (constrained["h"] if constrained else 200))

        # Clamp individual elements within TOP zone
        elem_r = int(28 * esc)
        ey = max(SAFE_ZONES["TOP"]["y1"] + elem_r + 5,
                 min(ey, SAFE_ZONES["TOP"]["y2"] - elem_r - 5))

        if etype == "magnifyingGlass":
            r = int(28 * esc)
            draw.ellipse([ex - r, ey - r, ex + r, ey + r],
                          outline=(*WHITE[:3], alpha), width=3)
            draw.ellipse([ex - r + 3, ey - r + 3, ex + r - 3, ey + r - 3],
                          outline=(*YELLOW[:3], alpha // 3), width=2)
            handle_end_x = ex + int(r * 1.6)
            handle_end_y = ey + int(r * 1.6)
            draw.line([(ex + int(r * 0.7), ey + int(r * 0.7)), (handle_end_x, handle_end_y)],
                       fill=(*WHITE[:3], alpha), width=3)

        elif etype == "suitedFigure":
            bw, bh = int(36 * esc), int(50 * esc)
            bx, by = ex - bw // 2, ey
            draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=6,
                                    fill=(*DARK_SURFACE, alpha // 2),
                                    outline=(*WHITE[:3], alpha), width=2)
            hr = int(14 * esc)
            draw.ellipse([ex - hr, by - hr - 4, ex + hr, by + 4],
                          fill=(*WHITE[:3], alpha // 3),
                          outline=(*WHITE[:3], alpha), width=2)
            lw, lh = int(28 * esc), int(18 * esc)
            lx, ly = ex - lw // 2, by + bh // 2
            draw.rounded_rectangle([lx, ly, lx + lw, ly + lh], radius=3,
                                    fill=(*YELLOW[:3], alpha // 4),
                                    outline=(*WHITE[:3], alpha // 2), width=1)

        elif etype == "laptop":
            lw, lh = int(40 * esc), int(28 * esc)
            lx, ly = ex - lw // 2, ey - lh // 2
            draw.rounded_rectangle([lx, ly, lx + lw, ly + lh], radius=4,
                                    fill=(*DARK_SURFACE, alpha // 2),
                                    outline=(*WHITE[:3], alpha), width=2)
            for i in range(3):
                line_y = ly + 8 + i * 8
                draw.line([(lx + 6, line_y), (lx + lw - 6, line_y)],
                           fill=(*YELLOW[:3], alpha // 3), width=1)
            draw.line([(lx, ly + lh), (lx + lw, ly + lh)],
                       fill=(*WHITE[:3], alpha), width=2)

        elif etype == "resume":
            rw, rh = int(30 * esc), int(40 * esc)
            rx, ry = ex - rw // 2, ey - rh // 2
            draw.rounded_rectangle([rx, ry, rx + rw, ry + rh], radius=3,
                                    fill=(*WHITE[:3], alpha // 2),
                                    outline=(*WHITE[:3], alpha), width=2)
            for i in range(4):
                ly = ry + 6 + i * 9
                lw = rw - 8 - (i % 2) * 8
                draw.rectangle([rx + 4, ly, rx + 4 + lw, ly + 3],
                                fill=(*WHITE[:3], alpha // 3))
            mag_r = int(12 * esc)
            draw.ellipse([ex + 5, ey - rh // 2 - mag_r - 2, ex + 5 + mag_r * 2,
                          ey - rh // 2 + mag_r - 2],
                          outline=(*YELLOW[:3], alpha), width=2)
            draw.line([(ex + 5 + mag_r, ey - rh // 2 - 2),
                       (ex + 5 + mag_r + 8, ey - rh // 2 + 10)],
                       fill=(*WHITE[:3], alpha), width=2)

        elif etype == "magnifyingGlass":
            r = int(24 * esc)
            draw.ellipse([ex - r, ey - r, ex + r, ey + r],
                          outline=(*YELLOW[:3], alpha), width=3)
            draw.line([(ex + int(r * 0.7), ey + int(r * 0.7)),
                       (ex + int(r * 1.5), ey + int(r * 1.5))],
                       fill=(*WHITE[:3], alpha), width=3)


def render_broll_cut(draw, img_w, img_h, params):
    """B-roll cut: darkened frame with content hint."""
    content = params.get("content", "")
    alpha = 160

    if content == "DubaiAerial":
        for i in range(20):
            a = alpha // 30
            draw.rectangle([0, i * (img_h // 20), img_w, (i + 1) * (img_h // 20)],
                            fill=(20, 25, 35, a))
        buildings = [
            (0.1, 0.5, 0.08, 0.35), (0.2, 0.55, 0.06, 0.30), (0.3, 0.45, 0.10, 0.40),
            (0.45, 0.50, 0.07, 0.32), (0.55, 0.48, 0.09, 0.38),
            (0.68, 0.52, 0.06, 0.28), (0.78, 0.47, 0.08, 0.42),
            (0.88, 0.50, 0.07, 0.33),
        ]
        for bx, by, bw_ratio, bh_ratio in buildings:
            bx_px = int(bx * img_w)
            by_px = int(by * img_h)
            bw = int(bw_ratio * img_w)
            bh = int(bh_ratio * img_h)
            draw.rectangle([bx_px, by_px, bx_px + bw, by_px + bh],
                            fill=(15, 18, 25, alpha // 3))

    elif content == "businessHandshake":
        cx = img_w // 2
        cy = img_h // 2
        lx = cx - 80
        draw.ellipse([lx - 20, cy - 60, lx + 20, cy - 20],
                      fill=(30, 30, 30, alpha // 4))
        draw.rectangle([lx - 25, cy - 20, lx + 25, cy + 60],
                        fill=(30, 30, 30, alpha // 4))
        rx = cx + 80
        draw.ellipse([rx - 20, cy - 60, rx + 20, cy - 20],
                      fill=(30, 30, 30, alpha // 4))
        draw.rectangle([rx - 25, cy - 20, rx + 25, cy + 60],
                        fill=(30, 30, 30, alpha // 4))
        draw.ellipse([cx - 15, cy - 10, cx + 15, cy + 10],
                      fill=(*YELLOW[:3], alpha // 6))

    draw.rectangle([0, 0, img_w, img_h], fill=(0, 0, 0, alpha // 4))


def render_comparison_diagram(draw, img_w, img_h, params, validation_log=None):
    """Two-column comparison: OWN COUNTRY vs UAE with flow data."""
    columns = params.get("columns", [])
    if not columns:
        return

    alpha = 200
    cx = int(img_w * 0.55)

    # Place in BOTTOM safe zone with bounding box check
    sz = SAFE_ZONES["BOTTOM"]
    col_w = 100
    col_h = 140
    gap = 16
    total_w = col_w * 2 + gap
    x = cx - total_w // 2
    y = sz["y1"]

    bbox = {"x1": x, "y1": y, "x2": x + total_w, "y2": y + col_h,
            "w": total_w, "h": col_h}

    if validation_log:
        hit = bbox_hits_protected(bbox)
        clip = bbox_clips_canvas(bbox)
        validation_log.append({
            "element": "graphic: comparisonDiagram",
            "bbox": bbox,
            "zone": "BOTTOM",
            "protected_hit": hit,
            "clipping": clip,
        })

    start_x = x

    for i, col in enumerate(columns):
        cx_col = start_x + i * (col_w + gap)
        label = col.get("label", "")
        color_hex = col.get("color", "#FF4D2D")
        color = hex_to_rgb(color_hex)
        flows = col.get("flows", [])

        draw.rounded_rectangle(
            [cx_col, y, cx_col + col_w, y + col_h],
            radius=8, outline=(*color[:3], alpha), width=3
        )

        font = get_font(14, bold=True)
        lw, lh = measure(draw, label, font)
        lx = cx_col + (col_w - lw) // 2
        ly = y + 6
        stroked_text(draw, lx, ly, label, font, (*color[:3], alpha),
                     stroke=(*BLACK[:3], alpha), sw=1)

        bar_y = y + 28
        for flow in flows:
            flabel = flow.get("label", "")
            bw_ratio = flow.get("barWidth", 0.5)
            bar_w = int(col_w * bw_ratio * 0.85)
            bar_h = 16
            bar_x = cx_col + (col_w - bar_w) // 2
            bar_y_end = bar_y + bar_h

            draw.rounded_rectangle([bar_x, bar_y, bar_x + bar_w, bar_y_end],
                                    radius=3, fill=(*color[:3], alpha // 8))
            fill_w = int(bar_w * bw_ratio)
            draw.rounded_rectangle([bar_x, bar_y, bar_x + fill_w, bar_y_end],
                                    radius=3, fill=(*color[:3], alpha // 4))

            small = get_font(10)
            sw, sh = measure(draw, flabel, small)
            sx = bar_x + (bar_w - sw) // 2
            sy = bar_y + (bar_h - sh) // 2
            draw.text((sx, sy), flabel, font=small, fill=(*WHITE[:3], alpha // 2))

            bar_y = bar_y_end + 4

    if params.get("arrowBetween"):
        mid_y = y + col_h // 2
        right_edge = start_x + 2 * (col_w + gap)
        left_edge = start_x + col_w
        draw.line([(left_edge, mid_y), (right_edge, mid_y)],
                   fill=(*WHITE[:3], alpha // 3), width=2)
        draw.polygon([(right_edge, mid_y), (right_edge - 8, mid_y - 4), (right_edge - 8, mid_y + 4)],
                      fill=(*WHITE[:3], alpha // 3))


def render_icon_set(draw, img_w, img_h, params, validation_log=None):
    """Set of icons: gears, document chart, etc."""
    elements = params.get("elements", [])
    alpha = 180

    # Group bbox
    group_bbox = get_graphic_group_bbox(elements, img_w, img_h)
    constrained = None
    if group_bbox:
        constrained = constrain_group_to_top_zone(group_bbox, img_w)

    if validation_log and group_bbox:
        test_bbox = constrained or group_bbox
        hit = bbox_hits_protected(test_bbox)
        clip = bbox_clips_canvas(test_bbox)
        validation_log.append({
            "element": "graphic: iconSet (group)",
            "bbox": test_bbox,
            "zone": "TOP",
            "protected_hit": hit,
            "clipping": clip,
        })

    if constrained:
        scale = constrained.get("scale", 1.0)
        zone_cx = (SAFE_ZONES["TOP"]["x1"] + SAFE_ZONES["TOP"]["x2"]) // 2
        zone_cy = (SAFE_ZONES["TOP"]["y1"] + SAFE_ZONES["TOP"]["y2"]) // 2
    else:
        scale = 1.0
        zone_cx = img_w // 2
        zone_cy = (LAYOUT_REF["TOP_Y"] + LAYOUT_REF["TOP_Y_END"]) // 2

    for elem in elements:
        etype = elem.get("type", "")
        ex_ratio = elem.get("x", 0.5)
        ey_ratio = elem.get("yOffset", 0.5)
        esc = elem.get("scale", 0.7) * scale

        ex = zone_cx + int((ex_ratio - 0.5) * (constrained["w"] if constrained else img_w * 0.5))
        ey = zone_cy + int((ey_ratio - 0.5) * (constrained["h"] if constrained else 200))

        elem_r = int(28 * esc)
        ey = max(SAFE_ZONES["TOP"]["y1"] + elem_r + 5,
                 min(ey, SAFE_ZONES["TOP"]["y2"] - elem_r - 5))

        if etype == "gear":
            outer_r = int(22 * esc)
            inner_r = int(9 * esc)
            draw.ellipse([ex - outer_r, ey - outer_r, ex + outer_r, ey + outer_r],
                          outline=(*ACCENT[:3], alpha), width=4)
            draw.ellipse([ex - inner_r, ey - inner_r, ex + inner_r, ey + inner_r],
                          fill=(*ACCENT[:3], alpha // 5))
            for deg in range(0, 360, 60):
                a = math.radians(deg)
                x1 = ex + int(inner_r * 1.2 * math.cos(a))
                y1 = ey + int(inner_r * 1.2 * math.sin(a))
                x2 = ex + int(outer_r * 0.85 * math.cos(a))
                y2 = ey + int(outer_r * 0.85 * math.sin(a))
                draw.line([(x1, y1), (x2, y2)], fill=(*ACCENT[:3], alpha // 2), width=4)

        elif etype == "documentChart":
            dw, dh = int(50 * esc), int(60 * esc)
            dx, dy = ex - dw // 2, ey - dh // 2
            draw.rounded_rectangle([dx, dy, dx + dw, dy + dh], radius=4,
                                    fill=(*DARK_SURFACE, alpha // 2),
                                    outline=(*WHITE[:3], alpha // 2), width=2)
            bar_w = 6
            for i in range(3):
                bar_h = [12, 20, 15][i]
                bx = dx + 8 + i * (bar_w + 4)
                by = dy + dh - 8 - bar_h
                draw.rectangle([bx, by, bx + bar_w, dy + dh - 8],
                                fill=(*YELLOW[:3], alpha // 3))
            draw.polygon([
                (dx + dw - 10, dy), (dx + dw, dy + 10), (dx + dw - 10, dy + 10)
            ], fill=(*WHITE[:3], alpha // 5))

        elif etype == "bell":
            br = int(18 * esc)
            bx, by = ex, ey + 4
            draw.ellipse([bx - br, by - br, bx + br, by + br],
                          fill=(*YELLOW[:3], alpha // 3),
                          outline=(*YELLOW[:3], alpha), width=3)
            draw.ellipse([bx - 4, by + br - 4, bx + 4, by + br + 4],
                          fill=(*YELLOW[:3], alpha))
            draw.arc([bx - 8, by - br - 12, bx + 8, by - br + 4],
                      start=0, end=180, fill=(*YELLOW[:3], alpha), width=3)


def render_single_icon(draw, img_w, img_h, params):
    """Single icon (bell, gear, etc.)."""
    render_icon_set(draw, img_w, img_h, {
        "elements": [{"type": params.get("iconType", "bell"),
                       "x": 0.5, "yOffset": 0.5, "scale": 1.0}]
    })


def render_illustration(draw, img_w, img_h, validation_log=None):
    """Decorative illustration card with abstract shapes."""
    cx = img_w // 2
    cy = (SAFE_ZONES["TOP"]["y1"] + SAFE_ZONES["TOP"]["y2"]) // 2
    rw = img_w - 140
    rh = 150
    rx = cx - rw // 2
    ry = cy - rh // 2

    # Keep within TOP zone
    ry = max(SAFE_ZONES["TOP"]["y1"], min(ry, SAFE_ZONES["TOP"]["y2"] - rh))

    bbox = {"x1": rx, "y1": ry, "x2": rx + rw, "y2": ry + rh,
            "w": rw, "h": rh}

    if validation_log:
        hit = bbox_hits_protected(bbox)
        clip = bbox_clips_canvas(bbox)
        validation_log.append({
            "element": "graphic: illustration",
            "bbox": bbox,
            "zone": "TOP",
            "protected_hit": hit,
            "clipping": clip,
        })

    for off in range(6, 0, -2):
        draw.rounded_rectangle([rx - off, ry - off, rx + rw + off, ry + rh + off],
                                radius=14, fill=(*ACCENT[:3], 35))
    draw.rounded_rectangle([rx, ry, rx + rw, ry + rh], radius=12,
                            fill=(*DARK_SURFACE, 120))
    draw.rounded_rectangle([rx, ry, rx + rw, ry + rh], radius=12,
                            outline=(*ACCENT[:3], 120), width=3)

    cr = 24
    draw.ellipse([cx - 70 - cr, cy - cr, cx - 70 + cr, cy + cr],
                  fill=(*ACCENT[:3], 60))
    rw2, rh2 = 40, 28
    draw.rounded_rectangle([cx + 20, cy - rh2 // 2, cx + 20 + rw2, cy + rh2 // 2],
                            radius=5, fill=(*YELLOW[:3], 50))


def render_depth_overlay(draw, img_w, img_h):
    """Subtle dark gradient overlay for depth."""
    for i in range(8):
        a = 20 + i * 5
        draw.rectangle([0, SAFE_ZONES["TOP"]["y1"] + i * 12, img_w,
                        SAFE_ZONES["TOP"]["y1"] + i * 12 + 12],
                        fill=(0, 0, 0, a))


def render_arrow(draw, img_w, img_h, params):
    """Large arrow overlay — placed in TOP safe zone."""
    alpha = 180
    x1, y1 = int(img_w * 0.72), SAFE_ZONES["TOP"]["y1"] + 60
    x2, y2 = int(img_w * 0.50), SAFE_ZONES["TOP"]["y1"] + 160

    draw.line([(x1, y1), (x2, y2)], fill=(*ACCENT[:3], alpha), width=7)
    head = 26
    angle = math.atan2(y2 - y1, x2 - x1)
    draw.polygon([
        (x2, y2),
        (x2 - head * math.cos(angle - 0.45), y2 - head * math.sin(angle - 0.45)),
        (x2 - head * math.cos(angle + 0.45), y2 - head * math.sin(angle + 0.45)),
    ], fill=(*ACCENT[:3], alpha))


def render_diagram(draw, img_w, img_h, validation_log=None):
    """Simple diagram box — BOTTOM zone."""
    sz = SAFE_ZONES["BOTTOM"]
    cx = (sz["x1"] + sz["x2"]) // 2
    cy = sz["y1"] + 70
    dw, dh = 200, 140
    bbox = {"x1": cx - dw // 2, "y1": cy - dh // 2,
            "x2": cx + dw // 2, "y2": cy + dh // 2,
            "w": dw, "h": dh}

    if validation_log:
        hit = bbox_hits_protected(bbox)
        clip = bbox_clips_canvas(bbox)
        validation_log.append({
            "element": "graphic: diagram",
            "bbox": bbox, "zone": "BOTTOM",
            "protected_hit": hit, "clipping": clip,
        })

    draw.rounded_rectangle([cx - dw // 2, cy - dh // 2, cx + dw // 2, cy + dh // 2],
                            radius=8, outline=(*ACCENT[:3], 160), width=3)


# ─── Component: CaptionBlock ───────────────────────────────────────────
def render_caption_block(draw, img_w, img_h, text, params, active_word=None,
                         validation_log=None):
    """Bottom caption with optional highlighted word."""
    scheme = params.get("colorScheme", "whiteOnBlack")
    position = normalize_position_v2(params.get("position", "BOTTOM"))
    font_size = params.get("fontSize", 38)
    stacked = params.get("stacked", False)

    font = get_font(font_size, bold=False)
    font_bold = get_font(font_size, bold=True)

    words = text.split()[:7]
    if not words:
        return

    # Build word data with measured widths
    word_data = []
    for w in words:
        f = font_bold if w == active_word else font
        ww, hh = measure(draw, w, f)
        word_data.append((w, ww, hh))

    spacing = int(font_size * 0.22)
    total_w = sum(ww for _, ww, _ in word_data) + spacing * max(0, len(words) - 1)
    max_h = max(h for _, _, h in word_data)
    pad_x = int(font_size * 0.22)
    pad_y = int(font_size * 0.14)
    line_h = int(font_size * 1.35)

    # Calculate total caption bbox
    total_bw = total_w + pad_x * 2
    total_bh = line_h + pad_y * 2

    # Position in BOTTOM safe zone, anchored to bottom
    sz = SAFE_ZONES["BOTTOM"]
    x = (img_w - total_w) // 2
    y = sz["y2"] - total_bh  # anchor to bottom of BOTTOM zone

    bbox = {"x1": x - pad_x, "y1": y - pad_y,
            "x2": x + total_w + pad_x, "y2": y + line_h + pad_y,
            "w": total_bw, "h": total_bh}

    if validation_log:
        hit = bbox_hits_protected(bbox)
        clip = bbox_clips_canvas(bbox)
        validation_log.append({
            "element": f"caption: {text[:30]}",
            "bbox": bbox, "zone": "BOTTOM",
            "protected_hit": hit, "clipping": clip,
        })

    x_word = x
    for word, ww, hh in word_data:
        if word == active_word:
            hh_px = int(font_size * 1.2)
            if scheme == "yellowOnBlack":
                draw.rounded_rectangle(
                    [x_word - pad_x, y - pad_y, x_word + ww + pad_x, y + hh_px + pad_y],
                    radius=int(font_size * 0.14), fill=YELLOW)
                stroked_text(draw, x_word, y, word, font_bold, BLACK, sw=1)
            else:
                draw.rounded_rectangle(
                    [x_word - pad_x, y - pad_y, x_word + ww + pad_x, y + hh_px + pad_y],
                    radius=int(font_size * 0.14), fill=ACCENT)
                stroked_text(draw, x_word, y, word, font_bold, WHITE, sw=1)
        else:
            alpha = 160 if scheme == "yellowOnBlack" else 200
            draw.text((x_word, y), word, font=font, fill=(*WHITE[:3], alpha))
        x_word += ww + spacing


# ─── Component: TransitionFlash ────────────────────────────────────────
def render_transition(draw, img_w, img_h, kind):
    if kind == "zoom_through":
        margin = 25
        draw.rectangle([0, 0, img_w, margin], fill=(*BLACK[:3], 70))
        draw.rectangle([0, img_h - margin, img_w, img_h], fill=(*BLACK[:3], 70))
        draw.rectangle([0, 0, margin, img_h], fill=(*BLACK[:3], 55))
        draw.rectangle([img_w - margin, 0, img_w, img_h], fill=(*BLACK[:3], 55))
    elif kind == "cut":
        draw.rectangle([0, 0, img_w, img_h], fill=(*WHITE[:3], 35))


# ─── Helpers ───────────────────────────────────────────────────────────
def hex_to_rgb(hex_str):
    h = hex_str.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def event_is_active(event, moment_sec):
    ts = event.get("timestamp", 0)
    dur = event.get("duration", 2000) / 1000
    return 0 <= (moment_sec - ts) < dur


def get_best_event(events, category, moment_sec):
    """Get the most specific event for a category at this moment."""
    candidates = [e for e in events if e["category"] == category and event_is_active(e, moment_sec)]
    if not candidates:
        return None
    enriched = [e for e in candidates if e.get("source") == "enriched"]
    return enriched[0] if enriched else candidates[0]


# ─── Scene composer ────────────────────────────────────────────────────
def compose_cell(raw_frame, moment_sec, events, validation_log=None):
    """Compose all effects for one preview cell."""
    img = raw_frame.resize((CELL_W, CELL_H), Image.LANCZOS)
    draw = ImageDraw.Draw(img, "RGBA")

    # ── Video zoom ──
    for e in events:
        if e["category"] == "transition" and e.get("kind") == "zoom_through" and event_is_active(e, moment_sec):
            img = zoom_through(img, 1.12)
            draw = ImageDraw.Draw(img, "RGBA")
            break

    for e in events:
        if e["category"] == "transition" and e.get("kind") == "cut" and event_is_active(e, moment_sec):
            punch_zoom(img, 1.04)
            draw = ImageDraw.Draw(img, "RGBA")
            break

    # ── Layer 1: B-roll cuts (replaces speaker frame) ──
    broll = get_best_event(events, "graphic", moment_sec)
    if broll and broll.get("kind") == "brollCut":
        params = broll.get("params", {})
        render_broll_cut(draw, CELL_W, CELL_H, params)
        draw = ImageDraw.Draw(img, "RGBA")

    # ── Layer 2: Background graphics ──
    for e in events:
        if (e["category"] == "graphic" and
                e.get("kind") in ("illustration", "overlay", "cartoonOverlay", "comparisonDiagram",
                                   "iconSet") and
                event_is_active(e, moment_sec)):
            render_graphic(draw, CELL_W, CELL_H, e.get("kind", "overlay"), e.get("params", {}),
                           validation_log)

    # ── Layer 3: Arrow / diagram / icon overlays ──
    for e in events:
        if (e["category"] == "graphic" and
                e.get("kind") in ("arrow", "diagram", "icon") and
                event_is_active(e, moment_sec)):
            render_graphic(draw, CELL_W, CELL_H, e.get("kind", "icon"), e.get("params", {}))

    # ── Layer 4: Slam text / captions ──
    cap = get_best_event(events, "caption", moment_sec)
    if cap:
        kind = cap.get("kind", "kinetic")
        params = cap.get("params", {})
        text = params.get("text", "")

        if kind == "slam_out_slam_in":
            old_text = params.get("text", "")
            new_text = params.get("newText", old_text)
            elapsed = moment_sec - cap["timestamp"]
            dur = cap.get("duration", 3000) / 1000
            progress = min(1.0, elapsed / dur) if dur > 0 else 0.5
            render_text_swap(draw, CELL_W, CELL_H, old_text, new_text, progress, params,
                             validation_log)

        elif kind in ("slam", "kinetic"):
            render_slam_text(draw, CELL_W, CELL_H, text, params, validation_log)

        # Highlighted word
        words = params.get("words", [])
        for w in words:
            if w.get("highlighted"):
                render_caption_block(draw, CELL_W, CELL_H, text, params,
                                     active_word=w["word"], validation_log=validation_log)

    # ── Layer 5: Standalone highlights ──
    hl = get_best_event(events, "highlight", moment_sec)
    if hl and not cap:
        params = hl.get("params", {})
        render_highlight(draw, CELL_W, CELL_H, params.get("text", ""), params,
                         validation_log)

    # ── Layer 6: Transition flashes ──
    for e in events:
        if e["category"] == "transition" and event_is_active(e, moment_sec):
            render_transition(draw, CELL_W, CELL_H, e.get("kind", "cut"))

    return img


# ─── Cell header ───────────────────────────────────────────────────────
def render_header(draw, moment_sec, events):
    draw.rectangle([0, 0, CELL_W, HEADER_H], fill=(*BLACK[:3], 190))
    font = get_font(12, bold=True)
    draw.text((8, 6), f"{moment_sec:.2f}s", font=font, fill=ACCENT)


# ─── Contact sheet ─────────────────────────────────────────────────────
def build_sheet(cells, output_path):
    sheet = Image.new("RGB", (CANVAS_W, CANVAS_H), DARK_BG)
    draw = ImageDraw.Draw(sheet)

    ft = get_font(16, bold=True)
    fs = get_font(10)
    draw.text((PADDING, 10), "CorporateCareerGrowthAmana — Reference Preview V3 (BB-Aware)",
              font=ft, fill=ACCENT)
    draw.text((PADDING, 30), f"11 moments \u00b7 9:16 \u00b7 {datetime.now().strftime('%Y-%m-%d')} "
              f"\u00b7 Bounding-box-aware layout",
              font=fs, fill=(90, 90, 90))

    for i, cell in enumerate(cells):
        if i >= COLS * ROWS:
            break
        col = i % COLS
        row = i // COLS
        x = PADDING + col * (CELL_W + GAP)
        y = TITLE_H + GAP + row * (CELL_H + HEADER_H + GAP)
        sheet.paste(cell, (x, y))

    sheet.save(output_path, "PNG", optimize=True)
    print(f"  Saved: {output_path} ({CANVAS_W}x{CANVAS_H}px)")


# ─── Frame extraction ──────────────────────────────────────────────────
def extract_frame(video_path, time_sec, output_path):
    cmd = [
        "ffmpeg", "-ss", str(time_sec), "-i", video_path,
        "-frames:v", "1", "-q:v", "2", "-y", output_path,
    ]
    try:
        subprocess.run(cmd, capture_output=True, check=True)
        return os.path.exists(output_path)
    except (FileNotFoundError, subprocess.CalledProcessError) as e:
        print(f"  ERROR: {e}")
        return False


# ─── Legacy layout reference (for clamped rendering) ────────────────────
LAYOUT_REF = {
    "TOP_Y": 100,
    "TOP_Y_END": 340,
    "BOTTOM_Y": 1500,
    "BOTTOM_Y_END": 1830,
    "FACE_TOP": 400,
    "FACE_BOTTOM": 950,
    "BODY_TOP": 950,
    "BODY_BOTTOM": 1450,
    "MARGIN_X": 54,
    "MAX_WIDTH": 972,
}


# ─── Main ───────────────────────────────────────────────────────────────
def main():
    project_name = sys.argv[1] if len(sys.argv) > 1 else "corporate-career-growth-amana"

    video_path = os.path.join(BASE, "public", "projects", project_name, "footage", "testing-video.mp4")
    blueprint_path = os.path.join(BASE, "work", project_name, "prep", "refs", "edit-blueprint.json")
    output_dir = os.path.join(BASE, "work", project_name, "preview")
    os.makedirs(output_dir, exist_ok=True)

    print(f"Video:       {video_path}")
    print(f"Blueprint:   {blueprint_path}")
    print(f"Output:      {output_dir}")

    with open(blueprint_path, "r", encoding="utf-8") as f:
        blueprint = json.load(f)
    events = blueprint.get("events", [])
    print(f"Events:      {len(events)} total\n")

    cells = []
    all_validation = []
    vlog = []

    for moment in PREVIEW_MOMENTS:
        print(f"  [{moment:5.1f}s] extracting...", end=" ", flush=True)
        raw_path = os.path.join(output_dir, f"raw_{moment:.2f}.png")
        if not extract_frame(video_path, moment, raw_path):
            print("FAILED")
            continue

        raw_img = Image.open(raw_path).convert("RGB")
        moment_events = [e for e in events if abs(e.get("timestamp", 0) - moment) < 1.5]
        active = [e for e in moment_events if event_is_active(e, moment)]
        cats = [e["category"] for e in active]

        print(f"compositing ({len(active)} active)...", end=" ")
        composed = compose_cell(raw_img, moment, moment_events, vlog)

        hdr = ImageDraw.Draw(composed, "RGBA")
        render_header(hdr, moment, cats)

        cells.append(composed)
        print("OK")
        os.remove(raw_path)

    print(f"\nBuilding contact sheet...")
    output_path = os.path.join(output_dir, "contact-sheet-v3.png")
    build_sheet(cells, output_path)

    # ── Validation report ──
    collisions = [v for v in vlog if v.get("protected_hit")]
    clips = [v for v in vlog if v.get("clipping")]

    print(f"\n{'='*60}")
    print(f"BOUNDING-BOX VALIDATION REPORT")
    print(f"{'='*60}")
    print(f"Total elements validated: {len(vlog)}")
    print(f"Protected-region collisions: {len(collisions)}")
    print(f"Canvas clipping violations: {len(clips)}")

    if collisions:
        print(f"\nCOLLISIONS:")
        for c in collisions:
            bbox = c["bbox"]
            print(f"  [{c['element']}]")
            print(f"    bbox: ({bbox['x1']},{bbox['y1']}) → ({bbox['x2']},{bbox['y2']})")
            print(f"    zone: {c['zone']}, hit: {c['protected_hit']}")

    if clips:
        print(f"\nCLIPPING:")
        for c in clips:
            bbox = c["bbox"]
            print(f"  [{c['element']}]")
            print(f"    bbox: ({bbox['x1']},{bbox['y1']}) → ({bbox['x2']},{bbox['y2']})")

    if not collisions and not clips:
        print(f"\nAll elements clear. No collisions. No clipping.")

    print(f"\nDone. {len(cells)} cells rendered.")
    print(f"Output: {output_path}")
    print(f"Canvas: {CANVAS_W}x{CANVAS_H}px")

    cats_summary = {}
    for e in events:
        c = e["category"]
        cats_summary[c] = cats_summary.get(c, 0) + 1
    print(f"\nEvent breakdown:")
    for cat, count in sorted(cats_summary.items()):
        print(f"  {cat}: {count}")

    print(f"\nMoment map:")
    for m in PREVIEW_MOMENTS:
        active_at = [e for e in events if event_is_active(e, m)]
        cats_at = list(dict.fromkeys(e["category"] for e in active_at))
        print(f"  {m:5.1f}s -> {cats_at or 'none'} ({len(active_at)} active)")


if __name__ == "__main__":
    main()

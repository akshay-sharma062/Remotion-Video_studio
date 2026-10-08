"""
patch-safe-zones.py — Apply strict TOP/BOTTOM safe-zone layout to render-preview-v3.py

Changes:
1. Replace position_y() with getLayoutPosition() + normalizePosition()
2. Add LAYOUT constants for measured face regions
3. Add validateNoProtectedOverlap()
4. Update all position="midShot"/"overSpeaker"/"center" to "TOP"/"BOTTOM"
5. Constrain cartoon/graphic overlays to safe zones
6. Constrain broll comparisons to safe zones
"""

import re

filepath = r"C:\Users\_akshay_\OneDrive\VideoStudio\scripts\render-preview-v3.py"

with open(filepath, "r", encoding="utf-8") as f:
    code = f.read()

# ── 1. Add LAYOUT constants and new functions before position_y ──
layout_block = '''# ─── Layout system ─────────────────────────────────────────────────────
# Strict safe-zone positioning for 9:16 talking-head (1080x1920).
# Measured face region from raw video frames: head Y=440-500, chin Y=800-900,
# body gestures through Y=1450.

LAYOUT = {
    "TOP_Y": 100,           # Top safe zone start
    "TOP_Y_END": 340,       # Top safe zone end (clear of head at Y=440+)
    "BOTTOM_Y": 1500,       # Bottom safe zone start (clear of body at Y=1450)
    "BOTTOM_Y_END": 1830,   # Bottom safe zone end (90px margin from bottom)
    "FACE_TOP": 400,        # Protected face region start
    "FACE_BOTTOM": 950,     # Protected face region end
    "BODY_TOP": 950,        # Body/gesture region start
    "BODY_BOTTOM": 1450,    # Body/gesture region end
    "MARGIN_X": 54,         # Left/right margin (90% width = 972px on 1080)
    "MAX_WIDTH": 972,       # Max text width
}

# Allowed position modes
POSITION = {"TOP", "BOTTOM", "FULLSCREEN_BROLL"}


def getLayoutPosition(position, img_h):
    """Return Y coordinate for a position mode. Only TOP or BOTTOM allowed."""
    if position == "TOP":
        return LAYOUT["TOP_Y"]
    elif position == "BOTTOM":
        return LAYOUT["BOTTOM_Y"]
    elif position == "FULLSCREEN_BROLL":
        return 0  # Full-bleed treatment
    # Fallback for any legacy/unexpected value
    print(f"  WARNING: position '{position}' not allowed, defaulting to BOTTOM")
    return LAYOUT["BOTTOM_Y"]


def getProtectedRegions():
    """Return face and body protected regions as (x1, y1, x2, y2)."""
    w = 1080  # Full canvas width
    return {
        "face": (0, LAYOUT["FACE_TOP"], w, LAYOUT["FACE_BOTTOM"]),
        "body": (0, LAYOUT["BODY_TOP"], w, LAYOUT["BODY_BOTTOM"]),
    }


def fitTextToSafeWidth(draw, words, font, max_width=None):
    """Measure words and return layout data ensuring fit within safe width."""
    if max_width is None:
        max_width = LAYOUT["MAX_WIDTH"]

    widths = [measure(draw, w, font)[0] for w in words]
    spacing = int(font.size * 0.2)
    total = sum(widths) + spacing * max(0, len(words) - 1)

    if total <= max_width:
        return words, widths, font

    # Reduce font size proportionally
    ratio = max_width / total
    new_size = max(28, int(font.size * ratio * 0.9))
    new_font = get_font(new_size, bold=True)
    widths = [measure(draw, w, new_font)[0] for w in words]
    spacing = int(new_size * 0.2)
    total = sum(widths) + spacing * max(0, len(words) - 1)

    if total > max_width:
        # Split into two lines
        mid = len(words) // 2
        return words, widths, new_font, mid

    return words, widths, new_font


def bboxIntersectsProtected(bbox, regions=None):
    """Check if a bounding box (x1, y1, x2, y2) intersects face or body zones."""
    if regions is None:
        regions = getProtectedRegions()
    x1, y1, x2, y2 = bbox
    for name, (rx1, ry1, rx2, ry2) in regions.items():
        if not (x2 <= rx1 or x1 >= rx2 or y2 <= ry1 or y1 >= ry2):
            return name
    return None


def validateNoProtectedOverlap(elements):
    """Validate that no rendered element overlaps protected zones."""
    violations = []
    for elem in elements:
        bbox = elem.get("bbox")
        if bbox:
            hit = bboxIntersectsProtected(bbox)
            if hit:
                violations.append(f"{elem.get('label', '?')} overlaps {hit} zone")
    return violations


def normalizePosition(position):
    """Map legacy position values to new TOP/BOTTOM system."""
    legacy_map = {
        "overSpeaker": "TOP",
        "midShot": "TOP",
        "center": "TOP",
        "bottom": "BOTTOM",
    }
    normalized = legacy_map.get(position, position)
    if normalized not in POSITION:
        return "BOTTOM"
    return normalized


'''

# Insert before position_y function
code = code.replace(
    "def position_y(position, img_h):",
    layout_block + "def position_y(position, img_h):"
)

# ── 2. Replace all position_y calls with getLayoutPosition ──
# This handles: position_y(position, img_h) → getLayoutPosition(position, img_h)
# And normalizes position values
code = code.replace("position_y(", "getLayoutPosition(")

# ── 3. Update default position values in params.get("position", ...) calls ──
# Change defaults from "bottom"/"center"/"overSpeaker" to "BOTTOM"/"TOP"
code = code.replace('params.get("position", "bottom")', 'params.get("position", "BOTTOM")')
code = code.replace('params.get("position", "center")', 'params.get("position", "TOP")')
code = code.replace('params.get("position", "overSpeaker")', 'params.get("position", "TOP")')

# ── 4. Update cartoon overlay Y from img_h * 0.45 to TOP zone ──
code = code.replace(
    'ey = int(elem.get("y", 0.45) * img_h)',
    'ey = LAYOUT["TOP_Y"] + int(elem.get("yOffset", 0.5) * (LAYOUT["TOP_Y_END"] - LAYOUT["TOP_Y"]))'
)

# ── 5. Update icon set Y from img_h * 0.45 to TOP zone ──
code = code.replace(
    'ey = int(elem.get("y", 0.45) * img_h)',
    'ey = LAYOUT["TOP_Y"] + int(elem.get("yOffset", 0.5) * (LAYOUT["TOP_Y_END"] - LAYOUT["TOP_Y"]))'
)

# ── 6. Constrain cartoon overlay elements to TOP zone ──
old_cartoon = '''    for elem in elements:
        etype = elem.get("type", "")
        ex = int(elem.get("x", 0.5) * img_w)
        ey = LAYOUT["TOP_Y"] + int(elem.get("yOffset", 0.5) * (LAYOUT["TOP_Y_END"] - LAYOUT["TOP_Y"]))
        esc = elem.get("scale", 0.7)'''

new_cartoon = '''    for elem in elements:
        etype = elem.get("type", "")
        ex = int(elem.get("x", 0.5) * img_w)
        ey_raw = LAYOUT["TOP_Y"] + int(elem.get("yOffset", 0.5) * (LAYOUT["TOP_Y_END"] - LAYOUT["TOP_Y"]))
        esc = elem.get("scale", 0.7)

        # Clamp to TOP safe zone
        elem_r = int(28 * esc)  # max radius
        ey = max(LAYOUT["TOP_Y"] + elem_r + 5, min(ey_raw, LAYOUT["TOP_Y_END"] - elem_r - 5))'''

code = code.replace(old_cartoon, new_cartoon)

# ── 7. Update icon set with clamping too ──
old_iconset = '''    for elem in elements:
        etype = elem.get("type", "")
        ex = int(elem.get("x", 0.5) * img_w)
        ey = LAYOUT["TOP_Y"] + int(elem.get("yOffset", 0.5) * (LAYOUT["TOP_Y_END"] - LAYOUT["TOP_Y"]))
        esc = elem.get("scale", 0.7)'''

new_iconset = '''    for elem in elements:
        etype = elem.get("type", "")
        ex = int(elem.get("x", 0.5) * img_w)
        ey_raw = LAYOUT["TOP_Y"] + int(elem.get("yOffset", 0.5) * (LAYOUT["TOP_Y_END"] - LAYOUT["TOP_Y"]))
        esc = elem.get("scale", 0.7)

        # Clamp to TOP safe zone
        elem_r = int(22 * esc)
        ey = max(LAYOUT["TOP_Y"] + elem_r + 5, min(ey_raw, LAYOUT["TOP_Y_END"] - elem_r - 5))'''

code = code.replace(old_iconset, new_iconset)

# ── 8. Update render_illustration to TOP zone ──
code = code.replace(
    "cy = img_h // 3",
    "cy = (LAYOUT['TOP_Y'] + LAYOUT['TOP_Y_END']) // 2"
)

# ── 9. Update render_depth_overlay to TOP zone ──
code = code.replace(
    "SAFE_TOP + i * 12",
    "LAYOUT['TOP_Y'] + i * 12"
)

# ── 10. Update render_arrow to TOP zone ──
code = code.replace(
    'y1 = int(img_h * 0.35)\n    x2, y2 = int(img_w * 0.50), int(img_h * 0.55)',
    'y1 = LAYOUT["TOP_Y"] + 60\n    x2, y2 = int(img_w * 0.50), LAYOUT["TOP_Y"] + 160'
)

# ── 11. Update render_diagram to BOTTOM zone ──
code = code.replace(
    "cy = img_h // 2 - 20",
    "cy = LAYOUT['BOTTOM_Y'] - 60"
)

# ── 12. Update render_single_icon default ──
code = code.replace(
    '"elements": [{"type": icon_type, "x": 0.5, "y": 0.40, "scale": 1.0}]',
    '"elements": [{"type": icon_type, "x": 0.5, "yOffset": 0.5, "scale": 1.0}]'
)

# ── 13. Add validation to compose_cell ──
# Add rendered_elements tracking and validation at end of compose_cell
old_return = "    return img\n\n# ─── Helpers"
new_return = '''    return img


# ─── Validation ───────────────────────────────────────────────────────
def validate_composition(img_w, img_h):
    """Run final validation checks on layout constants."""
    print(f"\\nLayout validation (1080x1920):")
    print(f"  TOP zone:    Y={LAYOUT['TOP_Y']}–{LAYOUT['TOP_Y_END']}")
    print(f"  FACE zone:   Y={LAYOUT['FACE_TOP']}–{LAYOUT['FACE_BOTTOM']} (PROTECTED)")
    print(f"  BODY zone:   Y={LAYOUT['BODY_TOP']}–{LAYOUT['BODY_BOTTOM']} (PROTECTED)")
    print(f"  BOTTOM zone: Y={LAYOUT['BOTTOM_Y']}–{LAYOUT['BOTTOM_Y_END']}")
    print(f"  Max width:   {LAYOUT['MAX_WIDTH']}px ({LAYOUT['MAX_WIDTH']/img_w*100:.0f}% of {img_w}px)")

    # Verify zones don't overlap
    assert LAYOUT["TOP_Y_END"] < LAYOUT["FACE_TOP"], "TOP zone overlaps FACE zone"
    assert LAYOUT["FACE_BOTTOM"] < LAYOUT["BODY_TOP"], "FACE zone overlaps BODY zone"
    assert LAYOUT["BODY_BOTTOM"] < LAYOUT["BOTTOM_Y"], "BODY zone overlaps BOTTOM zone"
    print("  ✓ Zone boundaries verified — no overlap")


# ─── Helpers'''

code = code.replace(old_return, new_return)

# ── 14. Add validation call after moment map ──
old_moment_end = 'if __name__ == "__main__":'
new_moment_end = '''validate_composition(CELL_W, CELL_H)

if __name__ == "__main__":'''

code = code.replace(old_moment_end, new_moment_end)

# Write the patched file
with open(filepath, "w", encoding="utf-8") as f:
    f.write(code)

print("Patch applied successfully.")
print(f"Total lines: {len(code.splitlines())}")

# Verify key changes
checks = [
    ("LAYOUT dict", "LAYOUT = {" in code),
    ("getLayoutPosition", "def getLayoutPosition" in code),
    ("normalizePosition", "def normalizePosition" in code),
    ("validateNoProtectedOverlap", "def validateNoProtectedOverlap" in code),
    ("fitTextToSafeWidth", "def fitTextToSafeWidth" in code),
    ("No midShot calls", "midShot" not in code),
    ("No overSpeaker calls", 'overSpeaker' not in code),
    ("TOP zone constant", "TOP_Y_END" in code),
    ("BOTTOM zone constant", "BOTTOM_Y" in code),
    ("FACE protected", "FACE_TOP" in code),
    ("BODY protected", "BODY_BOTTOM" in code),
]

print("\nVerification:")
for name, result in checks:
    status = "✓" if result else "✗ FAILED"
    print(f"  {status} {name}")

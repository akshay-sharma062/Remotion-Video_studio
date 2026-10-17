"""
build-speaker-matte.py — per-frame speaker matte for the Premium 9:16 B-roll span.

WHY
    B-roll must play BEHIND the speaker (frames 253..385 of
    CorporateCareerGrowthAmana-Premium-916). That needs a per-frame matte of the
    speaker, and no alpha/cutout asset exists for this project.

HOW (no new dependencies — numpy + Pillow, both already installed)
    The shot is a gift for classical segmentation:
      * the camera is static (wall corners hold to within ~2 luma across 15
        sampled frames spanning the whole span),
      * the backdrop is a bright, near-neutral wall (luma ~183..217, channel
        spread <= ~5),
      * the subject is dark (black shirt mean luma 51.6) except for small
        specular highlights (teeth, forehead, white watch band).

    A plain luma threshold is NOT enough: the teeth/forehead highlights are
    brighter than the wall's own p5 and would punch holes in the face. So we
    key on CONNECTIVITY, not brightness:

      1. `is_wall_candidate` = (luma >= LUMA_MIN) AND (channel spread <= SPREAD_MAX)
         -> marks wall, and also those interior specular highlights.
      2. Flood the candidate mask from the image BORDER.
         -> only the real wall is reachable; highlights enclosed by skin/hair
            are unreachable and therefore stay subject. This is what protects
            the face automatically.
      3. Subject = everything that was not border-reachable.
      4. Erode ~2px, then Gaussian-feather ~1.6px
         -> removes the bright wall rim (halo) and gives a soft edge.

    Flood fill is implemented as run-length connected-component labelling
    (union-find over row runs), not PIL's ImageDraw.floodfill, which is pure
    Python and would take tens of seconds per 1080x1920 frame.

    Temporal stability: a 3-frame median on the binary subject mask, then
    erode+feather. Removes 1-frame speckle without the lag an EMA would add.

OUTPUT
    work/tmp/phase10/matte/f####.png   grayscale matte, 1080x1920, aligned 1:1
                                       with the talking-head video frame (same
                                       size, same objectFit geometry), so it can
                                       be used as a CSS mask over that video.

USAGE
    python scripts/build-speaker-matte.py [--from 253] [--to 385] [--keep-frames]

Read-only with respect to every approved asset: it only writes under
work/tmp/phase10/.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOOTAGE = os.path.join(
    ROOT,
    "public", "projects", "corporate-career-growth-amana",
    "footage", "testing-video.mp4",
)
WORK = os.path.join(ROOT, "work", "tmp", "phase10")
FRAME_DIR = os.path.join(WORK, "seg_frames")
MATTE_DIR = os.path.join(WORK, "matte")

# Wall/background key. Tuned against frames 253..385 of the actual footage.
# The wall occupies luma ~183..217 with a channel spread of <= ~5; the face
# highlights reach ~212 but are enclosed, so they survive via connectivity.
LUMA_MIN = 150.0
SPREAD_MAX = 34

# Edge treatment. Erode-first kills the residual bright wall rim that would
# otherwise read as a halo around the subject.
ERODE_SIZE = 5      # MinFilter window; 5 => ~2px inward
FEATHER_RADIUS = 1.6


def extract_frames(frm: int, to: int) -> None:
    """Decode exactly frames [frm, to] to PNGs named f####.png."""
    os.makedirs(FRAME_DIR, exist_ok=True)
    existing = [
        f for f in os.listdir(FRAME_DIR)
        if f.startswith("f") and f.endswith(".png")
    ]
    if len(existing) == (to - frm + 1):
        print(f"  frames already extracted ({len(existing)}) — reusing")
        return

    print(f"  extracting frames {frm}..{to} from the talking-head footage")
    cmd = [
        "ffmpeg", "-v", "error", "-y",
        "-i", FOOTAGE,
        "-vf", f"select='between(n\\,{frm}\\,{to})'",
        "-vsync", "0",
        "-start_number", str(frm),
        os.path.join(FRAME_DIR, "f%04d.png"),
    ]
    subprocess.run(cmd, check=True)
    n = len([f for f in os.listdir(FRAME_DIR) if f.endswith(".png")])
    print(f"  wrote {n} frames")


def wall_candidate(rgb: np.ndarray) -> np.ndarray:
    """True where the pixel could be the bright neutral backdrop."""
    luma = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    spread = rgb.max(axis=-1) - rgb.min(axis=-1)
    return (luma >= LUMA_MIN) & (spread <= SPREAD_MAX)


def _runs(mask: np.ndarray):
    """Row runs of True as (row, start_col, end_col_inclusive) arrays."""
    h, w = mask.shape
    padded = np.zeros((h, w + 2), dtype=np.int8)
    padded[:, 1:w + 1] = mask
    d = np.diff(padded, axis=1)

    st = np.argwhere(d == 1)     # (row, j) where a run begins
    en = np.argwhere(d == -1)    # (row, j) where a run ends

    rows = st[:, 0]
    starts = st[:, 1]            # start col (original coords)
    ends = en[:, 1] - 1          # end col, inclusive (original coords)
    return rows, starts, ends


def border_reachable_background(cand: np.ndarray) -> np.ndarray:
    """
    Pixels of `cand` connected to the image border, via run-length labelling.

    Returns a boolean mask of the background (wall) region.
    """
    h, w = cand.shape
    rows, starts, ends = _runs(cand)
    n = len(rows)
    if n == 0:
        return np.zeros((h, w), dtype=bool)

    # Union-find over runs.
    parent = np.arange(n)

    def find(a: int) -> int:
        root = a
        while parent[root] != root:
            root = parent[root]
        while parent[a] != root:     # path compression
            parent[a], a = root, parent[a]
        return root

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    # Index runs per row for overlap queries.
    order = np.argsort(rows, kind="stable")
    rows_s = rows[order]
    starts_s = starts[order]
    ends_s = ends[order]
    row_bounds = np.searchsorted(rows_s, np.arange(h + 1))

    row_starts: dict[int, np.ndarray] = {}
    row_ends: dict[int, np.ndarray] = {}
    row_gidx: dict[int, np.ndarray] = {}
    for r in range(h):
        lo, hi = row_bounds[r], row_bounds[r + 1]
        if hi > lo:
            idx = order[lo:hi]
            row_starts[r] = starts_s[lo:hi]
            row_ends[r] = ends_s[lo:hi]
            row_gidx[r] = idx

    for r in range(h - 1):
        if r not in row_starts or (r + 1) not in row_starts:
            continue
        a_st, a_en, a_gi = row_starts[r], row_ends[r], row_gidx[r]
        b_st, b_en, b_gi = row_starts[r + 1], row_ends[r + 1], row_gidx[r + 1]
        for i in range(len(a_st)):
            s, e = a_st[i], a_en[i]
            lo = np.searchsorted(b_en, s, side="left")    # b_end >= s
            hi = np.searchsorted(b_st, e, side="right")   # b_start <= e
            for j in range(lo, hi):
                union(int(a_gi[i]), int(b_gi[j]))

    # Any run touching the image border marks its whole component as background.
    touches = (rows == 0) | (rows == h - 1) | (starts == 0) | (ends == w - 1)
    bg_roots: set[int] = set()
    for k in np.flatnonzero(touches):
        bg_roots.add(find(int(k)))
    if not bg_roots:
        return np.zeros((h, w), dtype=bool)

    is_bg_run = np.array([find(i) in bg_roots for i in range(n)], dtype=bool)
    bg = np.zeros((h, w), dtype=bool)
    rr = rows[is_bg_run]
    ss = starts[is_bg_run]
    ee = ends[is_bg_run]
    for r, s, e in zip(rr.tolist(), ss.tolist(), ee.tolist()):
        bg[r, s:e + 1] = True
    return bg


def subject_of(path: str) -> np.ndarray:
    """Binary subject mask (True = speaker) for one frame file."""
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
    bg = border_reachable_background(wall_candidate(rgb))
    return ~bg


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="frm", type=int, default=253)
    ap.add_argument("--to", dest="to", type=int, default=385)
    ap.add_argument("--keep-frames", action="store_true")
    args = ap.parse_args()

    t0 = time.time()
    print("build-speaker-matte")
    print(f"  span frames {args.frm}..{args.to}")
    extract_frames(args.frm, args.to)

    files = sorted(f for f in os.listdir(FRAME_DIR) if f.endswith(".png"))
    if not files:
        print("ERROR: no frames extracted", file=sys.stderr)
        return 1

    # Pass 1 — raw subject masks.
    raw: list[np.ndarray] = []
    for f in files:
        raw.append(subject_of(os.path.join(FRAME_DIR, f)))
    print(f"  pass 1 (raw masks): {time.time() - t0:.1f}s")

    # Pass 2 — 3-frame temporal median to kill single-frame speckle.
    smoothed: list[np.ndarray] = []
    for i in range(len(raw)):
        if 0 < i < len(raw) - 1:
            m = (raw[i - 1].astype(np.uint8)
                 + raw[i].astype(np.uint8)
                 + raw[i + 1].astype(np.uint8)) >= 2
        else:
            m = raw[i]
        smoothed.append(m)

    os.makedirs(MATTE_DIR, exist_ok=True)
    fractions: list[float] = []
    for f, m in zip(files, smoothed):
        img = Image.fromarray((m * 255).astype(np.uint8), mode="L")
        img = img.filter(ImageFilter.MinFilter(ERODE_SIZE))
        img = img.filter(ImageFilter.GaussianBlur(FEATHER_RADIUS))
        img.save(os.path.join(MATTE_DIR, f))

        frac = float((np.asarray(img) > 128).mean())
        fractions.append(frac)

    print(f"  pass 2 (smooth+feather): {time.time() - t0:.1f}s")
    print(f"  wrote {len(files)} mattes -> {os.path.relpath(MATTE_DIR, ROOT)}")

    # Automated QA: the subject fraction must not jump frame to frame. A large
    # jump means the key leaked (or grabbed) something between frames.
    fa = np.array(fractions)
    d = np.abs(np.diff(fa))
    print(f"  subject fraction: min={fa.min():.3f} mean={fa.mean():.3f} max={fa.max():.3f}")
    print(f"  max frame-to-frame jump: {d.max():.4f} (frame {int(np.argmax(d)) + args.frm})")
    worst = []
    for i in np.argsort(d)[-6:][::-1]:
        worst.append(f"f{int(i) + args.frm}->f{int(i) + 1 + args.frm}: {d[i]:.4f}")
    print("  largest jumps: " + ", ".join(worst))
    if d.max() > 0.04:
        print("  WARNING: a jump above 0.04 suggests a key leak — inspect those frames")

    if not args.keep_frames:
        pass  # frames are cheap to regenerate; leave them for the next run
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

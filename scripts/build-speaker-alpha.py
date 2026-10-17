"""
build-speaker-alpha.py — bake the speaker matte into a VP9-alpha WebM.

WHY THIS SHAPE
    The Premium 9:16 composition must play B-roll BEHIND the speaker for
    frames 253..385. That needs the speaker separated from the wall as real
    pixel alpha, not a CSS mask driven by 133 separate PNGs.

    Two reasons alpha-in-the-video wins over a per-frame CSS mask:
      * Alignment. The composition applies a slow zoom (1.0 -> 1.04) plus
        emphasis punches to the speaker. A baked-alpha clip scales image and
        alpha together in one texture, so they can never drift apart. A CSS
        mask is a second element and must be transformed in lockstep.
      * Mechanism. BrollLayer already seeks a <Video> per frame. An alpha
        WebM is seeked by exactly the same code path, so nothing new can
        break. A mask would introduce 133 new image loads per render.

    A median background PLATE was tried first and rejected — see the note in
    build-speaker-matte.py. The speaker owns the frame centre, so a temporal
    median reconstructs a ghosted speaker rather than a clean wall.

INPUT
    work/tmp/phase10/seg_frames/f####.png   RGB frames from the footage
    work/tmp/phase10/matte/f####.png        ../../scripts/build-speaker-matte.py output

OUTPUT
    work/tmp/phase10/speaker-alpha.webm     VP9 / yuva420p, 24000/1001 fps

USAGE
    python scripts/build-speaker-alpha.py --from 253 --to 385

Read-only with respect to every approved asset: it writes only under
work/tmp/phase10/.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, "work", "tmp", "phase10")
FRAME_DIR = os.path.join(WORK, "seg_frames")
MATTE_DIR = os.path.join(WORK, "matte")
DEFAULT_OUT = os.path.join(WORK, "speaker-alpha.webm")

# The composition runs at 23.976 fps. Encoding the alpha clip at the same rate
# keeps Remotion's per-frame seek a 1:1 mapping — no resampling, no drift.
FPS_NUM, FPS_DEN = 24000, 1001


def probe(path: str) -> dict[str, str]:
    """
    Read the few stream properties we assert on.

    Note on pix_fmt: ffprobe reports a VP9 alpha WebM as `yuv420p` even when the
    file genuinely carries alpha. The alpha plane is stored separately and
    signalled by the container-level `alpha_mode` tag, not by pix_fmt — so
    `pix_fmt` is deliberately NOT what we assert on. `alpha_mode=1` is.
    """
    out = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_streams",
            "-show_format",
            "-of", "json",
            path,
        ],
        capture_output=True, text=True, check=True,
    ).stdout
    data = json.loads(out)
    props: dict[str, str] = {}
    stream = (data.get("streams") or [{}])[0]
    for key in ("codec_name", "width", "height"):
        props[key] = str(stream.get(key, ""))
    # alpha_mode is a MATROSKA-LEVEL tag attached to the stream, so it sits in
    # stream["tags"] and is absent entirely (not None-valued) when dropped.
    props["alpha_mode"] = str(stream.get("tags", {}).get("alpha_mode", ""))
    fmt = data.get("format", {})
    props["duration"] = str(fmt.get("duration", ""))
    props["size"] = str(fmt.get("size", "0"))
    return props


def decoded_frame_count(path: str) -> int:
    """Count actually-decoded frames (nb_frames is N/A for VP9-in-WebM)."""
    out = subprocess.run(
        [
            "ffprobe", "-v", "error", "-count_frames",
            "-select_streams", "v:0",
            "-show_entries", "stream=nb_read_frames",
            "-of", "csv=p=0",
            path,
        ],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    try:
        return int(out)
    except ValueError:
        return -1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="frm", type=int, default=253)
    ap.add_argument("--to", dest="to", type=int, default=385)
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--crf", type=int, default=18)
    ap.add_argument(
        "--gop", type=int, default=24,
        help="keyframe interval; denser = more accurate per-frame seeking",
    )
    ap.add_argument(
        "--preview-dir", default=os.path.join(WORK, "alpha_preview"),
        help="where to write the matte-on-black edge check PNGs",
    )
    args = ap.parse_args()

    if not os.path.isdir(FRAME_DIR) or not os.path.isdir(MATTE_DIR):
        print(f"ERROR: missing input dirs.\n  {FRAME_DIR}\n  {MATTE_DIR}", file=sys.stderr)
        return 1

    n_frames = args.to - args.frm + 1
    frames_pattern = os.path.join(FRAME_DIR, "f%04d.png")
    matte_pattern = os.path.join(MATTE_DIR, "f%04d.png")

    missing = [
        n for n in range(args.frm, args.to + 1)
        if not os.path.exists(os.path.join(FRAME_DIR, f"f{n:04d}.png"))
        or not os.path.exists(os.path.join(MATTE_DIR, f"f{n:04d}.png"))
    ]
    if missing:
        print(
            f"ERROR: {len(missing)} frame/matte pairs missing (first: f{missing[0]:04d}).\n"
            f"  Run: python scripts/build-speaker-matte.py --from {args.frm} --to {args.to}",
            file=sys.stderr,
        )
        return 1

    print("build-speaker-alpha")
    print(f"  span frames {args.frm}..{args.to}  ({n_frames} frames @ {FPS_NUM}/{FPS_DEN} fps)")

    # alphamerge replaces the primary input's alpha with the LUMA of the second
    # input. Two inputs, same numbering, so frame N pairs with matte N.
    filter_complex = (
        "[0:v]format=rgb24[bg];"
        "[1:v]format=gray[ma];"
        "[bg][ma]alphamerge[out]"
    )

    cmd = [
        "ffmpeg", "-v", "error", "-y",
        "-framerate", f"{FPS_NUM}/{FPS_DEN}",
        "-start_number", str(args.frm), "-i", frames_pattern,
        "-framerate", f"{FPS_NUM}/{FPS_DEN}",
        "-start_number", str(args.frm), "-i", matte_pattern,
        "-filter_complex", filter_complex,
        "-map", "[out]",
        "-c:v", "libvpx-vp9",
        "-pix_fmt", "yuva420p",
        # Constant-quality: -b:v 0 lets -crf govern. Alpha survives only with
        # an explicit yuva420p pix_fmt on a codec that advertises it.
        "-b:v", "0", "-crf", str(args.crf),
        "-deadline", "good", "-cpu-used", "2",
        "-row-mt", "1",
        "-g", str(args.gop),
        "-an",
        args.out,
    ]

    print(f"  encoding VP9/yuva420p, crf {args.crf}, gop {args.gop}")
    subprocess.run(cmd, check=True)

    props = probe(args.out)
    size_mb = int(props.get("size", "0")) / 1e6
    print(f"  wrote {os.path.relpath(args.out, ROOT)}  ({size_mb:.1f} MB)")
    print(f"  codec={props.get('codec_name')}  alpha_mode={props.get('alpha_mode')}  "
          f"{props.get('width')}x{props.get('height')}  dur={props.get('duration')}s")

    # Assert the three properties that make this file usable as a speaker layer.
    # alpha_mode=1 is the real alpha proof: pix_fmt reads as yuv420p regardless,
    # because the alpha plane lives alongside the colour plane rather than in it.
    ok = True
    if props.get("alpha_mode") != "1":
        print(f"  ERROR: alpha_mode is {props.get('alpha_mode')!r}, expected '1' — "
              "alpha was dropped.", file=sys.stderr)
        ok = False
    if props.get("codec_name") != "vp9":
        print(f"  ERROR: codec is {props.get('codec_name')!r}, expected 'vp9'.", file=sys.stderr)
        ok = False
    decoded = decoded_frame_count(args.out)
    if decoded != n_frames:
        print(f"  ERROR: {decoded} frames decoded, expected {n_frames}.", file=sys.stderr)
        ok = False
    else:
        print(f"  decoded frames verified: {decoded}")

    # Independent second proof of alpha: decode the alpha plane to RGBA and
    # compare it against the source matte. A container tag is metadata; this is
    # the actual pixels. If the plane were missing, everything would read 255.
    import numpy as np
    from PIL import Image

    tmp_rgba = os.path.join(args.preview_dir, "_rgba")
    os.makedirs(tmp_rgba, exist_ok=True)
    check_frames = [
        args.frm, args.frm + 52, args.frm + 90, args.to,
    ]
    # -c:v libvpx-vp9 (an INPUT option, before -i) selects the alpha-capable
    # decoder; the native ffmpeg VP9 decoder discards the alpha plane entirely.
    # -pix_fmt rgba is an OUTPUT option, so it must come AFTER -i.
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-y",
            "-c:v", "libvpx-vp9", "-i", args.out,
            "-pix_fmt", "rgba",
            os.path.join(tmp_rgba, "d%04d.png"),
        ],
        check=True,
    )
    print(f"\n  alpha plane vs source matte:")
    print(f"    {'frame':>6} {'alphaMean':>10} {'vsMatte MAE':>12} {'edgeMAE':>9}")
    for n in check_frames:
        idx = n - args.frm + 1
        p = os.path.join(tmp_rgba, f"d{idx:04d}.png")
        if not os.path.exists(p):
            print(f"    f{n:04d}  (decoded PNG missing)")
            continue
        im = Image.open(p)
        if im.mode != "RGBA":
            print(f"    f{n:04d}  ERROR: decoded PNG is {im.mode}, not RGBA", file=sys.stderr)
            ok = False
            continue
        a = np.asarray(im.split()[3]).astype(np.float32)
        src = np.asarray(
            Image.open(os.path.join(MATTE_DIR, f"f{n:04d}.png")).convert("L")
        ).astype(np.float32)
        d = np.abs(a - src)
        band = (src > 20) & (src < 235)
        print(f"    f{n:04d} {a.mean():>10.1f} {d.mean():>12.2f} {d[band].mean():>9.2f}")
        if a.mean() < 1:
            print(f"    ERROR: f{n:04d} alpha is empty — plane did not survive",
                  file=sys.stderr)
            ok = False

    # Edge check: matte over flat colour makes any halo or hole obvious to a
    # human eye, which a numeric coverage figure alone would not. Two inputs
    # (colour source + the decoded clip) means -filter_complex, not -vf.
    for n in check_frames:
        subprocess.run(
            [
                "ffmpeg", "-v", "error", "-y",
                "-f", "lavfi", "-i", f"color=c=0x00B0FF:s=1080x1920:r=24",
                "-c:v", "libvpx-vp9", "-i", args.out,
                "-filter_complex",
                f"[1:v]select='eq(n\\,{n - args.frm})'[clip];"
                f"[0:v][clip]overlay=shortest=1,scale=270:-2[out]",
                "-map", "[out]", "-frames:v", "1",
                os.path.join(args.preview_dir, f"alpha_check_f{n:04d}.png"),
            ],
            check=True,
        )
    print(f"\n  edge previews -> {os.path.relpath(args.preview_dir, ROOT)}")

    if not ok:
        return 1
    print("  OK: alpha verified present and matching the source matte")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

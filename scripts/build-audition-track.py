#!/usr/bin/env python3
"""
build_audition_track.py
Builds a single audition WAV from the 6 confirmed-staged internal files.
No external assets used. No pack files modified.
"""

import struct
import wave
import os

# ── Source files (read-only — originals untouched) ──────────────────────────
SOURCES = [
    ("headline-reveal",  "REVEAL-E.wav",  "impact_warm",       300, 0.35),
    ("text-entrance",    "TEXT-F.wav",    "text_enter_sweep",  400, 0.20),
    ("keyword-accent",   "ACCENT-F.wav",  "accent_chime",      300, 0.30),
    ("keyword-accent",   "ACCENT-G.wav",  "highlight_sparkle", 250, 0.30),
    ("scene-transition", "TRANS-H.wav",   "sweep_smooth",      500, 0.25),
    ("scene-transition", "TRANS-I.wav",   "sweep_reverse",     400, 0.25),
]

BASE = os.path.join(os.path.dirname(__file__), "..", "work", "sfx-audition-premium")
OUT  = os.path.join(os.path.dirname(__file__), "..", "work", "sfx-audition-premium", "audition-track.wav")
INDEX_OUT = os.path.join(os.path.dirname(__file__), "..", "work", "sfx-audition-premium", "audition-track-index.txt")

GAP_MS    = 800   # silence between entries
LEADER_MS = 2000  # tone burst at start (will be silence placeholder)

def read_wav(path):
    with wave.open(path, "rb") as w:
        nch      = w.getnchannels()
        sw_bytes = w.getsampwidth()   # bytes per sample (1,2,3,4) — for wave API
        fr       = w.getframerate()
        nframes  = w.getnframes()
        data     = w.readframes(nframes)
    return nch, sw_bytes, fr, nframes, data

def write_wav(path, nch, sw, fr, samples):
    with wave.open(path, "wb") as w:
        w.setnchannels(nch)
        w.setsampwidth(sw)
        w.setframerate(fr)
        w.writeframes(samples)

def make_silence(ms, fr, sw_bytes, nch):
    n = int(fr * ms / 1000)
    return b'\x00' * (n * sw_bytes * nch)

# ── Validate sources ─────────────────────────────────────────────────────────
print("=== Validating source files ===")
entries = []
for folder, fname, label, dur_ms, gain in SOURCES:
    path = os.path.join(BASE, folder, fname)
    if not os.path.exists(path):
        print(f"MISSING: {path}")
        exit(1)
    nch, sw_bytes, fr, nframes, data = read_wav(path)
    actual_dur = nframes / fr * 1000
    print(f"  {fname:<22} {fr}Hz {sw_bytes*8}bit ch={nch} {actual_dur:.0f}ms (catalog {dur_ms}ms)")
    entries.append((folder, fname, label, dur_ms, gain, nch, sw_bytes, fr, data))

# ── Build output ─────────────────────────────────────────────────────────────
nch  = entries[0][5]   # channels (1 = mono)
sw   = entries[0][6]   # bytes per sample (2 for 16-bit)
fr   = entries[0][7]   # sample rate (44100)

parts  = []
parts.append(make_silence(LEADER_MS, fr, sw, nch))   # leader silence

index_lines = []
cursor_ms   = LEADER_MS

for i, (folder, fname, label, dur_ms, gain, nch_e, sw_e, fr_e, data) in enumerate(entries):
    # Apply gain — use per-entry sample width for struct format
    if gain != 1.0:
        fmt = "<" + "h" * (len(data) // sw_e)
        samples = list(struct.unpack(fmt, data))
        scaled  = [max(-32768, min(32767, int(s * gain))) for s in samples]
        data = struct.pack(fmt, *scaled)

    parts.append(data)

    index_lines.append(
        f"{i+1:2d}.  {cursor_ms/1000:7.2f}s  {dur_ms/1000:.2f}s   "
        f"{label:<22}  {folder}/{fname}"
    )
    cursor_ms += int(len(data) / (sw * nch) / fr * 1000) + GAP_MS
    parts.append(make_silence(GAP_MS, fr, sw, nch))

output_data = b"".join(parts)
total_ms    = len(output_data) / (sw * nch) / fr * 1000

write_wav(OUT, nch, sw, fr, output_data)
print(f"\n=== Output ===")
print(f"  File:     {OUT}")
print(f"  Format:   {nch}ch {sw*8}bit {fr}Hz")
print(f"  Duration: {total_ms/1000:.1f}s")
print(f"  Size:     {len(output_data):,} bytes")

# ── Write index ──────────────────────────────────────────────────────────────
header = (
    f"Audition Track Index\n"
    f"File:     audition-track.wav\n"
    f"Format:   {nch}ch {sw*8}bit {fr}Hz\n"
    f"Duration: {total_ms/1000:.1f}s ({total_ms/1000/60:.2f} min)\n"
    f"Entries:  {len(entries)}\n"
    f"Gaps:     {GAP_MS}ms between entries, {LEADER_MS}ms leader\n"
    f"Gain:     per-entry as noted\n"
    f"Status:   NOT PLAYBACK-VERIFIED — audio properties unconfirmed\n"
    f"          No ffprobe run (blocked). Audition in Premiere Pro.\n"
    f"\n{'#':>2}  {'START':>7}  {'DUR':>5}  {'LABEL':<22}  SOURCE\n"
    f"{'-'*70}\n"
)
index_lines_str = "\n".join(index_lines)
footer = (
    f"\n{'='*70}\n"
    f"NOTES:\n"
    f"  - All files are internal copies from work/sfx-audition/\n"
    f"  - No external assets included\n"
    f"  - [REVEAL-B] 'Strong punches to the body' excluded (violence theme)\n"
    f"  - Source originals NOT modified\n"
    f"  - Output status: CONSTRUCTED — NOT AUDITIONED\n"
    f"  - Verify in Premiere Pro before marking any sound as selected\n"
)

with open(INDEX_OUT, "w", encoding="utf-8") as f:
    f.write(header + index_lines_str + footer)

print(f"\n  Index:   {INDEX_OUT}")
print(f"\nDone.")

#!/usr/bin/env python3
"""
build-sfx-track.py — Build a properly-timed SFX track for the review draft.

Strategy:
  1. Read the 7 scene SFX files from work/tmp/sfx/
  2. Time each one to land exactly at the headline entrance frame
  3. Fill everything else with silence
  4. Output a single mono 44.1kHz WAV matching the voice track length
  5. Write SFX-CUES.txt for the review draft

SFX → Scene mapping (from existing files and SFX-CUES.txt):
  Scene 1 "SIGNIFICANTLY MORE"   (91f=3.80s)  → s1_whoosh.wav  (entrance whoosh)
  Scene 2 "MORE TALENTED"        (170f=7.10s)  → s2_word_punch.wav (emphasis hit)
  Scene 3 "13 YEARS"             (243f=10.14s) → s3_emphasis.wav + s4_slam.wav (number slam)
  Scene 4 "MUCH MORE SALARY"     (360f=15.02s) → s5_impact.wav  (emphasis punch)
  Scene 5 "TALENT OR SKILLS"     (450f=18.77s) → s6_sweep.wav   (transition)
  Scene 6 "POSITIONING"          (499f=20.81s) → s7_final.wav   (final hit)
  Intro lead-in                  (38f=1.59s)   → s1_whoosh.wav  (second copy, earlier)

Ducking: SFX at -8dB under voice during speech, full volume in gaps.
High-pass: 130Hz on all SFX.
"""

import os
import struct
import math
import wave

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = "corporate-career-growth-amana"

SFX_DIR = os.path.join(BASE, "work", "tmp", "sfx")
OUT_DIR = os.path.join(BASE, "out", PROJECT)
VOICE_PATH = os.path.join(OUT_DIR, "voice.wav")

SAMPLE_RATE = 44100
FPS = 23.976
HIGH_PASS_HZ = 130
DUCK_DB = -8
SFX_VOLUME = 0.7

# ─── SFX event definitions ─────────────────────────────────────────────────────
# (name, time_sec, file, volume_mult)
SFX_EVENTS = [
    ("intro_whoosh",  1.59,  "s1_whoosh.wav",       0.6),   # Lead-in before Scene 1
    ("scene1_slam",   3.80,  "s1_whoosh.wav",       0.7),   # SIGNIFICANTLY MORE entrance
    ("scene2_slam",   7.10,  "s2_word_punch.wav",   0.7),   # MORE TALENTED slam
    ("scene3_number", 10.14, "s3_emphasis.wav",     0.5),   # 13 YEARS number emphasis
    ("scene3_slam",   10.30, "s4_slam.wav",         0.7),   # 13 YEARS slam hit
    ("scene4_punch",  15.02, "s5_impact.wav",       0.8),   # MUCH MORE SALARY emphasis
    ("scene5_whoosh", 18.77, "s6_sweep.wav",        0.5),   # TALENT OR SKILLS transition
    ("scene6_hit",    20.81, "s7_final.wav",        0.7),   # POSITIONING final hit
]


# ─── Audio Helpers ─────────────────────────────────────────────────────────────

def read_wav(path):
    """Read a WAV file, return (samples_float32, sample_rate, nchannels)."""
    with wave.open(path, 'rb') as w:
        nch = w.getnchannels()
        sw = w.getsampwidth()
        sr = w.getframerate()
        nf = w.getnframes()
        raw = w.readframes(nf)

    if sw == 2:
        fmt = '<' + 'h' * (len(raw) // 2)
        samples = [s / 32768.0 for s in struct.unpack(fmt, raw)]
    elif sw == 4:
        fmt = '<' + 'i' * (len(raw) // 4)
        samples = [s / 2147483648.0 for s in struct.unpack(fmt, raw)]
    else:
        raise ValueError(f"Unsupported sample width: {sw}")

    # Convert to mono
    if nch == 2:
        samples = [(samples[i] + samples[i+1]) / 2 for i in range(0, len(samples), 2)]

    return samples, sr


def write_wav(path, samples, sample_rate):
    """Write mono float32 samples to 16-bit WAV."""
    pcm = struct.pack('<' + 'h' * len(samples),
                      *[max(-32768, min(32767, int(s * 32767))) for s in samples])
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(pcm)


def high_pass(samples, cutoff_hz, sr):
    """First-order high-pass filter."""
    if cutoff_hz <= 0:
        return samples
    rc = 1.0 / (2 * math.pi * cutoff_hz)
    dt = 1.0 / sr
    alpha = rc / (rc + dt)
    out = [0.0] * len(samples)
    out[0] = samples[0]
    for i in range(1, len(samples)):
        out[i] = alpha * (out[i-1] + samples[i] - samples[i-1])
    return out


def detect_silence_gaps(samples, sr, threshold=0.015, min_gap_sec=0.08):
    """Find speech gaps in voice for ducking automation."""
    window = int(0.02 * sr)
    gaps = []
    in_gap = False
    gap_start = 0
    gap_count = 0

    for i in range(0, len(samples), window):
        end = min(i + window, len(samples))
        rms = math.sqrt(sum(samples[j] * samples[j] for j in range(i, end)) / (end - i))
        if rms < threshold:
            gap_count += 1
            if not in_gap:
                gap_start = i
                in_gap = True
        else:
            if in_gap and gap_count >= min_gap_sec * sr / window:
                gaps.append((gap_start / sr, i / sr))
            in_gap = False
            gap_count = 0

    if in_gap and gap_count >= min_gap_sec * sr / window:
        gaps.append((gap_start / sr, len(samples) / sr))

    return gaps


def is_in_gap(t_sec, gaps):
    return any(t_sec >= g[0] and t_sec <= g[1] for g in gaps)


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    # Read voice for gap detection and ducking
    print("Reading voice track...")
    voice_samples, voice_sr = read_wav(VOICE_PATH)
    duration_sec = len(voice_samples) / voice_sr
    total_samples = int(duration_sec * SAMPLE_RATE)
    print(f"  Voice: {duration_sec:.2f}s, {voice_sr}Hz, {len(voice_samples)} samples")

    # Detect voice gaps for ducking
    print("Detecting voice gaps...")
    gaps = detect_silence_gaps(voice_samples, voice_sr)
    print(f"  Found {len(gaps)} voice gaps")

    # Build SFX track
    sfx_track = [0.0] * total_samples
    duck_gain = 10 ** (DUCK_DB / 20)

    cues = []

    for name, time_sec, filename, vol_mult in SFX_EVENTS:
        filepath = os.path.join(SFX_DIR, filename)
        if not os.path.exists(filepath):
            print(f"  WARNING: Missing SFX file: {filepath}")
            continue

        sfx_samples, sfx_sr = read_wav(filepath)
        if sfx_sr != SAMPLE_RATE:
            # Resample by simple linear interpolation
            ratio = sfx_sr / SAMPLE_RATE
            new_len = int(len(sfx_samples) / ratio)
            sfx_samples = [sfx_samples[int(i * ratio)] for i in range(new_len)]

        # Apply high-pass
        sfx_samples = high_pass(sfx_samples, HIGH_PASS_HZ, SAMPLE_RATE)

        # Determine duck gain based on overlap with voice
        start_s = int(time_sec * SAMPLE_RATE)
        overlaps_voice = False
        for t in [time_sec + i * 0.02 for i in range(len(sfx_samples) // int(0.02 * SAMPLE_RATE) + 1)]:
            if t < duration_sec and not is_in_gap(t, gaps):
                overlaps_voice = True
                break

        gain = SFX_VOLUME * vol_mult * (duck_gain if overlaps_voice else 1.0)

        # Mix into track
        for i, s in enumerate(sfx_samples):
            idx = start_s + i
            if 0 <= idx < total_samples:
                sfx_track[idx] += s * gain

        dur_ms = int(len(sfx_samples) / SAMPLE_RATE * 1000)
        cues.append((name, time_sec, dur_ms, filename, "ducked" if overlaps_voice else "full"))
        print(f"  [{name}] {time_sec:.2f}s +{dur_ms}ms from {filename} vol={vol_mult} {'(ducked)' if overlaps_voice else '(full)'}")

    # Write SFX track
    sfx_path = os.path.join(OUT_DIR, "sfx.wav")
    write_wav(sfx_path, sfx_track, SAMPLE_RATE)
    print(f"\nWrote SFX track: {sfx_path}")

    # Write SFX-CUES.txt
    cues_path = os.path.join(OUT_DIR, "SFX-CUES.txt")
    with open(cues_path, 'w', encoding='utf-8') as f:
        f.write("SFX-CUES — corporate-career-growth-amana (SFX Review Draft)\n")
        f.write("=" * 60 + "\n")
        f.write(f"Video duration: {duration_sec:.2f}s ({int(duration_sec * FPS)} frames @ 23.976fps)\n")
        f.write(f"SFX track: {sfx_path}\n")
        f.write("Ducking: -8dB under voice during speech, full volume in gaps\n")
        f.write(f"High-pass: {HIGH_PASS_HZ}Hz on all SFX\n\n")
        f.write("CUES\n")
        f.write("-" * 60 + "\n")
        f.write(f"{'#':<4} {'Timecode':<10} {'Type':<10} {'Source File':<22} {'Duration':<10} {'Level'}\n")
        f.write("-" * 60 + "\n")
        for i, (name, t, dur, src, level) in enumerate(cues, 1):
            tc = f"{int(t//60):02d}:{t%60:05.2f}"
            f.write(f"{i:<4} {tc:<10} {'sfx':<10} {src:<22} {dur:<10}ms {level}\n")
        f.write("\n")
        f.write("ALL EVENTS (with frame numbers at 23.976fps)\n")
        f.write("-" * 60 + "\n")
        for i, (name, t, dur, src, level) in enumerate(cues, 1):
            frame = int(round(t * 23.976))
            tc = f"{int(t//60):02d}:{t%60:05.2f}"
            f.write(f"  Frame {frame:>3} ({tc}) — {name} [{dur}ms] from {src} {level}\n")
    print(f"Wrote cues: {cues_path}")


if __name__ == "__main__":
    main()

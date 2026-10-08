#!/usr/bin/env python3
"""
Generate reference-driven SFX audio track for draft render.

Creates a single WAV file with SFX events at the correct timestamps,
mixed under the voice track. Ducking: -6dB under voice.
SFX types: whoosh (zoom), hit (slam), ding (highlight), impact (graphic).

Input: canonical voice audio at work/corporate-career-growth-amana/prep/audio/canonical.wav
Output: work/corporate-career-growth-amana/prep/audio/sfx-reference.wav

SFX events from edit-blueprint.json (timestamp, duration_ms, kind):
"""

import json
import math
import os
import struct
import wave

# ─── Config ─────────────────────────────────────────────────────────────
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT = "corporate-career-growth-amana"
SAMPLE_RATE = 44100

VOICE_PATH = os.path.join(BASE, "work", PROJECT, "prep", "audio", "canonical.wav")
OUTPUT_PATH = os.path.join(BASE, "work", PROJECT, "prep", "audio", "sfx-reference.wav")

# SFX event definitions (timestamp_sec, duration_ms, kind)
# Derived from edit-blueprint.json enriched events
SFX_EVENTS = [
    (0.0,   300,  "whoosh"),   # Slam entrance
    (0.88,  300,  "hit"),      # Text swap impact
    (2.36,  300,  "ding"),     # BUSINESS DEVELOPMENT slam
    (2.36,  300,  "hit"),      # BUSINESS DEVELOPMENT hit
    (4.5,   300,  "hit"),      # PAYING highlight
    (4.5,   200,  "ding"),     # PAYING highlight ding
    (6.75,  400,  "whoosh"),   # Zoom-through into B-roll
    (9.8,   300,  "ding"),     # YOUR PROFILE graphic entrance
    (12.46, 300,  "hit"),      # Comparison diagram slam
    (12.46, 300,  "ding"),     # Comparison diagram ding
    (15.76, 300,  "hit"),      # It's About Having emphasis
    (17.998,300,  "hit"),      # RIGHT NEGOTIATION STRATEGY slam
    (20.16, 300,  "whoosh"),   # LAND / closing entrance
    (20.16, 300,  "hit"),      # LAND hit
    (20.8,  300,  "ding"),     # REGISTER NOW bell
]

DUCK_DB = -6  # SFX ducked 6dB under voice
HIGH_PASS_HZ = 130


def read_wav(path):
    """Read a mono WAV file, return (samples, sample_rate)."""
    with wave.open(path, 'rb') as w:
        nchannels = w.getnchannels()
        sampwidth = w.getsampwidth()
        framerate = w.getframerate()
        nframes = w.getnframes()
        raw = w.readframes(nframes)

    # Convert to mono float32
    if sampwidth == 2:
        fmt = '<' + 'h' * (len(raw) // 2)
        samples = [s / 32768.0 for s in struct.unpack(fmt, raw)]
    elif sampwidth == 4:
        fmt = '<' + 'i' * (len(raw) // 4)
        samples = [s / 2147483648.0 for s in struct.unpack(fmt, raw)]
    else:
        raise ValueError(f"Unsupported sample width: {sampwidth}")

    if nchannels == 2:
        samples = [samples[i] + samples[i+1] for i in range(0, len(samples), 2)]

    return samples, framerate


def write_wav(path, samples, sample_rate):
    """Write mono float32 samples to WAV."""
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        # Clamp and convert to int16
        pcm = struct.pack('<' + 'h' * len(samples),
                          *[max(-32768, min(32767, int(s * 32767))) for s in samples])
        w.writeframes(pcm)


def high_pass_filter(samples, sr, cutoff_hz):
    """Simple first-order high-pass filter."""
    rc = 1.0 / (2 * math.pi * cutoff_hz)
    dt = 1.0 / sr
    alpha = rc / (rc + dt)
    filtered = [0.0] * len(samples)
    filtered[0] = samples[0]
    for i in range(1, len(samples)):
        filtered[i] = alpha * (filtered[i-1] + samples[i] - samples[i-1])
    return filtered


def generate_whoosh(duration_ms, sr):
    """Generate a whoosh sound effect (noise burst with fade)."""
    samples = int(duration_ms / 1000.0 * sr)
    fade_out = int(samples * 0.3)
    result = []
    for i in range(samples):
        t = i / sr
        # White noise with band-pass-ish envelope
        noise = (hash(i) % 1000) / 500.0 - 1.0  # Pseudo-random
        # Envelope: quick attack, sustained, fade out
        if i < samples * 0.1:
            env = i / (samples * 0.1)
        elif i > samples - fade_out:
            env = (samples - i) / fade_out
        else:
            env = 1.0

        # Frequency sweep: high → low
        freq_mod = math.sin(2 * math.pi * (2000 - 1500 * i / samples) * t)
        result.append(noise * env * 0.15 * freq_mod)
    return result


def generate_hit(duration_ms, sr):
    """Generate a hit/impact sound effect."""
    samples = int(duration_ms / 1000.0 * sr)
    result = []
    for i in range(samples):
        t = i / sr
        # Short noise burst with low-frequency thump
        noise = (hash(i + 42) % 1000) / 500.0 - 1.0
        thump = math.sin(2 * math.pi * 80 * t) * math.exp(-t * 20)
        snap = math.sin(2 * math.pi * 2000 * t) * math.exp(-t * 40)

        if i < samples * 0.05:
            env = i / (samples * 0.05)
        elif i > samples * 0.7:
            env = (samples - i) / (samples * 0.3)
        else:
            env = 1.0

        result.append((noise * 0.3 + thump * 0.5 + snap * 0.2) * env * 0.25)
    return result


def generate_ding(duration_ms, sr):
    """Generate a ding/click sound effect."""
    samples = int(duration_ms / 1000.0 * sr)
    result = []
    for i in range(samples):
        t = i / sr
        # Two-tone chime
        tone1 = math.sin(2 * math.pi * 1200 * t)
        tone2 = math.sin(2 * math.pi * 1800 * t) * 0.5
        combined = (tone1 + tone2) * 0.5

        env = math.exp(-t * 15) if t < 0.3 else math.exp(-t * 8)

        result.append(combined * env * 0.2)
    return result


def mix_tracks(voice, sfx_track, total_duration_sec, sr):
    """Mix voice + SFX with ducking."""
    total_samples = int(total_duration_sec * sr)
    output = [0.0] * total_samples

    # Copy voice
    for i in range(min(len(voice), total_samples)):
        output[i] = voice[i]

    # Mix SFX
    duck_gain = 10 ** (DUCK_DB / 20)  # -6dB = 0.5
    for i in range(min(len(sfx_track), total_samples)):
        output[i] += sfx_track[i] * duck_gain

    return output


def main():
    print(f"Reading voice from: {VOICE_PATH}")

    if not os.path.exists(VOICE_PATH):
        print(f"ERROR: Voice file not found at {VOICE_PATH}")
        print("Please extract audio from testing-video.mp4 first.")
        return

    voice, sr = read_wav(VOICE_PATH)
    duration_sec = len(voice) / sr
    print(f"Voice: {duration_sec:.2f}s, {sr}Hz, {len(voice)} samples")

    # Build SFX track
    total_samples = len(voice)
    sfx_track = [0.0] * total_samples

    sfx_generators = {
        "whoosh": generate_whoosh,
        "hit": generate_hit,
        "ding": generate_ding,
    }

    for timestamp_sec, duration_ms, kind in SFX_EVENTS:
        if timestamp_sec >= duration_sec:
            continue

        gen = sfx_generators.get(kind, generate_hit)
        sfx_samples = gen(duration_ms, sr)

        start_sample = int(timestamp_sec * sr)
        for i, s in enumerate(sfx_samples):
            idx = start_sample + i
            if 0 <= idx < total_samples:
                sfx_track[idx] += s

    # Apply high-pass filter to SFX
    sfx_track = high_pass_filter(sfx_track, sr, HIGH_PASS_HZ)

    # Mix
    output = mix_tracks(voice, sfx_track, duration_sec, sr)

    # Soft clip to prevent distortion
    output = [max(-0.95, min(0.95, s)) for s in output]

    # Write output
    write_wav(OUTPUT_PATH, output, sr)
    print(f"\nSFX track written: {OUTPUT_PATH}")
    print(f"Duration: {duration_sec:.2f}s")
    print(f"Sample rate: {sr}Hz")
    print(f"SFX events: {len(SFX_EVENTS)}")
    print(f"Ducking: {DUCK_DB}dB")


if __name__ == "__main__":
    main()

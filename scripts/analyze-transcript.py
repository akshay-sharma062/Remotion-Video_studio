#!/usr/bin/env python3
"""Detailed transcription analysis: segment-level output from both models side by side."""
import json, sys
from faster_whisper import WhisperModel

audio_path = sys.argv[1] if len(sys.argv) > 1 else "work/corporate-career-growth-amana/prep/audio/original.wav"

for model_size in ["small", "medium"]:
    print(f"\n{'='*60}")
    print(f"MODEL: {model_size}")
    print(f"{'='*60}")

    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        audio_path,
        language="en",
        word_timestamps=True,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500),
    )

    for i, seg in enumerate(segments):
        print(f"\nSegment {i+1} [{seg.start:.2f}s - {seg.end:.2f}s]")
        if seg.words:
            for w in seg.words:
                print(f"  [{w.start:6.3f} - {w.end:6.3f}] {w.word!r} (prob: {w.probability:.3f})")

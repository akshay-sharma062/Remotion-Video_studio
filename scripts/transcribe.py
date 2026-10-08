#!/usr/bin/env python3
"""Transcribe with faster-whisper small model, output word-level timestamps."""
import json, sys
from faster_whisper import WhisperModel

audio_path = sys.argv[1] if len(sys.argv) > 1 else "work/corporate-career-growth-amana/prep/audio/original.wav"
output_path = sys.argv[2] if len(sys.argv) > 2 else "work/corporate-career-growth-amana/prep/audio/words.json"

model = WhisperModel("small", device="cpu", compute_type="int8")

segments, info = model.transcribe(
    audio_path,
    language="en",
    word_timestamps=True,
    vad_filter=True,
    vad_parameters=dict(min_silence_duration_ms=500),
)

words = []
for seg in segments:
    if seg.words:
        for w in seg.words:
            words.append({
                "word": w.word,
                "start": round(w.start, 3),
                "end": round(w.end, 3),
            })

result = {"language": info.language, "duration": info.duration, "words": words}

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(result, f, indent=2, ensure_ascii=False)

print(f"Transcribed {len(words)} words -> {output_path}")

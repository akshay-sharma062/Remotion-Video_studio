/**
 * sfx-library/wav-writer.ts — write Float32Array audio buffers to WAV files.
 *
 * Supports writing individual files or concatenated files with configurable gaps.
 * Uses Node.js Buffers for efficient I/O.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";

const SAMPLE_RATE = 44100;

/**
 * Write a single Float32Array as a 16-bit mono WAV file.
 */
export function writeWavFile(
  path: string,
  samples: Float32Array,
  sampleRate: number = SAMPLE_RATE
): void {
  const dir = path.split(/[\\/]/).slice(0, -1).join("/");
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const buffer = encodeWav(samples, sampleRate);
  writeFileSync(path, buffer);
}

/**
 * Concatenate multiple Float32Array buffers with optional gap (ms) between each.
 * Useful for creating audition files.
 */
export function concatenateWithGaps(
  buffers: Float32Array[],
  gapMs: number = 500,
  sampleRate: number = SAMPLE_RATE
): Float32Array {
  const gapSamples = Math.round((gapMs / 1000) * sampleRate);
  const silence = new Float32Array(gapSamples);
  const totalLength = buffers.reduce((acc, b) => acc + b.length, 0) + silence.length * (buffers.length - 1);
  const result = new Float32Array(totalLength);

  let offset = 0;
  for (let i = 0; i < buffers.length; i++) {
    result.set(buffers[i], offset);
    offset += buffers[i].length;
    if (i < buffers.length - 1) {
      result.set(silence, offset);
      offset += silence.length;
    }
  }

  return result;
}

/**
 * Read a mono WAV file back to Float32Array.
 */
export function readWavFile(path: string): { samples: Float32Array; sampleRate: number } {
  const fs = require("fs");
  const data = fs.readFileSync(path);
  return decodeWav(Buffer.from(data));
}

/**
 * Encode Float32Array to WAV format (16-bit mono).
 */
export function encodeWav(samples: Float32Array, sampleRate: number = SAMPLE_RATE): Buffer {
  const buffer = Buffer.alloc(44 + samples.length * 2);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);          // chunk size
  buffer.writeUInt16LE(1, 20);           // PCM format
  buffer.writeUInt16LE(1, 22);           // mono
  buffer.writeUInt32LE(sampleRate, 24);  // sample rate
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32);           // block align
  buffer.writeUInt16LE(16, 34);          // bits per sample

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples.length * 2, 40);

  // Write samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16 = Math.round(clamped * 32767);
    buffer.writeInt16LE(int16, offset);
    offset += 2;
  }

  return buffer;
}

/**
 * Decode a WAV file to Float32Array (mono only).
 */
export function decodeWav(buffer: Buffer): { samples: Float32Array; sampleRate: number } {
  if (buffer.readUInt32LE(0) !== 0x46464952) throw new Error("Not a WAV file (no RIFF)");
  if (buffer.readUInt32LE(8) !== 0x45564157) throw new Error("Not a WAV file (no WAVE)");

  let offset = 12;
  let numChannels = 1;
  let sampleRate = SAMPLE_RATE;
  let bitsPerSample = 16;

  // Find fmt chunk
  while (offset < buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === "fmt ") {
      numChannels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      bitsPerSample = buffer.readUInt16LE(offset + 22);
      break;
    }

    offset += 8 + chunkSize;
  }

  // Find data chunk
  offset = 12;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset < buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    if (chunkId === "data") {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }

    offset += 8 + chunkSize;
  }

  if (dataOffset < 0) throw new Error("No data chunk found in WAV file");

  const samples = new Float32Array(dataSize / (bitsPerSample / 8) / numChannels);

  if (bitsPerSample === 16) {
    for (let i = 0; i < samples.length; i++) {
      const intOffset = dataOffset + i * (numChannels * 2);
      let sample = buffer.readInt16LE(intOffset);

      // Convert to mono if stereo
      if (numChannels === 2) {
        const right = buffer.readInt16LE(intOffset + 2);
        sample = Math.round((sample + right) / 2);
      }

      samples[i] = sample / 32768;
    }
  } else if (bitsPerSample === 32) {
    for (let i = 0; i < samples.length; i++) {
      const intOffset = dataOffset + i * (numChannels * 4);
      samples[i] = buffer.readFloatLE(intOffset);
    }
  } else {
    throw new Error(`Unsupported bit depth: ${bitsPerSample}`);
  }

  return { samples, sampleRate };
}

/**
 * Compute the peak level (max absolute sample) of a buffer.
 */
export function getPeakLevel(samples: Float32Array): number {
  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    max = Math.max(max, Math.abs(samples[i]));
  }
  return max;
}

/**
 * Compute RMS level of a buffer.
 */
export function getRmsLevel(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * audio/index.ts — Audio mixing subsystem.
 *
 * Public API for the audio subsystem.
 *
 * Usage:
 *   import { AudioMixer, dbToGain } from "../editing-intelligence/audio";
 */

export {
  AudioMixer,
  DEFAULT_AUDIO_MIX_CONFIG,
} from "./audio-mixer";
export type { AudioMixConfig, AudioMixResult } from "./audio-mixer";
export { dbToGain, gainToDb, calculateDuckGain } from "./audio-mixer";

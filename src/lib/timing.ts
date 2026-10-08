import { useMotionBlur as motionBlur, readableHold } from "../design/motion";

export function wordHoldTime(wordCount: number): number {
  return readableHold(wordCount);
}

export function calcMotionBlur(current: number, previous: number): number {
  return motionBlur(current, previous);
}

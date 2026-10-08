import { join } from "path";

/**
 * projectAssets — resolve a project's asset root.
 * In Remotion, the public dir is always `public/`.
 */
export function projectAssets(name: string): string {
  return join("public", "projects", name);
}

export function projectFootage(name: string): string {
  return join(projectAssets(name), "footage");
}

export function projectBroll(name: string): string {
  return join(projectAssets(name), "broll");
}

export function projectScreenshots(name: string): string {
  return join(projectAssets(name), "screenshots");
}

export function projectAudio(name: string): string {
  return join(projectAssets(name), "audio");
}

export function projectProcessed(name: string): string {
  return join(projectAssets(name), "processed");
}

export function workDir(name: string): string {
  return join("work", name);
}

export function outDir(name: string): string {
  return join("out", name);
}

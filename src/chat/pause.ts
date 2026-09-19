import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pauseFilePath } from "../config/runtimeFiles.ts";

export type PauseFile = { paused: boolean };

export function readPausedFile(filePath = pauseFilePath()): boolean {
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as { paused?: unknown };
    return parsed.paused === true;
  } catch {
    return false;
  }
}

export async function writePaused(
  paused: boolean,
  filePath = pauseFilePath(),
): Promise<void> {
  const body: PauseFile = { paused };
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(body)}\n`);
}

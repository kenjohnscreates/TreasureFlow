import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_PATH = path.join(".data", "flash.json");

export type FlashRecord = {
  reserveUsdc: string;
  spotUsd: number;
  orderIds: string[];
  approveTx?: string;
  hashes: string[];
};

export async function loadFlash(filePath = DEFAULT_PATH): Promise<FlashRecord | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as FlashRecord;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function persistFlash(
  record: FlashRecord,
  filePath = DEFAULT_PATH,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`);
}

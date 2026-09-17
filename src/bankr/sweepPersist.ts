import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_PATH = path.join(".data", "sweep.json");

export type SweepRecord = {
  depositUsdc: string;
  depositUsdt: string;
  addTx: string;
  hashes: string[];
};

export async function persistSweep(
  record: SweepRecord,
  filePath = DEFAULT_PATH,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`);
}

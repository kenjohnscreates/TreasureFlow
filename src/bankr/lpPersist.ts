import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_PATH = path.join(".data", "lp.json");

export type LpRecord = {
  market: string;
  usd: number;
  mintTx: string;
  tokenId?: string;
  route?: string;
  hashes: string[];
};

export async function persistLp(
  record: LpRecord,
  filePath = DEFAULT_PATH,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`);
}

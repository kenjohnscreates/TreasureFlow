import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SpendEvent } from "./math.ts";

const DEFAULT_PATH = path.join(".data", "spend.json");

type FileShape = { events: { atMs: number; amountUsdc: string }[] };

export async function loadSpend(filePath = DEFAULT_PATH): Promise<SpendEvent[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as FileShape;
    return parsed.events.map((event) => ({
      atMs: event.atMs,
      amountUsdc: BigInt(event.amountUsdc),
    }));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function appendSpend(
  amountUsdc: bigint,
  atMs = Date.now(),
  filePath = DEFAULT_PATH,
): Promise<SpendEvent[]> {
  const events = await loadSpend(filePath);
  events.push({ atMs, amountUsdc });
  await mkdir(path.dirname(filePath), { recursive: true });
  const body: FileShape = {
    events: events.map((event) => ({
      atMs: event.atMs,
      amountUsdc: event.amountUsdc.toString(),
    })),
  };
  await writeFile(filePath, `${JSON.stringify(body, null, 2)}\n`);
  return events;
}

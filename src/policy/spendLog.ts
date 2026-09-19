import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spendFilePath } from "../config/runtimeFiles.ts";
import { AppError } from "../errors.ts";
import type { SpendEvent } from "./math.ts";

type FileShape = { events: { atMs: number; amountUsdc: string }[] };

function serialize(events: SpendEvent[]): FileShape {
  return {
    events: events.map((event) => ({
      atMs: event.atMs,
      amountUsdc: event.amountUsdc.toString(),
    })),
  };
}

export async function loadSpend(filePath = spendFilePath()): Promise<SpendEvent[]> {
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

export async function assertSpendWritable(filePath = spendFilePath()): Promise<void> {
  try {
    const events = await loadSpend(filePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(serialize(events), null, 2)}\n`);
  } catch (err) {
    if (err instanceof AppError && err.code === "spend_unwritable") throw err;
    throw new AppError("spend_unwritable", "spend log is not writable", err);
  }
}

export async function appendSpend(
  amountUsdc: bigint,
  atMs = Date.now(),
  filePath = spendFilePath(),
): Promise<SpendEvent[]> {
  const events = await loadSpend(filePath);
  events.push({ atMs, amountUsdc });
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(serialize(events), null, 2)}\n`);
  return events;
}

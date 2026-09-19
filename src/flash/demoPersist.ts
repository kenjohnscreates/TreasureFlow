import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { demoFlashFilePath } from "../config/runtimeFiles.ts";

export type DemoFlashOrder = {
  id: string;
  qtyUsdc: string;
  limitPriceUsd: string;
  pctBelowSpot: number;
  spotUsd: number;
};

export type DemoFlashRecord = {
  orders: DemoFlashOrder[];
};

export async function loadDemoFlash(
  filePath = demoFlashFilePath(),
): Promise<DemoFlashRecord> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<DemoFlashRecord>;
    if (!Array.isArray(parsed.orders)) return { orders: [] };
    return { orders: parsed.orders.filter((row) => row && typeof row.id === "string") };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { orders: [] };
    throw err;
  }
}

export async function persistDemoFlash(
  record: DemoFlashRecord,
  filePath = demoFlashFilePath(),
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`);
}

export async function appendDemoFlashOrder(
  order: DemoFlashOrder,
  filePath = demoFlashFilePath(),
): Promise<DemoFlashRecord> {
  const current = await loadDemoFlash(filePath);
  if (!current.orders.some((row) => row.id === order.id)) {
    current.orders.push(order);
  }
  await persistDemoFlash(current, filePath);
  return current;
}

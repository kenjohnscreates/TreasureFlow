import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BASESCAN_TX_ORIGIN,
  FLASH_ORDERS,
  LIVE_RECEIPTS,
  basescanTxUrl,
} from "../src/demo/evidence.ts";

const notes = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../NOTES.md"),
  "utf8",
);

describe("B6 live evidence", () => {
  it("receipt hashes match NOTES and BaseScan hrefs", () => {
    expect(LIVE_RECEIPTS).toHaveLength(5);
    for (const receipt of LIVE_RECEIPTS) {
      expect(notes).toContain(receipt.hash);
      expect(basescanTxUrl(receipt.hash)).toBe(`${BASESCAN_TX_ORIGIN}${receipt.hash}`);
      expect(basescanTxUrl(receipt.hash).startsWith("https://basescan.org/tx/")).toBe(
        true,
      );
    }
  });

  it("Flash order ids, rungs, prices, and qty match NOTES", () => {
    expect(FLASH_ORDERS).toHaveLength(3);
    expect(FLASH_ORDERS.map((order) => order.rungPct)).toEqual([2, 4, 6]);
    for (const order of FLASH_ORDERS) {
      expect(notes).toContain(order.id);
      expect(notes).toContain(`$${order.limitPriceUsd}`);
      expect(order.qtyUsdc).toBe("0.53164");
    }
    expect(notes).toContain("0.53164 USDC each");
    expect(notes).toContain("76613");
  });
});

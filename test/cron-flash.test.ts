import { describe, expect, it } from "vitest";
import { hourInTz, shouldRunNightly } from "../src/sweep/cron.ts";
import { limitBuyQuote } from "../src/flash/types.ts";
import { BASE } from "../src/config/constants.ts";

describe("nightly cron window", () => {
  it("fires at 02:00 America/New_York (EDT)", () => {
    const twoAm = new Date("2026-09-16T06:00:00.000Z");
    expect(hourInTz(twoAm, "America/New_York")).toBe(2);
    expect(shouldRunNightly(twoAm, "America/New_York")).toBe(true);
  });

  it("skips other hours", () => {
    const noon = new Date("2026-09-16T16:00:00.000Z");
    expect(shouldRunNightly(noon, "America/New_York")).toBe(false);
  });
});

describe("Flash limit quote shape", () => {
  it("builds a Base cbBTC buy", () => {
    const quote = limitBuyQuote({
      targetAsset: BASE.cbBtc,
      contraAsset: BASE.usdc,
      qtyUsdc: "3",
      limitNotionalPrice: "98000",
    });
    expect(quote.orderType).toBe("limit");
    expect(quote.side).toBe("buy");
    expect(quote.targetChain).toBe("base");
    expect(quote.funderAddress).toBeUndefined();
  });
});

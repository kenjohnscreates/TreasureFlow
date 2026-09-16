import { describe, expect, it } from "vitest";
import { usdc } from "../src/config/constants.ts";
import { buildLimitLadder } from "../src/flash/ladder.ts";

describe("Flash limit ladder", () => {
  it("places three rungs below spot", () => {
    const rungs = buildLimitLadder({ spotUsd: 100_000, reserveUsdc: usdc(9) });
    expect(rungs).toHaveLength(3);
    expect(rungs[0]?.pctBelowSpot).toBe(2);
    expect(rungs[0]?.limitPriceUsd).toBe(98_000);
    expect(rungs[0]?.sizeUsdc).toBe(usdc(3));
  });
});

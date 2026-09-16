import { describe, expect, it } from "vitest";
import { usdc } from "../src/config/constants.ts";
import {
  maxLpValue,
  remainingDailyCap,
  shortfallForPay,
  spentInWindow,
  surplusAboveBuffer,
} from "../src/policy/math.ts";

describe("buffer and sweep math", () => {
  it("keeps the buffer unswept", () => {
    expect(surplusAboveBuffer(usdc(55), usdc(15))).toBe(usdc(40));
    expect(surplusAboveBuffer(usdc(10), usdc(15))).toBe(0n);
  });

  it("caps LP share", () => {
    expect(maxLpValue(usdc(100), 0.7)).toBe(usdc(70));
  });

  it("computes payment shortfall", () => {
    expect(shortfallForPay(usdc(5), usdc(8))).toBe(usdc(3));
    expect(shortfallForPay(usdc(8), usdc(8))).toBe(0n);
  });
});

describe("daily cap", () => {
  it("rolls over 24h", () => {
    const now = 1_000_000_000_000;
    const events = [
      { atMs: now - 25 * 60 * 60 * 1000, amountUsdc: usdc(20) },
      { atMs: now - 2 * 60 * 60 * 1000, amountUsdc: usdc(8) },
    ];
    expect(spentInWindow(events, now, 24 * 60 * 60 * 1000)).toBe(usdc(8));
    expect(remainingDailyCap(usdc(30), events, now)).toBe(usdc(22));
  });
});

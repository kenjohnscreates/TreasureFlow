import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/load.ts";
import { usdc } from "../src/config/constants.ts";
import { planPay, planSweep } from "../src/sweep/plan.ts";
import { AppError } from "../src/errors.ts";

const dest = getAddress("0x000000000000000000000000000000000000dEaD");

describe("planSweep", () => {
  it("plans addLiquidity when surplus clears min size", () => {
    const config = loadConfig();
    const plan = planSweep(
      { usdcFree: usdc(55), usdtFree: usdc(40), lpValueUsdc: 0n },
      config.policy,
      false,
    );
    expect(plan.action).toBe("add_liquidity");
    expect(plan.depositUsdc).toBe(usdc(40));
  });

  it("noops when surplus is tiny", () => {
    const config = loadConfig();
    const plan = planSweep(
      { usdcFree: usdc(16), usdtFree: 0n, lpValueUsdc: 0n },
      config.policy,
      false,
    );
    expect(plan.action).toBe("noop");
  });
});

describe("planPay", () => {
  it("pays from free USDC without unwind", () => {
    const config = loadConfig();
    config.payDestinations = [dest];
    const plan = planPay({
      snapshot: { usdcFree: usdc(20), usdtFree: 0n, lpValueUsdc: 0n },
      amountUsdc: usdc(8),
      to: dest,
      config,
      spend: [],
    });
    expect(plan.action).toBe("pay");
    expect(plan.shortfallUsdc).toBe(0n);
  });

  it("rejects over the per-call cap", () => {
    const config = loadConfig();
    config.payDestinations = [dest];
    expect(() =>
      planPay({
        snapshot: { usdcFree: usdc(55), usdtFree: 0n, lpValueUsdc: 0n },
        amountUsdc: usdc(50),
        to: dest,
        config,
        spend: [],
      }),
    ).toThrow(AppError);
  });
});

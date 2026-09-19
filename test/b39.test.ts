import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatUnits } from "viem";
import { describe, expect, it } from "vitest";
import { USDC_DECIMALS } from "../src/config/constants.ts";
import { loadConfig } from "../src/config/load.ts";
import { FLASH_ORDERS } from "../src/demo/evidence.ts";
import { formatUsdcSpend } from "../web/src/formatUsdcSpend.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("B39 USDC spend display", () => {
  it("formats qty as USD spend not BTC", () => {
    expect(formatUsdcSpend("0.53164")).toBe("$0.53 USDC");
    expect(formatUsdcSpend("0.235011")).toBe("$0.24 USDC");
    expect(formatUsdcSpend(undefined)).toBe("--");
    expect(formatUsdcSpend("")).toBe("--");
    expect(formatUsdcSpend("market")).toBe("market");
    expect(formatUsdcSpend("n/a")).toBe("n/a");
    expect(FLASH_ORDERS.every((order) => order.qtyUsdc === "0.53164")).toBe(true);
    expect(FLASH_ORDERS.map((order) => order.id)).toEqual([
      "7863b457-c132-4f6d-bc01-0925dd32d6ee",
      "afcc2cb5-e93b-4565-98be-6fe60bc8c744",
      "296280cb-3ba3-466f-96e6-f0f018fea652",
    ]);
  });

  it("Buy-the-dip table uses the spend formatter", () => {
    const appSrc = readFileSync(join(root, "web/src/App.tsx"), "utf8");
    expect(appSrc).toContain("formatUsdcSpend");
    expect(appSrc).toContain("{formatUsdcSpend(order.qtyUsdc)}");
    expect(appSrc).not.toMatch(/<td className="mono">\{order\.qtyUsdc\}<\/td>/);
    expect(appSrc).not.toMatch(/\u2014|\u2013/);
  });

  it("caps stay 15/10/30/15", () => {
    const { policy } = loadConfig();
    expect(formatUnits(policy.bufferUsdc, USDC_DECIMALS)).toBe("15");
    expect(formatUnits(policy.perCallCapUsdc, USDC_DECIMALS)).toBe("10");
    expect(formatUnits(policy.dailyCapUsdc, USDC_DECIMALS)).toBe("30");
    expect(formatUnits(policy.hardStopUsdc, USDC_DECIMALS)).toBe("15");
  });
});

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatUnits } from "viem";
import { describe, expect, it } from "vitest";
import { USDC_DECIMALS } from "../src/config/constants.ts";
import { loadConfig } from "../src/config/load.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("B40 cyan card drops held subline", () => {
  it("keeps total USD and Active positions rows, not the card subline", () => {
    const app = readFileSync(join(root, "web/src/App.tsx"), "utf8");
    expect(app).toContain("liveTotalUsd");
    expect(app).toContain("<small>USD</small>");
    expect(app).toContain('liveAmt(treasury, "usdc")');
    expect(app).toContain('liveAmt(treasury, "usdt")');
    expect(app).toContain('liveAmt(treasury, "nvdac")');
    expect(app).toContain("<td>Held</td>");
    expect(app).toContain("<td>ETH</td>");
    expect(app).toContain("<td>USDT</td>");
    expect(app).toContain("<td>NVDAc</td>");
    expect(app).not.toContain("liveEthLine");
    expect(app).not.toContain("treasury-held");
    expect(app).not.toContain("wallet-bals");
    expect(app).not.toMatch(/\u2014|\u2013/);
    const css = readFileSync(join(root, "web/src/index.css"), "utf8");
    expect(css).not.toContain("treasury-held");
  });

  it("caps stay 15/10/30/15", () => {
    const { policy } = loadConfig();
    expect(formatUnits(policy.bufferUsdc, USDC_DECIMALS)).toBe("15");
    expect(formatUnits(policy.perCallCapUsdc, USDC_DECIMALS)).toBe("10");
    expect(formatUnits(policy.dailyCapUsdc, USDC_DECIMALS)).toBe("30");
    expect(formatUnits(policy.hardStopUsdc, USDC_DECIMALS)).toBe("15");
  });
});

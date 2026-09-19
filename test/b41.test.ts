import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatUnits, getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { USDC_DECIMALS } from "../src/config/constants.ts";
import { loadConfig } from "../src/config/load.ts";
import { truncateAddress } from "../src/bankr/parse.ts";
import { publicStatus } from "../src/chat/status.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("B41 approved wallets page and Lend cue", () => {
  it("adds Approved wallets from payDestDisplays and a disabled Lend & Borrow nav", () => {
    const app = readFileSync(join(root, "web/src/App.tsx"), "utf8");
    expect(app).toContain('"allowlist"');
    expect(app).toContain("Approved wallets");
    expect(app).toContain("The agent can only send to these wallets.");
    expect(app).toContain("allowlistRows");
    expect(app).toContain("payDestDisplays");
    expect(app).toContain("Lend & Borrow");
    expect(app).toMatch(/disabled title="Coming later"/);
    expect(app).not.toMatch(/>\s*Lend\s*</);
    expect(app).not.toMatch(/setView\("lend/i);
    expect(app).not.toMatch(/\u2014|\u2013/);
    const css = readFileSync(join(root, "web/src/index.css"), "utf8");
    expect(css).toContain("#allowlist.page.on");
    expect(css).toContain("nav button:disabled");
  });

  it("status still truncates the two pay dests", () => {
    const dest1 = getAddress("0x1111111111111111111111111111111111111111");
    const dest2 = getAddress("0x2222222222222222222222222222222222222222");
    const status = publicStatus({
      ...loadConfig(),
      payDestinations: [dest1, dest2],
    });
    expect(status.payDestDisplays).toEqual([
      truncateAddress(dest1),
      truncateAddress(dest2),
    ]);
    expect(status).not.toHaveProperty("payDestinations");
    expect(JSON.stringify(status)).not.toContain(dest1);
    expect(JSON.stringify(status)).not.toContain(dest2);
  });

  it("header logo links to the TreasureFlow home URL", () => {
    const app = readFileSync(join(root, "web/src/App.tsx"), "utf8");
    const landing = readFileSync(join(root, "web/src/Landing.tsx"), "utf8");
    expect(app).toContain('href="https://treasureflow.vercel.app/"');
    expect(landing).toContain('href="https://treasureflow.vercel.app/"');
    expect(app).toContain('aria-label="TreasureFlow home"');
    expect(app).toContain('window.history.pushState({}, "", "/")');
  });

  it("caps stay 15/10/30/15", () => {
    const { policy } = loadConfig();
    expect(formatUnits(policy.bufferUsdc, USDC_DECIMALS)).toBe("15");
    expect(formatUnits(policy.perCallCapUsdc, USDC_DECIMALS)).toBe("10");
    expect(formatUnits(policy.dailyCapUsdc, USDC_DECIMALS)).toBe("30");
    expect(formatUnits(policy.hardStopUsdc, USDC_DECIMALS)).toBe("15");
  });
});

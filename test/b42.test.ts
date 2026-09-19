import { formatUnits, getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseIntent } from "../src/chat/intent.ts";
import { handleChat } from "../src/chat/handle.ts";
import { loadConfig } from "../src/config/load.ts";
import { USDC_DECIMALS } from "../src/config/constants.ts";
import { llmSystemPrompt } from "../src/bankr/llm.ts";

const dest1 = getAddress("0x1111111111111111111111111111111111111111");
const dest2 = getAddress("0x2222222222222222222222222222222222222222");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("B42 wallet 1 / wallet 2 pay aliases", () => {
  it("parses send $10 USDC to wallet 1 as pay 10 to PAY_DEST_1", () => {
    const intent = parseIntent("send $10 USDC to wallet 1");
    expect(intent.kind).toBe("pay");
    if (intent.kind === "pay") {
      expect(intent.amountUsdc).toBe(10_000_000n);
      expect(intent.to).toBe("PAY_DEST_1");
    }
    const caps = parseIntent("send $10 USDC to Wallet 1");
    expect(caps.kind).toBe("pay");
    if (caps.kind === "pay") expect(caps.to).toBe("PAY_DEST_1");
  });

  it("parses send $50 USDC to wallet 2 and rejects per-call cap", () => {
    const intent = parseIntent("send $50 USDC to wallet 2");
    expect(intent.kind).toBe("pay");
    if (intent.kind === "pay") {
      expect(intent.amountUsdc).toBe(50_000_000n);
      expect(intent.to).toBe("PAY_DEST_2");
    }
    const config = { ...loadConfig(), payDestinations: [dest1, dest2] };
    const reply = handleChat("send $50 USDC to wallet 2", config);
    expect(reply.kind).toBe("pay");
    expect(reply.plan.action).toBe("rejected");
    expect(reply.plan.code).toBe("per_call_cap");
    expect(reply.summary).toContain("Per-call cap is 10 USDC");
  });

  it("plans send $10 USDC to wallet 1 under the per-call cap", () => {
    const config = { ...loadConfig(), payDestinations: [dest1, dest2] };
    const reply = handleChat("send $10 USDC to wallet 1", config, {
      snapshot: { usdcFree: 55_000_000n, usdtFree: 40_000_000n, lpValueUsdc: 0n },
    });
    expect(reply.kind).toBe("pay");
    expect(reply.plan.action).toBe("pay");
    expect(reply.plan.sent).toBe(false);
    expect(reply.plan.amountUsdc).toBe("10");
  });

  it("Approved wallets page and chips use Wallet 1 / Wallet 2", () => {
    const app = readFileSync(join(root, "web/src/App.tsx"), "utf8");
    expect(app).toContain("Wallet ${i + 1}");
    expect(app).not.toContain("founderDisplay");
    expect(app).toContain("send $10 USDC to wallet 1");
    expect(app).toContain("send $50 USDC to wallet 2");
    expect(app).toContain("Send 10");
    expect(app).toContain("Send 50");
    expect(app).not.toContain("Send 8");
    expect(llmSystemPrompt()).toContain("send $10 USDC to wallet 1");
    expect(llmSystemPrompt()).toContain("send $50 USDC to wallet 2");
    expect(app).not.toMatch(/\u2014|\u2013/);
  });

  it("caps stay 15/10/30/15", () => {
    const { policy } = loadConfig();
    expect(formatUnits(policy.bufferUsdc, USDC_DECIMALS)).toBe("15");
    expect(formatUnits(policy.perCallCapUsdc, USDC_DECIMALS)).toBe("10");
    expect(formatUnits(policy.dailyCapUsdc, USDC_DECIMALS)).toBe("30");
    expect(formatUnits(policy.hardStopUsdc, USDC_DECIMALS)).toBe("15");
  });
});

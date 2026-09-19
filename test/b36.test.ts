import { formatUnits, getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { parseIntent } from "../src/chat/intent.ts";
import { handleChat } from "../src/chat/handle.ts";
import { encodeTransfer } from "../src/aerodrome/encode.ts";
import { loadConfig } from "../src/config/load.ts";
import { BASE, USDC_DECIMALS, usdc } from "../src/config/constants.ts";
import { llmSystemPrompt } from "../src/bankr/llm.ts";

const dest = getAddress("0x1111111111111111111111111111111111111111");
const treasury = getAddress("0x000000000000000000000000000000000000dEaD");

describe("B36 optional $ on deposit and pay", () => {
  it("parses deposit $5 usdc as USDC 5e6", () => {
    const intent = parseIntent("deposit $5 usdc");
    expect(intent.kind).toBe("deposit");
    if (intent.kind === "deposit") {
      expect(intent.token).toBe("USDC");
      expect(intent.amount).toBe(5_000_000n);
    }
  });

  it("still parses deposit 5 USDC", () => {
    const intent = parseIntent("deposit 5 USDC");
    expect(intent.kind).toBe("deposit");
    if (intent.kind === "deposit") {
      expect(intent.token).toBe("USDC");
      expect(intent.amount).toBe(5_000_000n);
    }
  });

  it("parses send $8 USDC to PAY_DEST_1 as pay 8", () => {
    const intent = parseIntent("send $8 USDC to PAY_DEST_1");
    expect(intent.kind).toBe("pay");
    if (intent.kind === "pay") {
      expect(intent.amountUsdc).toBe(8_000_000n);
      expect(intent.to).toBe("PAY_DEST_1");
    }
    const existing = parseIntent("send 8 USDC to PAY_DEST_1");
    expect(existing.kind).toBe("pay");
    if (existing.kind === "pay") expect(existing.amountUsdc).toBe(8_000_000n);
  });

  it("send 50 still per_call_cap / rejected", () => {
    const config = { ...loadConfig(), payDestinations: [dest] };
    const reply = handleChat("send 50 USDC to PAY_DEST_1", config);
    expect(reply.kind).toBe("pay");
    expect(reply.plan.action).toBe("rejected");
    expect(reply.plan.code).toBe("per_call_cap");
    expect(reply.plan.sent).not.toBe(true);
    const dollar = handleChat("send $50 USDC to PAY_DEST_1", config);
    expect(dollar.kind).toBe("pay");
    expect(dollar.plan.code).toBe("per_call_cap");
    expect(dollar.plan.sent).not.toBe(true);
  });

  it("caps stay 15/10/30/15", () => {
    const policy = loadConfig().policy;
    expect(formatUnits(policy.bufferUsdc, USDC_DECIMALS)).toBe("15");
    expect(formatUnits(policy.perCallCapUsdc, USDC_DECIMALS)).toBe("10");
    expect(formatUnits(policy.dailyCapUsdc, USDC_DECIMALS)).toBe("30");
    expect(formatUnits(policy.hardStopUsdc, USDC_DECIMALS)).toBe("15");
    expect(policy.bufferUsdc).toBe(usdc(15));
  });

  it("deposit $5 usdc is the same unsigned ERC-20 plan as deposit 5 USDC", () => {
    const config = { ...loadConfig(), treasuryAddress: treasury };
    const dollar = handleChat("deposit $5 usdc", config);
    const plain = handleChat("deposit 5 USDC", config);
    expect(dollar.kind).toBe("deposit");
    expect(plain.kind).toBe("deposit");
    expect(dollar.plan.action).toBe("deposit");
    expect(dollar.plan.sent).not.toBe(true);
    expect(dollar.unsignedTx?.to).toBe(BASE.usdc);
    expect(dollar.unsignedTx?.value).toBe("0x0");
    expect(dollar.unsignedTx?.data).toBe(encodeTransfer(treasury, 5_000_000n));
    expect(dollar.unsignedTx).toEqual(plain.unsignedTx);
    expect(dollar.plan.amount).toBe("5");
    expect(dollar.plan.token).toBe("USDC");
  });

  it("LLM prompt lists deposit $N USDC and does not set sent", () => {
    const prompt = llmSystemPrompt();
    expect(prompt).toContain("deposit $N USDC");
    expect(prompt).toContain("deposit N USDC");
    expect(prompt).not.toMatch(/\u2014|\u2013/);
    expect(prompt.toLowerCase()).not.toContain("sent: true");
  });
});

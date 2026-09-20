import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { truncateAddress } from "../src/bankr/parse.ts";
import { handleChat } from "../src/chat/handle.ts";
import { parseIntent } from "../src/chat/intent.ts";
import { chatLiveOpts } from "../src/chat/reads.ts";
import { encodeTransfer } from "../src/aerodrome/encode.ts";
import { BASE, usdc } from "../src/config/constants.ts";
import { loadConfig } from "../src/config/load.ts";

const dest = getAddress("0x1111111111111111111111111111111111111111");
const treasury = "0x4c9D00000000000000000000000000000000a6c2" as Address;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const LIVE_PORTFOLIO = {
  evmAddress: treasury,
  eth: "0.009615",
  usdc: "0",
  usdt: "2.116011",
  nvdac: "0.068",
  tokenCount: 3,
};

describe("B32 live chat snapshot", () => {
  it("handle.ts does not silently substitute DEMO_SNAPSHOT 55/40", () => {
    const src = readFileSync(join(root, "src/chat/handle.ts"), "utf8");
    expect(src).not.toContain("DEMO_SNAPSHOT");
    expect(src).not.toContain("55_000_000n");
    expect(src).not.toContain("40_000_000n");
  });

  it("missing snapshot does not plan pay from 55 USDC", () => {
    const config = { ...loadConfig(), payDestinations: [dest] };
    const reply = handleChat(`send 8 USDC to ${dest}`, config);
    expect(reply.kind).toBe("pay");
    expect(reply.plan.action).toBe("rejected");
    expect(reply.plan.code).toBe("no_live_snapshot");
    expect(reply.plan.action).not.toBe("pay");
    expect(reply.plan.action).not.toBe("unwind_and_pay");
    expect(reply.summary).toContain("Not using demo balances");
    expect(reply.summary).not.toContain("55");
  });

  it("live zero USDC still cannot plan Send 8", () => {
    const config = { ...loadConfig(), payDestinations: [dest] };
    const reply = handleChat(`send 8 USDC to ${dest}`, config, {
      snapshot: { usdcFree: 0n, usdtFree: usdc(2), lpValueUsdc: 0n },
    });
    expect(reply.plan.action).toBe("rejected");
    expect(reply.plan.code).toBe("insufficient_lp");
  });

  it("chatLiveOpts omits snapshot when Bankr key is missing", async () => {
    const opts = await chatLiveOpts(
      { ...loadConfig(), bankrApiKey: "" },
      "how much USDC in the treasury",
    );
    expect(opts.snapshot).toBeUndefined();
    expect(opts.portfolio).toBeUndefined();
  });
});

describe("B32 balance and deposit phrasing", () => {
  it("parses balance / how much / treasury status", () => {
    expect(parseIntent("how much USDC in the treasury").kind).toBe("balance");
    expect(parseIntent("what is the treasury").kind).toBe("balance");
    expect(parseIntent("balance").kind).toBe("balance");
    expect(parseIntent("status").kind).toBe("balance");
    expect(parseIntent("how much").kind).toBe("balance");
  });

  it("balance intent returns live-shaped summary", () => {
    const config = { ...loadConfig(), treasuryAddress: treasury };
    const reply = handleChat("how much USDC in the treasury", config, {
      portfolio: LIVE_PORTFOLIO,
    });
    expect(reply.kind).toBe("balance");
    expect(reply.plan.live).toBe(true);
    expect(reply.summary).toContain(truncateAddress(treasury));
    expect(reply.summary).toContain("0x4c9D...a6c2");
    expect(reply.summary).toContain("USDC 0");
    expect(reply.summary).toContain("USDT 2.116011");
    expect(reply.summary).toContain("NVDAc 0.068");
    expect(reply.summary).toContain("ETH 0.009615");
    expect(reply.summary).not.toContain("55");
    expect(reply.summary).not.toMatch(/\$42/);
  });

  it("balance without portfolio is honest empty", () => {
    const reply = handleChat("how much USDC in the treasury", loadConfig());
    expect(reply.kind).toBe("balance");
    expect(reply.plan.live).toBe(false);
    expect(reply.summary).toContain("Not using demo balances");
    expect(reply.summary).not.toContain("55");
  });

  it("maps send-from-external-to-treasury to unsigned USDC deposit", () => {
    const config = { ...loadConfig(), treasuryAddress: dest };
    const prompts = [
      "send 5 USDC from my external wallet to the treasury",
      "send $5 from my external wallet to the treasury",
      "send 5 USDC from my wallet/external to the treasury",
    ];
    for (const prompt of prompts) {
      const intent = parseIntent(prompt);
      expect(intent.kind).toBe("deposit");
      if (intent.kind === "deposit") {
        expect(intent.token).toBe("USDC");
        expect(intent.amount).toBe(5_000_000n);
      }
      const reply = handleChat(prompt, config);
      expect(reply.kind).toBe("deposit");
      expect(reply.plan.action).toBe("deposit");
      expect(reply.plan.amount).toBe("5");
      expect(reply.unsignedTx?.to).toBe(BASE.usdc);
      expect(reply.unsignedTx?.data).toBe(encodeTransfer(dest, 5_000_000n));
      expect(reply.summary).toContain("Sign in your wallet");
    }
  });

  it("does not treat send-from-external-to-treasury as pay", () => {
    const intent = parseIntent("send $5 from my external wallet to the treasury");
    expect(intent.kind).not.toBe("pay");
    expect(intent.kind).toBe("deposit");
  });

  it("external-wallet ETH questions do not read the founder wallet", () => {
    const reply = handleChat("how much eth in my external wallet", loadConfig());
    expect(parseIntent("how much eth in my external wallet").kind).toBe("external_wallet");
    expect(reply.kind).toBe("external_wallet");
    expect(reply.summary).toContain("External Wallet card");
    expect(reply.summary).toContain("company treasury");
    expect(reply.summary).toContain("does not send from the external wallet");
    expect(reply.summary).not.toContain("55");
  });

  it("unknown still safe", () => {
    expect(parseIntent("what is the buffer?").kind).toBe("unknown");
    const reply = handleChat("blorp the widgets", loadConfig());
    expect(reply.kind).toBe("unknown");
    expect(reply.summary).toBe("No matching intent.");
    expect(reply.plan.action).toBe("unknown");
  });
});

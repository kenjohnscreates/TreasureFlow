import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { truncateAddress } from "../src/bankr/parse.ts";
import { parseIntent, assertAllowlisted } from "../src/chat/intent.ts";
import { handleChat } from "../src/chat/handle.ts";
import { encodeTransfer } from "../src/aerodrome/encode.ts";
import { loadConfig } from "../src/config/load.ts";
import { BASE } from "../src/config/constants.ts";
import { coreAllowlist } from "../src/policy/allowlist.ts";
import { AppError } from "../src/errors.ts";

const dest = getAddress("0x000000000000000000000000000000000000dEaD");

describe("parseIntent", () => {
  it("parses send N USDC to PAY_DEST_1", () => {
    const intent = parseIntent("send 8 USDC to PAY_DEST_1");
    expect(intent.kind).toBe("pay");
    if (intent.kind === "pay") {
      expect(intent.amountUsdc).toBe(8_000_000n);
      expect(intent.to).toBe("PAY_DEST_1");
    }
  });

  it("parses send N USDC to 0x", () => {
    const intent = parseIntent(`send 8 USDC to ${dest}`);
    expect(intent.kind).toBe("pay");
    if (intent.kind === "pay") {
      expect(intent.amountUsdc).toBe(8_000_000n);
      expect(intent.to).toBe(dest);
    }
  });

  it("parses commas used in spoken demo copy", () => {
    const intent = parseIntent(`send 2,400 USDC to ${dest}`);
    expect(intent.kind).toBe("pay");
    if (intent.kind === "pay") expect(intent.amountUsdc).toBe(2_400_000_000n);
  });

  it("returns unknown for chatter", () => {
    expect(parseIntent("what is the buffer?").kind).toBe("unknown");
  });

  it("parses deposit USDC and NVDAc (8 decimals)", () => {
    const usdc = parseIntent("deposit 8 USDC");
    expect(usdc.kind).toBe("deposit");
    if (usdc.kind === "deposit") {
      expect(usdc.token).toBe("USDC");
      expect(usdc.amount).toBe(8_000_000n);
    }
    const nvda = parseIntent("deposit 1.5 NVDAc");
    expect(nvda.kind).toBe("deposit");
    if (nvda.kind === "deposit") {
      expect(nvda.token).toBe("NVDAc");
      expect(nvda.amount).toBe(150_000_000n);
    }
  });

  it("parses sweep, lp stocks, demo flash, and limits", () => {
    expect(parseIntent("sweep").kind).toBe("sweep");
    expect(parseIntent("lp").kind).toBe("lp_stocks");
    expect(parseIntent("lp stocks").kind).toBe("lp_stocks");
    expect(parseIntent("lp NVDAc").kind).toBe("lp_stocks");
    expect(parseIntent("buy 1 USDC of cbBTC 0.01 percent below spot").kind).toBe(
      "demo_flash",
    );
    expect(parseIntent("limits").kind).toBe("limits");
    expect(parseIntent("ladder").kind).toBe("limits");
  });
});

describe("allowlist", () => {
  it("rejects unknown destinations", () => {
    expect(() => assertAllowlisted(dest, [])).toThrow(AppError);
  });

  it("includes NVDAc", () => {
    expect(coreAllowlist()).toContain(BASE.nvdac);
  });
});

describe("handleChat", () => {
  it("encodes deposit unsigned tx for the user wallet", () => {
    const config = { ...loadConfig(), treasuryAddress: dest };
    const reply = handleChat("deposit 8 USDC", config);
    expect(reply.kind).toBe("deposit");
    expect(reply.unsignedTx?.chainId).toBe(8453);
    expect(reply.unsignedTx?.to).toBe(BASE.usdc);
    expect(reply.unsignedTx?.value).toBe("0x0");
    expect(reply.unsignedTx?.data).toBe(encodeTransfer(dest, 8_000_000n));
  });

  it("refuses deposit without treasury", () => {
    const config = { ...loadConfig(), treasuryAddress: null };
    expect(() => handleChat("deposit 1 NVDAc", config)).toThrow(AppError);
    try {
      handleChat("deposit 1 NVDAc", config);
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      if (err instanceof AppError) expect(err.code).toBe("missing_treasury");
    }
  });

  it("handleChat resolves PAY_DEST_1 before allowlist", () => {
    const dest = getAddress("0x1111111111111111111111111111111111111111");
    const config = { ...loadConfig(), payDestinations: [dest] };
    const reply = handleChat("send 8 USDC to PAY_DEST_1", config, {
      snapshot: { usdcFree: 55_000_000n, usdtFree: 40_000_000n, lpValueUsdc: 0n },
    });
    expect(reply.kind).toBe("pay");
    expect(reply.plan.action).toBe("pay");
    expect(reply.plan.to).toBe(truncateAddress(dest));
    expect(reply.plan.sent).toBe(false);
  });

  it("returns lp stocks plan and sized sweep/limits", () => {
    const config = loadConfig();
    const lp = handleChat("lp stocks", config);
    expect(lp.plan.action).toBe("lp_stocks");
    expect(lp.plan.sent).toBe(false);
    const sweep = handleChat("sweep", config, {
      snapshot: { usdcFree: 55_000_000n, usdtFree: 40_000_000n, lpValueUsdc: 0n },
    });
    expect(sweep.kind).toBe("sweep");
    expect(sweep.plan.action).toBe("add_liquidity");
    expect(sweep.plan.sent).toBe(false);
    const limits = handleChat("limits", config);
    expect(limits.plan.action).toBe("limits");
    expect(limits.summary.includes("Chat does not submit")).toBe(true);
  });
});

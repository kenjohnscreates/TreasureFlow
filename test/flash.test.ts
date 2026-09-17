import { describe, expect, it } from "vitest";
import { extractSignature, extractTxHash } from "../src/bankr/agent.ts";
import { typedDataSignPrompt } from "../src/bankr/signTyped.ts";
import { handleChat } from "../src/chat/handle.ts";
import { BASE, usdc } from "../src/config/constants.ts";
import { loadConfig } from "../src/config/load.ts";
import { isEip7702Code, wrapKernel7702Signature } from "../src/flash/kernel.ts";
import { buildLimitLadder } from "../src/flash/ladder.ts";
import {
  parseFlashOrderId,
  parseFlashQuote,
  typedDataForWallet,
} from "../src/flash/parse.ts";
import { isRecord } from "../src/bankr/parse.ts";
import { sizeLiveLimits } from "../src/flash/size.ts";
import { limitBuyQuote } from "../src/flash/types.ts";

describe("Flash limit ladder", () => {
  it("places three rungs below spot", () => {
    const rungs = buildLimitLadder({ spotUsd: 100_000, reserveUsdc: usdc(9) });
    expect(rungs).toHaveLength(3);
    expect(rungs[0]?.pctBelowSpot).toBe(2);
    expect(rungs[0]?.limitPriceUsd).toBe(98_000);
    expect(rungs[0]?.sizeUsdc).toBe(usdc(3));
  });
});

describe("live limit sizing", () => {
  it("reserves surplus under hard stop and per-call", () => {
    const plan = sizeLiveLimits({
      usdcFree: usdc(40),
      bufferUsdc: usdc(15),
      hardStopUsdc: usdc(15),
      perCallCapUsdc: usdc(10),
      dailyLeftUsdc: usdc(30),
    });
    expect(plan.action).toBe("place");
    expect(plan.surplusUsdc).toBe(usdc(25));
    expect(plan.reserveUsdc).toBe(usdc(10));
  });

  it("noops when USDC is at the buffer", () => {
    const plan = sizeLiveLimits({
      usdcFree: usdc(15),
      bufferUsdc: usdc(15),
      hardStopUsdc: usdc(15),
      perCallCapUsdc: usdc(10),
      dailyLeftUsdc: usdc(30),
    });
    expect(plan.action).toBe("noop");
    expect(plan.reserveUsdc).toBe(0n);
  });

  it("caps reserve at remaining daily", () => {
    const plan = sizeLiveLimits({
      usdcFree: usdc(40),
      bufferUsdc: usdc(15),
      hardStopUsdc: usdc(15),
      perCallCapUsdc: usdc(10),
      dailyLeftUsdc: usdc(4),
    });
    expect(plan.action).toBe("place");
    expect(plan.reserveUsdc).toBe(usdc(4));
  });
});

describe("Flash quote parse", () => {
  it("keeps quoteId and orderTypedData", () => {
    const parsed = parseFlashQuote({
      quoteId: "q_1",
      evm: {
        orderTypedData:
          '{"domain":{},"types":{},"primaryType":"FlashOrder","message":{}}',
        approveTx: {
          to: BASE.usdc,
          data: "0x095ea7b30000000000000000000000000000000000000000000000000000000000000000",
        },
        permitTypedData: null,
      },
    });
    expect(parsed.quoteId).toBe("q_1");
    expect(parsed.approveTx?.to).toBe(BASE.usdc);
    expect(parsed.orderTypedData.includes("FlashOrder")).toBe(true);
  });

  it("reads orderId from submit", () => {
    expect(parseFlashOrderId({ orderId: "ord_1" })).toBe("ord_1");
  });

  it("strips EIP712Domain and numeric chainId for wallet sign", () => {
    const signed = typedDataForWallet({
      domain: { chainId: "8453", name: "Flash" },
      types: { EIP712Domain: [], FlashOrder: [] },
      primaryType: "FlashOrder",
      message: { salt: "1" },
    });
    expect(signed.types).toEqual({ FlashOrder: [] });
    expect(isRecord(signed.domain) && signed.domain.chainId).toBe(8453);
  });
});

describe("limit quote shape", () => {
  it("builds a Base cbBTC buy with funder", () => {
    const quote = limitBuyQuote({
      targetAsset: BASE.cbBtc,
      contraAsset: BASE.usdc,
      qtyUsdc: "3",
      limitNotionalPrice: "98000",
      funderAddress: "0x1111111111111111111111111111111111111111",
    });
    expect(quote.orderType).toBe("limit");
    expect(quote.side).toBe("buy");
    expect(quote.targetChain).toBe("base");
    expect(quote.funderAddress).toBe("0x1111111111111111111111111111111111111111");
  });
});

describe("Kernel 7702 wrap", () => {
  it("wraps signatures with sudo mode 0x00", () => {
    const inner = `0x${"ab".repeat(65)}` as `0x${string}`;
    expect(wrapKernel7702Signature(inner)).toBe(`0x00${"ab".repeat(65)}`);
    expect(isEip7702Code("0xef0100aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(true);
    expect(isEip7702Code("0x")).toBe(false);
  });
});

describe("Bankr typed-data prompt", () => {
  it("copies typed data unmodified", () => {
    const json = '{"domain":{"chainId":8453},"types":{},"primaryType":"X","message":{}}';
    const prompt = typedDataSignPrompt(json);
    expect(prompt.includes("eth_signTypedData_v4")).toBe(true);
    expect(prompt.endsWith(json)).toBe(true);
    expect(prompt.includes("Do not submit a transaction")).toBe(true);
  });

  it("extracts a 65-byte signature and not a tx hash", () => {
    const sig = `0x${"ab".repeat(65)}`;
    expect(extractSignature(`sig ${sig}`)).toBe(sig);
    expect(extractTxHash(sig)).toBeUndefined();
    expect(
      extractSignature(
        "0x725611366d7ea9790ab7852740d7403c234f2c22057eb4ef9a573d9ccfb312fe",
      ),
    ).toBe(undefined);
  });
});

describe("chat limits", () => {
  it("stays dry and points at the CLI", () => {
    const reply = handleChat("limits", loadConfig());
    expect(reply.plan.action).toBe("limits");
    expect(reply.summary.includes("Chat does not submit")).toBe(true);
    expect(reply.summary.includes("pnpm bankr:limits")).toBe(true);
  });
});

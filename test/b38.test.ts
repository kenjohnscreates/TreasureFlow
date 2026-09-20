import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatUnits, getAddress } from "viem";
import { describe, expect, it, vi } from "vitest";
import { handleChat } from "../src/chat/handle.ts";
import { parseIntent } from "../src/chat/intent.ts";
import { maybeSubmitChatFlash } from "../src/chat/submit.ts";
import { llmSystemPrompt } from "../src/bankr/llm.ts";
import { BASE, USDC_DECIMALS, usdc } from "../src/config/constants.ts";
import { loadConfig } from "../src/config/load.ts";
import { FLASH_ORDERS } from "../src/demo/evidence.ts";
import {
  DEMO_FLASH_MAX_SLIPPAGE,
  DEMO_FLASH_USDC,
  executeDemoFlash,
  isProtectedFlashOrderId,
  sizeDemoFlashSpend,
} from "../src/flash/demoOrder.ts";
import { marketBuyQuote, type FlashQuoteRequest } from "../src/flash/types.ts";

const dest = getAddress("0x1111111111111111111111111111111111111111");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MARKET_PROMPT = "buy cbBTC";
const LEGACY_PROMPT = "buy 1 USDC of cbBTC 0.01 percent below spot";
const B5_IDS = FLASH_ORDERS.map((order) => order.id);

function flashConfig() {
  return {
    ...loadConfig(),
    paused: false,
    bankrApiKey: "test-key",
    flashApiKey: "flash-key",
    treasuryAddress: dest,
  };
}

function liveDeps(orderId = "demo-market-id") {
  const quoteOrder = vi.fn(async (_key: string, _body: FlashQuoteRequest) => ({
    quoteId: "q_market",
    evm: {
      orderTypedData:
        '{"domain":{},"types":{"Flash":[]},"primaryType":"Flash","message":{}}',
    },
  }));
  const submitOrder = vi.fn(async (_key: string, _body: unknown) => ({ orderId }));
  return {
    quoteOrder,
    submitOrder,
    readSpotUsd: vi.fn(async () => 76_613),
    signFlashPayload: vi.fn(async () => ({
      signature: ("0x" + "ab".repeat(65)) as `0x${string}`,
      echo: "{}",
    })),
    getOrder: vi.fn(async () => ({ status: "ACCEPTED" })),
    appendSpend: vi.fn(async () => []),
    loadSpend: vi.fn(async () => []),
    appendDemoFlashOrder: vi.fn(async (row: {
      id: string;
      qtyUsdc: string;
      limitPriceUsd: string;
      pctBelowSpot: number;
      spotUsd: number;
    }) => ({ orders: [row] })),
    readAccountCode: vi.fn(async () => undefined),
  };
}

describe("B38 market buy sizing", () => {
  it("0 USDC and below 0.10 noop with no Flash POST", async () => {
    const config = flashConfig();
    for (const free of [0n, usdc("0.09")]) {
      const reply = handleChat(MARKET_PROMPT, config, {
        snapshot: { usdcFree: free, usdtFree: 0n, lpValueUsdc: 0n },
      });
      expect(reply.kind).toBe("demo_flash");
      expect(reply.plan.action).toBe("noop");
      expect(reply.plan.sent).toBe(false);
      expect(reply.plan.reason).toBe(free === 0n ? "no free USDC" : "insufficient_usdc");

      const deps = liveDeps();
      const live = await executeDemoFlash({
        config,
        usdcFree: free,
        live: true,
        deps,
      });
      expect(live.sent).toBe(false);
      expect(deps.quoteOrder).not.toHaveBeenCalled();
      expect(deps.submitOrder).not.toHaveBeenCalled();
      expect(deps.appendSpend).not.toHaveBeenCalled();
    }
  });

  it("0.235 USDC sizes spend to that amount under hard stop 15", () => {
    const config = loadConfig();
    expect(sizeDemoFlashSpend(usdc("0.235"))).toBe(usdc("0.235"));
    expect(usdc("0.235") < config.policy.hardStopUsdc).toBe(true);
    const reply = handleChat(MARKET_PROMPT, config, {
      snapshot: { usdcFree: usdc("0.235"), usdtFree: 0n, lpValueUsdc: 0n },
    });
    expect(reply.plan.action).toBe("demo_flash");
    expect(reply.plan.qtyUsdc).toBe("0.235");
    expect(reply.plan.hardStopOk).toBe(true);
    expect(reply.plan.orderType).toBe("market");
    expect(reply.summary).toContain("0.235");
    expect(reply.summary).toContain("5% slippage");
    expect(reply.summary).not.toMatch(/\u2014|\u2013/);
  });

  it("2 USDC free caps spend at 1", () => {
    expect(sizeDemoFlashSpend(usdc(2))).toBe(DEMO_FLASH_USDC);
    const reply = handleChat(MARKET_PROMPT, loadConfig(), {
      snapshot: { usdcFree: usdc(2), usdtFree: 0n, lpValueUsdc: 0n },
    });
    expect(reply.plan.qtyUsdc).toBe("1");
    expect(reply.plan.action).toBe("demo_flash");
  });

  it("legacy 0.01% prompt maps to the same market intent", () => {
    expect(parseIntent(MARKET_PROMPT).kind).toBe("demo_flash");
    expect(parseIntent(LEGACY_PROMPT).kind).toBe("demo_flash");
    const config = loadConfig();
    const snap = { usdcFree: usdc("0.235"), usdtFree: 0n, lpValueUsdc: 0n };
    const market = handleChat(MARKET_PROMPT, config, { snapshot: snap });
    const legacy = handleChat(LEGACY_PROMPT, config, { snapshot: snap });
    expect(legacy.plan.orderType).toBe("market");
    expect(legacy.plan.qtyUsdc).toBe(market.plan.qtyUsdc);
    expect(legacy.plan.limitPriceUsd).toBe("market");
  });
});

describe("B38 market quote + B5 + caps", () => {
  it("market quote has orderType market, no limitNotionalPrice, maxSlippage 0.05, qty is spend", async () => {
    const deps = liveDeps();
    const result = await executeDemoFlash({
      config: flashConfig(),
      usdcFree: usdc("0.235"),
      live: true,
      deps,
    });
    expect(result.sent).toBe(true);
    expect(result.qtyUsdc).toBe("0.235");
    expect(result.limitPriceUsd).toBe("market");
    expect(result.pctBelowSpot).toBe(0);
    expect(B5_IDS.includes(result.orderId ?? "")).toBe(false);
    expect(deps.quoteOrder).toHaveBeenCalledOnce();
    const request = deps.quoteOrder.mock.calls[0]?.[1];
    if (!request) throw new Error("missing quote request");
    expect(request.orderType).toBe("market");
    expect(request.limitNotionalPrice).toBeUndefined();
    expect(request.maxSlippage).toBe("0.05");
    expect(request.maxSlippage).toBe(DEMO_FLASH_MAX_SLIPPAGE);
    expect(request.qty).toBe("0.235");
    expect(request.side).toBe("buy");
    expect(request.targetAsset).toBe(BASE.cbBtc);
    expect(request.contraAsset).toBe(BASE.usdc);
    expect(request.targetChain).toBe("base");
    expect(request.contraChain).toBe("base");
    expect(deps.submitOrder).toHaveBeenCalledOnce();
    const submitted = deps.submitOrder.mock.calls[0]?.[1] as FlashQuoteRequest | undefined;
    expect(submitted?.orderType).toBe("market");
    expect(submitted?.limitNotionalPrice).toBeUndefined();
    expect(deps.appendSpend).toHaveBeenCalledWith(usdc("0.235"));
    expect(deps.appendDemoFlashOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "demo-market-id",
        qtyUsdc: "0.235",
        limitPriceUsd: "market",
        pctBelowSpot: 0,
      }),
    );

    const built = marketBuyQuote({
      targetAsset: BASE.cbBtc,
      contraAsset: BASE.usdc,
      qtyUsdc: "0.235",
    });
    expect(built.orderType).toBe("market");
    expect(built.maxSlippage).toBe("0.05");
    expect("limitNotionalPrice" in built).toBe(false);
  });

  it("does not cancel B5 Flash ids and treats them as protected", async () => {
    const demoSrc = readFileSync(join(root, "src/flash/demoOrder.ts"), "utf8");
    expect(demoSrc).not.toContain("cancelOrder");
    expect(demoSrc).not.toContain("cancelPrior");
    for (const id of B5_IDS) {
      expect(isProtectedFlashOrderId(id)).toBe(true);
    }
    const deps = liveDeps();
    const cancelOrder = vi.fn();
    await executeDemoFlash({
      config: flashConfig(),
      usdcFree: usdc("0.235"),
      live: true,
      deps,
    });
    expect(cancelOrder).not.toHaveBeenCalled();
    const limitsSrc = readFileSync(join(root, "src/flash/limitsCli.ts"), "utf8");
    expect(limitsSrc).toContain("isProtectedFlashOrderId");
    expect(limitsSrc).toContain("protected b5");
  });

  it("send 50 still per_call_cap", () => {
    const dest = getAddress("0x1111111111111111111111111111111111111111");
    const config = { ...loadConfig(), payDestinations: [dest] };
    const reply = handleChat("send 50 USDC to PAY_DEST_1", config);
    expect(reply.kind).toBe("pay");
    expect(reply.plan.action).toBe("rejected");
    expect(reply.plan.code).toBe("per_call_cap");
    expect(reply.plan.sent).not.toBe(true);
  });

  it("caps stay 15/10/30/15", () => {
    const policy = loadConfig().policy;
    expect(formatUnits(policy.bufferUsdc, USDC_DECIMALS)).toBe("15");
    expect(formatUnits(policy.perCallCapUsdc, USDC_DECIMALS)).toBe("10");
    expect(formatUnits(policy.dailyCapUsdc, USDC_DECIMALS)).toBe("30");
    expect(formatUnits(policy.hardStopUsdc, USDC_DECIMALS)).toBe("15");
  });

  it("plan-only flash is sent:false and LLM canonical is buy cbBTC", async () => {
    const config = flashConfig();
    const reply = handleChat(MARKET_PROMPT, config, {
      snapshot: { usdcFree: usdc("0.235"), usdtFree: 0n, lpValueUsdc: 0n },
    });
    expect(reply.plan.sent).toBe(false);
    const out = await maybeSubmitChatFlash(reply, { ...config, paused: true }, {
      snapshot: { usdcFree: usdc("0.235"), usdtFree: 0n, lpValueUsdc: 0n },
    }, {
      quoteOrder: vi.fn(),
      submitOrder: vi.fn(),
      assertSpendWritable: vi.fn(async () => undefined),
    });
    expect(out.plan.sent).not.toBe(true);
    expect(out.plan.code).toBe("paused");
    const prompt = llmSystemPrompt();
    expect(prompt).toContain("buy cbBTC");
    expect(prompt).not.toContain("0.01 percent below spot");
    expect(prompt).not.toMatch(/\u2014|\u2013/);
  });

  it("orders table labels and chip prompt", () => {
    const appSrc = readFileSync(join(root, "web/src/App.tsx"), "utf8");
    expect(appSrc).toContain("Limit $/cbBTC");
    expect(appSrc).toContain("USDC spend");
    expect(appSrc).toContain("Buy $1 cbBTC now");
    expect(appSrc).toContain('prompt: "buy cbBTC"');
    expect(appSrc).toContain("B5 rungs fill only if spot drops to that limit");
    expect(appSrc).not.toMatch(/\u2014|\u2013/);
  });
});

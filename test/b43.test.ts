import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatUnits, getAddress } from "viem";
import { describe, expect, it, vi } from "vitest";
import { handleChat } from "../src/chat/handle.ts";
import { parseIntent } from "../src/chat/intent.ts";
import { wouldSubmitChat } from "../src/chat/hosting.ts";
import { maybeSubmitChatFlash } from "../src/chat/submit.ts";
import { llmSystemPrompt } from "../src/bankr/llm.ts";
import { USDC_DECIMALS, usdc } from "../src/config/constants.ts";
import { loadConfig } from "../src/config/load.ts";
import { FLASH_ORDERS } from "../src/demo/evidence.ts";
import {
  DEMO_DIP_PCT_BELOW,
  DEMO_FLASH_USDC,
  demoFlashLimitPrice,
  executeDemoFlash,
  isProtectedFlashOrderId,
} from "../src/flash/demoOrder.ts";
import type { FlashQuoteRequest } from "../src/flash/types.ts";

const dest = getAddress("0x1111111111111111111111111111111111111111");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIP_PROMPT = "buy the dip";
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

function liveDeps(orderId = "demo-dip-id") {
  const quoteOrder = vi.fn(async (_key: string, _body: FlashQuoteRequest) => ({
    quoteId: "q_dip",
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
    assertSpendWritable: vi.fn(async () => undefined),
  };
}

describe("B43 buy-the-dip Flash limit from chat", () => {
  it("parses buy the dip as a 2% limit, not a market buy", () => {
    expect(parseIntent(DIP_PROMPT).kind).toBe("dip_flash");
    expect(parseIntent("buy dip").kind).toBe("dip_flash");
    expect(parseIntent("buy cbBTC").kind).toBe("demo_flash");
    const config = flashConfig();
    const reply = handleChat(DIP_PROMPT, config, {
      snapshot: { usdcFree: usdc("0.235"), usdtFree: 0n, lpValueUsdc: 0n },
      spotUsd: 76_613,
    });
    expect(reply.kind).toBe("dip_flash");
    expect(reply.plan.action).toBe("dip_flash");
    expect(reply.plan.orderType).toBe("limit");
    expect(reply.plan.pctBelowSpot).toBe(DEMO_DIP_PCT_BELOW);
    expect(reply.plan.qtyUsdc).toBe("0.235");
    expect(reply.plan.limitPriceUsd).toBe(
      demoFlashLimitPrice(76613, DEMO_DIP_PCT_BELOW).toFixed(2),
    );
    expect(reply.summary).toContain(`${DEMO_DIP_PCT_BELOW}% below spot`);
    expect(reply.summary).toContain("Confirm to submit");
    expect(wouldSubmitChat(reply)).toBe(true);
  });

  it("0 / <0.10 USDC noop with no Flash POST", async () => {
    const config = flashConfig();
    for (const free of [0n, usdc("0.09")]) {
      const reply = handleChat(DIP_PROMPT, config, {
        snapshot: { usdcFree: free, usdtFree: 0n, lpValueUsdc: 0n },
      });
      expect(reply.plan.action).toBe("noop");
      const deps = liveDeps();
      const live = await executeDemoFlash({
        config,
        usdcFree: free,
        live: true,
        mode: "limit",
        deps,
      });
      expect(live.sent).toBe(false);
      expect(deps.quoteOrder).not.toHaveBeenCalled();
    }
  });

  it("quotes a limit 0.001% below spot and does not reuse B5 ids", async () => {
    const config = flashConfig();
    const deps = liveDeps();
    const live = await executeDemoFlash({
      config,
      usdcFree: usdc("0.235"),
      live: true,
      mode: "limit",
      deps,
    });
    expect(live.sent).toBe(true);
    expect(live.pctBelowSpot).toBe(DEMO_DIP_PCT_BELOW);
    expect(live.limitPriceUsd).toBe(
      demoFlashLimitPrice(76613, DEMO_DIP_PCT_BELOW).toFixed(2),
    );
    expect(deps.quoteOrder).toHaveBeenCalledOnce();
    const body = deps.quoteOrder.mock.calls[0]?.[1] as FlashQuoteRequest;
    expect(body.orderType).toBe("limit");
    expect(body.qty).toBe("0.235");
    expect(body.limitNotionalPrice).toBe(
      demoFlashLimitPrice(76613, DEMO_DIP_PCT_BELOW).toFixed(2),
    );
    expect(body.maxSlippage).toBeUndefined();
    expect(body.funderAddress).toBe(dest);
    expect(B5_IDS.every((id) => isProtectedFlashOrderId(id))).toBe(true);
    expect(isProtectedFlashOrderId(live.orderId ?? "")).toBe(false);
    const reply = handleChat(DIP_PROMPT, config, {
      snapshot: { usdcFree: usdc("0.235"), usdtFree: 0n, lpValueUsdc: 0n },
      spotUsd: 76_613,
    });
    const submitted = await maybeSubmitChatFlash(reply, config, {
      snapshot: { usdcFree: usdc("0.235"), usdtFree: 0n, lpValueUsdc: 0n },
    }, liveDeps("demo-dip-id"));
    expect(submitted.kind).toBe("dip_flash");
    expect(submitted.plan.sent).toBe(true);
    expect(submitted.plan.orderType).toBe("limit");
  });

  it("spends 1 USDC when free USDC is at least 1", async () => {
    const config = flashConfig();
    const reply = handleChat(DIP_PROMPT, config, {
      snapshot: { usdcFree: usdc(5), usdtFree: 0n, lpValueUsdc: 0n },
      spotUsd: 76_613,
    });
    expect(reply.plan.qtyUsdc).toBe(formatUnits(DEMO_FLASH_USDC, USDC_DECIMALS));
    const deps = liveDeps();
    await executeDemoFlash({
      config,
      usdcFree: usdc(5),
      live: true,
      mode: "limit",
      deps,
    });
    const body = deps.quoteOrder.mock.calls[0]?.[1] as FlashQuoteRequest;
    expect(body.qty).toBe("1");
    expect(body.funderAddress).toBe(dest);
  });

  it("chip, LLM, and B5 ids stay", () => {
    const app = readFileSync(join(root, "web/src/App.tsx"), "utf8");
    expect(app).toContain("Buy the dip $1");
    expect(app).toContain('prompt: "buy the dip"');
    expect(app).toContain("0.001% below spot");
    expect(app).toContain("Buy $1 cbBTC now");
    expect(llmSystemPrompt()).toContain("buy the dip");
    expect(B5_IDS).toEqual([
      "7863b457-c132-4f6d-bc01-0925dd32d6ee",
      "afcc2cb5-e93b-4565-98be-6fe60bc8c744",
      "296280cb-3ba3-466f-96e6-f0f018fea652",
    ]);
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

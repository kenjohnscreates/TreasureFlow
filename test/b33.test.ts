import { unlink } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHAT_KEY_HEADER,
  CHAT_NONCE_HEADER,
  CHAT_SIG_HEADER,
} from "../src/chat/agentUrl.ts";
import { issueChallenge } from "../src/chat/founderAuth.ts";
import { handleChat } from "../src/chat/handle.ts";
import { chatKeyGate } from "../src/chat/hosting.ts";
import { app } from "../src/chat/http.ts";
import {
  maybeSubmitChat,
  maybeSubmitChatFlash,
  maybeSubmitChatLp,
  maybeSubmitChatSweep,
} from "../src/chat/submit.ts";
import { usdc } from "../src/config/constants.ts";
import { loadConfig } from "../src/config/load.ts";
import { FLASH_ORDERS } from "../src/demo/evidence.ts";
import {
  DEMO_FLASH_USDC,
  demoFlashLimitPrice,
  executeDemoFlash,
  isProtectedFlashOrderId,
} from "../src/flash/demoOrder.ts";
import { parseFlashFilledQty } from "../src/flash/parse.ts";
import { executeSweep } from "../src/bankr/sweepLive.ts";

const dest = getAddress("0x1111111111111111111111111111111111111111");
const founder = privateKeyToAccount(generatePrivateKey());
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEMO_PROMPT = "buy 1 USDC of cbBTC 0.01 percent below spot";
const B5_IDS = FLASH_ORDERS.map((order) => order.id);

const saved = {
  VERCEL: process.env.VERCEL,
  CHAT_KEY: process.env.CHAT_KEY,
  FOUNDER_ADDRESS: process.env.FOUNDER_ADDRESS,
  BANKR_API_KEY: process.env.BANKR_API_KEY,
  FLASH_API_KEY: process.env.FLASH_API_KEY,
  PAUSED: process.env.PAUSED,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function blankLiveKeys() {
  process.env.BANKR_API_KEY = "";
  process.env.FLASH_API_KEY = "";
}

describe("B33 submit gate", () => {
  beforeEach(async () => {
    blankLiveKeys();
    await unlink(".data/challenge.json").catch(() => undefined);
    await unlink("/tmp/treasureflow-challenge.json").catch(() => undefined);
  });
  afterEach(async () => {
    await unlink(".data/challenge.json").catch(() => undefined);
    await unlink("/tmp/treasureflow-challenge.json").catch(() => undefined);
    restoreEnv();
  });

  it("plan-only POST /chat without key returns sent:false for sweep/lp/flash", async () => {
    process.env.PAUSED = "false";
    for (const prompt of ["sweep", "lp stocks", DEMO_PROMPT]) {
      const res = await app.request("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        plan: { sent?: boolean; action?: string };
      };
      expect(body.plan.action).not.toBe("rejected");
      expect(body.plan.sent).not.toBe(true);
    }
  });

  it("confirm without founder sig is 401 when FOUNDER_ADDRESS is set", async () => {
    process.env.CHAT_KEY = "unit-test-key";
    process.env.FOUNDER_ADDRESS = founder.address;
    process.env.PAUSED = "false";
    const res = await app.request("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CHAT_KEY_HEADER]: "unit-test-key",
      },
      body: JSON.stringify({ prompt: "sweep" }),
    });
    expect(res.status).toBe(401);
  });

  it("Vercel missing CHAT_KEY with a submit header is 401", () => {
    const env = { VERCEL: "1" };
    const sweep = { kind: "sweep", plan: { action: "noop" } };
    expect(chatKeyGate(sweep, "x", "", env)).toMatchObject({ ok: false, status: 401 });
    expect(chatKeyGate(sweep, undefined, "", env)).toEqual({ ok: true, submit: false });
  });

  it("Vercel missing FOUNDER_ADDRESS is 401 on confirm", async () => {
    process.env.VERCEL = "1";
    process.env.CHAT_KEY = "unit-test-key";
    process.env.FOUNDER_ADDRESS = "";
    process.env.PAUSED = "false";
    const res = await app.request("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CHAT_KEY_HEADER]: "unit-test-key",
      },
      body: JSON.stringify({ prompt: "sweep" }),
    });
    expect(res.status).toBe(401);
  });

  it("confirm with key + founder sig of challenge is allowed", async () => {
    process.env.CHAT_KEY = "unit-test-key";
    process.env.FOUNDER_ADDRESS = founder.address;
    process.env.PAUSED = "false";
    const challenge = await issueChallenge();
    const sig = await founder.signMessage({ message: challenge.message });
    const res = await app.request("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CHAT_KEY_HEADER]: "unit-test-key",
        [CHAT_NONCE_HEADER]: challenge.nonce,
        [CHAT_SIG_HEADER]: sig,
      },
      body: JSON.stringify({ prompt: "sweep" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { plan: { sent?: boolean; action?: string } };
    expect(body.plan.sent).not.toBe(true);
    expect(body.plan.action).toBe("noop");
  });
});

describe("B33 pause, hard stop, 0 USDC, B5", () => {
  it("does not submit sweep/lp/flash when paused", async () => {
    const config = {
      ...loadConfig(),
      paused: true,
      bankrApiKey: "test-key",
      flashApiKey: "flash-key",
      treasuryAddress: dest,
    };
    const deps = {
      quoteAddLiquidity: vi.fn(),
      submitSkillTx: vi.fn(),
      submitOrder: vi.fn(),
      quoteOrder: vi.fn(),
      runEntry: vi.fn(),
      fetchNvdaQuote: vi.fn(),
      assertSpendWritable: vi.fn(async () => undefined),
    };
    const sweep = handleChat("sweep", config, {
      snapshot: { usdcFree: usdc(55), usdtFree: usdc(40), lpValueUsdc: 0n },
    });
    expect(sweep.plan.action).toBe("rejected");
    expect(sweep.plan.code).toBe("paused");
    const sweepOut = await maybeSubmitChatSweep(
      { kind: "sweep", summary: "plan", plan: { action: "add_liquidity", sent: false } },
      config,
      { snapshot: { usdcFree: usdc(55), usdtFree: usdc(40), lpValueUsdc: 0n } },
      deps,
    );
    expect(deps.submitSkillTx).not.toHaveBeenCalled();
    expect(deps.quoteAddLiquidity).not.toHaveBeenCalled();
    expect(sweepOut.plan.code).toBe("paused");

    const lp = handleChat("lp stocks", config);
    expect(lp.plan.action).toBe("rejected");
    const lpOut = await maybeSubmitChatLp(
      { kind: "lp_stocks", summary: "plan", plan: { action: "lp_stocks", sent: false } },
      config,
      { snapshot: { usdcFree: usdc(55), usdtFree: 0n, lpValueUsdc: 0n } },
      deps,
    );
    expect(deps.runEntry).not.toHaveBeenCalled();
    expect(lpOut.plan.code).toBe("paused");

    const flash = handleChat(DEMO_PROMPT, config, {
      snapshot: { usdcFree: usdc(20), usdtFree: 0n, lpValueUsdc: 0n },
      spotUsd: 100_000,
    });
    expect(flash.plan.action).toBe("rejected");
    const flashOut = await maybeSubmitChatFlash(
      {
        kind: "demo_flash",
        summary: "plan",
        plan: { action: "demo_flash", sent: false },
      },
      config,
      { snapshot: { usdcFree: usdc(20), usdtFree: 0n, lpValueUsdc: 0n } },
      deps,
    );
    expect(deps.submitOrder).not.toHaveBeenCalled();
    expect(deps.quoteOrder).not.toHaveBeenCalled();
    expect(flashOut.plan.code).toBe("paused");
  });

  it("keeps $1 demo flash under the 15 USDC hard stop", () => {
    const config = loadConfig();
    expect(DEMO_FLASH_USDC < config.policy.hardStopUsdc).toBe(true);
    expect(DEMO_FLASH_USDC).toBe(usdc(1));
    const reply = handleChat(DEMO_PROMPT, config, {
      snapshot: { usdcFree: usdc(20), usdtFree: 0n, lpValueUsdc: 0n },
      spotUsd: 100_000,
    });
    expect(reply.plan.hardStopOk).toBe(true);
    expect(reply.plan.qtyUsdc).toBe("1");
    expect(reply.plan.pctBelowSpot).toBe(0.01);
    expect(reply.plan.limitPriceUsd).toBe(demoFlashLimitPrice(100_000).toFixed(2));
    expect(reply.summary).toContain("No performance claim");
    expect(reply.summary).not.toMatch(/\u2014|\u2013/);
  });

  it("0 USDC sweep is a noop and does not fake addLiquidity", async () => {
    const config = {
      ...loadConfig(),
      paused: false,
      bankrApiKey: "test-key",
      treasuryAddress: dest,
    };
    const reply = handleChat("sweep", config, {
      snapshot: { usdcFree: 0n, usdtFree: 0n, lpValueUsdc: 0n },
    });
    expect(reply.plan.action).toBe("noop");
    expect(reply.plan.sent).toBe(false);
    const deps = {
      quoteAddLiquidity: vi.fn(),
      submitSkillTx: vi.fn(),
      appendSpend: vi.fn(),
      persistSweep: vi.fn(),
      loadSpend: vi.fn(async () => []),
      assertSpendWritable: vi.fn(async () => undefined),
    };
    const out = await maybeSubmitChatSweep(reply, config, {
      snapshot: { usdcFree: 0n, usdtFree: 0n, lpValueUsdc: 0n },
    }, deps);
    expect(deps.quoteAddLiquidity).not.toHaveBeenCalled();
    expect(deps.submitSkillTx).not.toHaveBeenCalled();
    expect(out.plan.sent).toBe(false);
    expect(out.plan.action).toBe("noop");
    expect(out.summary).toMatch(/noop|Nothing to sweep/i);

    const live = await executeSweep({
      config,
      snapshot: { usdcFree: 0n, usdtFree: 0n, lpValueUsdc: 0n },
      live: true,
      deps,
    });
    expect(live.sent).toBe(false);
    expect(live.sized.action).toBe("noop");
    expect(deps.quoteAddLiquidity).not.toHaveBeenCalled();
  });

  it("does not cancel B5 Flash ids from the demo path", async () => {
    const demoSrc = readFileSync(join(root, "src/flash/demoOrder.ts"), "utf8");
    expect(demoSrc).not.toContain("cancelOrder");
    expect(demoSrc).not.toContain("cancelPrior");
    for (const id of B5_IDS) {
      expect(isProtectedFlashOrderId(id)).toBe(true);
    }
    const config = {
      ...loadConfig(),
      paused: false,
      bankrApiKey: "test-key",
      flashApiKey: "flash-key",
      treasuryAddress: dest,
    };
    const cancelOrder = vi.fn();
    const deps = {
      readSpotUsd: vi.fn(async () => 100_000),
      quoteOrder: vi.fn(async () => ({
        quoteId: "q_demo",
        evm: {
          orderTypedData:
            '{"domain":{},"types":{"Flash":[]},"primaryType":"Flash","message":{}}',
        },
      })),
      signFlashPayload: vi.fn(async () => ({
        signature: ("0x" + "ab".repeat(65)) as `0x${string}`,
        echo: "{}",
      })),
      submitOrder: vi.fn(async () => ({ orderId: "demo-order-id" })),
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
    const result = await executeDemoFlash({
      config,
      usdcFree: usdc(5),
      live: true,
      deps,
    });
    expect(result.sent).toBe(true);
    expect(result.orderId).toBe("demo-order-id");
    expect(B5_IDS.includes(result.orderId ?? "")).toBe(false);
    expect(cancelOrder).not.toHaveBeenCalled();
    expect(deps.submitOrder).toHaveBeenCalledOnce();
    const limitsSrc = readFileSync(join(root, "src/flash/limitsCli.ts"), "utf8");
    expect(limitsSrc).toContain("isProtectedFlashOrderId");
    expect(limitsSrc).toContain("protected b5");
  });

  it("parses filled qty only when Flash JSON has it", () => {
    expect(parseFlashFilledQty({ order: { status: "ACCEPTED" } })).toBeUndefined();
    expect(
      parseFlashFilledQty({
        order: { filled: { contraAmount: "0.4", targetAmount: "0.00001" } },
      }),
    ).toBe("0.4");
    expect(parseFlashFilledQty({ executedQty: "0.2" })).toBe("0.2");
    expect(parseFlashFilledQty({})).toBeUndefined();
  });

  it("maybeSubmitChat routes sweep noop without Bankr add", async () => {
    const config = { ...loadConfig(), paused: false, bankrApiKey: "test-key" };
    const reply = handleChat("sweep", config, {
      snapshot: { usdcFree: 0n, usdtFree: 0n, lpValueUsdc: 0n },
    });
    const out = await maybeSubmitChat("sweep", reply, config, {
      snapshot: { usdcFree: 0n, usdtFree: 0n, lpValueUsdc: 0n },
    }, {
      submitSkillTx: vi.fn(),
      quoteAddLiquidity: vi.fn(),
      assertSpendWritable: vi.fn(async () => undefined),
    });
    expect(out.plan.sent).toBe(false);
    expect(out.kind).toBe("sweep");
  });
});

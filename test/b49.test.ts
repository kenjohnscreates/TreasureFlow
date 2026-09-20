import { getAddress } from "viem";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { discoverIncreaseTokenIdResilient } from "../src/aerodrome/slipstream.ts";
import { executeLp } from "../src/bankr/lpLive.ts";
import { chatLiveOpts } from "../src/chat/reads.ts";
import { handleChat } from "../src/chat/handle.ts";
import { loadConfig } from "../src/config/load.ts";
import { SLIPSTREAM_NVDA_NFT_ID } from "../src/demo/evidence.ts";
import { usdc } from "../src/config/constants.ts";
const root = join(import.meta.dirname, "..");
const treasury = getAddress("0x1111111111111111111111111111111111111111");
const INCREASE_ID = SLIPSTREAM_NVDA_NFT_ID;

function lpConfig() {
  return {
    ...loadConfig(),
    paused: false,
    bankrApiKey: "test-key",
    treasuryAddress: treasury,
    baseRpcUrl: "http://127.0.0.1:8545",
  };
}

function planFlags(runEntry: ReturnType<typeof vi.fn>): Record<string, string> {
  const call = runEntry.mock.calls.find((c) => c[0] === "plan");
  return (call?.[1] as Record<string, string>) ?? {};
}

describe("B49 lp stocks Slipstream discovery retry", () => {
  it("handleChat with slipstream #6356494 plans increase, not mint", () => {
    const plan = handleChat("lp stocks", lpConfig(), {
      slipstream: [{ tokenId: INCREASE_ID, staked: true, usd: "10.03" }],
    });
    expect(plan.plan.mode).toBe("increase");
    expect(plan.plan.tokenId).toBe(INCREASE_ID);
    expect(plan.summary).toContain(`NFT #${INCREASE_ID}`);
    expect(plan.summary).not.toMatch(/mint/i);
  });

  it("handleChat with empty slipstream plans mint", () => {
    const plan = handleChat("lp stocks", lpConfig(), { slipstream: [] });
    expect(plan.plan.mode).toBe("mint");
    expect(plan.plan.tokenId).toBeUndefined();
    expect(plan.summary).toMatch(/Open a Slipstream NVDAc position/i);
    expect(plan.summary).not.toMatch(/NFT #/);
  });

  it("slipstreamLpsForChatPlan falls back to #6356494 when retry throws", async () => {
    const quote = await import("../src/aerodrome/quote.ts");
    vi.spyOn(quote, "withPublicRpcs").mockRejectedValue(new Error("all RPCs failed"));
    const slip = await import("../src/aerodrome/slipstream.ts");
    const rows = await slip.slipstreamLpsForChatPlan(treasury, "http://127.0.0.1:8545", "0x4c9D...a6c2");
    expect(rows[0]?.tokenId).toBe(INCREASE_ID);
    expect(rows[0]?.staked).toBe(true);
    vi.restoreAllMocks();
  });

  it("discoverIncreaseTokenIdResilient falls back to #6356494 when all RPCs fail", async () => {
    const id = await discoverIncreaseTokenIdResilient(
      treasury,
      "https://example.invalid",
      "0x4c9D...a6c2",
    );
    expect(id).toBe(INCREASE_ID);
  });

  it("executeLp uses increase when injected read throws", async () => {
    const runEntry = vi.fn(async (phase: string, flags: Record<string, string>) => {
      if (phase === "plan") {
        return {
          ok: true as const,
          phase: "plan" as const,
          report: "",
          txs: [],
          raw: { band: { tickLower: -1, tickUpper: 1 }, walletUsdc: 20 },
        };
      }
      if (phase === "size") {
        return {
          ok: true as const,
          phase: "size" as const,
          report: "",
          txs: [],
          raw: { amount0Usdc: 5 },
        };
      }
      return { ok: true as const, phase: "settle" as const, report: "", txs: [], raw: {} };
    });
    const result = await executeLp({
      config: lpConfig(),
      live: false,
      usdcFree: usdc(20),
      deps: {
        fetchNvdaQuote: vi.fn(async () => ({ price: 222, ageS: 10, source: "test" })),
        readNvdaSlipstreamLps: vi.fn(async () => {
          throw new Error("transport");
        }),
        runEntry,
        loadSpend: vi.fn(async () => []),
      },
    });
    expect(result.mode).toBe("increase");
    expect(result.tokenId).toBe(INCREASE_ID);
    expect(planFlags(runEntry)["token-id"]).toBe(INCREASE_ID);
  });

  it("chatLiveOpts populates slipstream after RPC flake (mocked portfolio)", async () => {
    const config = lpConfig();
    const snap = {
      evmAddress: treasury,
      eth: "0",
      usdc: "1",
      usdt: "0",
      nvdac: "0",
      tokenCount: 1,
    };
    const readsMod = await import("../src/chat/reads.ts");
    vi.spyOn(readsMod, "tryBankrPortfolio").mockResolvedValue(snap);

    const slipMod = await import("../src/aerodrome/slipstream.ts");
    let calls = 0;
    vi.spyOn(slipMod, "readNvdaSlipstreamLps").mockImplementation(async () => {
      calls += 1;
      if (calls === 1) throw new Error("RPC Request failed");
      return [{ tokenId: INCREASE_ID, staked: true }];
    });

    const opts = await chatLiveOpts(config, "lp stocks");
    expect(opts.slipstream?.[0]?.tokenId).toBe(INCREASE_ID);
    vi.restoreAllMocks();
  });

  it("App.tsx Confirm is Write key only; Sign deposit remains", () => {
    const appSrc = readFileSync(join(root, "web/src/App.tsx"), "utf8");
    expect(appSrc).not.toContain("signMessage");
    expect(appSrc).not.toContain("fetchChallenge");
    expect(appSrc).toContain("Write key");
    expect(appSrc).toContain("Sign deposit");
  });

  it("load.ts policy defaults stay 15 / 10 / 30 / 15", () => {
    const { policy } = loadConfig();
    expect(policy.bufferUsdc).toBe(usdc(15));
    expect(policy.perCallCapUsdc).toBe(usdc(10));
    expect(policy.dailyCapUsdc).toBe(usdc(30));
    expect(policy.hardStopUsdc).toBe(usdc(15));
  });
});

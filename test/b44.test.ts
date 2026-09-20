import { encodeFunctionData, getAddress } from "viem";
import { describe, expect, it, vi } from "vitest";
import { SLIPSTREAM_NPM_ABI } from "../src/aerodrome/abi.ts";
import { pickIncreaseTokenId } from "../src/aerodrome/slipstream.ts";
import { executeLp } from "../src/bankr/lpLive.ts";
import { maybeSubmitChatLp } from "../src/chat/submit.ts";
import { handleChat } from "../src/chat/handle.ts";
import { BASE, usdc } from "../src/config/constants.ts";
import { loadConfig } from "../src/config/load.ts";
import { SLIPSTREAM_NVDA_NFT_ID } from "../src/demo/evidence.ts";
import { DEMO_LP_USD, parseSkillTx, type SkillTx } from "../src/bankr/skillTx.ts";
import type { SkillResult } from "../src/bankr/skill.ts";

const dest = getAddress("0x1111111111111111111111111111111111111111");
const INCREASE_ID = SLIPSTREAM_NVDA_NFT_ID;

function lpConfig() {
  return {
    ...loadConfig(),
    paused: false,
    bankrApiKey: "test-key",
    treasuryAddress: dest,
    baseRpcUrl: "http://127.0.0.1:8545",
  };
}

function increaseCalldata(tokenId = BigInt(INCREASE_ID)): `0x${string}` {
  return encodeFunctionData({
    abi: SLIPSTREAM_NPM_ABI,
    functionName: "increaseLiquidity",
    args: [
      {
        tokenId,
        amount0Desired: 5_000_000n,
        amount1Desired: 160_000n,
        amount0Min: 0n,
        amount1Min: 0n,
        deadline: 1_755_800_000n,
      },
    ],
  });
}

const increaseTx: SkillTx = parseSkillTx({
  to: BASE.slipstreamNpmEquity,
  data: increaseCalldata(),
  value: "0",
  chainId: 8453,
  label: "increase NVDA position $10.00 at $209.38 - $228.86",
});

const mintTx: SkillTx = parseSkillTx({
  to: BASE.slipstreamNpmEquity,
  data: "0xb5007d1f000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  value: "0",
  chainId: 8453,
  label: "mint NVDA position $10.00 at $209.38 - $228.86",
});

function skill(phase: string, txs: SkillTx[], raw: Record<string, unknown>): SkillResult {
  return {
    ok: true,
    phase: phase as SkillResult["phase"],
    report: "",
    txs,
    raw,
  };
}

describe("B44 increase existing Slipstream NFT", () => {
  it("encodes increaseLiquidity as selector 0x219f5d17 with 6 words and tokenId 6356494", () => {
    const data = increaseCalldata();
    expect(data.slice(0, 10)).toBe("0x219f5d17");
    expect((data.length - 2) / 2).toBe(4 + 6 * 32);
    expect(BigInt("0x" + data.slice(10, 74))).toBe(6356494n);
  });

  it("prefers #6356494 when several live NFTs exist", () => {
    expect(
      pickIncreaseTokenId([
        { tokenId: "99", staked: false },
        { tokenId: INCREASE_ID, staked: true },
      ]),
    ).toBe(INCREASE_ID);
    expect(pickIncreaseTokenId([])).toBeUndefined();
    expect(pickIncreaseTokenId([{ tokenId: "77", staked: false }])).toBe("77");
  });

  it("increases #6356494 with no mint label and no gauge deposit", async () => {
    const submitted: string[] = [];
    const runEntry = vi.fn(async (phase: string) => {
      if (phase === "plan") {
        return skill("plan", [], {
          band: { tickLower: -12000, tickUpper: -11000 },
          walletUsdc: 20,
        });
      }
      if (phase === "size") {
        expect(runEntry.mock.calls.some((c) => c[1]?.["token-id"] === INCREASE_ID)).toBe(true);
        expect(increaseTx.label.startsWith("mint ")).toBe(false);
        return skill("size", [increaseTx], { amount0Usdc: 5, amount1Stock: 0.01 });
      }
      expect(phase).toBe("settle");
      expect(runEntry.mock.calls.at(-1)?.[1]?.["token-id"]).toBe(INCREASE_ID);
      expect(runEntry.mock.calls.at(-1)?.[1]?.["mint-tx"]).toBeUndefined();
      return skill("settle", [], { tokenId: INCREASE_ID });
    });
    const result = await executeLp({
      config: lpConfig(),
      live: true,
      usdcFree: usdc(20),
      deps: {
        fetchNvdaQuote: vi.fn(async () => ({ price: 222, ageS: 10, source: "test" })),
        readNvdaSlipstreamLps: vi.fn(async () => [
          { tokenId: INCREASE_ID, staked: true, usd: "10" },
        ]),
        runEntry,
        submitSkillTx: vi.fn(async (_key: string, tx: SkillTx) => {
          submitted.push(tx.label);
          return "0x" + "ab".repeat(32) as `0x${string}`;
        }),
        loadSpend: vi.fn(async () => []),
        appendSpend: vi.fn(async () => []),
        persistLp: vi.fn(async () => undefined),
      },
    });
    expect(result.sent).toBe(true);
    expect(result.mode).toBe("increase");
    expect(result.tokenId).toBe(INCREASE_ID);
    expect(result.increaseTx).toBeDefined();
    expect(result.mintTx).toBeUndefined();
    expect(submitted.some((label) => label.startsWith("mint "))).toBe(false);
    expect(submitted.some((label) => /stake /i.test(label))).toBe(false);
    expect(submitted.some((label) => /gauge/i.test(label))).toBe(false);
  });

  it("falls back to mint when no live NFT exists", async () => {
    const runEntry = vi.fn(async (phase: string) => {
      if (phase === "plan") {
        return skill("plan", [], {
          band: { tickLower: -12000, tickUpper: -11000 },
          walletUsdc: 20,
        });
      }
      if (phase === "size") {
        expect(runEntry.mock.calls[0]?.[1]?.["token-id"]).toBeUndefined();
        return skill("size", [mintTx], { amount0Usdc: 5, amount1Stock: 0.01 });
      }
      expect(runEntry.mock.calls.at(-1)?.[1]?.["mint-tx"]).toBeDefined();
      expect(runEntry.mock.calls.at(-1)?.[1]?.["token-id"]).toBeUndefined();
      return skill("settle", [], { tokenId: "99" });
    });
    const result = await executeLp({
      config: lpConfig(),
      live: true,
      usdcFree: usdc(20),
      deps: {
        fetchNvdaQuote: vi.fn(async () => ({ price: 222, ageS: 10, source: "test" })),
        readNvdaSlipstreamLps: vi.fn(async () => []),
        runEntry,
        submitSkillTx: vi.fn(async () => ("0x" + "cd".repeat(32)) as `0x${string}`),
        loadSpend: vi.fn(async () => []),
        appendSpend: vi.fn(async () => []),
        persistLp: vi.fn(async () => undefined),
      },
    });
    expect(result.mode).toBe("mint");
    expect(result.mintTx).toBeDefined();
    expect(result.increaseTx).toBeUndefined();
    expect(result.tokenId).toBe("99");
  });

  it("chat plan names the NFT and submit copy is add-not-mint", async () => {
    const plan = handleChat("lp stocks", lpConfig(), {
      slipstream: [{ tokenId: INCREASE_ID, staked: true }],
    });
    expect(plan.plan.mode).toBe("increase");
    expect(plan.plan.tokenId).toBe(INCREASE_ID);
    expect(plan.summary).toContain(`NFT #${INCREASE_ID}`);
    expect(plan.summary).not.toMatch(/mint/i);
    expect(plan.summary).not.toMatch(/\u2014|\u2013/);

    const submitted = await maybeSubmitChatLp(
      plan,
      lpConfig(),
      { snapshot: { usdcFree: usdc(20), usdtFree: 0n, lpValueUsdc: 0n } },
      {
        fetchNvdaQuote: vi.fn(async () => ({ price: 222, ageS: 10, source: "test" })),
        readNvdaSlipstreamLps: vi.fn(async () => [
          { tokenId: INCREASE_ID, staked: true },
        ]),
        runEntry: vi.fn(async (phase: string) => {
          if (phase === "plan") {
            return skill("plan", [], {
              band: { tickLower: -1, tickUpper: 1 },
              walletUsdc: 20,
            });
          }
          if (phase === "size") {
            return skill("size", [increaseTx], { amount0Usdc: 5 });
          }
          return skill("settle", [], { tokenId: INCREASE_ID });
        }),
        submitSkillTx: vi.fn(async () => ("0x" + "ee".repeat(32)) as `0x${string}`),
        loadSpend: vi.fn(async () => []),
        appendSpend: vi.fn(async () => []),
        persistLp: vi.fn(async () => undefined),
        assertSpendWritable: vi.fn(async () => undefined),
      },
    );
    expect(submitted.summary).toBe(`Added $${DEMO_LP_USD} to NFT #${INCREASE_ID}.`);
    expect(submitted.summary).not.toMatch(/[Mm]int/);
    expect(submitted.plan.mode).toBe("increase");
    expect(submitted.plan.sent).toBe(true);
  });
});

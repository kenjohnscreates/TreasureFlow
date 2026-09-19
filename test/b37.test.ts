import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatUnits, type Address } from "viem";
import { describe, expect, it, vi } from "vitest";
import { publicTreasury, totalUsdFromLegs } from "../src/chat/reads.ts";
import { BASE, USDC_DECIMALS, usdc } from "../src/config/constants.ts";
import { loadConfig } from "../src/config/load.ts";
import { SLIPSTREAM_NVDA_NFT_ID } from "../src/demo/evidence.ts";
import { AppError } from "../src/errors.ts";
import {
  NVDA_ORACLE_MAX_AGE_S,
  ORACLE_MAX_AGE_S,
  formatUsdDecimal,
  nvdacNotionalUsd,
} from "../src/oracle/chainlink.ts";
import type { BankrPortfolioSnap } from "../src/bankr/parse.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const COINBASE_NVDA = "0x04689a41629776563E6822F76f2e57D148d28513";
const SNAP_ADDR = "0x4c9D00000000000000000000000000000000a6c2" as Address;

const SNAP: BankrPortfolioSnap = {
  evmAddress: SNAP_ADDR,
  eth: "0.01",
  usdc: "12.5",
  usdt: "2.1",
  nvdac: "0.068",
  tokenCount: 3,
};

function cfg(over: Partial<ReturnType<typeof loadConfig>> = {}) {
  return {
    ...loadConfig(),
    bankrApiKey: "test",
    flashApiKey: "",
    baseRpcUrl: "https://example.invalid",
    ...over,
  };
}

const skipChain = {
  readEthSpotUsd: async () => {
    throw new AppError("oracle_stale", "skip");
  },
  readNvdaSpotUsd: async () => {
    throw new AppError("oracle_stale", "skip");
  },
  readSammLp: async () => ({ liquidity: 0n, amountUsdc: 0n, amountUsdt: 0n }),
  readSlipstream: async () => [],
};

describe("B37 treasury total USD", () => {
  it("sums usdc + usdt + ethUsdValue + nvdacUsdValue + samm quoted + slipstream usd", async () => {
    const body = await publicTreasury(cfg(), {
      snap: SNAP,
      readEthSpotUsd: async (feed) => {
        expect(feed).toBe(BASE.ethUsdFeed);
        return 4000;
      },
      readNvdaSpotUsd: async (feed) => {
        expect(feed).toBe(BASE.nvdaUsdFeed);
        return 200;
      },
      readSammLp: async () => ({
        liquidity: 1n,
        amountUsdc: usdc("4.38"),
        amountUsdt: usdc("5"),
      }),
      readSlipstream: async () => [
        { tokenId: SLIPSTREAM_NVDA_NFT_ID, staked: true, usd: "10" },
      ],
    });
    expect(body.live).toBe(true);
    expect(body.usdc).toBe("12.5");
    expect(body.usdt).toBe("2.1");
    expect(body.ethUsdValue).toBe("40");
    expect(body.nvdacUsd).toBe("200");
    expect(body.nvdacUsdValue).toBe(nvdacNotionalUsd("0.068", 200));
    expect(body.sammLpUsdc).toBe("4.38");
    expect(body.sammLpUsdt).toBe("5");
    expect(body.slipstream).toEqual([
      { tokenId: "6356494", staked: true, usd: "10" },
    ]);
    expect(body.totalUsd).toBe(
      totalUsdFromLegs([
        "12.5",
        "2.1",
        "40",
        body.nvdacUsdValue,
        "4.38",
        "5",
        "10",
      ]),
    );
    expect(body.totalUsd).toBe(
      formatUsdDecimal(12.5 + 2.1 + 40 + Number(body.nvdacUsdValue) + 4.38 + 5 + 10),
    );
    expect(JSON.stringify(body)).not.toMatch(/0x[a-fA-F0-9]{40}/);
  });

  it("omits a missing oracle leg and still sums the rest", async () => {
    const body = await publicTreasury(cfg(), {
      snap: SNAP,
      readEthSpotUsd: async () => 4000,
      readNvdaSpotUsd: async () => {
        throw new AppError("oracle_stale", "Chainlink answer is stale");
      },
      readSammLp: async () => ({
        liquidity: 1n,
        amountUsdc: usdc("4.38"),
        amountUsdt: usdc("5"),
      }),
      readSlipstream: async () => [
        { tokenId: SLIPSTREAM_NVDA_NFT_ID, staked: true, usd: "10" },
      ],
    });
    expect(body.nvdacUsd).toBeUndefined();
    expect(body.nvdacUsdValue).toBeUndefined();
    expect(body.ethUsdValue).toBe("40");
    expect(body.sammLpUsdc).toBe("4.38");
    expect(body.totalUsd).toBe(totalUsdFromLegs(["12.5", "2.1", "40", "4.38", "5", "10"]));
    expect(body.nvdac).toBe("0.068");
  });

  it("omits totalUsd when live:false", async () => {
    const body = await publicTreasury(cfg({ bankrApiKey: "" }), skipChain);
    expect(body.live).toBe(false);
    expect(body.totalUsd).toBeUndefined();
    expect(body.usdc).toBeUndefined();
    expect(body.sammLpUsdc).toBeUndefined();
    expect(body.slipstream).toBeUndefined();
  });

  it("uses the documented Coinbase NVDA proxy, not a guessed feed or Yahoo", () => {
    expect(BASE.nvdaUsdFeed).toBe(COINBASE_NVDA);
    expect(NVDA_ORACLE_MAX_AGE_S).toBe(48 * 60 * 60);
    expect(NVDA_ORACLE_MAX_AGE_S).toBeGreaterThan(ORACLE_MAX_AGE_S);
    const constants = readFileSync(join(root, "src/config/constants.ts"), "utf8");
    const oracle = readFileSync(join(root, "src/oracle/chainlink.ts"), "utf8");
    const reads = readFileSync(join(root, "src/chat/reads.ts"), "utf8");
    const slip = readFileSync(join(root, "src/aerodrome/slipstream.ts"), "utf8");
    const src = `${constants}\n${oracle}\n${reads}\n${slip}`;
    expect(src).toContain(COINBASE_NVDA);
    expect(src).toContain("NVDA_ORACLE_MAX_AGE_S");
    expect(src.toLowerCase()).not.toContain("yahoo");
    expect(src).not.toContain("finance.yahoo");
    const doc = readFileSync(join(root, "docs/oracles/b20-tokenized-stocks.md"), "utf8");
    expect(doc).toContain(COINBASE_NVDA);
    expect(SLIPSTREAM_NVDA_NFT_ID).toBe("6356494");
  });

  it("shows sAMM / slipstream rows when quotes succeed, omits when zero/missing", async () => {
    const live = await publicTreasury(cfg(), {
      snap: SNAP,
      ...skipChain,
      readEthSpotUsd: async () => 4000,
      readSammLp: async () => ({
        liquidity: 1n,
        amountUsdc: usdc("4.38"),
        amountUsdt: usdc("5"),
      }),
      readSlipstream: async () => [
        { tokenId: SLIPSTREAM_NVDA_NFT_ID, staked: true, usd: "10" },
      ],
    });
    expect(live.sammLpUsdc).toBe("4.38");
    expect(live.sammLpUsdt).toBe("5");
    expect(live.slipstream?.[0]?.tokenId).toBe("6356494");
    expect(live.slipstream?.[0]?.staked).toBe(true);

    const empty = await publicTreasury(cfg(), {
      snap: SNAP,
      ...skipChain,
    });
    expect(empty.sammLpUsdc).toBeUndefined();
    expect(empty.sammLpUsdt).toBeUndefined();
    expect(empty.slipstream).toBeUndefined();

    const missing = await publicTreasury(cfg(), {
      snap: SNAP,
      ...skipChain,
      readSammLp: async () => {
        throw new AppError("aerodrome_quote", "rpc failed");
      },
      readSlipstream: async () => {
        throw new AppError("slipstream_quote", "nft gone");
      },
    });
    expect(missing.sammLpUsdc).toBeUndefined();
    expect(missing.slipstream).toBeUndefined();
    expect(missing.totalUsd).toBe(totalUsdFromLegs(["12.5", "2.1"]));
  });

  it("skips chain quotes when RPC is missing and still totals Bankr cash", async () => {
    const readEth = vi.fn(async () => 4000);
    const readNvda = vi.fn(async () => 200);
    const readSamm = vi.fn(async () => ({
      liquidity: 1n,
      amountUsdc: usdc("4.38"),
      amountUsdt: usdc("5"),
    }));
    const readSlip = vi.fn(async () => [
      { tokenId: SLIPSTREAM_NVDA_NFT_ID, staked: true, usd: "10" },
    ]);
    const body = await publicTreasury(cfg({ baseRpcUrl: "" }), {
      snap: SNAP,
      readEthSpotUsd: readEth,
      readNvdaSpotUsd: readNvda,
      readSammLp: readSamm,
      readSlipstream: readSlip,
    });
    expect(readEth).not.toHaveBeenCalled();
    expect(readNvda).not.toHaveBeenCalled();
    expect(readSamm).not.toHaveBeenCalled();
    expect(readSlip).not.toHaveBeenCalled();
    expect(body.ethUsd).toBeUndefined();
    expect(body.nvdacUsd).toBeUndefined();
    expect(body.sammLpUsdc).toBeUndefined();
    expect(body.slipstream).toBeUndefined();
    expect(body.totalUsd).toBe(totalUsdFromLegs(["12.5", "2.1"]));
    expect(body.usdc).toBe("12.5");
  });

  it("caps stay 15/10/30/15", () => {
    const policy = loadConfig().policy;
    expect(formatUnits(policy.bufferUsdc, USDC_DECIMALS)).toBe("15");
    expect(formatUnits(policy.perCallCapUsdc, USDC_DECIMALS)).toBe("10");
    expect(formatUnits(policy.dailyCapUsdc, USDC_DECIMALS)).toBe("30");
    expect(formatUnits(policy.hardStopUsdc, USDC_DECIMALS)).toBe("15");
    expect(policy.bufferUsdc).toBe(usdc(15));
  });

  it("Home card uses USD total and LP rows, no em dashes", () => {
    const app = readFileSync(join(root, "web/src/App.tsx"), "utf8");
    expect(app).toContain("liveTotalUsd");
    expect(app).toContain("<small>USD</small>");
    expect(app).toContain("USDC/USDT sAMM");
    expect(app).toContain("NVDAc Slipstream");
    expect(app).not.toMatch(/\u2014|\u2013/);
    expect(app).not.toMatch(/<small>USDC<\/small>/);
  });
});

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatUnits, type Address } from "viem";
import { describe, expect, it, vi } from "vitest";
import { publicTreasury } from "../src/chat/reads.ts";
import { BASE, USDC_DECIMALS, usdc } from "../src/config/constants.ts";
import { loadConfig } from "../src/config/load.ts";
import { AppError } from "../src/errors.ts";
import {
  ETH_SPOT_MAX,
  ETH_SPOT_MIN,
  ethNotionalUsd,
} from "../src/oracle/chainlink.ts";
import type { BankrPortfolioSnap } from "../src/bankr/parse.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const STANDARD_ETH_USD = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";
const SVR_PROXIES = [
  "0x50015f8b17fb2C290Dde41fDc246ed0dcEE93a8b",
  "0x5731Ae06077c79A3B292498940211E0aE7130bd3",
  "0xa4250cE1aA15Ff4cb5E5a8655293b65694e436Ed",
] as const;
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

describe("B35 ETH/USD feed", () => {
  it("uses the documented Base ETH/USD standard proxy, not SVR", () => {
    expect(BASE.ethUsdFeed).toBe(STANDARD_ETH_USD);
    const constants = readFileSync(join(root, "src/config/constants.ts"), "utf8");
    const oracle = readFileSync(join(root, "src/oracle/chainlink.ts"), "utf8");
    const reads = readFileSync(join(root, "src/chat/reads.ts"), "utf8");
    const src = `${constants}\n${oracle}\n${reads}`;
    expect(src).toContain(STANDARD_ETH_USD);
    expect(src).toMatch(/SPOT_MIN = 1_000/);
    expect(src).toContain("ETH_SPOT_MIN");
    const lower = src.toLowerCase();
    for (const svr of SVR_PROXIES) {
      expect(lower).not.toContain(svr.toLowerCase());
    }
    const app = readFileSync(join(root, "web/src/App.tsx"), "utf8");
    expect(app).toContain("liveEthLine");
    expect(app).not.toMatch(/\u2014|\u2013/);
  });

  it("ETH bounds accept a print that BTC SPOT_MIN=1000 would reject", () => {
    expect(ETH_SPOT_MIN).toBeLessThan(1000);
    expect(800).toBeGreaterThanOrEqual(ETH_SPOT_MIN);
    expect(800).toBeLessThanOrEqual(ETH_SPOT_MAX);
  });

  it("caps stay 15/10/30/15", () => {
    const policy = loadConfig().policy;
    expect(formatUnits(policy.bufferUsdc, USDC_DECIMALS)).toBe("15");
    expect(formatUnits(policy.perCallCapUsdc, USDC_DECIMALS)).toBe("10");
    expect(formatUnits(policy.dailyCapUsdc, USDC_DECIMALS)).toBe("30");
    expect(formatUnits(policy.hardStopUsdc, USDC_DECIMALS)).toBe("15");
    expect(policy.bufferUsdc).toBe(usdc(15));
  });
});

describe("B35 GET /treasury ETH USD", () => {
  const skipLp = {
    readNvdaSpotUsd: async () => {
      throw new AppError("oracle_stale", "skip");
    },
    readSammLp: async () => ({ liquidity: 0n, amountUsdc: 0n, amountUsdt: 0n }),
    readSlipstream: async () => [],
  };

  it("omits ethUsd / ethUsdValue when BASE_RPC_URL is empty", async () => {
    const readEth = vi.fn(async () => 4000);
    const body = await publicTreasury(cfg({ baseRpcUrl: "" }), {
      snap: SNAP,
      readEthSpotUsd: readEth,
    });
    expect(readEth).not.toHaveBeenCalled();
    expect(body.live).toBe(true);
    expect(body.eth).toBe("0.01");
    expect(body.usdc).toBe("12.5");
    expect(body.ethUsd).toBeUndefined();
    expect(body.ethUsdValue).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/0x[a-fA-F0-9]{40}/);
  });

  it("omits USD fields on oracle failure and still returns live Bankr eth/usdc", async () => {
    const body = await publicTreasury(cfg(), {
      snap: SNAP,
      readEthSpotUsd: async () => {
        throw new AppError("oracle_stale", "Chainlink answer is stale");
      },
      ...skipLp,
    });
    expect(body.live).toBe(true);
    expect(body.eth).toBe("0.01");
    expect(body.usdc).toBe("12.5");
    expect(body.usdt).toBe("2.1");
    expect(body.nvdac).toBe("0.068");
    expect(body.ethUsd).toBeUndefined();
    expect(body.ethUsdValue).toBeUndefined();
    expect(body.treasuryDisplay).toBe("0x4c9D...a6c2");
  });

  it("multiplies live spot by native ETH amount", async () => {
    const body = await publicTreasury(cfg(), {
      snap: SNAP,
      readEthSpotUsd: async (feed) => {
        expect(feed).toBe(BASE.ethUsdFeed);
        return 4000;
      },
      ...skipLp,
    });
    expect(body.live).toBe(true);
    expect(body.eth).toBe("0.01");
    expect(body.ethUsd).toBe("4000");
    expect(body.ethUsdValue).toBe("40");
    expect(body.usdc).toBe("12.5");
    expect(ethNotionalUsd("0.00762", 4000)).toBe("30.48");
    expect(JSON.stringify(body)).not.toMatch(/0x[a-fA-F0-9]{40}/);
  });
});

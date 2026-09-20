import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { BASE } from "../src/config/constants.ts";
import { AppError } from "../src/errors.ts";
import { NVDA_ORACLE_MAX_AGE_S } from "../src/oracle/chainlink.ts";
import { resolveNvdaQuote } from "../src/bankr/quote.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FEED = BASE.nvdaUsdFeed;

describe("B47 weekend NVDA quote for LP increase", () => {
  it("falls back to Coinbase NVDA when Yahoo is stale", async () => {
    const quote = await resolveNvdaQuote({
      rpcUrl: "https://example.invalid",
      feed: FEED,
      deps: {
        fetchYahoo: vi.fn(async () => {
          throw new AppError("quote_stale", "NVDA quote older than 900s");
        }),
        readChainlink: vi.fn(async () => ({ price: 222.37, ageS: 36_000 })),
      },
    });
    expect(quote).toEqual({ price: 222.37, ageS: 36_000, source: "chainlink" });
  });

  it("falls back to Coinbase NVDA when Yahoo HTTP fails", async () => {
    const quote = await resolveNvdaQuote({
      rpcUrl: "https://example.invalid",
      feed: FEED,
      deps: {
        fetchYahoo: vi.fn(async () => {
          throw new AppError("nvda_quote", "NVDA quote HTTP failed");
        }),
        readChainlink: vi.fn(async () => ({ price: 222.27, ageS: 80_000 })),
      },
    });
    expect(quote.source).toBe("chainlink");
    expect(quote.price).toBe(222.27);
  });

  it("keeps a fresh Yahoo print", async () => {
    const quote = await resolveNvdaQuote({
      rpcUrl: "https://example.invalid",
      feed: FEED,
      deps: {
        fetchYahoo: vi.fn(async () => ({ price: 222.1, ageS: 12, source: "yahoo" })),
        readChainlink: vi.fn(async () => ({ price: 1, ageS: 1 })),
      },
    });
    expect(quote).toEqual({ price: 222.1, ageS: 12, source: "yahoo" });
  });

  it("lets increase reuse last close up to the 48h Coinbase heartbeat", () => {
    const entry = readFileSync(join(root, "vendor/aero-stock-lp/scripts/entry.mjs"), "utf8");
    expect(entry).toContain("existingBand ? 48 * 60 * 60 : 900");
    expect(NVDA_ORACLE_MAX_AGE_S).toBe(48 * 60 * 60);
  });
});

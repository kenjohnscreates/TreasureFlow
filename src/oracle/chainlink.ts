import { type Address, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { publicRpc, withPublicRpcs } from "../aerodrome/quote.ts";
import { AppError } from "../errors.ts";
import { btcSpotFromAnswer } from "../flash/ladder.ts";

export const CHAINLINK_ABI = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

/** Base cbBTC/USD and ETH/USD heartbeat is 1200s. Fail closed at 2x. */
export const ORACLE_MAX_AGE_S = 2400;
/**
 * Coinbase NVDA total-return feed (docs/oracles/b20-tokenized-stocks.md):
 * 0.5% / 24h heartbeat, holds last close on weekends. Fail closed at 2x 24h.
 * Do not reuse ETH/BTC 2400s (that omits a valid weekend print).
 */
export const NVDA_ORACLE_MAX_AGE_S = 48 * 60 * 60;
const SPOT_MIN = 1_000;
const SPOT_MAX = 1_000_000;

/**
 * ETH/USD fail-closed range. BTC `readSpotUsd` uses SPOT_MIN=1000 / SPOT_MAX=1e6,
 * which would reject a valid ETH print below $1,000. ETH bounds are 50-100_000.
 * Stale or non-positive answers still fail closed. Heartbeat 2x 1200s is ORACLE_MAX_AGE_S.
 */
export const ETH_SPOT_MIN = 50;
export const ETH_SPOT_MAX = 100_000;

/** Display-only equity bounds. Fail closed; not a trading gate. */
export const NVDA_SPOT_MIN = 1;
export const NVDA_SPOT_MAX = 10_000;

async function readLatestSpotOnce(
  feed: Address,
  rpcUrl: string,
  maxAgeS: number,
  nowMs: number,
): Promise<{ spot: number; ageS: number }> {
  const client = createPublicClient({
    chain: base,
    transport: http(publicRpc(rpcUrl), { retryCount: 2, retryDelay: 300 }),
  });
  const [round, decimals] = await Promise.all([
    client.readContract({
      address: feed,
      abi: CHAINLINK_ABI,
      functionName: "latestRoundData",
    }),
    client.readContract({ address: feed, abi: CHAINLINK_ABI, functionName: "decimals" }),
  ]);
  const answer = round[1];
  const updatedAt = round[3];
  if (answer <= 0n)
    throw new AppError("oracle_stale", "Chainlink answer is not positive");
  const ageS = Math.max(0, nowMs / 1000 - Number(updatedAt));
  if (ageS > maxAgeS)
    throw new AppError("oracle_stale", "Chainlink answer is stale");
  return { spot: btcSpotFromAnswer(answer, decimals), ageS };
}

async function readLatestSpot(
  feed: Address,
  rpcUrl: string,
  maxAgeS = ORACLE_MAX_AGE_S,
  nowMs = Date.now(),
): Promise<{ spot: number; ageS: number }> {
  try {
    return await withPublicRpcs(rpcUrl, (url) =>
      readLatestSpotOnce(feed, url, maxAgeS, nowMs),
    );
  } catch (err) {
    if (err instanceof AppError && err.code === "aerodrome_quote") {
      throw new AppError("oracle_http", err.message);
    }
    throw err;
  }
}

export async function readSpotUsd(feed: Address, rpcUrl = ""): Promise<number> {
  const { spot } = await readLatestSpot(feed, rpcUrl);
  if (spot < SPOT_MIN || spot > SPOT_MAX) {
    throw new AppError("oracle_range", "Chainlink spot is outside the expected range");
  }
  return spot;
}

export async function readEthSpotUsd(feed: Address, rpcUrl: string): Promise<number> {
  if (!rpcUrl)
    throw new AppError("oracle_rpc", "BASE_RPC_URL missing");
  const { spot } = await readLatestSpot(feed, rpcUrl);
  if (spot < ETH_SPOT_MIN || spot > ETH_SPOT_MAX) {
    throw new AppError("oracle_range", "Chainlink ETH spot is outside the expected range");
  }
  return spot;
}

export async function readNvdaSpotUsd(feed: Address, rpcUrl: string): Promise<number> {
  const quote = await readNvdaSpotQuote(feed, rpcUrl);
  return quote.price;
}

export async function readNvdaSpotQuote(
  feed: Address,
  rpcUrl: string,
  nowMs = Date.now(),
): Promise<{ price: number; ageS: number }> {
  if (!rpcUrl)
    throw new AppError("oracle_rpc", "BASE_RPC_URL missing");
  const { spot, ageS } = await readLatestSpot(feed, rpcUrl, NVDA_ORACLE_MAX_AGE_S, nowMs);
  if (spot < NVDA_SPOT_MIN || spot > NVDA_SPOT_MAX) {
    throw new AppError("oracle_range", "Chainlink NVDA spot is outside the expected range");
  }
  return { price: spot, ageS };
}

export function formatUsdDecimal(n: number): string {
  if (!Number.isFinite(n) || n < 0) {
    throw new AppError("oracle_range", "USD decimal is not finite");
  }
  return n.toFixed(8).replace(/\.?0+$/, "") || "0";
}

export function ethNotionalUsd(ethAmount: string, spotUsd: number): string | undefined {
  return notionalUsd(ethAmount, spotUsd);
}

export function nvdacNotionalUsd(nvdacAmount: string, spotUsd: number): string | undefined {
  return notionalUsd(nvdacAmount, spotUsd);
}

function notionalUsd(amount: string, spotUsd: number): string | undefined {
  const qty = Number(amount);
  if (!Number.isFinite(qty) || qty < 0) return undefined;
  const value = qty * spotUsd;
  if (!Number.isFinite(value) || value < 0) return undefined;
  return formatUsdDecimal(value);
}

import {
  createPublicClient,
  decodeFunctionResult,
  encodeFunctionData,
  formatUnits,
  http,
  type Address,
} from "viem";
import { base } from "viem/chains";
import { NVDAC_DECIMALS, USDC_DECIMALS, BASE } from "../config/constants.ts";
import { SLIPSTREAM_NVDA_NFT_ID } from "../demo/evidence.ts";
import { AppError } from "../errors.ts";
import { formatUsdDecimal } from "../oracle/chainlink.ts";
import {
  NVDA_GAUGE_ABI,
  SLIPSTREAM_NPM_ABI,
  SLIPSTREAM_POOL_ABI,
} from "./abi.ts";
import { log } from "../log.ts";
import { publicRpc, withPublicRpcs } from "./quote.ts";

export type SlipstreamLp = {
  tokenId: string;
  staked: boolean;
  usd?: string;
  amountUsdc?: string;
  amountNvdac?: string;
};

function rpcClient(rpcUrl: string) {
  return createPublicClient({
    chain: base,
    transport: http(publicRpc(rpcUrl), { retryCount: 2, retryDelay: 300 }),
  });
}

function sameAddr(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function isTransportError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (
    /rate limit|RPC Request failed|HTTP request failed|timeout|fetch failed|ECONNRESET|429/i.test(
      err.message,
    )
  ) {
    return true;
  }
  return (
    err.name === "HttpRequestError" ||
    err.name === "TimeoutError" ||
    err.name === "RpcRequestError"
  );
}

/** USDC is token0; human USD of 1 token1 (NVDAc). Same formula as vendor math.mjs. */
export function priceFromSqrtX96(sqrtPriceX96: bigint, decimals: number): number {
  if (sqrtPriceX96 <= 0n) return Number.NaN;
  const r = Number(sqrtPriceX96) / 2 ** 96;
  if (!(r > 0) || !Number.isFinite(r)) return Number.NaN;
  const price = 10 ** (decimals - 6) / (r * r);
  return Number.isFinite(price) && price > 0 ? price : Number.NaN;
}

async function discoverNvdaTokenIds(
  client: ReturnType<typeof rpcClient>,
  owner: Address,
): Promise<bigint[]> {
  const found = new Set<string>([SLIPSTREAM_NVDA_NFT_ID]);
  try {
    const staked = await client.readContract({
      address: BASE.nvdaGauge,
      abi: NVDA_GAUGE_ABI,
      functionName: "stakedValues",
      args: [owner],
    });
    for (const id of staked) {
      if (id > 0n) found.add(id.toString());
    }
  } catch (err) {
    if (isTransportError(err)) throw err;
  }
  return [...found].map((id) => BigInt(id)).filter((id) => id > 0n);
}

async function readOne(
  client: ReturnType<typeof rpcClient>,
  tokenId: bigint,
): Promise<SlipstreamLp | undefined> {
  const holder = await client.readContract({
    address: BASE.slipstreamNpmEquity,
    abi: SLIPSTREAM_NPM_ABI,
    functionName: "ownerOf",
    args: [tokenId],
  });
  const pos = await client.readContract({
    address: BASE.slipstreamNpmEquity,
    abi: SLIPSTREAM_NPM_ABI,
    functionName: "positions",
    args: [tokenId],
  });
  const token1 = pos[3];
  const liquidity = pos[7];
  if (token1 === undefined || liquidity === undefined || liquidity === 0n) return undefined;
  if (!sameAddr(token1, BASE.nvdac)) return undefined;

  const staked = sameAddr(holder, BASE.nvdaGauge);
  const row: SlipstreamLp = { tokenId: tokenId.toString(), staked };

  try {
    const slot0 = await client.readContract({
      address: BASE.nvdaPool,
      abi: SLIPSTREAM_POOL_ABI,
      functionName: "slot0",
    });
    const sqrtPriceX96 = slot0[0];
    if (sqrtPriceX96 === undefined) throw new AppError("slipstream_quote", "slot0 empty");
    const price = priceFromSqrtX96(sqrtPriceX96, NVDAC_DECIMALS);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    const data = encodeFunctionData({
      abi: SLIPSTREAM_NPM_ABI,
      functionName: "decreaseLiquidity",
      args: [
        {
          tokenId,
          liquidity,
          amount0Min: 0n,
          amount1Min: 0n,
          deadline,
        },
      ],
    });
    const ret = await client.call({
      to: BASE.slipstreamNpmEquity,
      data,
      account: holder,
    });
    if (!ret.data) throw new AppError("slipstream_quote", "decreaseLiquidity empty");
    const decoded = decodeFunctionResult({
      abi: SLIPSTREAM_NPM_ABI,
      functionName: "decreaseLiquidity",
      data: ret.data,
    });
    const principal0 = decoded[0];
    const principal1 = decoded[1];
    row.amountUsdc = formatUnits(principal0, USDC_DECIMALS);
    row.amountNvdac = formatUnits(principal1, NVDAC_DECIMALS);
    if (Number.isFinite(price) && price > 0) {
      const usd =
        Number(formatUnits(principal0, USDC_DECIMALS)) +
        Number(formatUnits(principal1, NVDAC_DECIMALS)) * price;
      if (Number.isFinite(usd) && usd > 0) row.usd = formatUsdDecimal(usd);
    }
  } catch {
    /* NFT row without NAV */
  }
  return row;
}

export async function readNvdaSlipstreamLps(
  owner: Address,
  rpcUrl: string,
): Promise<SlipstreamLp[]> {
  const client = rpcClient(rpcUrl);
  const ids = await discoverNvdaTokenIds(client, owner);
  const rows: SlipstreamLp[] = [];
  let transportErr: unknown;
  for (const tokenId of ids) {
    try {
      const row = await readOne(client, tokenId);
      if (row) rows.push(row);
    } catch (err) {
      if (isTransportError(err)) {
        transportErr = err;
        continue;
      }
    }
  }
  if (rows.length === 0 && transportErr) throw transportErr;
  return rows;
}

export function pickIncreaseTokenId(rows: SlipstreamLp[]): string | undefined {
  const preferred = rows.find((row) => row.tokenId === SLIPSTREAM_NVDA_NFT_ID);
  if (preferred) return preferred.tokenId;
  return rows[0]?.tokenId;
}

export async function readNvdaSlipstreamLpsWithRetry(
  owner: Address,
  rpcUrl: string,
): Promise<SlipstreamLp[]> {
  return withPublicRpcs(rpcUrl, (url) => readNvdaSlipstreamLps(owner, url));
}

function slipstreamReadErrorCode(err: unknown): string {
  return err instanceof AppError ? err.code : "slipstream_quote";
}

/** Chat plan: retry public RPCs; on total failure assume demo NFT #6356494 (increase, not mint). */
export async function slipstreamLpsForChatPlan(
  owner: Address,
  rpcUrl: string,
  treasuryDisplay?: string,
): Promise<SlipstreamLp[]> {
  try {
    const slipstream = await readNvdaSlipstreamLpsWithRetry(owner, rpcUrl);
    if (slipstream.length === 0) {
      log("slipstream_lp_read", {
        live: true,
        count: 0,
        ...(treasuryDisplay ? { treasury: treasuryDisplay } : {}),
      });
      return slipstream;
    }
    log("slipstream_lp_read", {
      live: true,
      ...(treasuryDisplay ? { treasury: treasuryDisplay } : {}),
      count: slipstream.length,
      tokenId: slipstream[0]?.tokenId ?? "",
      staked: slipstream[0]?.staked === true,
      ...(slipstream[0]?.usd !== undefined ? { usd: slipstream[0].usd } : {}),
    });
    return slipstream;
  } catch (err) {
    log("slipstream_lp_read", {
      live: false,
      code: slipstreamReadErrorCode(err),
      fallback: true,
      tokenId: SLIPSTREAM_NVDA_NFT_ID,
      ...(treasuryDisplay ? { treasury: treasuryDisplay } : {}),
    });
    return [{ tokenId: SLIPSTREAM_NVDA_NFT_ID, staked: true }];
  }
}

/** Live LP submit: retry public RPCs; on total failure use demo NFT id; empty success still mints. */
export async function discoverIncreaseTokenIdResilient(
  owner: Address,
  rpcUrl: string,
  treasuryDisplay?: string,
): Promise<string | undefined> {
  try {
    const rows = await readNvdaSlipstreamLpsWithRetry(owner, rpcUrl);
    return pickIncreaseTokenId(rows);
  } catch (err) {
    log("slipstream_lp_read", {
      live: false,
      code: slipstreamReadErrorCode(err),
      fallback: true,
      tokenId: SLIPSTREAM_NVDA_NFT_ID,
      ...(treasuryDisplay ? { treasury: treasuryDisplay } : {}),
    });
    return SLIPSTREAM_NVDA_NFT_ID;
  }
}

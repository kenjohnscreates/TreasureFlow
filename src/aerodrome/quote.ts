import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";
import { ERC20_ABI, ROUTER_ABI } from "./abi.ts";
import { BASE } from "../config/constants.ts";
import { AppError } from "../errors.ts";

const FALLBACK_RPC = "https://mainnet.base.org";
export const PUBLIC_RPCS = [
  FALLBACK_RPC,
  "https://base-rpc.publicnode.com",
  "https://base.drpc.org",
] as const;
const RPC_HTTP = { retryCount: 2, retryDelay: 300 } as const;

export type AddQuote = {
  amountUsdc: bigint;
  amountUsdt: bigint;
  liquidity: bigint;
};

export type RemoveQuote = {
  amountUsdc: bigint;
  amountUsdt: bigint;
};

export type SammLpPosition = {
  liquidity: bigint;
  amountUsdc: bigint;
  amountUsdt: bigint;
};

function rpcClient(rpcUrl = FALLBACK_RPC) {
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl || FALLBACK_RPC, RPC_HTTP),
  });
}

export async function withPublicRpcs<T>(
  rpcUrl: string,
  fn: (url: string) => Promise<T>,
): Promise<T> {
  const preferred = publicRpc(rpcUrl);
  const urls = [preferred, ...PUBLIC_RPCS.filter((url) => url !== preferred)];
  let last: unknown;
  for (const url of urls) {
    try {
      return await fn(url);
    } catch (err) {
      if (err instanceof AppError) throw err;
      last = err;
    }
  }
  throw new AppError(
    "aerodrome_quote",
    last instanceof Error ? last.message : "all RPCs failed",
  );
}

export async function quoteAddLiquidity(
  amountUsdc: bigint,
  amountUsdt: bigint,
  rpcUrl = FALLBACK_RPC,
): Promise<AddQuote> {
  return withPublicRpcs(rpcUrl, async (url) => {
    const client = rpcClient(url);
    const quoted = await client.readContract({
      address: BASE.aerodromeRouter,
      abi: ROUTER_ABI,
      functionName: "quoteAddLiquidity",
      args: [BASE.usdc, BASE.usdt, true, BASE.aerodromePoolFactory, amountUsdc, amountUsdt],
    });
    const [amountA, amountB, liquidity] = quoted;
    if (liquidity === 0n || amountA === 0n || amountB === 0n) {
      throw new AppError("aerodrome_quote", "sAMM quote returned zero liquidity");
    }
    return { amountUsdc: amountA, amountUsdt: amountB, liquidity };
  });
}

export async function quoteRemoveLiquidity(
  liquidity: bigint,
  rpcUrl = FALLBACK_RPC,
): Promise<RemoveQuote> {
  return withPublicRpcs(rpcUrl, async (url) => {
    const client = rpcClient(url);
    const quoted = await client.readContract({
      address: BASE.aerodromeRouter,
      abi: ROUTER_ABI,
      functionName: "quoteRemoveLiquidity",
      args: [BASE.usdc, BASE.usdt, true, BASE.aerodromePoolFactory, liquidity],
    });
    const [amountA, amountB] = quoted;
    return { amountUsdc: amountA, amountUsdt: amountB };
  });
}

export async function sammLpBalance(
  owner: Address,
  rpcUrl = FALLBACK_RPC,
): Promise<bigint> {
  return withPublicRpcs(rpcUrl, async (url) => {
    const client = rpcClient(url);
    return client.readContract({
      address: BASE.usdcUsdtSamm,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [owner],
    });
  });
}

export async function readSammLpValueUsdc(
  owner: Address,
  rpcUrl = FALLBACK_RPC,
): Promise<SammLpPosition> {
  const liquidity = await sammLpBalance(owner, rpcUrl);
  if (liquidity === 0n) {
    return { liquidity: 0n, amountUsdc: 0n, amountUsdt: 0n };
  }
  const quoted = await quoteRemoveLiquidity(liquidity, rpcUrl);
  return { liquidity, amountUsdc: quoted.amountUsdc, amountUsdt: quoted.amountUsdt };
}

export function sizeLpBurn(args: {
  totalLiquidity: bigint;
  shortfallUsdc: bigint;
  fullAmountUsdc: bigint;
}): bigint {
  const { totalLiquidity, shortfallUsdc, fullAmountUsdc } = args;
  if (totalLiquidity === 0n || shortfallUsdc === 0n || fullAmountUsdc === 0n) {
    return 0n;
  }
  if (fullAmountUsdc <= shortfallUsdc) return totalLiquidity;
  const liq = (totalLiquidity * shortfallUsdc + fullAmountUsdc - 1n) / fullAmountUsdc;
  if (liq < 1n) return 1n;
  return liq > totalLiquidity ? totalLiquidity : liq;
}

export function publicRpc(url: string): string {
  return url || FALLBACK_RPC;
}

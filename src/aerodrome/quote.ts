import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { ROUTER_ABI } from "./abi.ts";
import { BASE } from "../config/constants.ts";
import { AppError } from "../errors.ts";

const FALLBACK_RPC = "https://mainnet.base.org";

export type AddQuote = {
  amountUsdc: bigint;
  amountUsdt: bigint;
  liquidity: bigint;
};

export async function quoteAddLiquidity(
  amountUsdc: bigint,
  amountUsdt: bigint,
  rpcUrl = FALLBACK_RPC,
): Promise<AddQuote> {
  const client = createPublicClient({
    chain: base,
    transport: http(rpcUrl || FALLBACK_RPC),
  });
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
}

export function publicRpc(url: string): string {
  return url || FALLBACK_RPC;
}

import { decodeFunctionData, encodeFunctionData, type Address } from "viem";
import { BASE } from "../config/constants.ts";
import { AppError } from "../errors.ts";
import { ERC20_ABI, ROUTER_ABI } from "./abi.ts";

const DEFAULT_SLIPPAGE_BPS = 50n;

export type AddLiqArgs = {
  amountUsdc: bigint;
  amountUsdt: bigint;
  to: Address;
  deadlineSec?: bigint;
  slippageBps?: bigint;
};

export type RemoveLiqArgs = {
  liquidity: bigint;
  minUsdc: bigint;
  minUsdt: bigint;
  to: Address;
  deadlineSec?: bigint;
};

function minOut(amount: bigint, slippageBps: bigint): bigint {
  return amount - (amount * slippageBps) / 10_000n;
}

function deadline(explicit?: bigint): bigint {
  return explicit ?? BigInt(Math.floor(Date.now() / 1000) + 600);
}

export function encodeApprove(tokenSpender: Address, amount: bigint): `0x${string}` {
  return encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [tokenSpender, amount],
  });
}

export function encodeTransfer(to: Address, amount: bigint): `0x${string}` {
  return encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [to, amount],
  });
}

export function decodeTransfer(data: `0x${string}`): { to: Address; amount: bigint } {
  const decoded = decodeFunctionData({ abi: ERC20_ABI, data });
  if (decoded.functionName !== "transfer") {
    throw new AppError("bad_calldata", "calldata is not ERC-20 transfer");
  }
  const [to, amount] = decoded.args;
  return { to, amount };
}

export function encodeAddLiquidity(args: AddLiqArgs): `0x${string}` {
  const bps = args.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
  return encodeFunctionData({
    abi: ROUTER_ABI,
    functionName: "addLiquidity",
    args: [
      BASE.usdc,
      BASE.usdt,
      true,
      args.amountUsdc,
      args.amountUsdt,
      minOut(args.amountUsdc, bps),
      minOut(args.amountUsdt, bps),
      args.to,
      deadline(args.deadlineSec),
    ],
  });
}

export function encodeRemoveLiquidity(args: RemoveLiqArgs): `0x${string}` {
  return encodeFunctionData({
    abi: ROUTER_ABI,
    functionName: "removeLiquidity",
    args: [
      BASE.usdc,
      BASE.usdt,
      true,
      args.liquidity,
      args.minUsdc,
      args.minUsdt,
      args.to,
      deadline(args.deadlineSec),
    ],
  });
}

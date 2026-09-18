import { parseUnits } from "viem";
import { USDC_DECIMALS } from "../config/constants.ts";
import type { TreasurySnapshot } from "../policy/math.ts";
import type { BankrPortfolioSnap } from "./parse.ts";

export function portfolioToSnapshot(
  snap: BankrPortfolioSnap,
  lpValueUsdc = 0n,
): TreasurySnapshot {
  return {
    usdcFree: parseUnits(snap.usdc, USDC_DECIMALS),
    usdtFree: parseUnits(snap.usdt, USDC_DECIMALS),
    lpValueUsdc,
  };
}

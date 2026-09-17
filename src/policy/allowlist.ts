import { type Address } from "viem";
import { BASE } from "../config/constants.ts";

export function coreAllowlist(extra: Address[] = []): Address[] {
  return [
    BASE.usdc,
    BASE.usdt,
    BASE.nvdac,
    BASE.aerodromeRouter,
    BASE.slipstreamNpmEquity,
    BASE.slipstreamRouterEquity,
    BASE.nvdaGauge,
    BASE.cbBtc,
    ...extra,
  ];
}

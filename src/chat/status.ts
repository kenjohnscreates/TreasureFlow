import { formatUnits } from "viem";
import { truncateAddress } from "../bankr/parse.ts";
import { BASE, USDC_DECIMALS, type AppConfig } from "../config/constants.ts";
import { missingLater, missingNow } from "../config/status.ts";

export function publicStatus(config: AppConfig) {
  return {
    policy: {
      bufferUsdc: formatUnits(config.policy.bufferUsdc, USDC_DECIMALS),
      perCallCapUsdc: formatUnits(config.policy.perCallCapUsdc, USDC_DECIMALS),
      dailyCapUsdc: formatUnits(config.policy.dailyCapUsdc, USDC_DECIMALS),
      hardStopUsdc: formatUnits(config.policy.hardStopUsdc, USDC_DECIMALS),
    },
    missingNow: missingNow(config),
    missingLater: missingLater(config),
    dryRun: config.dryRun,
    paused: config.paused,
    signer: "bankr" as const,
    treasuryAddress: config.treasuryAddress,
    treasuryDisplay: config.treasuryAddress
      ? truncateAddress(config.treasuryAddress)
      : null,
    tokens: {
      usdc: BASE.usdc,
      usdt: BASE.usdt,
      nvdac: BASE.nvdac,
      aerodromeRouter: BASE.aerodromeRouter,
    },
  };
}

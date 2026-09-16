import { type Address, parseUnits } from "viem";
import { base, baseSepolia } from "viem/chains";

export const USDC_DECIMALS = 6;

export const BASE = {
  chainId: base.id,
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
  usdt: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" as Address,
  aerodromeRouter: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43" as Address,
  cbBtc: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf" as Address,
  // Confirm on Chainlink Base feeds before M5 live orders.
  btcUsdFeed: "0x07DA0E54543a844a80ABE69c8A12F22B3aA59f9D" as Address,
} as const;

export const BASE_SEPOLIA = {
  chainId: baseSepolia.id,
} as const;

export type PolicyConfig = {
  bufferUsdc: bigint;
  perCallCapUsdc: bigint;
  dailyCapUsdc: bigint;
  minSweepUsdc: bigint;
  maxLpShare: number;
  hardStopUsdc: bigint;
  demoPayUsdc: bigint;
  demoRejectUsdc: bigint;
};

export type AppConfig = {
  dynamicEnvironmentId: string;
  dynamicApiToken: string;
  dynamicWalletId: string;
  baseRpcUrl: string;
  baseSepoliaRpcUrl: string;
  xaiApiKey: string;
  flashApiKey: string;
  bankrApiKey: string;
  payDestinations: Address[];
  policy: PolicyConfig;
  dryRun: boolean;
  paused: boolean;
  cronTz: string;
};

export function usdc(amount: string | number): bigint {
  return parseUnits(String(amount), USDC_DECIMALS);
}

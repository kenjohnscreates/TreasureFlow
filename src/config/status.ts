import type { AppConfig } from "./constants.ts";

export function missingNow(config: AppConfig): string[] {
  const missing: string[] = [];
  if (!config.dynamicEnvironmentId) missing.push("DYNAMIC_ENVIRONMENT_ID");
  if (!config.dynamicApiToken) missing.push("DYNAMIC_API_TOKEN");
  if (!config.baseRpcUrl) missing.push("BASE_RPC_URL");
  if (!config.baseSepoliaRpcUrl) missing.push("BASE_SEPOLIA_RPC_URL");
  if (!config.payDestinations[0]) missing.push("PAY_DEST_1");
  if (!config.payDestinations[1]) missing.push("PAY_DEST_2");
  return missing;
}

export function missingLater(config: AppConfig): string[] {
  const missing: string[] = [];
  if (!config.dynamicWalletId) missing.push("DYNAMIC_WALLET_ID");
  if (!config.treasuryAddress) missing.push("TREASURY_ADDRESS");
  if (!config.xaiApiKey) missing.push("XAI_API_KEY");
  if (!config.flashApiKey) missing.push("FLASH_API_KEY");
  if (!config.bankrApiKey) missing.push("BANKR_API_KEY");
  return missing;
}

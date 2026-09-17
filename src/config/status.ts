import type { AppConfig } from "./constants.ts";

export function missingNow(config: AppConfig): string[] {
  const missing: string[] = [];
  if (!config.bankrApiKey) missing.push("BANKR_API_KEY");
  return missing;
}

export function missingLater(config: AppConfig): string[] {
  const missing: string[] = [];
  if (!config.treasuryAddress) missing.push("TREASURY_ADDRESS");
  if (!config.payDestinations[0]) missing.push("PAY_DEST_1");
  if (!config.payDestinations[1]) missing.push("PAY_DEST_2");
  if (!config.baseRpcUrl) missing.push("BASE_RPC_URL");
  if (!config.xaiApiKey) missing.push("XAI_API_KEY");
  if (!config.flashApiKey) missing.push("FLASH_API_KEY");
  return missing;
}

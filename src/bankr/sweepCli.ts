import { parseUnits } from "viem";
import { USDC_DECIMALS } from "../config/constants.ts";
import { loadConfig, requireBankrKey } from "../config/load.ts";
import { AppError } from "../errors.ts";
import { log } from "../log.ts";
import { getWalletPortfolio } from "./client.ts";
import { assertNotStranded, parsePortfolio } from "./parse.ts";
import { executeSweep } from "./sweepLive.ts";

function isLive(): boolean {
  return process.argv.includes("--live");
}

export async function runBankrSweep(envPath = ".env"): Promise<void> {
  const config = loadConfig(envPath);
  requireBankrKey(config);
  const treasury = config.treasuryAddress;
  if (!treasury) throw new AppError("missing_treasury", "TREASURY_ADDRESS is required");
  assertNotStranded(treasury);
  const snap = parsePortfolio(await getWalletPortfolio(config.bankrApiKey));
  const snapshot = {
    usdcFree: parseUnits(snap.usdc, USDC_DECIMALS),
    usdtFree: parseUnits(snap.usdt, USDC_DECIMALS),
    lpValueUsdc: 0n,
  };
  await executeSweep({ config, snapshot, live: isLive() });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBankrSweep().catch((err) => {
    const code = err instanceof AppError ? err.code : "bankr_sweep";
    const message = err instanceof AppError ? err.message : "Bankr sweep failed";
    log("bankr_error", { code, message });
    process.exit(1);
  });
}

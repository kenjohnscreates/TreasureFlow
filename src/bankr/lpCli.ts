import { loadConfig, requireBankrKey } from "../config/load.ts";
import { AppError } from "../errors.ts";
import { log } from "../log.ts";
import { executeLp } from "./lpLive.ts";
import { assertNotStranded } from "./parse.ts";

function isLive(): boolean {
  return process.argv.includes("--live");
}

export async function runBankrLp(envPath = ".env"): Promise<void> {
  const config = loadConfig(envPath);
  requireBankrKey(config);
  const treasury = config.treasuryAddress;
  if (!treasury) throw new AppError("missing_treasury", "TREASURY_ADDRESS is required");
  assertNotStranded(treasury);
  await executeLp({ config, live: isLive() });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBankrLp().catch((err) => {
    const code = err instanceof AppError ? err.code : "bankr_lp";
    const message = err instanceof AppError ? err.message : "Bankr LP failed";
    log("bankr_error", { code, message });
    process.exit(1);
  });
}

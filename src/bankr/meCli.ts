import { loadConfig, requireBankrKey } from "../config/load.ts";
import { AppError } from "../errors.ts";
import { log } from "../log.ts";
import { getWalletMe, getWalletPortfolio } from "./client.ts";
import {
  assertNotStranded,
  assertPortfolioMatches,
  parsePortfolio,
  parseWalletMe,
  truncateAddress,
} from "./parse.ts";
import { persistTreasury } from "./persist.ts";

export async function runBankrMe(envPath = ".env"): Promise<void> {
  const config = loadConfig(envPath);
  requireBankrKey(config);
  const me = parseWalletMe(await getWalletMe(config.bankrApiKey));
  assertNotStranded(me.address);
  const snap = parsePortfolio(await getWalletPortfolio(config.bankrApiKey));
  assertPortfolioMatches(me, snap);
  const persisted = me.walletId
    ? persistTreasury(envPath, me.address, me.walletId)
    : persistTreasury(envPath, me.address);
  log("bankr_me", {
    treasury: truncateAddress(me.address),
    clubActive: me.clubActive,
    persistedAddress: persisted.wroteAddress,
    persistedWalletId: persisted.wroteWalletId,
  });
  log("bankr_portfolio", {
    eth: snap.eth,
    usdc: snap.usdc,
    usdt: snap.usdt,
    nvdac: snap.nvdac,
    tokenCount: snap.tokenCount,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBankrMe().catch((err) => {
    const code = err instanceof AppError ? err.code : "bankr_http";
    const message = err instanceof AppError ? err.message : "Bankr read failed";
    log("bankr_error", { code, message });
    process.exit(1);
  });
}

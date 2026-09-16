import { AppError } from "../errors.ts";
import { requireLiveWallet, type AppConfig } from "../config/load.ts";

export function assertCanSign(config: AppConfig): void {
  requireLiveWallet(config);
  if (config.dryRun) {
    throw new AppError("dry_run", "DRY_RUN=true; refusing to sign");
  }
}

export const WALLET_STUB = {
  async getAddress(): Promise<string> {
    throw new AppError(
      "wallet_unwired",
      "Dynamic wallet client is not wired (needs API token)",
    );
  },
};

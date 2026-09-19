import { config as loadDotenv } from "dotenv";
import { type Address, getAddress, isAddress } from "viem";
import { readPausedFile } from "../chat/pause.ts";
import { AppError } from "../errors.ts";
import { type AppConfig, usdc } from "./constants.ts";

export type { AppConfig };

function env(name: string): string {
  return process.env[name] ?? "";
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw === "true" || raw === "1";
}

function envNumber(name: string, fallback: string): number {
  return Number(process.env[name] || fallback);
}

function dest(value: string): Address | undefined {
  if (!value) return undefined;
  if (!isAddress(value)) {
    throw new AppError("bad_address", `PAY_DEST is not an address: ${value}`);
  }
  return getAddress(value);
}

function treasury(value: string): Address | null {
  if (!value) return null;
  if (!isAddress(value)) {
    throw new AppError("bad_address", `TREASURY_ADDRESS is not an address: ${value}`);
  }
  return getAddress(value);
}

function founder(value: string): Address | null {
  if (!value) return null;
  if (!isAddress(value)) {
    throw new AppError("bad_address", "FOUNDER_ADDRESS is not an address");
  }
  return getAddress(value);
}

export function loadConfig(envPath = ".env"): AppConfig {
  loadDotenv({ path: envPath, quiet: true });
  loadDotenv({ path: ".env.example", quiet: true, override: false });

  const dests = [dest(env("PAY_DEST_1")), dest(env("PAY_DEST_2"))].filter(
    (value): value is Address => Boolean(value),
  );

  return {
    dynamicEnvironmentId: env("DYNAMIC_ENVIRONMENT_ID"),
    dynamicApiToken: env("DYNAMIC_API_TOKEN"),
    dynamicWalletId: env("DYNAMIC_WALLET_ID"),
    treasuryAddress: treasury(env("TREASURY_ADDRESS")),
    founderAddress: founder(env("FOUNDER_ADDRESS")),
    baseRpcUrl: env("BASE_RPC_URL"),
    baseSepoliaRpcUrl: env("BASE_SEPOLIA_RPC_URL"),
    xaiApiKey: env("XAI_API_KEY"),
    flashApiKey: env("FLASH_API_KEY"),
    bankrApiKey: env("BANKR_API_KEY"),
    payDestinations: dests,
    policy: {
      bufferUsdc: usdc(envNumber("BUFFER_USDC", "15")),
      perCallCapUsdc: usdc(envNumber("PER_CALL_CAP_USDC", "10")),
      dailyCapUsdc: usdc(envNumber("DAILY_CAP_USDC", "30")),
      minSweepUsdc: usdc(envNumber("MIN_SWEEP_USDC", "5")),
      maxLpShare: envNumber("MAX_LP_SHARE", "0.7"),
      hardStopUsdc: usdc(envNumber("HARD_STOP_USDC", "15")),
      demoPayUsdc: usdc(envNumber("DEMO_PAY_USDC", "8")),
      demoRejectUsdc: usdc(envNumber("DEMO_REJECT_USDC", "50")),
    },
    dryRun: envBool("DRY_RUN", true),
    paused: envBool("PAUSED", false) || readPausedFile(),
    cronTz: process.env.CRON_TZ || "America/New_York",
  };
}

export function requireBankrKey(config: AppConfig): void {
  if (!config.bankrApiKey) {
    throw new AppError("missing_bankr", "BANKR_API_KEY is required for Bankr reads");
  }
}

export function requireFlashKey(config: AppConfig): void {
  if (!config.flashApiKey) {
    throw new AppError("missing_flash", "FLASH_API_KEY is required for Flash quotes");
  }
}

export function requireLiveWallet(config: AppConfig): void {
  if (!config.dynamicEnvironmentId || !config.dynamicApiToken) {
    throw new AppError(
      "missing_dynamic",
      "DYNAMIC_ENVIRONMENT_ID and DYNAMIC_API_TOKEN are required for live wallet calls",
    );
  }
  if (!config.baseRpcUrl) {
    throw new AppError("missing_rpc", "BASE_RPC_URL is required for live chain calls");
  }
}

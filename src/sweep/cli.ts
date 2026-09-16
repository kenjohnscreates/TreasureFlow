import { formatUnits } from "viem";
import { loadConfig } from "../config/load.ts";
import { USDC_DECIMALS } from "../config/constants.ts";
import { log } from "../log.ts";
import { planSweep } from "./plan.ts";
import type { TreasurySnapshot } from "../policy/math.ts";
import { AppError } from "../errors.ts";

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function demoSnapshot(): TreasurySnapshot {
  return {
    usdcFree: 55_000_000n,
    usdtFree: 40_000_000n,
    lpValueUsdc: 0n,
  };
}

export async function runSweepCli(): Promise<void> {
  const config = loadConfig();
  const dry = config.dryRun || argFlag("--dry-run");
  const snapshot = demoSnapshot();
  const plan = planSweep(snapshot, config.policy, config.paused);
  log("sweep_plan", {
    dryRun: dry,
    action: plan.action,
    reason: plan.reason,
    surplusUsdc: formatUnits(plan.surplusUsdc, USDC_DECIMALS),
    depositUsdc: formatUnits(plan.depositUsdc, USDC_DECIMALS),
  });
  if (plan.action === "add_liquidity" && !dry) {
    throw new AppError(
      "aerodrome_unwired",
      "Live addLiquidity is disabled until Dynamic keys are in .env",
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSweepCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

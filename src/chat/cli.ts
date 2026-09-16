import { formatUnits } from "viem";
import { loadConfig } from "../config/load.ts";
import { USDC_DECIMALS } from "../config/constants.ts";
import { parseIntent } from "./intent.ts";
import { planPay } from "../sweep/plan.ts";
import { log } from "../log.ts";
import { AppError } from "../errors.ts";
import type { TreasurySnapshot } from "../policy/math.ts";
import { missingNow } from "../config/status.ts";

function promptFromArgv(): string {
  const parts = process.argv
    .slice(2)
    .filter((arg) => arg !== "--" && !arg.startsWith("--") && !arg.endsWith(".ts"));
  return parts.join(" ").trim();
}

function demoSnapshot(): TreasurySnapshot {
  return { usdcFree: 55_000_000n, usdtFree: 40_000_000n, lpValueUsdc: 0n };
}

export async function runPayCli(): Promise<void> {
  const raw = promptFromArgv();
  if (!raw) throw new AppError("usage", 'Usage: pnpm pay -- "send 8 USDC to 0x..."');
  const config = loadConfig();
  const intent = parseIntent(raw);
  if (intent.kind !== "pay") {
    throw new AppError("parse", `Could not parse pay intent from: ${raw}`);
  }
  const dests = config.payDestinations.length ? config.payDestinations : [intent.to];
  const plan = planPay({
    snapshot: demoSnapshot(),
    amountUsdc: intent.amountUsdc,
    to: intent.to,
    config: { ...config, payDestinations: dests },
    spend: [],
  });
  log("pay_plan", {
    action: plan.action,
    to: plan.to,
    amountUsdc: formatUnits(plan.amountUsdc, USDC_DECIMALS),
    shortfallUsdc: formatUnits(plan.shortfallUsdc, USDC_DECIMALS),
    missing: missingNow(config).join(",") || "none",
    dryRun: config.dryRun,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPayCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

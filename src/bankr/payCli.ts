import { formatUnits, parseUnits } from "viem";
import { BASE, USDC_DECIMALS } from "../config/constants.ts";
import { loadConfig, requireBankrKey } from "../config/load.ts";
import { AppError } from "../errors.ts";
import { log } from "../log.ts";
import { appendSpend, loadSpend } from "../policy/spendLog.ts";
import { planPay } from "../sweep/plan.ts";
import { getWalletPortfolio } from "./client.ts";
import { assertNotStranded, parsePortfolio, truncateAddress } from "./parse.ts";
import { transferUsdc } from "./transfer.ts";

function isLive(): boolean {
  return process.argv.includes("--live");
}

export async function runBankrPay(envPath = ".env"): Promise<void> {
  const config = loadConfig(envPath);
  requireBankrKey(config);
  const dest = config.payDestinations[0];
  if (!dest) throw new AppError("missing_pay_dest", "PAY_DEST_1 is required");
  assertNotStranded(dest);
  const amountUsdc = config.policy.demoPayUsdc;
  const amountHuman = formatUnits(amountUsdc, USDC_DECIMALS);
  const snap = parsePortfolio(await getWalletPortfolio(config.bankrApiKey));
  const usdcFree = parseUnits(snap.usdc, USDC_DECIMALS);
  const spend = await loadSpend();
  const plan = planPay({
    snapshot: {
      usdcFree,
      usdtFree: parseUnits(snap.usdt, USDC_DECIMALS),
      lpValueUsdc: 0n,
    },
    amountUsdc,
    to: dest,
    config,
    spend,
  });
  log("bankr_pay_plan", {
    action: plan.action,
    dest: truncateAddress(dest),
    amountUsdc: amountHuman,
    usdcFree: snap.usdc,
    live: isLive(),
  });
  if (!isLive()) {
    log("bankr_pay", { sent: false, reason: "pass --live to submit" });
    return;
  }
  const txHash = await transferUsdc({
    apiKey: config.bankrApiKey,
    recipient: dest,
    amountHuman,
  });
  await appendSpend(amountUsdc);
  log("bankr_pay", {
    sent: true,
    dest: truncateAddress(dest),
    token: BASE.usdc,
    amountUsdc: amountHuman,
    txHash: truncateAddress(txHash),
    txHashFull: txHash,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBankrPay().catch((err) => {
    const code = err instanceof AppError ? err.code : "bankr_http";
    const message = err instanceof AppError ? err.message : "Bankr pay failed";
    log("bankr_error", { code, message });
    process.exit(1);
  });
}

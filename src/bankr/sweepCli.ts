import { formatUnits, parseUnits } from "viem";
import { encodeAddLiquidity, encodeApprove } from "../aerodrome/encode.ts";
import { publicRpc, quoteAddLiquidity } from "../aerodrome/quote.ts";
import { BASE, USDC_DECIMALS } from "../config/constants.ts";
import { loadConfig, requireBankrKey } from "../config/load.ts";
import { AppError } from "../errors.ts";
import { log } from "../log.ts";
import { appendSpend, loadSpend } from "../policy/spendLog.ts";
import { remainingDailyCap } from "../policy/math.ts";
import { planSweep, sizeLiveSweep } from "../sweep/plan.ts";
import { getWalletPortfolio } from "./client.ts";
import { pollJob, submitPrompt } from "./agent.ts";
import { assertNotStranded, parsePortfolio, truncateAddress } from "./parse.ts";
import { persistSweep } from "./sweepPersist.ts";
import { rawSubmitPrompt } from "./submitRaw.ts";
import {
  assertUnderHardStop,
  parseSkillTx,
  spendNotionalUsdc,
  type SkillTx,
} from "./skillTx.ts";

const MAX_UINT256 = (1n << 256n) - 1n;

function isLive(): boolean {
  return process.argv.includes("--live");
}

function skillTx(to: string, data: `0x${string}`, label: string): SkillTx {
  return parseSkillTx({ to, data, value: "0", chainId: BASE.chainId, label });
}

async function submitAll(apiKey: string, txs: SkillTx[]): Promise<`0x${string}`[]> {
  const hashes: `0x${string}`[] = [];
  for (const tx of txs) {
    log("bankr_sweep_submit", {
      label: tx.label,
      to: truncateAddress(tx.to),
      dataLen: tx.data.length,
      notionalUsdc: spendNotionalUsdc(tx),
    });
    const jobId = await submitPrompt(apiKey, rawSubmitPrompt(tx));
    log("bankr_sweep_job", { jobId, label: tx.label });
    const job = await pollJob(apiKey, jobId);
    if (!job.txHash)
      throw new AppError("bankr_job", "Bankr job completed without a tx hash");
    log("bankr_sweep_mined", {
      label: tx.label,
      txHash: truncateAddress(job.txHash),
      txHashFull: job.txHash,
    });
    hashes.push(job.txHash);
  }
  return hashes;
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
  const planned = planSweep(snapshot, config.policy, config.paused);
  const sized = sizeLiveSweep({
    plan: planned,
    usdtFree: snapshot.usdtFree,
    hardStopUsdc: config.policy.hardStopUsdc,
    minSweepUsdc: config.policy.minSweepUsdc,
  });
  const hardStop = Number(formatUnits(config.policy.hardStopUsdc, USDC_DECIMALS));
  log("bankr_sweep_plan", {
    action: sized.action,
    reason: sized.reason,
    usdcFree: snap.usdc,
    usdtFree: snap.usdt,
    surplusUsdc: formatUnits(sized.surplusUsdc, USDC_DECIMALS),
    depositUsdc: formatUnits(sized.depositUsdc, USDC_DECIMALS),
    bufferUsdc: formatUnits(config.policy.bufferUsdc, USDC_DECIMALS),
    live: isLive(),
  });
  if (sized.action !== "add_liquidity") {
    log("bankr_sweep", { sent: false, reason: sized.reason });
    return;
  }

  const quoted = await quoteAddLiquidity(
    sized.depositUsdc,
    sized.estimatedUsdt,
    publicRpc(config.baseRpcUrl),
  );
  if (quoted.amountUsdc > config.policy.hardStopUsdc) {
    throw new AppError("hard_stop", "quoted USDC exceeds hard stop");
  }
  const spend = await loadSpend();
  const dailyLeft = remainingDailyCap(config.policy.dailyCapUsdc, spend);
  if (quoted.amountUsdc > dailyLeft) {
    throw new AppError("daily_cap", "sweep USDC would exceed daily cap");
  }

  const notional = Number(formatUnits(quoted.amountUsdc, USDC_DECIMALS));
  const txs = [
    skillTx(
      BASE.usdc,
      encodeApprove(BASE.aerodromeRouter, MAX_UINT256),
      "approve USDC -> router",
    ),
    skillTx(
      BASE.usdt,
      encodeApprove(BASE.aerodromeRouter, MAX_UINT256),
      "approve USDT -> router",
    ),
    skillTx(
      BASE.aerodromeRouter,
      encodeAddLiquidity({
        amountUsdc: quoted.amountUsdc,
        amountUsdt: quoted.amountUsdt,
        to: treasury,
      }),
      `add sAMM USDC/USDT $${notional.toFixed(2)}`,
    ),
  ];
  for (const tx of txs) assertUnderHardStop(tx, hardStop);
  log("bankr_sweep_quote", {
    amountUsdc: formatUnits(quoted.amountUsdc, USDC_DECIMALS),
    amountUsdt: formatUnits(quoted.amountUsdt, USDC_DECIMALS),
    liquidity: quoted.liquidity.toString(),
    txs: txs.length,
  });
  if (!isLive()) {
    log("bankr_sweep", { sent: false, reason: "pass --live to submit" });
    return;
  }

  const hashes = await submitAll(config.bankrApiKey, txs);
  const addTx = hashes.at(-1);
  if (!addTx) throw new AppError("bankr_job", "addLiquidity tx hash missing");
  if (quoted.amountUsdc > 0n) await appendSpend(quoted.amountUsdc);
  await persistSweep({
    depositUsdc: quoted.amountUsdc.toString(),
    depositUsdt: quoted.amountUsdt.toString(),
    addTx,
    hashes,
  });
  log("bankr_sweep", {
    sent: true,
    addTx,
    amountUsdc: formatUnits(quoted.amountUsdc, USDC_DECIMALS),
    amountUsdt: formatUnits(quoted.amountUsdt, USDC_DECIMALS),
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBankrSweep().catch((err) => {
    const code = err instanceof AppError ? err.code : "bankr_sweep";
    const message = err instanceof AppError ? err.message : "Bankr sweep failed";
    log("bankr_error", { code, message });
    process.exit(1);
  });
}

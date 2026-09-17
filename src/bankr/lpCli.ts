import { formatUnits, parseUnits } from "viem";
import { USDC_DECIMALS } from "../config/constants.ts";
import { loadConfig, requireBankrKey } from "../config/load.ts";
import { AppError } from "../errors.ts";
import { log } from "../log.ts";
import { appendSpend, loadSpend } from "../policy/spendLog.ts";
import { pollJob, submitPrompt } from "./agent.ts";
import { fetchNvdaQuote, NVDA_IV } from "./quote.ts";
import { assertNotStranded, truncateAddress } from "./parse.ts";
import { persistLp } from "./lpPersist.ts";
import { rawSubmitPrompt } from "./submitRaw.ts";
import { runEntry, SKILL_STATE, type SkillResult } from "./skill.ts";
import {
  assertUnderHardStop,
  DEMO_LP_USD,
  spendNotionalUsdc,
  type SkillTx,
} from "./skillTx.ts";

function isLive(): boolean {
  return process.argv.includes("--live");
}

function numberField(raw: Record<string, unknown>, key: string): number | undefined {
  const value = raw[key];
  return typeof value === "number" ? value : undefined;
}

function stringField(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  return typeof value === "string" ? value : undefined;
}

function assertPhase(result: SkillResult, hardStopUsdc: number): void {
  for (const tx of result.txs) assertUnderHardStop(tx, hardStopUsdc);
}

async function submitAll(apiKey: string, txs: SkillTx[]): Promise<`0x${string}`[]> {
  const hashes: `0x${string}`[] = [];
  for (const tx of txs) {
    log("bankr_lp_submit", {
      label: tx.label,
      to: truncateAddress(tx.to),
      dataLen: tx.data.length,
      notionalUsdc: spendNotionalUsdc(tx),
    });
    const jobId = await submitPrompt(apiKey, rawSubmitPrompt(tx));
    log("bankr_lp_job", { jobId, label: tx.label });
    const job = await pollJob(apiKey, jobId);
    if (!job.txHash)
      throw new AppError("bankr_job", "Bankr job completed without a tx hash");
    log("bankr_lp_mined", {
      label: tx.label,
      txHash: truncateAddress(job.txHash),
      txHashFull: job.txHash,
    });
    hashes.push(job.txHash);
  }
  return hashes;
}

export async function runBankrLp(envPath = ".env"): Promise<void> {
  const config = loadConfig(envPath);
  requireBankrKey(config);
  const treasury = config.treasuryAddress;
  if (!treasury) throw new AppError("missing_treasury", "TREASURY_ADDRESS is required");
  assertNotStranded(treasury);
  const usd = DEMO_LP_USD;
  const hardStop = Number(formatUnits(config.policy.hardStopUsdc, USDC_DECIMALS));
  const quote = await fetchNvdaQuote();
  log("bankr_lp_quote", {
    price: quote.price,
    ageS: quote.ageS,
    source: quote.source,
    iv: NVDA_IV,
  });
  const plan = await runEntry("plan", {
    market: "NVDA",
    usd: String(usd),
    wallet: treasury,
    quote: String(quote.price),
    "quote-age-s": String(quote.ageS),
    iv: String(NVDA_IV),
  });
  assertPhase(plan, hardStop);
  const band = plan.raw.band;
  if (
    !band ||
    typeof band !== "object" ||
    typeof (band as { tickLower?: unknown }).tickLower !== "number" ||
    typeof (band as { tickUpper?: unknown }).tickUpper !== "number"
  ) {
    throw new AppError("skill_band", "plan did not return ticks");
  }
  const ticks = band as { tickLower: number; tickUpper: number };
  const walletUsdc = numberField(plan.raw, "walletUsdc") ?? 0;
  const gasLow = plan.raw.gasLowNeedsTopUp === true;
  if (gasLow) throw new AppError("gas_low", "Base ETH below skill gas preflight");
  log("bankr_lp_plan", {
    ok: true,
    usd,
    walletUsdc,
    txs: plan.txs.length,
    tickLower: ticks.tickLower,
    tickUpper: ticks.tickUpper,
    live: isLive(),
    concentration: plan.raw.needsConcentrationConfirm === true,
  });

  const size = await runEntry("size", {
    market: "NVDA",
    usd: String(usd),
    wallet: treasury,
    "tick-lower": String(ticks.tickLower),
    "tick-upper": String(ticks.tickUpper),
  });
  assertPhase(size, hardStop);
  const amount0Usdc = numberField(size.raw, "amount0Usdc") ?? 0;
  if (amount0Usdc > hardStop) {
    throw new AppError("hard_stop", "size USDC exceeds hard stop");
  }
  const spend = await loadSpend();
  const spent = spend.reduce((sum, event) => sum + event.amountUsdc, 0n);
  const nextSpend = parseUnits(amount0Usdc.toFixed(6), USDC_DECIMALS);
  if (spent + nextSpend > config.policy.dailyCapUsdc) {
    throw new AppError("daily_cap", "LP USDC would exceed daily cap");
  }
  log("bankr_lp_size", {
    amount0Usdc,
    amount1Stock: numberField(size.raw, "amount1Stock") ?? 0,
    txs: size.txs.length,
    live: isLive(),
  });
  if (!isLive()) {
    log("bankr_lp", { sent: false, reason: "pass --live to submit" });
    return;
  }

  const planHashes = await submitAll(config.bankrApiKey, plan.txs);
  const sizeHashes: `0x${string}`[] = [];
  let mintTx: `0x${string}` | undefined;
  let remaining = size.txs;
  let steps = 0;
  const sizeFlags = {
    market: "NVDA",
    usd: String(usd),
    wallet: treasury,
    "tick-lower": String(ticks.tickLower),
    "tick-upper": String(ticks.tickUpper),
  };
  while (remaining.length > 0 && steps < 6) {
    steps += 1;
    const next = remaining[0];
    if (!next) break;
    const [hash] = await submitAll(config.bankrApiKey, [next]);
    if (!hash) throw new AppError("bankr_job", "skill tx hash missing");
    sizeHashes.push(hash);
    if (next.label.startsWith("mint ")) mintTx = hash;
    if (remaining.length === 1) break;
    const again = await runEntry("size", sizeFlags);
    assertPhase(again, hardStop);
    remaining = again.txs;
  }
  if (!mintTx) throw new AppError("bankr_job", "mint tx hash missing");

  const settle = await runEntry("settle", {
    market: "NVDA",
    wallet: treasury,
    "mint-tx": mintTx,
    "entry-usd": String(usd),
    "state-path": SKILL_STATE,
  });
  assertPhase(settle, hardStop);
  const tokenId = stringField(settle.raw, "tokenId");
  const route = stringField(settle.raw, "route");
  log("bankr_lp_settle", {
    mintTx,
    tokenId: tokenId ?? "",
    route: route ?? "",
    txs: settle.txs.length,
  });
  const settleHashes = await submitAll(config.bankrApiKey, settle.txs);
  if (nextSpend > 0n) await appendSpend(nextSpend);
  const hashes = [...planHashes, ...sizeHashes, ...settleHashes];
  const record: {
    market: string;
    usd: number;
    mintTx: string;
    hashes: string[];
    tokenId?: string;
    route?: string;
  } = { market: "NVDA", usd, mintTx, hashes };
  if (tokenId) record.tokenId = tokenId;
  if (route) record.route = route;
  await persistLp(record);
  log("bankr_lp", {
    sent: true,
    mintTx,
    tokenId: tokenId ?? "",
    route: route ?? "",
    amount0Usdc,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBankrLp().catch((err) => {
    const code = err instanceof AppError ? err.code : "bankr_lp";
    const message = err instanceof AppError ? err.message : "Bankr LP failed";
    log("bankr_error", { code, message });
    process.exit(1);
  });
}

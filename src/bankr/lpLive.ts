import { formatUnits, parseUnits } from "viem";
import { USDC_DECIMALS, type AppConfig } from "../config/constants.ts";
import { AppError } from "../errors.ts";
import { log } from "../log.ts";
import { appendSpend, loadSpend } from "../policy/spendLog.ts";
import { persistLp } from "./lpPersist.ts";
import { assertNotStranded, truncateAddress } from "./parse.ts";
import { fetchNvdaQuote, NVDA_IV } from "./quote.ts";
import { runEntry, SKILL_STATE, type SkillResult } from "./skill.ts";
import {
  assertUnderHardStop,
  DEMO_LP_USD,
  spendNotionalUsdc,
  type SkillTx,
} from "./skillTx.ts";
import { submitSkillTx } from "./submitRaw.ts";

export type LpLiveDeps = {
  fetchNvdaQuote?: typeof fetchNvdaQuote;
  runEntry?: typeof runEntry;
  submitSkillTx?: typeof submitSkillTx;
  appendSpend?: typeof appendSpend;
  persistLp?: typeof persistLp;
  loadSpend?: typeof loadSpend;
};

export type LpLiveResult = {
  sent: boolean;
  reason: string;
  usd: number;
  walletUsdc?: number;
  amount0Usdc?: number;
  mintTx?: `0x${string}`;
  tokenId?: string;
  route?: string;
};

function assertPhase(result: SkillResult, hardStopUsdc: number): void {
  for (const tx of result.txs) assertUnderHardStop(tx, hardStopUsdc);
}

function numberField(raw: Record<string, unknown>, key: string): number | undefined {
  const value = raw[key];
  return typeof value === "number" ? value : undefined;
}

function stringField(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  return typeof value === "string" ? value : undefined;
}

export async function executeLp(args: {
  config: AppConfig;
  live: boolean;
  usdcFree?: bigint;
  deps?: LpLiveDeps;
}): Promise<LpLiveResult> {
  const { config, live } = args;
  const deps = args.deps ?? {};
  const usd = DEMO_LP_USD;
  if (args.usdcFree !== undefined && args.usdcFree <= 0n) {
    log("bankr_lp", { sent: false, reason: "no free USDC" });
    return { sent: false, reason: "no free USDC", usd };
  }
  const treasury = config.treasuryAddress;
  if (!treasury) throw new AppError("missing_treasury", "TREASURY_ADDRESS is required");
  assertNotStranded(treasury);
  const hardStop = Number(formatUnits(config.policy.hardStopUsdc, USDC_DECIMALS));
  const quoteFn = deps.fetchNvdaQuote ?? fetchNvdaQuote;
  const entry = deps.runEntry ?? runEntry;
  const quote = await quoteFn();
  log("bankr_lp_quote", {
    price: quote.price,
    ageS: quote.ageS,
    source: quote.source,
    iv: NVDA_IV,
  });
  const plan = await entry("plan", {
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
  if (walletUsdc <= 0) {
    log("bankr_lp", { sent: false, reason: "no free USDC" });
    return { sent: false, reason: "no free USDC", usd, walletUsdc };
  }
  log("bankr_lp_plan", {
    ok: true,
    usd,
    walletUsdc,
    txs: plan.txs.length,
    tickLower: ticks.tickLower,
    tickUpper: ticks.tickUpper,
    live,
    concentration: plan.raw.needsConcentrationConfirm === true,
  });

  const size = await entry("size", {
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
  const spendFn = deps.loadSpend ?? loadSpend;
  const spend = await spendFn();
  const spent = spend.reduce((sum, event) => sum + event.amountUsdc, 0n);
  const nextSpend = parseUnits(amount0Usdc.toFixed(6), USDC_DECIMALS);
  if (spent + nextSpend > config.policy.dailyCapUsdc) {
    throw new AppError("daily_cap", "LP USDC would exceed daily cap");
  }
  log("bankr_lp_size", {
    amount0Usdc,
    amount1Stock: numberField(size.raw, "amount1Stock") ?? 0,
    txs: size.txs.length,
    live,
  });
  if (!live) {
    log("bankr_lp", { sent: false, reason: "pass --live to submit" });
    return {
      sent: false,
      reason: "pass --live to submit",
      usd,
      walletUsdc,
      amount0Usdc,
    };
  }
  if (!config.bankrApiKey) {
    throw new AppError("missing_bankr", "BANKR_API_KEY is required for LP");
  }

  const submit = deps.submitSkillTx ?? submitSkillTx;
  async function submitAll(txs: SkillTx[]): Promise<`0x${string}`[]> {
    const hashes: `0x${string}`[] = [];
    for (const tx of txs) {
      log("bankr_lp_submit", {
        label: tx.label,
        to: truncateAddress(tx.to),
        dataLen: tx.data.length,
        notionalUsdc: spendNotionalUsdc(tx),
      });
      const hash = await submit(config.bankrApiKey, tx);
      log("bankr_lp_mined", { label: tx.label, txHash: truncateAddress(hash) });
      hashes.push(hash);
    }
    return hashes;
  }

  const planHashes = await submitAll(plan.txs);
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
    const [hash] = await submitAll([next]);
    if (!hash) throw new AppError("bankr_job", "skill tx hash missing");
    sizeHashes.push(hash);
    if (next.label.startsWith("mint ")) mintTx = hash;
    if (remaining.length === 1) break;
    const again = await entry("size", sizeFlags);
    assertPhase(again, hardStop);
    remaining = again.txs;
  }
  if (!mintTx) throw new AppError("bankr_job", "mint tx hash missing");

  const settle = await entry("settle", {
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
  const settleHashes = await submitAll(settle.txs);
  const append = deps.appendSpend ?? appendSpend;
  if (nextSpend > 0n) await append(nextSpend);
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
  const persist = deps.persistLp ?? persistLp;
  await persist(record);
  log("bankr_lp", {
    sent: true,
    mintTx,
    tokenId: tokenId ?? "",
    route: route ?? "",
    amount0Usdc,
  });
  const out: LpLiveResult = {
    sent: true,
    reason: "lp submitted",
    usd,
    walletUsdc,
    amount0Usdc,
    mintTx,
  };
  if (tokenId) out.tokenId = tokenId;
  if (route) out.route = route;
  return out;
}

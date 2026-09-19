import { formatUnits } from "viem";
import { encodeAddLiquidity, encodeApprove } from "../aerodrome/encode.ts";
import { publicRpc, quoteAddLiquidity } from "../aerodrome/quote.ts";
import { BASE, USDC_DECIMALS, type AppConfig } from "../config/constants.ts";
import { AppError } from "../errors.ts";
import { log } from "../log.ts";
import { remainingDailyCap, type TreasurySnapshot } from "../policy/math.ts";
import { appendSpend, loadSpend } from "../policy/spendLog.ts";
import { planSweep, sizeLiveSweep, type SweepPlan } from "../sweep/plan.ts";
import { persistSweep } from "./sweepPersist.ts";
import { submitSkillTx } from "./submitRaw.ts";
import { assertNotStranded, truncateAddress } from "./parse.ts";
import {
  assertUnderHardStop,
  parseSkillTx,
  spendNotionalUsdc,
  type SkillTx,
} from "./skillTx.ts";

const MAX_UINT256 = (1n << 256n) - 1n;

export type SweepLiveDeps = {
  quoteAddLiquidity?: typeof quoteAddLiquidity;
  submitSkillTx?: typeof submitSkillTx;
  appendSpend?: typeof appendSpend;
  persistSweep?: typeof persistSweep;
  loadSpend?: typeof loadSpend;
};

export type SweepLiveResult = {
  sized: SweepPlan;
  sent: boolean;
  reason: string;
  addTx?: `0x${string}`;
  hashes?: `0x${string}`[];
  amountUsdc?: string;
  amountUsdt?: string;
};

function skillTx(to: string, data: `0x${string}`, label: string): SkillTx {
  return parseSkillTx({ to, data, value: "0", chainId: BASE.chainId, label });
}

export function sizeTreasurySweep(
  config: AppConfig,
  snapshot: TreasurySnapshot,
): SweepPlan {
  const planned = planSweep(snapshot, config.policy, config.paused);
  return sizeLiveSweep({
    plan: planned,
    usdtFree: snapshot.usdtFree,
    hardStopUsdc: config.policy.hardStopUsdc,
    minSweepUsdc: config.policy.minSweepUsdc,
  });
}

export async function executeSweep(args: {
  config: AppConfig;
  snapshot: TreasurySnapshot;
  live: boolean;
  deps?: SweepLiveDeps;
}): Promise<SweepLiveResult> {
  const { config, snapshot, live } = args;
  const deps = args.deps ?? {};
  const treasury = config.treasuryAddress;
  if (!treasury) throw new AppError("missing_treasury", "TREASURY_ADDRESS is required");
  assertNotStranded(treasury);
  const sized = sizeTreasurySweep(config, snapshot);
  const hardStop = Number(formatUnits(config.policy.hardStopUsdc, USDC_DECIMALS));
  log("bankr_sweep_plan", {
    action: sized.action,
    reason: sized.reason,
    surplusUsdc: formatUnits(sized.surplusUsdc, USDC_DECIMALS),
    depositUsdc: formatUnits(sized.depositUsdc, USDC_DECIMALS),
    bufferUsdc: formatUnits(config.policy.bufferUsdc, USDC_DECIMALS),
    live,
  });
  if (sized.action !== "add_liquidity") {
    log("bankr_sweep", { sent: false, reason: sized.reason });
    return { sized, sent: false, reason: sized.reason };
  }

  const quoteFn = deps.quoteAddLiquidity ?? quoteAddLiquidity;
  const quoted = await quoteFn(
    sized.depositUsdc,
    sized.estimatedUsdt,
    publicRpc(config.baseRpcUrl),
  );
  if (quoted.amountUsdc > config.policy.hardStopUsdc) {
    throw new AppError("hard_stop", "quoted USDC exceeds hard stop");
  }
  const spendFn = deps.loadSpend ?? loadSpend;
  const spend = await spendFn();
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
  if (!live) {
    log("bankr_sweep", { sent: false, reason: "pass --live to submit" });
    return {
      sized,
      sent: false,
      reason: "pass --live to submit",
      amountUsdc: formatUnits(quoted.amountUsdc, USDC_DECIMALS),
      amountUsdt: formatUnits(quoted.amountUsdt, USDC_DECIMALS),
    };
  }
  if (!config.bankrApiKey) {
    throw new AppError("missing_bankr", "BANKR_API_KEY is required for sweep");
  }

  const submit = deps.submitSkillTx ?? submitSkillTx;
  const hashes: `0x${string}`[] = [];
  for (const tx of txs) {
    log("bankr_sweep_submit", {
      label: tx.label,
      to: truncateAddress(tx.to),
      dataLen: tx.data.length,
      notionalUsdc: spendNotionalUsdc(tx),
    });
    hashes.push(await submit(config.bankrApiKey, tx));
    const mined = hashes.at(-1);
    if (!mined) throw new AppError("bankr_job", "Bankr job completed without a tx hash");
    log("bankr_sweep_mined", {
      label: tx.label,
      txHash: truncateAddress(mined),
      txHashFull: mined,
    });
  }
  const addTx = hashes.at(-1);
  if (!addTx) throw new AppError("bankr_job", "addLiquidity tx hash missing");
  const append = deps.appendSpend ?? appendSpend;
  if (quoted.amountUsdc > 0n) await append(quoted.amountUsdc);
  const persist = deps.persistSweep ?? persistSweep;
  await persist({
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
  return {
    sized,
    sent: true,
    reason: sized.reason,
    addTx,
    hashes,
    amountUsdc: formatUnits(quoted.amountUsdc, USDC_DECIMALS),
    amountUsdt: formatUnits(quoted.amountUsdt, USDC_DECIMALS),
  };
}

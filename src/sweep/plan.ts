import type { Address } from "viem";
import type { AppConfig, PolicyConfig } from "../config/constants.ts";
import { AppError } from "../errors.ts";
import {
  type SpendEvent,
  type TreasurySnapshot,
  assertDaily,
  assertHardStop,
  assertNotPaused,
  assertPerCall,
  maxLpValue,
  remainingDailyCap,
  shortfallForPay,
  surplusAboveBuffer,
} from "../policy/math.ts";
import { assertAllowlisted } from "../chat/intent.ts";

export type SweepPlan = {
  action: "add_liquidity" | "noop";
  reason: string;
  surplusUsdc: bigint;
  depositUsdc: bigint;
  estimatedUsdt: bigint;
};

export type PayPlan = {
  action: "pay" | "unwind_and_pay";
  to: Address;
  amountUsdc: bigint;
  shortfallUsdc: bigint;
};

export function planSweep(
  snapshot: TreasurySnapshot,
  policy: PolicyConfig,
  paused: boolean,
): SweepPlan {
  assertNotPaused(paused);
  const surplus = surplusAboveBuffer(snapshot.usdcFree, policy.bufferUsdc);
  if (surplus < policy.minSweepUsdc) {
    return {
      action: "noop",
      reason: "surplus below minimum sweep size",
      surplusUsdc: surplus,
      depositUsdc: 0n,
      estimatedUsdt: 0n,
    };
  }
  const total = snapshot.usdcFree + snapshot.usdtFree + snapshot.lpValueUsdc;
  const room = maxLpValue(total, policy.maxLpShare) - snapshot.lpValueUsdc;
  const deposit = surplus < room ? surplus : room < 0n ? 0n : room;
  if (deposit < policy.minSweepUsdc) {
    return {
      action: "noop",
      reason: "LP share cap would be exceeded",
      surplusUsdc: surplus,
      depositUsdc: 0n,
      estimatedUsdt: 0n,
    };
  }
  return {
    action: "add_liquidity",
    reason: "sweep surplus into sAMM USDC/USDT",
    surplusUsdc: surplus,
    depositUsdc: deposit,
    estimatedUsdt: deposit,
  };
}

export const DEMO_SWEEP_USDC = 5_000_000n;

export function sizeLiveSweep(args: {
  plan: SweepPlan;
  usdtFree: bigint;
  hardStopUsdc: bigint;
  minSweepUsdc: bigint;
  demoCapUsdc?: bigint;
}): SweepPlan {
  const { plan, usdtFree, hardStopUsdc, minSweepUsdc } = args;
  const demoCap = args.demoCapUsdc ?? DEMO_SWEEP_USDC;
  if (plan.action !== "add_liquidity") return plan;
  let deposit = plan.depositUsdc;
  if (deposit > usdtFree) deposit = usdtFree;
  if (deposit > hardStopUsdc) deposit = hardStopUsdc;
  if (deposit > demoCap) deposit = demoCap;
  if (deposit < minSweepUsdc) {
    return {
      action: "noop",
      reason: "sized sweep below minimum",
      surplusUsdc: plan.surplusUsdc,
      depositUsdc: 0n,
      estimatedUsdt: 0n,
    };
  }
  return { ...plan, depositUsdc: deposit, estimatedUsdt: deposit };
}

export function planPay(args: {
  snapshot: TreasurySnapshot;
  amountUsdc: bigint;
  to: Address;
  config: AppConfig;
  spend: SpendEvent[];
  nowMs?: number;
}): PayPlan {
  const { snapshot, amountUsdc, to, config, spend, nowMs = Date.now() } = args;
  assertNotPaused(config.paused);
  assertAllowlisted(to, config.payDestinations);
  assertPerCall(amountUsdc, config.policy);
  assertHardStop(amountUsdc, config.policy);
  assertDaily(amountUsdc, remainingDailyCap(config.policy.dailyCapUsdc, spend, nowMs));
  const shortfall = shortfallForPay(snapshot.usdcFree, amountUsdc);
  if (shortfall > snapshot.lpValueUsdc) {
    throw new AppError("insufficient_lp", "Not enough LP to cover payment shortfall");
  }
  return {
    action: shortfall === 0n ? "pay" : "unwind_and_pay",
    to,
    amountUsdc,
    shortfallUsdc: shortfall,
  };
}

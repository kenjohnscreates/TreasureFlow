import { AppError } from "../errors.ts";
import type { PolicyConfig } from "../config/constants.ts";

export type TreasurySnapshot = {
  usdcFree: bigint;
  usdtFree: bigint;
  lpValueUsdc: bigint;
};

export type SpendEvent = {
  atMs: number;
  amountUsdc: bigint;
};

export function spentInWindow(
  events: SpendEvent[],
  nowMs: number,
  windowMs: number,
): bigint {
  const cutoff = nowMs - windowMs;
  return events
    .filter((event) => event.atMs >= cutoff)
    .reduce((sum, event) => sum + event.amountUsdc, 0n);
}

export function remainingDailyCap(
  dailyCapUsdc: bigint,
  events: SpendEvent[],
  nowMs = Date.now(),
): bigint {
  const used = spentInWindow(events, nowMs, 24 * 60 * 60 * 1000);
  return dailyCapUsdc > used ? dailyCapUsdc - used : 0n;
}

export function assertNotPaused(paused: boolean): void {
  if (paused) throw new AppError("paused", "Kill switch is on. No outbound activity.");
}

export function assertHardStop(amountUsdc: bigint, policy: PolicyConfig): void {
  if (amountUsdc > policy.hardStopUsdc) {
    throw new AppError(
      "hard_stop",
      `Amount ${amountUsdc} exceeds hard stop ${policy.hardStopUsdc}`,
    );
  }
}

export function assertPerCall(amountUsdc: bigint, policy: PolicyConfig): void {
  if (amountUsdc > policy.perCallCapUsdc) {
    throw new AppError(
      "per_call_cap",
      `Amount ${amountUsdc} exceeds per-call cap ${policy.perCallCapUsdc}`,
    );
  }
}

export function assertDaily(amountUsdc: bigint, remaining: bigint): void {
  if (amountUsdc > remaining) {
    throw new AppError(
      "daily_cap",
      `Amount ${amountUsdc} exceeds remaining daily cap ${remaining}`,
    );
  }
}

export function surplusAboveBuffer(usdcFree: bigint, bufferUsdc: bigint): bigint {
  return usdcFree > bufferUsdc ? usdcFree - bufferUsdc : 0n;
}

export function maxLpValue(totalUsdc: bigint, maxLpShare: number): bigint {
  if (maxLpShare < 0 || maxLpShare > 1) {
    throw new AppError("bad_lp_share", "MAX_LP_SHARE must be between 0 and 1");
  }
  return (totalUsdc * BigInt(Math.round(maxLpShare * 10_000))) / 10_000n;
}

export function shortfallForPay(usdcFree: bigint, amountUsdc: bigint): bigint {
  return amountUsdc > usdcFree ? amountUsdc - usdcFree : 0n;
}

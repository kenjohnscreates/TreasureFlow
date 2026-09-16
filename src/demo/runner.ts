import { formatUnits, getAddress } from "viem";
import { loadConfig } from "../config/load.ts";
import { USDC_DECIMALS, usdc } from "../config/constants.ts";
import { parseIntent } from "../chat/intent.ts";
import { planPay, planSweep } from "../sweep/plan.ts";
import { buildLimitLadder } from "../flash/ladder.ts";
import { log } from "../log.ts";
import type { TreasurySnapshot } from "../policy/math.ts";
import { AppError } from "../errors.ts";

const PAUSE_MS = Number(process.env.DEMO_PAUSE_MS ?? "800");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function snapshot(): TreasurySnapshot {
  return { usdcFree: 55_000_000n, usdtFree: 40_000_000n, lpValueUsdc: 0n };
}

async function step(title: string, fn: () => void): Promise<void> {
  log("demo_step", { title });
  fn();
  await sleep(PAUSE_MS);
}

export async function runDemo(): Promise<void> {
  const config = loadConfig();
  const dest =
    config.payDestinations[0] ?? getAddress("0x000000000000000000000000000000000000dEaD");
  const liveConfig = {
    ...config,
    payDestinations: config.payDestinations.length ? config.payDestinations : [dest],
  };

  await step("Founder view: buffer, caps, allowlist", () => {
    log("founder_view", {
      bufferUsdc: formatUnits(config.policy.bufferUsdc, USDC_DECIMALS),
      perCallCapUsdc: formatUnits(config.policy.perCallCapUsdc, USDC_DECIMALS),
      dailyCapUsdc: formatUnits(config.policy.dailyCapUsdc, USDC_DECIMALS),
      dest,
      note: "One company's own USDC. Limits enforced before signing.",
    });
  });

  await step("Nightly sweep (dry-run)", () => {
    const plan = planSweep(snapshot(), config.policy, config.paused);
    log("sweep", { action: plan.action, reason: plan.reason });
  });

  await step("Prompt-to-pay allowed", () => {
    const prompt = `send ${formatUnits(config.policy.demoPayUsdc, USDC_DECIMALS)} USDC to ${dest}`;
    const intent = parseIntent(prompt);
    if (intent.kind !== "pay") throw new AppError("parse", "demo pay prompt failed");
    const pay = planPay({
      snapshot: snapshot(),
      amountUsdc: intent.amountUsdc,
      to: intent.to,
      config: liveConfig,
      spend: [],
    });
    log("pay_ok", {
      action: pay.action,
      amountUsdc: formatUnits(pay.amountUsdc, USDC_DECIMALS),
    });
  });

  await step("Prompt-to-pay rejected at cap", () => {
    try {
      planPay({
        snapshot: snapshot(),
        amountUsdc: usdc(50),
        to: dest,
        config: liveConfig,
        spend: [],
      });
      throw new AppError("expected_reject", "50 USDC should hit per-call cap");
    } catch (err) {
      const code = err instanceof AppError ? err.code : "unknown";
      log("pay_rejected", { code });
    }
  });

  await step("Flash limit ladder (offline prices)", () => {
    const rungs = buildLimitLadder({ spotUsd: 110_000, reserveUsdc: usdc(9) });
    log("flash_ladder", { rungs: rungs.length, orderType: "limit" });
  });

  await step("Stretch narrated", () => {
    log("stretch", {
      status: "narrated",
      reason: "aero-stock-lp would sign from a Bankr wallet, not Dynamic",
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

import { formatUnits, type Address } from "viem";
import { encodeTransfer } from "../aerodrome/encode.ts";
import { assertNotStranded } from "../bankr/parse.ts";
import {
  BASE,
  NVDAC_DECIMALS,
  USDC_DECIMALS,
  usdc,
  type AppConfig,
} from "../config/constants.ts";
import { AppError } from "../errors.ts";
import { buildLimitLadder } from "../flash/ladder.ts";
import type { TreasurySnapshot } from "../policy/math.ts";
import { planPay, planSweep, type PayPlan, type SweepPlan } from "../sweep/plan.ts";
import {
  parseIntent,
  type DepositIntent,
  type DepositToken,
  type Intent,
} from "./intent.ts";

export type UnsignedTx = {
  chainId: number;
  to: Address;
  data: `0x${string}`;
  value: "0x0";
};

export type ChatReply = {
  kind: Intent["kind"];
  summary: string;
  plan: Record<string, string | number | boolean>;
  unsignedTx?: UnsignedTx;
};

const DEMO_SNAPSHOT: TreasurySnapshot = {
  usdcFree: 55_000_000n,
  usdtFree: 40_000_000n,
  lpValueUsdc: 0n,
};

const LP_STOCKS_REASON =
  "Both NVDAc and USDC legs must sit in the treasury first. Slipstream mint is signed later by the Bankr wallet (B3). Not the nightly USDC/USDT sweep.";

function tokenMeta(token: DepositToken): { address: Address; decimals: number } {
  if (token === "USDC") return { address: BASE.usdc, decimals: USDC_DECIMALS };
  return { address: BASE.nvdac, decimals: NVDAC_DECIMALS };
}

function depositPlan(intent: DepositIntent, config: AppConfig): ChatReply {
  const treasury = config.treasuryAddress;
  if (!treasury) {
    throw new AppError("missing_treasury", "TREASURY_ADDRESS is required for deposit");
  }
  assertNotStranded(treasury);
  const { address, decimals } = tokenMeta(intent.token);
  const unsignedTx: UnsignedTx = {
    chainId: BASE.chainId,
    to: address,
    data: encodeTransfer(treasury, intent.amount),
    value: "0x0",
  };
  return {
    kind: "deposit",
    summary:
      "Unsigned ERC-20 transfer to the Bankr treasury. Sign from the external wallet. Agent does not broadcast.",
    plan: {
      action: "deposit",
      token: intent.token,
      tokenAddress: address,
      amount: formatUnits(intent.amount, decimals),
      treasury,
      transferTo: treasury,
    },
    unsignedTx,
  };
}

function sweepPlan(config: AppConfig): ChatReply {
  const plan = planSweep(DEMO_SNAPSHOT, config.policy, config.paused);
  return {
    kind: "sweep",
    summary: plan.reason,
    plan: serializeSweep(plan),
  };
}

function serializeSweep(plan: SweepPlan): Record<string, string> {
  return {
    action: plan.action,
    reason: plan.reason,
    surplusUsdc: plan.surplusUsdc.toString(),
    depositUsdc: plan.depositUsdc.toString(),
    estimatedUsdt: plan.estimatedUsdt.toString(),
  };
}

function serializePay(plan: PayPlan): Record<string, string> {
  return {
    action: plan.action,
    to: plan.to,
    amountUsdc: plan.amountUsdc.toString(),
    shortfallUsdc: plan.shortfallUsdc.toString(),
  };
}

function payPlan(raw: string, config: AppConfig): ChatReply {
  const intent = parseIntent(raw);
  if (intent.kind !== "pay") throw new AppError("parse", "expected pay intent");
  const dests = config.payDestinations.length ? config.payDestinations : [intent.to];
  const plan = planPay({
    snapshot: DEMO_SNAPSHOT,
    amountUsdc: intent.amountUsdc,
    to: intent.to,
    config: { ...config, payDestinations: dests },
    spend: [],
  });
  return { kind: "pay", summary: `plan ${plan.action}`, plan: serializePay(plan) };
}

function limitsPlan(): ChatReply {
  const rungs = buildLimitLadder({ spotUsd: 110_000, reserveUsdc: usdc(9) });
  return {
    kind: "limits",
    summary: "Dry Flash limit ladder. Not submitted.",
    plan: {
      action: "limits",
      rungs: String(rungs.length),
      sizesUsdc: rungs.map((rung) => rung.sizeUsdc.toString()).join(","),
      pcts: rungs.map((rung) => rung.pctBelowSpot).join(","),
    },
  };
}

export function handleChat(raw: string, config: AppConfig): ChatReply {
  const intent = parseIntent(raw);
  if (intent.kind === "deposit") return depositPlan(intent, config);
  if (intent.kind === "sweep") return sweepPlan(config);
  if (intent.kind === "lp_stocks") {
    return {
      kind: "lp_stocks",
      summary: LP_STOCKS_REASON,
      plan: { action: "lp_stocks_unwired", reason: LP_STOCKS_REASON },
    };
  }
  if (intent.kind === "limits") return limitsPlan();
  if (intent.kind === "pay") return payPlan(raw, config);
  return {
    kind: "unknown",
    summary: "No matching intent.",
    plan: { action: "unknown", reason: "Could not parse prompt" },
  };
}

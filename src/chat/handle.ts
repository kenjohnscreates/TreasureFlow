import { formatUnits, type Address } from "viem";
import { encodeTransfer } from "../aerodrome/encode.ts";
import { assertNotStranded, truncateAddress } from "../bankr/parse.ts";
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
  "Slipstream NVDAc LP is pnpm bankr:lp. Chat does not submit. Not the nightly USDC/USDT sweep.";

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
    to: truncateAddress(plan.to),
    amountUsdc: formatUnits(plan.amountUsdc, USDC_DECIMALS),
    shortfallUsdc: formatUnits(plan.shortfallUsdc, USDC_DECIMALS),
    sent: "false",
  };
}

function rejectPay(code: string): ChatReply {
  const summary =
    code === "per_call_cap"
      ? "Rejected. Per-call cap is 10 USDC."
      : code === "hard_stop"
        ? "Rejected. Hard stop is 15 USDC per mainnet tx."
        : code === "not_allowlisted"
          ? "Rejected. Destination is not allowlisted."
          : code === "daily_cap"
            ? "Rejected. Daily cap would be exceeded."
            : code === "missing_pay_dest"
              ? "Rejected. PAY_DEST_1 is not set."
              : `Rejected. ${code}`;
  return {
    kind: "pay",
    summary,
    plan: { action: "rejected", code },
  };
}

function payPlan(raw: string, config: AppConfig): ChatReply {
  const intent = parseIntent(raw);
  if (intent.kind !== "pay") throw new AppError("parse", "expected pay intent");
  if (!config.payDestinations.length) return rejectPay("missing_pay_dest");
  try {
    const plan = planPay({
      snapshot: DEMO_SNAPSHOT,
      amountUsdc: intent.amountUsdc,
      to: intent.to,
      config,
      spend: [],
    });
    return {
      kind: "pay",
      summary: "Dry-run pay plan. Bankr transfer not sent from chat.",
      plan: serializePay(plan),
    };
  } catch (err) {
    if (err instanceof AppError) return rejectPay(err.code);
    throw err;
  }
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
      plan: { action: "lp_stocks_cli", reason: LP_STOCKS_REASON },
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

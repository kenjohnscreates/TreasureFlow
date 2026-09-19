import { formatUnits, type Address } from "viem";
import { encodeTransfer } from "../aerodrome/encode.ts";
import { DEMO_LP_USD } from "../bankr/skillTx.ts";
import { sizeTreasurySweep } from "../bankr/sweepLive.ts";
import {
  assertNotStranded,
  truncateAddress,
  type BankrPortfolioSnap,
} from "../bankr/parse.ts";
import {
  BASE,
  NVDAC_DECIMALS,
  USDC_DECIMALS,
  usdc,
  type AppConfig,
} from "../config/constants.ts";
import { AppError } from "../errors.ts";
import { DEMO_FLASH_PCT_BELOW, DEMO_FLASH_USDC, demoFlashLimitPrice } from "../flash/demoOrder.ts";
import { buildLimitLadder } from "../flash/ladder.ts";
import type { SpendEvent, TreasurySnapshot } from "../policy/math.ts";
import { assertHardStop, assertPerCall } from "../policy/math.ts";
import { planPay, type PayPlan, type SweepPlan } from "../sweep/plan.ts";
import {
  assertAllowlisted,
  parseIntent,
  resolvePayDest,
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

export type ChatOpts = {
  snapshot?: TreasurySnapshot;
  portfolio?: BankrPortfolioSnap;
  spend?: SpendEvent[];
  spotUsd?: number;
  reserveUsdc?: bigint;
};

const MISSING_LIVE =
  "Live treasury snapshot unavailable. Not using demo balances.";

function snapshotOf(opts: ChatOpts): TreasurySnapshot | undefined {
  return opts.snapshot;
}

function treasuryLabel(config: AppConfig, opts: ChatOpts): string | null {
  const addr = opts.portfolio?.evmAddress ?? config.treasuryAddress;
  return addr ? truncateAddress(addr) : null;
}

const LP_STOCKS_REASON =
  "Slipstream NVDAc LP. Confirm to submit. Notional under 15 USDC. Not the nightly USDC/USDT sweep.";

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

function sweepPlan(config: AppConfig, opts: ChatOpts): ChatReply {
  if (config.paused) return rejectChat("sweep", "paused");
  const snapshot = snapshotOf(opts);
  if (!snapshot) {
    return {
      kind: "sweep",
      summary: `${MISSING_LIVE} Confirm will noop.`,
      plan: {
        action: "noop",
        reason: "no_live_snapshot",
        surplusUsdc: "0",
        depositUsdc: "0",
        estimatedUsdt: "0",
        sent: false,
      },
    };
  }
  try {
    const plan = sizeTreasurySweep(config, snapshot);
    return {
      kind: "sweep",
      summary:
        plan.action === "add_liquidity"
          ? "Sweep plan. Confirm with write key and founder signature to submit."
          : "Nothing to sweep. Confirm will noop. Does not invent USDC.",
      plan: serializeSweep(plan),
    };
  } catch (err) {
    if (err instanceof AppError) return rejectChat("sweep", err.code);
    throw err;
  }
}

function balancePlan(config: AppConfig, opts: ChatOpts): ChatReply {
  const display = treasuryLabel(config, opts);
  const snap = opts.portfolio;
  if (!snap) {
    return {
      kind: "balance",
      summary: MISSING_LIVE,
      plan: { action: "balance", live: false },
    };
  }
  const treasury = display ?? "not created";
  return {
    kind: "balance",
    summary: `Company treasury ${treasury}. USDC ${snap.usdc}, USDT ${snap.usdt}, NVDAc ${snap.nvdac}, ETH ${snap.eth}.`,
    plan: {
      action: "balance",
      live: true,
      treasury,
      usdc: snap.usdc,
      usdt: snap.usdt,
      nvdac: snap.nvdac,
      eth: snap.eth,
    },
  };
}

const EXTERNAL_WALLET_REASON =
  "The External Wallet card shows that wallet. The agent only reports the company treasury. It does not send from the external wallet.";

function externalWalletPlan(): ChatReply {
  return {
    kind: "external_wallet",
    summary: EXTERNAL_WALLET_REASON,
    plan: { action: "external_wallet", reason: EXTERNAL_WALLET_REASON },
  };
}

function serializeSweep(plan: SweepPlan): Record<string, string | boolean> {
  return {
    action: plan.action,
    reason: plan.reason,
    surplusUsdc: plan.surplusUsdc.toString(),
    depositUsdc: plan.depositUsdc.toString(),
    estimatedUsdt: plan.estimatedUsdt.toString(),
    sent: false,
  };
}

function serializePay(plan: PayPlan): Record<string, string | boolean> {
  return {
    action: plan.action,
    to: truncateAddress(plan.to),
    amountUsdc: formatUnits(plan.amountUsdc, USDC_DECIMALS),
    shortfallUsdc: formatUnits(plan.shortfallUsdc, USDC_DECIMALS),
    sent: false,
  };
}

export function rejectChat(kind: Intent["kind"], code: string): ChatReply {
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
              : code === "insufficient_lp"
                ? "Rejected. Not enough LP USDC to cover payment shortfall."
                : code === "paused"
                  ? "Rejected. Pause is on. No outbound activity."
                  : code === "spend_unwritable"
                    ? "Rejected. Spend log is not writable."
                    : code === "no_live_snapshot"
                      ? MISSING_LIVE
                      : code === "missing_bankr"
                        ? "Rejected. BANKR_API_KEY is required."
                        : code === "missing_flash"
                          ? "Rejected. FLASH_API_KEY is required."
                          : `Rejected. ${code}`;
  return {
    kind,
    summary,
    plan: { action: "rejected", code },
  };
}

export function rejectChatPay(code: string): ChatReply {
  return rejectChat("pay", code);
}

function payPlan(raw: string, config: AppConfig, opts: ChatOpts): ChatReply {
  const intent = parseIntent(raw);
  if (intent.kind !== "pay") throw new AppError("parse", "expected pay intent");
  if (config.paused) return rejectChatPay("paused");
  if (!config.payDestinations.length) return rejectChatPay("missing_pay_dest");
  const to = resolvePayDest(intent.to, config.payDestinations);
  if (!to) return rejectChatPay("missing_pay_dest");
  try {
    assertAllowlisted(to, config.payDestinations);
    assertPerCall(intent.amountUsdc, config.policy);
    assertHardStop(intent.amountUsdc, config.policy);
  } catch (err) {
    if (err instanceof AppError) return rejectChatPay(err.code);
    throw err;
  }
  const snapshot = snapshotOf(opts);
  if (!snapshot) return rejectChatPay("no_live_snapshot");
  try {
    const plan = planPay({
      snapshot,
      amountUsdc: intent.amountUsdc,
      to,
      config,
      spend: opts.spend ?? [],
    });
    return {
      kind: "pay",
      summary:
        "Dry-run pay plan. Chat does not submit. Bankr transfer not sent from chat.",
      plan: serializePay(plan),
    };
  } catch (err) {
    if (err instanceof AppError) return rejectChatPay(err.code);
    throw err;
  }
}

const LIMITS_REASON =
  "Dry Flash limit ladder. Chat does not submit. Live is pnpm bankr:limits.";

function limitsPlan(opts: ChatOpts): ChatReply {
  const rungs = buildLimitLadder({
    spotUsd: opts.spotUsd ?? 110_000,
    reserveUsdc: opts.reserveUsdc ?? usdc(9),
  });
  return {
    kind: "limits",
    summary: LIMITS_REASON,
    plan: {
      action: "limits",
      rungs: String(rungs.length),
      sizesUsdc: rungs.map((rung) => rung.sizeUsdc.toString()).join(","),
      pcts: rungs.map((rung) => rung.pctBelowSpot).join(","),
    },
  };
}

function lpStocksPlan(config: AppConfig): ChatReply {
  if (config.paused) return rejectChat("lp_stocks", "paused");
  return {
    kind: "lp_stocks",
    summary: LP_STOCKS_REASON,
    plan: {
      action: "lp_stocks",
      reason: LP_STOCKS_REASON,
      sent: false,
      usd: DEMO_LP_USD,
    },
  };
}

const DEMO_FLASH_COPY =
  "Buy 1 USDC of cbBTC 0.01 percent below spot. Buys more on dips. No performance claim. Confirm to place. Does not promise a fill.";

function demoFlashPlan(config: AppConfig, opts: ChatOpts): ChatReply {
  if (config.paused) return rejectChat("demo_flash", "paused");
  try {
    assertPerCall(DEMO_FLASH_USDC, config.policy);
    assertHardStop(DEMO_FLASH_USDC, config.policy);
  } catch (err) {
    if (err instanceof AppError) return rejectChat("demo_flash", err.code);
    throw err;
  }
  const snapshot = snapshotOf(opts);
  const limitPriceUsd =
    typeof opts.spotUsd === "number"
      ? demoFlashLimitPrice(opts.spotUsd).toFixed(2)
      : "";
  const plan: Record<string, string | number | boolean> = {
    action: "noop",
    sent: false,
    qtyUsdc: formatUnits(DEMO_FLASH_USDC, USDC_DECIMALS),
    pctBelowSpot: DEMO_FLASH_PCT_BELOW,
    hardStopOk: DEMO_FLASH_USDC < config.policy.hardStopUsdc,
  };
  if (limitPriceUsd) plan.limitPriceUsd = limitPriceUsd;
  if (!snapshot) {
    return {
      kind: "demo_flash",
      summary: `${MISSING_LIVE} Confirm will noop.`,
      plan: { ...plan, reason: "no_live_snapshot" },
    };
  }
  if (snapshot.usdcFree < DEMO_FLASH_USDC) {
    return {
      kind: "demo_flash",
      summary: "Not enough USDC for a 1 USDC cbBTC limit. Confirm will noop.",
      plan: { ...plan, reason: snapshot.usdcFree <= 0n ? "no free USDC" : "insufficient_usdc" },
    };
  }
  return {
    kind: "demo_flash",
    summary: DEMO_FLASH_COPY,
    plan: { ...plan, action: "demo_flash", reason: "place demo flash" },
  };
}

export function handleChat(
  raw: string,
  config: AppConfig,
  opts: ChatOpts = {},
): ChatReply {
  const intent = parseIntent(raw);
  if (intent.kind === "deposit") return depositPlan(intent, config);
  if (intent.kind === "sweep") return sweepPlan(config, opts);
  if (intent.kind === "lp_stocks") return lpStocksPlan(config);
  if (intent.kind === "demo_flash") return demoFlashPlan(config, opts);
  if (intent.kind === "limits") return limitsPlan(opts);
  if (intent.kind === "pay") return payPlan(raw, config, opts);
  if (intent.kind === "balance") return balancePlan(config, opts);
  if (intent.kind === "external_wallet") return externalWalletPlan();
  return {
    kind: "unknown",
    summary: "No matching intent.",
    plan: { action: "unknown", reason: "Could not parse prompt" },
  };
}

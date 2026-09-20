import { executeLp, type LpLiveDeps } from "../bankr/lpLive.ts";
import { executeSweep, type SweepLiveDeps } from "../bankr/sweepLive.ts";
import { type AppConfig } from "../config/constants.ts";
import { AppError } from "../errors.ts";
import { executeDemoFlash, type DemoFlashDeps } from "../flash/demoOrder.ts";
import { truncateAddress } from "../bankr/parse.ts";
import { assertNotPaused } from "../policy/math.ts";
import { assertSpendWritable } from "../policy/spendLog.ts";
import { rejectChat, type ChatOpts, type ChatReply } from "./handle.ts";
import { maybeSubmitChatPay, type SubmitPayDeps } from "./submitPay.ts";

export type SubmitWriteDeps = SubmitPayDeps &
  SweepLiveDeps &
  LpLiveDeps &
  DemoFlashDeps & {
    usdcFree?: bigint;
  };

async function guardOutbound(
  kind: ChatReply["kind"],
  config: AppConfig,
  deps: SubmitWriteDeps,
): Promise<ChatReply | undefined> {
  try {
    assertNotPaused(config.paused);
  } catch (err) {
    if (err instanceof AppError && err.code === "paused") return rejectChat(kind, "paused");
    throw err;
  }
  const probe = deps.assertSpendWritable ?? assertSpendWritable;
  try {
    await probe();
  } catch (err) {
    if (err instanceof AppError && err.code === "spend_unwritable") {
      return rejectChat(kind, "spend_unwritable");
    }
    throw err;
  }
  return undefined;
}

function snapshotFromReply(
  reply: ChatReply,
  opts: ChatOpts,
  deps: SubmitWriteDeps,
): { usdcFree: bigint; usdtFree: bigint; lpValueUsdc: bigint } | undefined {
  if (opts.snapshot) return opts.snapshot;
  if (deps.usdcFree !== undefined) {
    return { usdcFree: deps.usdcFree, usdtFree: 0n, lpValueUsdc: 0n };
  }
  return undefined;
}

export async function maybeSubmitChatSweep(
  reply: ChatReply,
  config: AppConfig,
  opts: ChatOpts = {},
  deps: SubmitWriteDeps = {},
): Promise<ChatReply> {
  if (reply.kind !== "sweep") return reply;
  if (reply.plan.action !== "add_liquidity" && reply.plan.action !== "noop") return reply;
  const blocked = await guardOutbound("sweep", config, deps);
  if (blocked) return blocked;
  const snapshot = snapshotFromReply(reply, opts, deps);
  if (!snapshot) {
    return {
      kind: "sweep",
      summary: "Nothing to sweep. Live USDC unavailable. Did not invent funds.",
      plan: { ...reply.plan, action: "noop", sent: false, reason: "no_live_snapshot" },
    };
  }
  try {
    const result = await executeSweep({ config, snapshot, live: true, deps });
    if (!result.sent) {
      return {
        kind: "sweep",
        summary: `Nothing to sweep (${result.reason}). Did not add liquidity.`,
        plan: {
          ...reply.plan,
          action: result.sized.action,
          reason: result.reason,
          sent: false,
          surplusUsdc: result.sized.surplusUsdc.toString(),
          depositUsdc: result.sized.depositUsdc.toString(),
          estimatedUsdt: result.sized.estimatedUsdt.toString(),
        },
      };
    }
    const addTrunc = result.addTx ? truncateAddress(result.addTx) : "";
    return {
      kind: "sweep",
      summary: `Swept ${result.amountUsdc} USDC into sAMM. Tx ${addTrunc}.`,
      plan: {
        ...reply.plan,
        action: "add_liquidity",
        sent: true,
        ...(result.addTx ? { addTx: addTrunc } : {}),
        ...(result.amountUsdc ? { amountUsdc: result.amountUsdc } : {}),
        ...(result.amountUsdt ? { amountUsdt: result.amountUsdt } : {}),
      },
    };
  } catch (err) {
    if (err instanceof AppError) return rejectChat("sweep", err.code);
    throw err;
  }
}

export async function maybeSubmitChatLp(
  reply: ChatReply,
  config: AppConfig,
  opts: ChatOpts = {},
  deps: SubmitWriteDeps = {},
): Promise<ChatReply> {
  if (reply.kind !== "lp_stocks") return reply;
  if (reply.plan.action !== "lp_stocks") return reply;
  const blocked = await guardOutbound("lp_stocks", config, deps);
  if (blocked) return blocked;
  const usdcFree = opts.snapshot?.usdcFree ?? deps.usdcFree ?? 0n;
  try {
    const result = await executeLp({
      config,
      live: true,
      usdcFree,
      deps,
    });
    if (!result.sent) {
      return {
        kind: "lp_stocks",
        summary:
          result.mode === "increase"
            ? `LP stocks noop (${result.reason}). Did not increase.`
            : `LP stocks noop (${result.reason}). Did not mint.`,
        plan: {
          ...reply.plan,
          sent: false,
          reason: result.reason,
          usd: result.usd,
          mode: result.mode,
          ...(result.tokenId ? { tokenId: result.tokenId } : {}),
        },
      };
    }
    const mintTrunc = result.mintTx ? truncateAddress(result.mintTx) : "";
    const added = result.mode === "increase" && result.tokenId;
    return {
      kind: "lp_stocks",
      summary: added
        ? `Added $${result.usd} to NFT #${result.tokenId}.`
        : `LP stocks submitted. Notional $${result.usd}. Mint ${mintTrunc}.`,
      plan: {
        ...reply.plan,
        sent: true,
        usd: result.usd,
        mode: result.mode,
        ...(result.mintTx ? { mintTx: mintTrunc } : {}),
        ...(result.increaseTx ? { increaseTx: truncateAddress(result.increaseTx) } : {}),
        ...(result.tokenId ? { tokenId: result.tokenId } : {}),
        ...(typeof result.amount0Usdc === "number" ? { amount0Usdc: result.amount0Usdc } : {}),
      },
    };
  } catch (err) {
    if (err instanceof AppError) return rejectChat("lp_stocks", err.code);
    throw err;
  }
}

export async function maybeSubmitChatFlash(
  reply: ChatReply,
  config: AppConfig,
  opts: ChatOpts = {},
  deps: SubmitWriteDeps = {},
): Promise<ChatReply> {
  const dip = reply.kind === "dip_flash";
  if (reply.kind !== "demo_flash" && !dip) return reply;
  const actionOk = dip
    ? reply.plan.action === "dip_flash" || reply.plan.action === "noop"
    : reply.plan.action === "demo_flash" || reply.plan.action === "noop";
  if (!actionOk) return reply;
  const kind = dip ? "dip_flash" : "demo_flash";
  const blocked = await guardOutbound(kind, config, deps);
  if (blocked) return blocked;
  const usdcFree = opts.snapshot?.usdcFree ?? deps.usdcFree ?? 0n;
  try {
    const result = await executeDemoFlash({
      config,
      usdcFree,
      live: true,
      mode: dip ? "limit" : "market",
      deps,
    });
    if (!result.sent) {
      return {
        kind,
        summary: dip
          ? `Buy-the-dip noop (${result.reason}). Did not place an order.`
          : `Market buy noop (${result.reason}). Did not place an order.`,
        plan: {
          ...reply.plan,
          action: "noop",
          sent: false,
          reason: result.reason,
          qtyUsdc: result.qtyUsdc,
          pctBelowSpot: result.pctBelowSpot,
          orderType: dip ? "limit" : "market",
          ...(dip ? {} : { maxSlippage: "0.05" }),
          ...(result.limitPriceUsd ? { limitPriceUsd: result.limitPriceUsd } : {}),
        },
      };
    }
    return {
      kind,
      summary: dip
        ? `Placed buy-the-dip limit for cbBTC. Spend ${result.qtyUsdc} USDC. ${result.pctBelowSpot}% below spot. Limit $${result.limitPriceUsd}/cbBTC. Fills only if spot drops to that limit. Does not promise a fill. Order ${result.orderId ?? ""}.`
        : `Placed market buy of cbBTC. Spend ${result.qtyUsdc} USDC. 5% slippage. This is a market order. Does not promise a fill. Order ${result.orderId ?? ""}.`,
      plan: {
        ...reply.plan,
        action: dip ? "dip_flash" : "demo_flash",
        sent: true,
        qtyUsdc: result.qtyUsdc,
        pctBelowSpot: result.pctBelowSpot,
        orderType: dip ? "limit" : "market",
        ...(dip ? {} : { maxSlippage: "0.05" }),
        ...(result.orderId ? { orderId: result.orderId } : {}),
        ...(result.status ? { status: result.status } : {}),
        ...(result.limitPriceUsd ? { limitPriceUsd: result.limitPriceUsd } : {}),
        ...(result.filledQty ? { filledQty: result.filledQty } : {}),
      },
    };
  } catch (err) {
    if (err instanceof AppError) return rejectChat(kind, err.code);
    throw err;
  }
}

export async function maybeSubmitChat(
  prompt: string,
  reply: ChatReply,
  config: AppConfig,
  opts: ChatOpts = {},
  deps: SubmitWriteDeps = {},
): Promise<ChatReply> {
  if (reply.kind === "pay") return maybeSubmitChatPay(prompt, reply, config, deps);
  if (reply.kind === "sweep") return maybeSubmitChatSweep(reply, config, opts, deps);
  if (reply.kind === "lp_stocks") return maybeSubmitChatLp(reply, config, opts, deps);
  if (reply.kind === "demo_flash") return maybeSubmitChatFlash(reply, config, opts, deps);
  if (reply.kind === "dip_flash") return maybeSubmitChatFlash(reply, config, opts, deps);
  return reply;
}

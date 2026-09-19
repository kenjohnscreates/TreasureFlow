import { formatUnits } from "viem";
import { publicRpc, readSammLpValueUsdc } from "../aerodrome/quote.ts";
import { getWalletPortfolio } from "../bankr/client.ts";
import {
  parsePortfolio,
  truncateAddress,
  type BankrPortfolioSnap,
} from "../bankr/parse.ts";
import { portfolioToSnapshot } from "../bankr/snapshot.ts";
import { BASE, USDC_DECIMALS, type AppConfig } from "../config/constants.ts";
import { FLASH_ORDERS } from "../demo/evidence.ts";
import { AppError } from "../errors.ts";
import { getOrder } from "../flash/http.ts";
import { parseFlashOrderStatus } from "../flash/parse.ts";
import { sizeLiveLimits } from "../flash/size.ts";
import { log } from "../log.ts";
import { remainingDailyCap, type SpendEvent } from "../policy/math.ts";
import { loadSpend } from "../policy/spendLog.ts";
import { readSpotUsd } from "../oracle/chainlink.ts";
import { parseIntent } from "./intent.ts";
import type { ChatOpts } from "./handle.ts";

export type PublicTreasury = {
  live: boolean;
  eth?: string;
  usdc?: string;
  usdt?: string;
  nvdac?: string;
  tokenCount?: number;
  treasuryDisplay: string | null;
};

export type PublicFlashOrder = {
  id: string;
  rungPct: 2 | 4 | 6;
  limitPriceUsd: string;
  qtyUsdc: string;
  status: string;
};

export type PublicFlashOrders = {
  live: boolean;
  orders: PublicFlashOrder[];
};

function treasuryDisplay(config: AppConfig, snap?: BankrPortfolioSnap): string | null {
  if (snap?.evmAddress) return truncateAddress(snap.evmAddress);
  if (config.treasuryAddress) return truncateAddress(config.treasuryAddress);
  return null;
}

export async function tryBankrPortfolio(
  config: AppConfig,
): Promise<BankrPortfolioSnap | undefined> {
  if (!config.bankrApiKey) return undefined;
  try {
    const snap = parsePortfolio(await getWalletPortfolio(config.bankrApiKey));
    const display = treasuryDisplay(config, snap);
    log("bankr_portfolio_read", {
      live: true,
      ...(display ? { treasury: display } : {}),
      eth: snap.eth,
      usdc: snap.usdc,
      usdt: snap.usdt,
      nvdac: snap.nvdac,
      tokenCount: snap.tokenCount,
    });
    return snap;
  } catch (err) {
    const code = err instanceof AppError ? err.code : "bankr_http";
    log("bankr_portfolio_read", { live: false, code });
    return undefined;
  }
}

export async function publicTreasury(config: AppConfig): Promise<PublicTreasury> {
  const snap = await tryBankrPortfolio(config);
  if (!snap) return { live: false, treasuryDisplay: treasuryDisplay(config) };
  return {
    live: true,
    eth: snap.eth,
    usdc: snap.usdc,
    usdt: snap.usdt,
    nvdac: snap.nvdac,
    tokenCount: snap.tokenCount,
    treasuryDisplay: treasuryDisplay(config, snap),
  };
}

function staticFlashOrders(): PublicFlashOrder[] {
  return FLASH_ORDERS.map((order) => ({ ...order, status: "resting" }));
}

export async function publicFlashOrders(config: AppConfig): Promise<PublicFlashOrders> {
  const fallback = staticFlashOrders();
  if (!config.flashApiKey || !config.treasuryAddress) {
    return { live: false, orders: fallback };
  }
  const treasury = config.treasuryAddress;
  let liveHits = 0;
  const orders = await Promise.all(
    FLASH_ORDERS.map(async (order) => {
      try {
        const body = await getOrder(config.flashApiKey, order.id, treasury);
        liveHits += 1;
        return { ...order, status: parseFlashOrderStatus(body) };
      } catch (err) {
        const code = err instanceof AppError ? err.code : "flash_http";
        log("flash_order_read", { id: order.id, code });
        return { ...order, status: "resting" };
      }
    }),
  );
  return { live: liveHits > 0, orders };
}

async function loadSpendSafe(): Promise<SpendEvent[]> {
  try {
    return await loadSpend();
  } catch {
    return [];
  }
}

export async function chatLiveOpts(config: AppConfig, prompt: string): Promise<ChatOpts> {
  const intent = parseIntent(prompt);
  const opts: ChatOpts = {};
  const snap = await tryBankrPortfolio(config);
  if (snap) {
    opts.portfolio = snap;
    let lpValueUsdc = 0n;
    const needsLp =
      intent.kind === "sweep" || intent.kind === "pay" || intent.kind === "limits";
    const owner = snap.evmAddress ?? config.treasuryAddress;
    if (needsLp && owner) {
      try {
        const lp = await readSammLpValueUsdc(owner, publicRpc(config.baseRpcUrl));
        lpValueUsdc = lp.amountUsdc;
        log("samm_lp_quote", {
          lpValueUsdc: formatUnits(lp.amountUsdc, USDC_DECIMALS),
          lpValueUsdt: formatUnits(lp.amountUsdt, USDC_DECIMALS),
          liquidity: lp.liquidity.toString(),
        });
      } catch (err) {
        const code = err instanceof AppError ? err.code : "aerodrome_quote";
        log("samm_lp_quote", { live: false, code });
      }
    }
    opts.snapshot = portfolioToSnapshot(snap, lpValueUsdc);
  }

  if (intent.kind === "pay") opts.spend = await loadSpendSafe();

  if (intent.kind === "limits" && opts.snapshot) {
    const spend = opts.spend ?? (await loadSpendSafe());
    const sized = sizeLiveLimits({
      usdcFree: opts.snapshot.usdcFree,
      bufferUsdc: config.policy.bufferUsdc,
      hardStopUsdc: config.policy.hardStopUsdc,
      perCallCapUsdc: config.policy.perCallCapUsdc,
      dailyLeftUsdc: remainingDailyCap(config.policy.dailyCapUsdc, spend),
    });
    try {
      opts.spotUsd = await readSpotUsd(BASE.btcUsdFeed, config.baseRpcUrl);
      opts.reserveUsdc = sized.reserveUsdc;
    } catch {
      /* dummy ladder in handleChat */
    }
  }
  return opts;
}

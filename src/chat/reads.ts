import { formatUnits, type Address } from "viem";
import { publicRpc, readSammLpValueUsdc, PUBLIC_RPCS, type SammLpPosition } from "../aerodrome/quote.ts";
import {
  readNvdaSlipstreamLps,
  type SlipstreamLp,
} from "../aerodrome/slipstream.ts";
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
import { loadDemoFlash } from "../flash/demoPersist.ts";
import { getOrder } from "../flash/http.ts";
import { parseFlashFilledQty, parseFlashOrderStatus } from "../flash/parse.ts";
import { sizeLiveLimits } from "../flash/size.ts";
import { log } from "../log.ts";
import { remainingDailyCap, type SpendEvent } from "../policy/math.ts";
import { loadSpend } from "../policy/spendLog.ts";
import {
  ethNotionalUsd,
  formatUsdDecimal,
  nvdacNotionalUsd,
  readEthSpotUsd,
  readNvdaSpotUsd,
  readSpotUsd,
} from "../oracle/chainlink.ts";
import { parseIntent } from "./intent.ts";
import type { ChatOpts } from "./handle.ts";

export type PublicSlipstreamLp = SlipstreamLp;

export type PublicTreasury = {
  live: boolean;
  eth?: string;
  ethUsd?: string;
  ethUsdValue?: string;
  usdc?: string;
  usdt?: string;
  nvdac?: string;
  nvdacUsd?: string;
  nvdacUsdValue?: string;
  tokenCount?: number;
  treasuryDisplay: string | null;
  totalUsd?: string;
  sammLpUsdc?: string;
  sammLpUsdt?: string;
  slipstream?: PublicSlipstreamLp[];
};

export type PublicTreasuryDeps = {
  snap?: BankrPortfolioSnap;
  readEthSpotUsd?: typeof readEthSpotUsd;
  readNvdaSpotUsd?: typeof readNvdaSpotUsd;
  readSammLp?: typeof readSammLpValueUsdc;
  readSlipstream?: typeof readNvdaSlipstreamLps;
};

export type PublicFlashOrder = {
  id: string;
  rungPct: number;
  limitPriceUsd: string;
  qtyUsdc: string;
  status: string;
  filledQty?: string;
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

async function chainRead<T>(rpcUrl: string, fn: (url: string) => Promise<T>): Promise<T> {
  const urls = [rpcUrl, ...PUBLIC_RPCS.filter((url) => url !== rpcUrl)];
  let last: unknown;
  for (const url of urls) {
    try {
      return await fn(url);
    } catch (err) {
      if (err instanceof AppError) throw err;
      last = err;
    }
  }
  throw last instanceof Error ? last : new AppError("oracle_http", "all RPCs failed");
}

async function withEthUsd(
  body: PublicTreasury,
  rpcUrl: string,
  readFn: typeof readEthSpotUsd,
): Promise<Partial<PublicTreasury>> {
  try {
    const spot = await chainRead(rpcUrl, (url) => readFn(BASE.ethUsdFeed, url));
    if (!Number.isFinite(spot) || spot <= 0) {
      log("eth_usd_oracle", { live: false, code: "oracle_range" });
      return {};
    }
    const ethUsd = formatUsdDecimal(spot);
    const next: Partial<PublicTreasury> = { ethUsd };
    if (body.eth !== undefined) {
      const value = ethNotionalUsd(body.eth, spot);
      if (value !== undefined) next.ethUsdValue = value;
    }
    log("eth_usd_oracle", {
      live: true,
      ...(body.treasuryDisplay ? { treasury: body.treasuryDisplay } : {}),
      ethUsd,
      ...(next.ethUsdValue !== undefined ? { ethUsdValue: next.ethUsdValue } : {}),
    });
    return next;
  } catch (err) {
    const code = err instanceof AppError ? err.code : "oracle_http";
    log("eth_usd_oracle", { live: false, code });
    return {};
  }
}

async function withNvdaUsd(
  body: PublicTreasury,
  rpcUrl: string,
  readFn: typeof readNvdaSpotUsd,
): Promise<Partial<PublicTreasury>> {
  try {
    const spot = await chainRead(rpcUrl, (url) => readFn(BASE.nvdaUsdFeed, url));
    if (!Number.isFinite(spot) || spot <= 0) {
      log("nvda_usd_oracle", { live: false, code: "oracle_range" });
      return {};
    }
    const nvdacUsd = formatUsdDecimal(spot);
    const next: Partial<PublicTreasury> = { nvdacUsd };
    if (body.nvdac !== undefined) {
      const value = nvdacNotionalUsd(body.nvdac, spot);
      if (value !== undefined) next.nvdacUsdValue = value;
    }
    log("nvda_usd_oracle", {
      live: true,
      ...(body.treasuryDisplay ? { treasury: body.treasuryDisplay } : {}),
      nvdacUsd,
      ...(next.nvdacUsdValue !== undefined ? { nvdacUsdValue: next.nvdacUsdValue } : {}),
    });
    return next;
  } catch (err) {
    const code = err instanceof AppError ? err.code : "oracle_http";
    log("nvda_usd_oracle", { live: false, code });
    return {};
  }
}

async function withSammLp(
  body: PublicTreasury,
  owner: Address,
  rpcUrl: string,
  readFn: typeof readSammLpValueUsdc,
): Promise<Partial<PublicTreasury>> {
  try {
    const lp: SammLpPosition = await chainRead(rpcUrl, (url) => readFn(owner, url));
    if (lp.liquidity === 0n || (lp.amountUsdc === 0n && lp.amountUsdt === 0n)) {
      log("samm_lp_quote", { live: true, liquidity: "0" });
      return {};
    }
    const sammLpUsdc = formatUnits(lp.amountUsdc, USDC_DECIMALS);
    const sammLpUsdt = formatUnits(lp.amountUsdt, USDC_DECIMALS);
    log("samm_lp_quote", {
      live: true,
      ...(body.treasuryDisplay ? { treasury: body.treasuryDisplay } : {}),
      sammLpUsdc,
      sammLpUsdt,
      liquidity: lp.liquidity.toString(),
    });
    return { sammLpUsdc, sammLpUsdt };
  } catch (err) {
    const code = err instanceof AppError ? err.code : "aerodrome_quote";
    log("samm_lp_quote", { live: false, code });
    return {};
  }
}

async function withSlipstream(
  body: PublicTreasury,
  owner: Address,
  rpcUrl: string,
  readFn: typeof readNvdaSlipstreamLps,
): Promise<Partial<PublicTreasury>> {
  try {
    const slipstream = await chainRead(rpcUrl, (url) => readFn(owner, url));
    if (slipstream.length === 0) {
      log("slipstream_lp_read", { live: true, count: 0 });
      return {};
    }
    log("slipstream_lp_read", {
      live: true,
      ...(body.treasuryDisplay ? { treasury: body.treasuryDisplay } : {}),
      count: slipstream.length,
      tokenId: slipstream[0]?.tokenId ?? "",
      staked: slipstream[0]?.staked === true,
      ...(slipstream[0]?.usd !== undefined ? { usd: slipstream[0].usd } : {}),
    });
    return { slipstream };
  } catch (err) {
    const code = err instanceof AppError ? err.code : "slipstream_quote";
    log("slipstream_lp_read", { live: false, code });
    return {};
  }
}

export function totalUsdFromLegs(legs: Array<string | undefined>): string | undefined {
  const nums: number[] = [];
  for (const raw of legs) {
    if (raw === undefined) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) continue;
    nums.push(n);
  }
  if (nums.length === 0) return undefined;
  return formatUsdDecimal(nums.reduce((a, b) => a + b, 0));
}

function withTotalUsd(body: PublicTreasury): PublicTreasury {
  if (!body.live) return body;
  const slipUsd = body.slipstream?.map((row) => row.usd) ?? [];
  const totalUsd = totalUsdFromLegs([
    body.usdc,
    body.usdt,
    body.ethUsdValue,
    body.nvdacUsdValue,
    body.sammLpUsdc,
    body.sammLpUsdt,
    ...slipUsd,
  ]);
  if (totalUsd === undefined) return body;
  log("treasury_total", {
    live: true,
    ...(body.treasuryDisplay ? { treasury: body.treasuryDisplay } : {}),
    totalUsd,
  });
  return { ...body, totalUsd };
}

export async function publicTreasury(
  config: AppConfig,
  deps: PublicTreasuryDeps = {},
): Promise<PublicTreasury> {
  const snap = deps.snap ?? (await tryBankrPortfolio(config));
  if (!snap) return { live: false, treasuryDisplay: treasuryDisplay(config) };
  let body: PublicTreasury = {
    live: true,
    eth: snap.eth,
    usdc: snap.usdc,
    usdt: snap.usdt,
    nvdac: snap.nvdac,
    tokenCount: snap.tokenCount,
    treasuryDisplay: treasuryDisplay(config, snap),
  };
  const rpcUrl = config.baseRpcUrl;
  if (!rpcUrl) {
    log("treasury_chain", { live: false, code: "missing_rpc" });
    return withTotalUsd(body);
  }
  const owner = snap.evmAddress ?? config.treasuryAddress;
  const [eth, nvda] = await Promise.all([
    withEthUsd(body, rpcUrl, deps.readEthSpotUsd ?? readEthSpotUsd),
    withNvdaUsd(body, rpcUrl, deps.readNvdaSpotUsd ?? readNvdaSpotUsd),
  ]);
  body = { ...body, ...eth, ...nvda };
  if (owner) {
    body = {
      ...body,
      ...(await withSammLp(body, owner, rpcUrl, deps.readSammLp ?? readSammLpValueUsdc)),
    };
    body = {
      ...body,
      ...(await withSlipstream(body, owner, rpcUrl, deps.readSlipstream ?? readNvdaSlipstreamLps)),
    };
  }
  return withTotalUsd(body);
}

function staticFlashOrders(): PublicFlashOrder[] {
  return FLASH_ORDERS.map((order) => ({ ...order, status: "resting" }));
}

async function withLiveStatus(
  order: PublicFlashOrder,
  apiKey: string,
  treasury: string,
): Promise<{ order: PublicFlashOrder; hit: boolean }> {
  try {
    const body = await getOrder(apiKey, order.id, treasury);
    const filledQty = parseFlashFilledQty(body);
    const live: PublicFlashOrder = {
      ...order,
      status: parseFlashOrderStatus(body),
    };
    if (filledQty) live.filledQty = filledQty;
    return { order: live, hit: true };
  } catch (err) {
    const code = err instanceof AppError ? err.code : "flash_http";
    log("flash_order_read", { id: order.id, code });
    return { order: { ...order, status: order.status || "resting" }, hit: false };
  }
}

export async function publicFlashOrders(config: AppConfig): Promise<PublicFlashOrders> {
  const fallback = staticFlashOrders();
  const demo = await loadDemoFlash();
  const demoRows: PublicFlashOrder[] = demo.orders.map((order) => ({
    id: order.id,
    rungPct: order.pctBelowSpot,
    limitPriceUsd: order.limitPriceUsd,
    qtyUsdc: order.qtyUsdc,
    status: "resting",
  }));
  const merged = [...fallback];
  for (const row of demoRows) {
    if (!merged.some((order) => order.id === row.id)) merged.push(row);
  }
  if (!config.flashApiKey || !config.treasuryAddress) {
    return { live: false, orders: merged };
  }
  const treasury = config.treasuryAddress;
  const rows = await Promise.all(
    merged.map((order) => withLiveStatus(order, config.flashApiKey, treasury)),
  );
  return {
    live: rows.some((row) => row.hit),
    orders: rows.map((row) => row.order),
  };
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

  if (intent.kind === "pay" || intent.kind === "demo_flash" || intent.kind === "dip_flash") {
    opts.spend = await loadSpendSafe();
  }

  if (intent.kind === "demo_flash" || intent.kind === "dip_flash") {
    try {
      opts.spotUsd = await readSpotUsd(BASE.btcUsdFeed, config.baseRpcUrl);
    } catch {
      /* plan without a live limit price */
    }
  }

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

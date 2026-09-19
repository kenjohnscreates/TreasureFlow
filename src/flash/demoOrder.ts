import { formatUnits } from "viem";
import { publicRpc } from "../aerodrome/quote.ts";
import { assertNotStranded, truncateAddress } from "../bankr/parse.ts";
import { parseSkillTx } from "../bankr/skillTx.ts";
import { submitSkillTx } from "../bankr/submitRaw.ts";
import { BASE, USDC_DECIMALS, usdc, type AppConfig } from "../config/constants.ts";
import { FLASH_ORDERS } from "../demo/evidence.ts";
import { AppError } from "../errors.ts";
import { log } from "../log.ts";
import { readSpotUsd } from "../oracle/chainlink.ts";
import { assertHardStop, assertNotPaused, remainingDailyCap } from "../policy/math.ts";
import { appendSpend, loadSpend } from "../policy/spendLog.ts";
import { appendDemoFlashOrder } from "./demoPersist.ts";
import { getOrder, quoteOrder, submitOrder } from "./http.ts";
import {
  isEip7702Code,
  readAccountCode,
  readKernelDomain,
  type KernelDomain,
} from "./kernel.ts";
import {
  parseFlashFilledQty,
  parseFlashOrderId,
  parseFlashOrderStatus,
  parseFlashQuote,
} from "./parse.ts";
import { signFlashPayload } from "./sign.ts";
import { limitBuyQuote } from "./types.ts";

export const DEMO_FLASH_USDC = usdc(1);
export const DEMO_FLASH_PCT_BELOW = 0.01;

export function isProtectedFlashOrderId(id: string): boolean {
  return FLASH_ORDERS.some((order) => order.id === id);
}

export function demoFlashLimitPrice(
  spotUsd: number,
  pctBelow = DEMO_FLASH_PCT_BELOW,
): number {
  return spotUsd * (1 - pctBelow / 100);
}

function usdPrice(value: number): string {
  return value.toFixed(2);
}

export type DemoFlashDeps = {
  readSpotUsd?: typeof readSpotUsd;
  quoteOrder?: typeof quoteOrder;
  submitOrder?: typeof submitOrder;
  getOrder?: typeof getOrder;
  signFlashPayload?: typeof signFlashPayload;
  submitSkillTx?: typeof submitSkillTx;
  appendSpend?: typeof appendSpend;
  loadSpend?: typeof loadSpend;
  appendDemoFlashOrder?: typeof appendDemoFlashOrder;
  readAccountCode?: typeof readAccountCode;
  readKernelDomain?: typeof readKernelDomain;
};

export type DemoFlashResult = {
  sent: boolean;
  reason: string;
  qtyUsdc: string;
  pctBelowSpot: number;
  spotUsd?: number;
  limitPriceUsd?: string;
  orderId?: string;
  status?: string;
  filledQty?: string;
};

export async function executeDemoFlash(args: {
  config: AppConfig;
  usdcFree: bigint;
  live: boolean;
  deps?: DemoFlashDeps;
}): Promise<DemoFlashResult> {
  const { config, usdcFree, live } = args;
  const deps = args.deps ?? {};
  const qtyUsdc = formatUnits(DEMO_FLASH_USDC, USDC_DECIMALS);
  const base: DemoFlashResult = {
    sent: false,
    reason: "",
    qtyUsdc,
    pctBelowSpot: DEMO_FLASH_PCT_BELOW,
  };
  assertNotPaused(config.paused);
  assertHardStop(DEMO_FLASH_USDC, config.policy);
  const treasury = config.treasuryAddress;
  if (!treasury) throw new AppError("missing_treasury", "TREASURY_ADDRESS is required");
  assertNotStranded(treasury);
  if (usdcFree < DEMO_FLASH_USDC) {
    const reason = usdcFree <= 0n ? "no free USDC" : "insufficient_usdc";
    log("bankr_demo_flash", { sent: false, reason });
    return { ...base, reason };
  }
  const spendFn = deps.loadSpend ?? loadSpend;
  const spend = await spendFn();
  const dailyLeft = remainingDailyCap(config.policy.dailyCapUsdc, spend);
  if (DEMO_FLASH_USDC > dailyLeft) {
    throw new AppError("daily_cap", "demo flash USDC would exceed daily cap");
  }
  const spotFn = deps.readSpotUsd ?? readSpotUsd;
  const spotUsd = await spotFn(BASE.btcUsdFeed, publicRpc(config.baseRpcUrl));
  const limitPriceUsd = usdPrice(demoFlashLimitPrice(spotUsd));
  const priced = { ...base, spotUsd, limitPriceUsd, reason: "place demo flash" };
  if (!live) {
    log("bankr_demo_flash", { sent: false, reason: "not live", limitPriceUsd, spotUsd });
    return { ...priced, reason: "not live" };
  }
  if (!config.bankrApiKey) {
    throw new AppError("missing_bankr", "BANKR_API_KEY is required for demo flash");
  }
  if (!config.flashApiKey) {
    throw new AppError("missing_flash", "FLASH_API_KEY is required for demo flash");
  }

  const request = limitBuyQuote({
    targetAsset: BASE.cbBtc,
    contraAsset: BASE.usdc,
    qtyUsdc,
    limitNotionalPrice: limitPriceUsd,
    funderAddress: treasury,
  });
  const quoteFn = deps.quoteOrder ?? quoteOrder;
  const quoted = parseFlashQuote(await quoteFn(config.flashApiKey, request));
  log("bankr_demo_flash_quote", {
    qty: qtyUsdc,
    limitNotionalPrice: limitPriceUsd,
    quoteId: quoted.quoteId,
    hasApprove: Boolean(quoted.approveTx),
  });

  const codeFn = deps.readAccountCode ?? readAccountCode;
  const code = await codeFn(treasury, config.baseRpcUrl);
  const kernel: KernelDomain | undefined = isEip7702Code(code)
    ? await (deps.readKernelDomain ?? readKernelDomain)(treasury, config.baseRpcUrl)
    : undefined;
  const signFn = deps.signFlashPayload ?? signFlashPayload;
  const kernelArg = kernel ? { kernel } : {};

  if (quoted.approveTx) {
    if (quoted.approveTx.to.toLowerCase() !== BASE.usdc.toLowerCase()) {
      throw new AppError("flash_quote", "Flash approveTx to is not USDC");
    }
    const tx = parseSkillTx({
      to: quoted.approveTx.to,
      data: quoted.approveTx.data,
      value: "0",
      chainId: BASE.chainId,
      label: "approve USDC -> Flash",
    });
    const submitTx = deps.submitSkillTx ?? submitSkillTx;
    const hash = await submitTx(config.bankrApiKey, tx);
    log("bankr_demo_flash_approve", { txHash: truncateAddress(hash) });
  }

  let permitFields: Record<string, string> = {};
  if (quoted.permitTypedData) {
    const permit = await signFn({
      apiKey: config.bankrApiKey,
      typedDataJson: quoted.permitTypedData,
      ...kernelArg,
    });
    permitFields = {
      evmPermitTypedData: permit.echo,
      evmPermitSignature: permit.signature,
    };
  }
  const signed = await signFn({
    apiKey: config.bankrApiKey,
    typedDataJson: quoted.orderTypedData,
    ...kernelArg,
  });
  const submitFn = deps.submitOrder ?? submitOrder;
  const submitted = parseFlashOrderId(
    await submitFn(config.flashApiKey, {
      ...request,
      funderAddress: treasury,
      quoteId: quoted.quoteId,
      userSignature: signed.signature,
      evmOrderTypedData: signed.echo,
      ...permitFields,
    }),
  );
  if (isProtectedFlashOrderId(submitted)) {
    throw new AppError("flash_order", "demo flash must not reuse a B5 order id");
  }

  const getFn = deps.getOrder ?? getOrder;
  let status = "submitted";
  let filledQty: string | undefined;
  try {
    const body = await getFn(config.flashApiKey, submitted, treasury);
    status = parseFlashOrderStatus(body);
    filledQty = parseFlashFilledQty(body);
  } catch (err) {
    if (!(err instanceof AppError) || err.code !== "flash_http") throw err;
  }

  const append = deps.appendSpend ?? appendSpend;
  await append(DEMO_FLASH_USDC);
  const persist = deps.appendDemoFlashOrder ?? appendDemoFlashOrder;
  await persist({
    id: submitted,
    qtyUsdc,
    limitPriceUsd,
    pctBelowSpot: DEMO_FLASH_PCT_BELOW,
    spotUsd,
  });
  log("bankr_demo_flash", {
    sent: true,
    orderId: submitted,
    status,
    ...(filledQty ? { filledQty } : {}),
    qty: qtyUsdc,
    limitNotionalPrice: limitPriceUsd,
  });
  const out: DemoFlashResult = {
    sent: true,
    reason: "placed",
    qtyUsdc,
    pctBelowSpot: DEMO_FLASH_PCT_BELOW,
    spotUsd,
    limitPriceUsd,
    orderId: submitted,
    status,
  };
  if (filledQty) out.filledQty = filledQty;
  return out;
}

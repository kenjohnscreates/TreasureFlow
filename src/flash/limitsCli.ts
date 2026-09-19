import { type Hex, formatUnits, hashMessage, parseUnits } from "viem";
import type { KernelDomain } from "./kernel.ts";
import { publicRpc } from "../aerodrome/quote.ts";
import { BASE, USDC_DECIMALS } from "../config/constants.ts";
import { loadConfig, requireBankrKey, requireFlashKey } from "../config/load.ts";
import { AppError } from "../errors.ts";
import { log } from "../log.ts";
import { readSpotUsd } from "../oracle/chainlink.ts";
import { assertNotPaused, remainingDailyCap } from "../policy/math.ts";
import { appendSpend, loadSpend } from "../policy/spendLog.ts";
import { getWalletPortfolio } from "../bankr/client.ts";
import { assertNotStranded, parsePortfolio, truncateAddress } from "../bankr/parse.ts";
import { signPersonal, signTypedData } from "../bankr/signTyped.ts";
import { parseSkillTx } from "../bankr/skillTx.ts";
import { submitSkillTx } from "../bankr/submitRaw.ts";
import { isProtectedFlashOrderId } from "./demoOrder.ts";
import { cancelOrder, getOrder, quoteOrder, submitOrder } from "./http.ts";
import {
  isEip7702Code,
  kernelHashTypedData,
  readAccountCode,
  readKernelDomain,
  wrapKernel7702Signature,
} from "./kernel.ts";
import { buildLimitLadder } from "./ladder.ts";
import { parseFlashOrderId, parseFlashOrderStatus, parseFlashQuote } from "./parse.ts";
import { loadFlash, persistFlash } from "./persist.ts";
import { signFlashPayload } from "./sign.ts";
import { sizeLiveLimits } from "./size.ts";
import { limitBuyQuote } from "./types.ts";

function isLive(): boolean {
  return process.argv.includes("--live");
}

function usdPrice(value: number): string {
  return value.toFixed(2);
}

function flashCancelMessage(orderId: string): string {
  return `Definitive Flash v1 \u2014 Cancel Order\nOrder: ${orderId}`;
}

async function signCancel(args: {
  apiKey: string;
  message: string;
  kernel?: KernelDomain | undefined;
}): Promise<Hex> {
  if (!args.kernel) {
    return signPersonal({ apiKey: args.apiKey, message: args.message });
  }
  const inner = await signTypedData({
    apiKey: args.apiKey,
    typedDataJson: JSON.stringify(
      kernelHashTypedData({ hash: hashMessage(args.message), domain: args.kernel }),
    ),
  });
  return wrapKernel7702Signature(inner);
}

async function cancelPrior(
  flashApiKey: string,
  bankrApiKey: string,
  orderIds: string[],
  kernel?: KernelDomain | undefined,
): Promise<void> {
  for (const orderId of orderIds) {
    if (isProtectedFlashOrderId(orderId)) {
      log("bankr_limits_cancel", { orderId, cancelled: false, reason: "protected b5" });
      continue;
    }
    const cancelMessage = flashCancelMessage(orderId);
    const userSignature = await signCancel({
      apiKey: bankrApiKey,
      message: cancelMessage,
      kernel,
    });
    try {
      await cancelOrder(flashApiKey, orderId, { cancelMessage, userSignature });
      log("bankr_limits_cancel", { orderId, cancelled: true });
    } catch (err) {
      if (err instanceof AppError && err.message.includes("404")) {
        log("bankr_limits_cancel", { orderId, cancelled: false, reason: "not found" });
        continue;
      }
      throw err;
    }
  }
}

export async function runBankrLimits(envPath = ".env"): Promise<void> {
  const config = loadConfig(envPath);
  requireBankrKey(config);
  requireFlashKey(config);
  assertNotPaused(config.paused);
  const treasury = config.treasuryAddress;
  if (!treasury) throw new AppError("missing_treasury", "TREASURY_ADDRESS is required");
  assertNotStranded(treasury);
  const code = await readAccountCode(treasury, config.baseRpcUrl);
  const eip7702 = isEip7702Code(code);
  const snap = parsePortfolio(await getWalletPortfolio(config.bankrApiKey));
  const usdcFree = parseUnits(snap.usdc, USDC_DECIMALS);
  const spend = await loadSpend();
  const dailyLeft = remainingDailyCap(config.policy.dailyCapUsdc, spend);
  const sized = sizeLiveLimits({
    usdcFree,
    bufferUsdc: config.policy.bufferUsdc,
    hardStopUsdc: config.policy.hardStopUsdc,
    perCallCapUsdc: config.policy.perCallCapUsdc,
    dailyLeftUsdc: dailyLeft,
  });
  const spotUsd = await readSpotUsd(BASE.btcUsdFeed, publicRpc(config.baseRpcUrl));
  const rungs =
    sized.action === "place"
      ? buildLimitLadder({ spotUsd, reserveUsdc: sized.reserveUsdc })
      : [];
  log("bankr_limits_plan", {
    action: sized.action,
    reason: sized.reason,
    usdcFree: snap.usdc,
    surplusUsdc: formatUnits(sized.surplusUsdc, USDC_DECIMALS),
    reserveUsdc: formatUnits(sized.reserveUsdc, USDC_DECIMALS),
    spotUsd,
    rungs: rungs.length,
    live: isLive(),
    treasury: truncateAddress(treasury),
    eip7702,
  });
  if (sized.action !== "place" || rungs.length === 0) {
    log("bankr_limits", { sent: false, reason: sized.reason });
    return;
  }

  const quotes = [];
  for (const rung of rungs) {
    const qty = formatUnits(rung.sizeUsdc, USDC_DECIMALS);
    const limitNotionalPrice = usdPrice(rung.limitPriceUsd);
    const request = limitBuyQuote({
      targetAsset: BASE.cbBtc,
      contraAsset: BASE.usdc,
      qtyUsdc: qty,
      limitNotionalPrice,
      funderAddress: treasury,
    });
    const quoted = parseFlashQuote(await quoteOrder(config.flashApiKey, request));
    quotes.push({ rung, qty, limitNotionalPrice, request, quoted });
    log("bankr_limits_quote", {
      pctBelowSpot: rung.pctBelowSpot,
      qty,
      limitNotionalPrice,
      quoteId: quoted.quoteId,
      hasApprove: Boolean(quoted.approveTx),
      hasPermit: Boolean(quoted.permitTypedData),
    });
  }

  if (!isLive()) {
    log("bankr_limits", { sent: false, reason: "pass --live to submit" });
    return;
  }

  const kernel = eip7702
    ? await readKernelDomain(treasury, config.baseRpcUrl)
    : undefined;

  const prior = await loadFlash();
  if (prior?.orderIds.length) {
    await cancelPrior(config.flashApiKey, config.bankrApiKey, prior.orderIds, kernel);
  }

  const hashes: string[] = prior?.hashes ? [...prior.hashes] : [];
  let approveTx: string | undefined = prior?.approveTx;
  let approved = Boolean(approveTx);
  const orderIds: string[] = [];

  for (const row of quotes) {
    if (row.quoted.approveTx && !approved) {
      if (row.quoted.approveTx.to.toLowerCase() !== BASE.usdc.toLowerCase()) {
        throw new AppError("flash_quote", "Flash approveTx to is not USDC");
      }
      const tx = parseSkillTx({
        to: row.quoted.approveTx.to,
        data: row.quoted.approveTx.data,
        value: "0",
        chainId: BASE.chainId,
        label: "approve USDC -> Flash",
      });
      const hash = await submitSkillTx(config.bankrApiKey, tx);
      hashes.push(hash);
      approveTx = hash;
      approved = true;
      log("bankr_limits_approve", { txHash: truncateAddress(hash), txHashFull: hash });
      await persistFlash({
        reserveUsdc: sized.reserveUsdc.toString(),
        spotUsd,
        orderIds: [],
        hashes,
        approveTx,
      });
    }

    let permitFields: Record<string, string> = {};
    if (row.quoted.permitTypedData) {
      const permit = await signFlashPayload({
        apiKey: config.bankrApiKey,
        typedDataJson: row.quoted.permitTypedData,
        kernel,
      });
      permitFields = {
        evmPermitTypedData: permit.echo,
        evmPermitSignature: permit.signature,
      };
    }
    const signed = await signFlashPayload({
      apiKey: config.bankrApiKey,
      typedDataJson: row.quoted.orderTypedData,
      kernel,
    });
    const submitted = parseFlashOrderId(
      await submitOrder(config.flashApiKey, {
        ...row.request,
        funderAddress: treasury,
        quoteId: row.quoted.quoteId,
        userSignature: signed.signature,
        evmOrderTypedData: signed.echo,
        ...permitFields,
      }),
    );
    let status = "submitted";
    for (const delayMs of [0, 1500]) {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      try {
        status = parseFlashOrderStatus(
          await getOrder(config.flashApiKey, submitted, treasury),
        );
        break;
      } catch (err) {
        if (!(err instanceof AppError) || err.code !== "flash_http") throw err;
      }
    }
    orderIds.push(submitted);
    if (row.rung.sizeUsdc > 0n) await appendSpend(row.rung.sizeUsdc);
    log("bankr_limits_order", {
      orderId: submitted,
      status,
      pctBelowSpot: row.rung.pctBelowSpot,
      qty: row.qty,
      limitNotionalPrice: row.limitNotionalPrice,
    });
  }

  await persistFlash({
    reserveUsdc: sized.reserveUsdc.toString(),
    spotUsd,
    orderIds,
    hashes,
    ...(approveTx ? { approveTx } : {}),
  });
  log("bankr_limits", {
    sent: true,
    orders: orderIds.length,
    orderIds: orderIds.join(","),
    reserveUsdc: formatUnits(sized.reserveUsdc, USDC_DECIMALS),
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runBankrLimits().catch((err) => {
    const code = err instanceof AppError ? err.code : "bankr_limits";
    const message = err instanceof AppError ? err.message : "Bankr limits failed";
    log("bankr_error", { code, message });
    process.exit(1);
  });
}

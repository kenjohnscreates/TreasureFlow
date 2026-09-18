import { formatUnits, parseUnits, type Address } from "viem";
import { encodeApprove, encodeRemoveLiquidity } from "../aerodrome/encode.ts";
import {
  publicRpc,
  quoteRemoveLiquidity,
  readSammLpValueUsdc,
  sizeLpBurn,
  type RemoveQuote,
  type SammLpPosition,
} from "../aerodrome/quote.ts";
import { assertNotStranded, truncateAddress } from "../bankr/parse.ts";
import {
  assertUnderHardStop,
  parseSkillTx,
  spendNotionalUsdc,
  type SkillTx,
} from "../bankr/skillTx.ts";
import { submitSkillTx } from "../bankr/submitRaw.ts";
import { transferUsdc } from "../bankr/transfer.ts";
import { BASE, USDC_DECIMALS, type AppConfig } from "../config/constants.ts";
import { AppError } from "../errors.ts";
import { log } from "../log.ts";
import { assertHardStop } from "../policy/math.ts";
import { appendSpend } from "../policy/spendLog.ts";
import { rejectChatPay, type ChatReply } from "./handle.ts";
import { assertAllowlisted, parseIntent } from "./intent.ts";

const SLIPPAGE_BPS = 50n;

export type SubmitPayDeps = {
  transferUsdc?: typeof transferUsdc;
  appendSpend?: typeof appendSpend;
  submitSkillTx?: typeof submitSkillTx;
  readSammLp?: (owner: Address, rpcUrl: string) => Promise<SammLpPosition>;
  quoteRemoveLiquidity?: (liquidity: bigint, rpcUrl?: string) => Promise<RemoveQuote>;
};

function minOut(amount: bigint, slippageBps: bigint): bigint {
  return amount - (amount * slippageBps) / 10_000n;
}

function skillTx(to: string, data: `0x${string}`, label: string): SkillTx {
  return parseSkillTx({ to, data, value: "0", chainId: BASE.chainId, label });
}

function guardPayIntent(prompt: string, config: AppConfig) {
  const intent = parseIntent(prompt);
  if (intent.kind !== "pay") return undefined;
  assertAllowlisted(intent.to, config.payDestinations);
  assertNotStranded(intent.to);
  if (!config.bankrApiKey) {
    throw new AppError("missing_bankr", "BANKR_API_KEY is required for chat pay");
  }
  return intent;
}

async function submitTransfer(
  prompt: string,
  reply: ChatReply,
  config: AppConfig,
  deps: SubmitPayDeps,
): Promise<ChatReply> {
  const intent = guardPayIntent(prompt, config);
  if (!intent) return reply;
  const amountHuman = formatUnits(intent.amountUsdc, USDC_DECIMALS);
  const transfer = deps.transferUsdc ?? transferUsdc;
  const spend = deps.appendSpend ?? appendSpend;
  const txHash = await transfer({
    apiKey: config.bankrApiKey,
    recipient: intent.to,
    amountHuman,
  });
  await spend(intent.amountUsdc);
  const txTrunc = truncateAddress(txHash);
  log("chat_pay", {
    sent: true,
    dest: truncateAddress(intent.to),
    amountUsdc: amountHuman,
    txHash: txTrunc,
  });
  return {
    kind: "pay",
    summary: `Sent ${amountHuman} USDC on Base. Tx ${txTrunc}.`,
    plan: {
      ...reply.plan,
      sent: true,
      txHash: txTrunc,
    },
  };
}

async function submitUnwindAndPay(
  prompt: string,
  reply: ChatReply,
  config: AppConfig,
  deps: SubmitPayDeps,
): Promise<ChatReply> {
  const intent = guardPayIntent(prompt, config);
  if (!intent) return reply;
  const treasury = config.treasuryAddress;
  if (!treasury) {
    throw new AppError("missing_treasury", "TREASURY_ADDRESS is required for unwind");
  }
  assertNotStranded(treasury);

  const amountUsdc = intent.amountUsdc;
  const shortfall = parseUnits(String(reply.plan.shortfallUsdc), USDC_DECIMALS);
  const freeUsdc = amountUsdc > shortfall ? amountUsdc - shortfall : 0n;
  const rpc = publicRpc(config.baseRpcUrl);
  const readLp = deps.readSammLp ?? readSammLpValueUsdc;
  const quoteFn = deps.quoteRemoveLiquidity ?? quoteRemoveLiquidity;
  const position = await readLp(treasury, rpc);

  if (position.liquidity === 0n || position.amountUsdc < shortfall) {
    return rejectChatPay("insufficient_lp");
  }

  let liq = sizeLpBurn({
    totalLiquidity: position.liquidity,
    shortfallUsdc: shortfall,
    fullAmountUsdc: position.amountUsdc,
  });
  if (liq === 0n) return rejectChatPay("insufficient_lp");
  if (liq > position.liquidity) liq = position.liquidity;

  let quoted: RemoveQuote =
    liq === position.liquidity
      ? { amountUsdc: position.amountUsdc, amountUsdt: position.amountUsdt }
      : await quoteFn(liq, rpc);

  if (quoted.amountUsdc < shortfall) {
    liq = position.liquidity;
    quoted = { amountUsdc: position.amountUsdc, amountUsdt: position.amountUsdt };
  }
  if (quoted.amountUsdc < shortfall) return rejectChatPay("insufficient_lp");
  if (freeUsdc + quoted.amountUsdc < amountUsdc) return rejectChatPay("insufficient_lp");

  assertHardStop(quoted.amountUsdc, config.policy);
  assertHardStop(amountUsdc, config.policy);

  const minFromSlip = minOut(quoted.amountUsdc, SLIPPAGE_BPS);
  const minUsdc = minFromSlip < shortfall ? shortfall : minFromSlip;
  const minUsdt = minOut(quoted.amountUsdt, SLIPPAGE_BPS);
  const notional = Number(formatUnits(quoted.amountUsdc, USDC_DECIMALS));
  const txs = [
    skillTx(
      BASE.usdcUsdtSamm,
      encodeApprove(BASE.aerodromeRouter, liq),
      "approve LP -> router",
    ),
    skillTx(
      BASE.aerodromeRouter,
      encodeRemoveLiquidity({
        liquidity: liq,
        minUsdc,
        minUsdt,
        to: treasury,
      }),
      `remove sAMM USDC/USDT $${notional.toFixed(2)}`,
    ),
  ];
  const hardStop = Number(formatUnits(config.policy.hardStopUsdc, USDC_DECIMALS));
  for (const tx of txs) assertUnderHardStop(tx, hardStop);

  const submit = deps.submitSkillTx ?? submitSkillTx;
  const hashes: `0x${string}`[] = [];
  for (const tx of txs) {
    log("chat_unwind_submit", {
      label: tx.label,
      to: truncateAddress(tx.to),
      notionalUsdc: spendNotionalUsdc(tx),
    });
    hashes.push(await submit(config.bankrApiKey, tx));
    const mined = hashes.at(-1);
    if (!mined) throw new AppError("bankr_job", "Bankr job completed without a tx hash");
    log("chat_unwind_mined", { label: tx.label, txHash: truncateAddress(mined) });
  }
  const removeHash = hashes.at(-1);
  if (!removeHash) throw new AppError("bankr_job", "removeLiquidity tx hash missing");

  const amountHuman = formatUnits(amountUsdc, USDC_DECIMALS);
  const transfer = deps.transferUsdc ?? transferUsdc;
  const spend = deps.appendSpend ?? appendSpend;
  const txHash = await transfer({
    apiKey: config.bankrApiKey,
    recipient: intent.to,
    amountHuman,
  });
  await spend(amountUsdc);

  const removeTrunc = truncateAddress(removeHash);
  const txTrunc = truncateAddress(txHash);
  log("chat_pay", {
    sent: true,
    unwind: true,
    dest: truncateAddress(intent.to),
    amountUsdc: amountHuman,
    removeTx: removeTrunc,
    txHash: txTrunc,
  });
  return {
    kind: "pay",
    summary: `Sent ${amountHuman} USDC on Base. Remove ${removeTrunc}. Tx ${txTrunc}.`,
    plan: {
      ...reply.plan,
      sent: true,
      removeTxHash: removeTrunc,
      txHash: txTrunc,
    },
  };
}

export async function maybeSubmitChatPay(
  prompt: string,
  reply: ChatReply,
  config: AppConfig,
  deps: SubmitPayDeps = {},
): Promise<ChatReply> {
  if (reply.kind !== "pay") return reply;
  if (reply.plan.action === "pay") return submitTransfer(prompt, reply, config, deps);
  if (reply.plan.action === "unwind_and_pay") {
    return submitUnwindAndPay(prompt, reply, config, deps);
  }
  return reply;
}

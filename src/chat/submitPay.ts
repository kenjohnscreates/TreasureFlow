import { formatUnits } from "viem";
import { assertNotStranded, truncateAddress } from "../bankr/parse.ts";
import { transferUsdc } from "../bankr/transfer.ts";
import { USDC_DECIMALS, type AppConfig } from "../config/constants.ts";
import { AppError } from "../errors.ts";
import { log } from "../log.ts";
import { appendSpend } from "../policy/spendLog.ts";
import { assertAllowlisted, parseIntent } from "./intent.ts";
import type { ChatReply } from "./handle.ts";

export type SubmitPayDeps = {
  transferUsdc?: typeof transferUsdc;
  appendSpend?: typeof appendSpend;
};

const UNWIND_SUMMARY = "Unwind is not live yet (B14). Chat did not submit.";

export async function maybeSubmitChatPay(
  prompt: string,
  reply: ChatReply,
  config: AppConfig,
  deps: SubmitPayDeps = {},
): Promise<ChatReply> {
  if (reply.plan.action === "unwind_and_pay") {
    return {
      kind: "pay",
      summary: UNWIND_SUMMARY,
      plan: { ...reply.plan, sent: false, code: "unwind_not_live" },
    };
  }
  if (reply.kind !== "pay" || reply.plan.action !== "pay") return reply;

  const intent = parseIntent(prompt);
  if (intent.kind !== "pay") return reply;
  assertAllowlisted(intent.to, config.payDestinations);
  assertNotStranded(intent.to);
  if (!config.bankrApiKey) {
    throw new AppError("missing_bankr", "BANKR_API_KEY is required for chat pay");
  }

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

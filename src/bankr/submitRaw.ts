import { AppError } from "../errors.ts";
import { pollJob, submitPrompt } from "./agent.ts";
import { type SkillTx } from "./skillTx.ts";

export function rawSubmitPrompt(tx: SkillTx): string {
  return [
    "Submit exactly one Base mainnet transaction with the submit_raw_transaction tool.",
    "Copy these fields unmodified. Do not re-encode, prefix, checksum, swap, or add any other transaction.",
    "chain: base",
    "chainId: 8453",
    `to: ${tx.to}`,
    `value: ${tx.value}`,
    `data: ${tx.data}`,
    "Wait until the transaction is mined. Reply with the 0x transaction hash only.",
  ].join("\n");
}

export async function submitSkillTx(apiKey: string, tx: SkillTx): Promise<`0x${string}`> {
  const jobId = await submitPrompt(apiKey, rawSubmitPrompt(tx));
  const job = await pollJob(apiKey, jobId);
  if (!job.txHash)
    throw new AppError("bankr_job", "Bankr job completed without a tx hash");
  return job.txHash;
}

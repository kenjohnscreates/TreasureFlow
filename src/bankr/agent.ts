import { isHex } from "viem";
import { AppError } from "../errors.ts";
import { bankrGet, bankrPost } from "./http.ts";
import { isRecord } from "./parse.ts";

export type AgentJobStatus =
  "pending" | "processing" | "completed" | "failed" | "cancelled";

export type AgentJob = {
  jobId: string;
  status: AgentJobStatus;
  response?: string;
  txHash?: `0x${string}`;
};

const STATUSES = new Set<AgentJobStatus>([
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export function parsePromptAccepted(body: unknown): { jobId: string; threadId?: string } {
  if (!isRecord(body) || body.success !== true || typeof body.jobId !== "string") {
    throw new AppError("bankr_prompt", "Bankr /agent/prompt did not return a jobId");
  }
  const out: { jobId: string; threadId?: string } = { jobId: body.jobId };
  if (typeof body.threadId === "string" && body.threadId) out.threadId = body.threadId;
  return out;
}

export function extractTxHash(text: string): `0x${string}` | undefined {
  const match = text.match(/0x[a-fA-F0-9]{64}(?![a-fA-F0-9])/);
  if (!match) return undefined;
  const hash = match[0] as `0x${string}`;
  if (!isHex(hash) || hash.length !== 66) return undefined;
  return hash;
}

export function extractSignature(text: string): `0x${string}` | undefined {
  const match = text.match(/0x[a-fA-F0-9]{130,}/);
  if (!match) return undefined;
  const sig = match[0] as `0x${string}`;
  if (!isHex(sig) || sig.length < 132 || sig.length % 2 !== 0) return undefined;
  return sig;
}

export function parseAgentJob(body: unknown): AgentJob {
  if (!isRecord(body) || typeof body.jobId !== "string") {
    throw new AppError("bankr_job", "Bankr /agent/job was not a job");
  }
  const status = typeof body.status === "string" ? body.status : "";
  if (!STATUSES.has(status as AgentJobStatus)) {
    throw new AppError("bankr_job", "Bankr /agent/job status is unknown");
  }
  const response = typeof body.response === "string" ? body.response : undefined;
  const fromField =
    typeof body.txHash === "string"
      ? extractTxHash(body.txHash)
      : typeof body.transactionHash === "string"
        ? extractTxHash(body.transactionHash)
        : undefined;
  const fromText = response ? extractTxHash(response) : undefined;
  const job: AgentJob = {
    jobId: body.jobId,
    status: status as AgentJobStatus,
  };
  if (response) job.response = response;
  const txHash = fromField ?? fromText;
  if (txHash) job.txHash = txHash;
  return job;
}

export async function submitPrompt(apiKey: string, prompt: string): Promise<string> {
  const body = await bankrPost("/agent/prompt", apiKey, { prompt });
  return parsePromptAccepted(body).jobId;
}

export async function pollJob(
  apiKey: string,
  jobId: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<AgentJob> {
  const intervalMs = opts.intervalMs ?? 2000;
  const timeoutMs = opts.timeoutMs ?? 240_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = parseAgentJob(await bankrGet(`/agent/job/${jobId}`, apiKey));
    if (job.status === "completed") return job;
    if (job.status === "failed" || job.status === "cancelled") {
      throw new AppError("bankr_job", `Bankr job ${job.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new AppError("bankr_job", "Bankr job timed out");
}

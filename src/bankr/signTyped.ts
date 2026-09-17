import { isHex } from "viem";
import { AppError } from "../errors.ts";
import { extractSignature, pollJob, submitPrompt } from "./agent.ts";
import { bankrPost } from "./http.ts";
import { isRecord } from "./parse.ts";
import { assertTypedDataJson, typedDataForWallet } from "../flash/parse.ts";

export function typedDataSignPrompt(typedDataJson: string): string {
  return [
    "Sign EIP-712 typed data with eth_signTypedData_v4 / signTypedData.",
    "Do not submit a transaction. Copy the typed data unmodified.",
    "chain: base",
    "chainId: 8453",
    "Reply with the 0x signature only.",
    "typedData:",
    typedDataJson,
  ].join("\n");
}

function assertSignature(value: string): `0x${string}` {
  if (!isHex(value) || value.length < 132 || value.length % 2 !== 0) {
    throw new AppError("bankr_sign", "Bankr signature is invalid");
  }
  return value as `0x${string}`;
}

function parseSignBody(body: unknown): `0x${string}` {
  if (!isRecord(body) || body.success !== true || typeof body.signature !== "string") {
    throw new AppError("bankr_sign", "Bankr /wallet/sign did not return a signature");
  }
  return assertSignature(body.signature);
}

async function signViaAgent(apiKey: string, prompt: string): Promise<`0x${string}`> {
  const jobId = await submitPrompt(apiKey, prompt);
  const job = await pollJob(apiKey, jobId);
  const fromText = job.response ? extractSignature(job.response) : undefined;
  if (fromText) return assertSignature(fromText);
  throw new AppError("bankr_sign", "Bankr job completed without a signature");
}

export async function signTypedData(args: {
  apiKey: string;
  typedDataJson: string;
}): Promise<`0x${string}`> {
  const parsed = typedDataForWallet(assertTypedDataJson(args.typedDataJson));
  try {
    return parseSignBody(
      await bankrPost("/wallet/sign", args.apiKey, {
        signatureType: "eth_signTypedData_v4",
        typedData: parsed,
      }),
    );
  } catch (err) {
    if (!(err instanceof AppError) || err.code !== "bankr_http") throw err;
  }
  return signViaAgent(args.apiKey, typedDataSignPrompt(JSON.stringify(parsed)));
}

export async function signPersonal(args: {
  apiKey: string;
  message: string;
}): Promise<`0x${string}`> {
  return parseSignBody(
    await bankrPost("/wallet/sign", args.apiKey, {
      signatureType: "personal_sign",
      message: args.message,
    }),
  );
}

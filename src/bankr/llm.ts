import { isRecord } from "./parse.ts";
import { AppError } from "../errors.ts";
import { log } from "../log.ts";

export const BANKR_LLM_BASE_URL = "https://llm.bankr.bot";
export const BANKR_LLM_CHAT_PATH = "/v1/chat/completions";
export const DEFAULT_BANKR_LLM_MODEL = "gemini-3-flash";

export type LlmBalanceHint = {
  usdc: string;
  usdt: string;
  nvdac: string;
  eth: string;
  treasuryDisplay?: string;
};

type LlmHeaders = Record<string, string>;

type LlmInit = {
  method?: string;
  body?: string;
  headers?: LlmHeaders;
};

type LlmRes = Awaited<ReturnType<typeof fetch>> & {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export function bankrLlmModel(env: NodeJS.Dict<string> = process.env): string {
  const raw = env.BANKR_LLM_MODEL?.trim();
  return raw || DEFAULT_BANKR_LLM_MODEL;
}

function statusMessage(status: number): string {
  if (status === 401) {
    return "Enable LLM Gateway on this Bankr key at bankr.bot/api-keys.";
  }
  if (status === 402) return "Add LLM credits at bankr.bot/llm.";
  return `Bankr LLM ${status}`;
}

function statusCode(status: number): string {
  if (status === 401) return "llm_401";
  if (status === 402) return "llm_402";
  return "llm_http";
}

async function bankrLlmFetch(
  path: string,
  apiKey: string,
  init: LlmInit,
): Promise<unknown> {
  if (!apiKey) throw new AppError("bankr_unwired", "BANKR_API_KEY is empty");
  const opts = {
    ...init,
    headers: {
      "X-API-Key": apiKey,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  };
  let res: LlmRes;
  try {
    res = (await fetch(`${BANKR_LLM_BASE_URL}${path}`, opts)) as LlmRes;
  } catch {
    log("bankr_llm", { code: "llm_http" });
    throw new AppError("llm_http", "Bankr LLM request failed");
  }
  if (!res.ok) {
    const code = statusCode(res.status);
    log("bankr_llm", { status: res.status, code });
    throw new AppError(code, statusMessage(res.status));
  }
  try {
    return (await res.json()) as unknown;
  } catch {
    log("bankr_llm", { code: "llm_http" });
    throw new AppError("llm_http", "Bankr LLM returned non-JSON");
  }
}

export async function bankrLlmPost(apiKey: string, body: unknown): Promise<unknown> {
  return bankrLlmFetch(BANKR_LLM_CHAT_PATH, apiKey, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function llmSystemPrompt(live?: LlmBalanceHint): string {
  const caps =
    "Company treasury only. Founder signs deposits. Caps: buffer 15, per-call 10, daily 30, hard stop 15. No performance claims. No em dashes.";
  const lines =
    "Reply with exactly one canonical line our parser accepts, nothing else: deposit N USDC, deposit $N USDC, send $10 USDC to wallet 1, send $50 USDC to wallet 2, send N USDC to PAY_DEST_1, sweep, lp stocks, buy cbBTC, buy the dip, how much USDC in the treasury, or UNKNOWN.";
  if (!live) return `${caps} ${lines}`;
  const treasury = live.treasuryDisplay ? ` Treasury ${live.treasuryDisplay}.` : "";
  return `${caps} Live: USDC ${live.usdc}, USDT ${live.usdt}, NVDAc ${live.nvdac}, ETH ${live.eth}.${treasury} ${lines}`;
}

export function completionText(body: unknown): string {
  if (!isRecord(body) || !Array.isArray(body.choices)) return "";
  const first = body.choices[0];
  if (!isRecord(first) || !isRecord(first.message)) return "";
  const content = first.message.content;
  return typeof content === "string" ? content : "";
}

export function canonicalizeMapperLine(raw: string): string {
  const first = raw.split(/\r?\n/)[0] ?? "";
  const line = first
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
  if (!line || /^unknown\.?$/i.test(line)) return "UNKNOWN";
  return line;
}

export async function mapUnknownPrompt(
  raw: string,
  apiKey: string,
  live?: LlmBalanceHint,
): Promise<string> {
  const body = await bankrLlmPost(apiKey, {
    model: bankrLlmModel(),
    temperature: 0,
    max_tokens: 64,
    messages: [
      { role: "system", content: llmSystemPrompt(live) },
      { role: "user", content: raw },
    ],
  });
  return canonicalizeMapperLine(completionText(body));
}

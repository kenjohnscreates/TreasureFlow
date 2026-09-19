import { AppError } from "../errors.ts";

export const BANKR_BASE_URL = "https://api.bankr.bot";

function statusMessage(status: number): string {
  if (status === 401) return "Bankr 401. Check API key";
  if (status === 403) {
    return "Bankr 403. Check Wallet API writes, IP allowlist, or allowedRecipients";
  }
  return `Bankr ${status}`;
}

type BankrHeaders = Record<string, string>;

type BankrInit = {
  method?: string;
  body?: string;
  headers?: BankrHeaders;
};

type BankrRes = Awaited<ReturnType<typeof fetch>> & {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

async function bankrFetch(
  path: string,
  apiKey: string,
  init: BankrInit,
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
  let res: BankrRes;
  try {
    res = (await fetch(`${BANKR_BASE_URL}${path}`, opts)) as BankrRes;
  } catch {
    throw new AppError("bankr_http", "Bankr request failed");
  }
  if (!res.ok) {
    throw new AppError("bankr_http", statusMessage(res.status));
  }
  try {
    return (await res.json()) as unknown;
  } catch {
    throw new AppError("bankr_http", "Bankr returned non-JSON");
  }
}

export async function bankrGet(path: string, apiKey: string): Promise<unknown> {
  return bankrFetch(path, apiKey, { method: "GET" });
}

export async function bankrPost(
  path: string,
  apiKey: string,
  body: unknown,
): Promise<unknown> {
  return bankrFetch(path, apiKey, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

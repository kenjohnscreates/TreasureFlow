import { AppError } from "../errors.ts";
import { isRecord } from "../bankr/parse.ts";
import { FLASH_BASE_URL, type FlashQuoteRequest } from "./types.ts";

function statusMessage(status: number): string {
  if (status === 401) return "Flash 401. Check API key";
  return `Flash ${status}`;
}

function errorCode(body: unknown): string {
  if (!isRecord(body)) return "";
  if (typeof body.error === "string" && body.error) return ` ${body.error}`;
  if (isRecord(body.error)) {
    const code = typeof body.error.code === "string" ? body.error.code : "";
    const msg =
      typeof body.error.message === "string" ? body.error.message.slice(0, 120) : "";
    const extra = [code, msg].filter(Boolean).join(" ");
    return extra ? ` ${extra}` : "";
  }
  return "";
}

type FlashHeaders = Record<string, string>;

type FlashInit = {
  method?: string;
  body?: string;
  headers?: FlashHeaders;
};

type FlashRes = Awaited<ReturnType<typeof fetch>> & {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export async function flashJson(
  path: string,
  apiKey: string,
  init: FlashInit = {},
): Promise<unknown> {
  if (!apiKey) throw new AppError("flash_unwired", "FLASH_API_KEY is empty");
  const opts = {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-definitive-api-key": apiKey,
      ...(init.headers ?? {}),
    },
  };
  let res: FlashRes;
  try {
    res = (await fetch(`${FLASH_BASE_URL}${path}`, opts)) as FlashRes;
  } catch {
    throw new AppError("flash_http", "Flash request failed");
  }
  if (!res.ok) {
    let extra = "";
    try {
      extra = errorCode((await res.json()) as unknown);
    } catch {
      /* status-only */
    }
    throw new AppError("flash_http", `${statusMessage(res.status)}${extra}`);
  }
  try {
    return (await res.json()) as unknown;
  } catch {
    throw new AppError("flash_http", "Flash returned non-JSON");
  }
}

export async function quoteOrder(
  apiKey: string,
  body: FlashQuoteRequest,
): Promise<unknown> {
  return flashJson("/quote", apiKey, { method: "POST", body: JSON.stringify(body) });
}

export async function submitOrder(apiKey: string, body: unknown): Promise<unknown> {
  return flashJson("/order", apiKey, { method: "POST", body: JSON.stringify(body) });
}

export async function getOrder(
  apiKey: string,
  orderId: string,
  funderAddress: string,
): Promise<unknown> {
  const q = new URLSearchParams({ funderAddress });
  return flashJson(`/orders/${orderId}?${q.toString()}`, apiKey, { method: "GET" });
}

export async function cancelOrder(
  apiKey: string,
  orderId: string,
  body: { cancelMessage: string; userSignature: string },
): Promise<unknown> {
  return flashJson(`/orders/${orderId}/cancel`, apiKey, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

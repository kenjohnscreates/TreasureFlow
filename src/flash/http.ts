import { AppError, wrapExternal } from "../errors.ts";
import { FLASH_BASE_URL, type FlashQuoteRequest } from "./types.ts";

export async function flashJson(
  path: string,
  apiKey: string,
  init: RequestInit = {},
): Promise<unknown> {
  if (!apiKey) throw new AppError("flash_unwired", "FLASH_API_KEY is empty");
  try {
    const res = await fetch(`${FLASH_BASE_URL}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-definitive-api-key": apiKey,
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new AppError("flash_http", `Flash ${path} ${res.status}: ${body}`);
    }
    return (await res.json()) as unknown;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw wrapExternal("flash_http", err);
  }
}

export async function quoteOrder(
  apiKey: string,
  body: FlashQuoteRequest,
): Promise<unknown> {
  return flashJson("/quote", apiKey, { method: "POST", body: JSON.stringify(body) });
}

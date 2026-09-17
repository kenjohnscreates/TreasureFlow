import { AppError } from "../errors.ts";

export const BANKR_BASE_URL = "https://api.bankr.bot";

function statusMessage(status: number): string {
  if (status === 401 || status === 403) {
    return `Bankr ${status}. Check API key and IP allowlist`;
  }
  return `Bankr ${status}`;
}

export async function bankrGet(path: string, apiKey: string): Promise<unknown> {
  if (!apiKey) throw new AppError("bankr_unwired", "BANKR_API_KEY is empty");
  let res: Response;
  try {
    res = await fetch(`${BANKR_BASE_URL}${path}`, {
      method: "GET",
      headers: { "X-API-Key": apiKey },
    });
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

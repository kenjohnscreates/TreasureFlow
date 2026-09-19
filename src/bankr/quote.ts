import { AppError } from "../errors.ts";

// OptiView 30d ATM as of 2026-09-16 15:55 ET. Script has no IV-age gate.
export const NVDA_IV = 0.311;

export type NvdaQuote = {
  price: number;
  ageS: number;
  source: string;
};

type QuoteRes = Awaited<ReturnType<typeof fetch>> & {
  ok: boolean;
  json: () => Promise<unknown>;
};

export async function fetchNvdaQuote(nowMs = Date.now()): Promise<NvdaQuote> {
  const url =
    "https://query1.finance.yahoo.com/v8/finance/chart/NVDA?interval=1m&range=1d";
  const opts = {
    headers: { "User-Agent": "Mozilla/5.0 TreasureFlow" },
    signal: AbortSignal.timeout(15_000),
  };
  let res: QuoteRes;
  try {
    res = (await fetch(url, opts)) as QuoteRes;
  } catch {
    throw new AppError("nvda_quote", "NVDA quote request failed");
  }
  if (!res.ok) throw new AppError("nvda_quote", "NVDA quote HTTP failed");
  const body = (await res.json()) as {
    chart?: {
      result?: { meta?: { regularMarketPrice?: number; regularMarketTime?: number } }[];
    };
  };
  const meta = body.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  const ts = meta?.regularMarketTime;
  if (typeof price !== "number" || !(price > 0) || typeof ts !== "number") {
    throw new AppError("nvda_quote", "NVDA quote missing price");
  }
  const ageS = Math.max(0, Math.floor(nowMs / 1000) - ts);
  if (ageS > 900) throw new AppError("quote_stale", "NVDA quote older than 900s");
  return { price, ageS, source: "yahoo" };
}

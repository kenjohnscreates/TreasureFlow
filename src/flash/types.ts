export const FLASH_BASE_URL = "https://flash.definitive.fi/v1";

export type FlashOrderType =
  "market" | "limit" | "twap" | "stop" | "stop-loss" | "take-profit" | "bracket";

export type FlashSide = "buy" | "sell";

export type FlashQuoteRequest = {
  targetAsset: string;
  targetChain: string;
  contraAsset: string;
  contraChain: string;
  side: FlashSide;
  qty: string;
  orderType: FlashOrderType;
  limitNotionalPrice?: string;
  maxSlippage?: string;
  recipientAddress?: string;
  funderAddress?: string;
};

export type FlashLimitQuote = FlashQuoteRequest & {
  orderType: "limit";
  limitNotionalPrice: string;
};

export type FlashMarketQuote = FlashQuoteRequest & {
  orderType: "market";
  maxSlippage: string;
};

export function limitBuyQuote(args: {
  targetAsset: string;
  contraAsset: string;
  qtyUsdc: string;
  limitNotionalPrice: string;
  chain?: string;
  funderAddress?: string;
}): FlashLimitQuote {
  const chain = args.chain ?? "base";
  const quote: FlashLimitQuote = {
    targetAsset: args.targetAsset,
    targetChain: chain,
    contraAsset: args.contraAsset,
    contraChain: chain,
    side: "buy",
    qty: args.qtyUsdc,
    orderType: "limit",
    limitNotionalPrice: args.limitNotionalPrice,
  };
  if (args.funderAddress) quote.funderAddress = args.funderAddress;
  return quote;
}

export const FLASH_MARKET_MAX_SLIPPAGE = "0.05";

export function marketBuyQuote(args: {
  targetAsset: string;
  contraAsset: string;
  qtyUsdc: string;
  maxSlippage?: string;
  chain?: string;
  funderAddress?: string;
}): FlashMarketQuote {
  const chain = args.chain ?? "base";
  const quote: FlashMarketQuote = {
    targetAsset: args.targetAsset,
    targetChain: chain,
    contraAsset: args.contraAsset,
    contraChain: chain,
    side: "buy",
    qty: args.qtyUsdc,
    orderType: "market",
    maxSlippage: args.maxSlippage ?? FLASH_MARKET_MAX_SLIPPAGE,
  };
  if (args.funderAddress) quote.funderAddress = args.funderAddress;
  return quote;
}

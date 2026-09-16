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
  recipientAddress?: string;
};

export type FlashLimitQuote = FlashQuoteRequest & {
  orderType: "limit";
  limitNotionalPrice: string;
};

export function limitBuyQuote(args: {
  targetAsset: string;
  contraAsset: string;
  qtyUsdc: string;
  limitNotionalPrice: string;
  chain?: string;
}): FlashLimitQuote {
  const chain = args.chain ?? "base";
  return {
    targetAsset: args.targetAsset,
    targetChain: chain,
    contraAsset: args.contraAsset,
    contraChain: chain,
    side: "buy",
    qty: args.qtyUsdc,
    orderType: "limit",
    limitNotionalPrice: args.limitNotionalPrice,
  };
}

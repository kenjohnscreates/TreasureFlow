/** Static Sat demo receipts from NOTES. Not live Flash/Bankr fetches. Fills unverified. */

export const BASESCAN_TX_ORIGIN = "https://basescan.org/tx/";

export type LiveReceipt = {
  id: string;
  label: string;
  hash: `0x${string}`;
  note: string;
};

export type FlashOrderEvidence = {
  id: string;
  rungPct: 2 | 4 | 6;
  limitPriceUsd: string;
  qtyUsdc: string;
};

export const LIVE_RECEIPTS: readonly LiveReceipt[] = [
  {
    id: "b2-pay",
    label: "Pay 8 USDC",
    hash: "0x725611366d7ea9790ab7852740d7403c234f2c22057eb4ef9a573d9ccfb312fe",
    note: "To an approved wallet",
  },
  {
    id: "b3-mint",
    label: "Slipstream mint",
    hash: "0x6875cfaa3a6eaca7e2da7802846367f9c836b255707b45f560536a7a9174f131",
    note: "NFT #6356494 staked",
  },
  {
    id: "b3-stake",
    label: "Slipstream stake",
    hash: "0x19dd797353ba41145bc56a201291684864eedbcc4ff1bf3b16591c4f8e0770bf",
    note: "NFT #6356494",
  },
  {
    id: "b4-samm",
    label: "sAMM add",
    hash: "0xba78ae950e062fd2daeffc53d92f160a0544ce1aa50e24b920f02f7c31655e99",
    note: "4.38 USDC + 5 USDT",
  },
  {
    id: "b5-approve",
    label: "Flash USDC approve",
    hash: "0xb4d5193e653259cba80f342ce75753907d0a6733f115b903f8d843cd44585c46",
    note: "Lets Flash spend USDC for cbBTC",
  },
];

/** B3 Slipstream NVDAc NFT. First-party id, same pattern as FLASH_ORDERS. */
export const SLIPSTREAM_NVDA_NFT_ID = "6356494";

export const FLASH_ORDERS: readonly FlashOrderEvidence[] = [
  {
    id: "7863b457-c132-4f6d-bc01-0925dd32d6ee",
    rungPct: 2,
    limitPriceUsd: "75080.80",
    qtyUsdc: "0.53164",
  },
  {
    id: "afcc2cb5-e93b-4565-98be-6fe60bc8c744",
    rungPct: 4,
    limitPriceUsd: "73548.53",
    qtyUsdc: "0.53164",
  },
  {
    id: "296280cb-3ba3-466f-96e6-f0f018fea652",
    rungPct: 6,
    limitPriceUsd: "72016.27",
    qtyUsdc: "0.53164",
  },
];

export const FLASH_LADDER_COPY =
  "Buys more on dips. No performance claim. Spot ~76613 Chainlink Base cbBTC/USD. Resting ids from NOTES. Fills unverified.";

export const CHAT_DRY_COPY = "Chat does not submit. Live writes are CLI --live only.";

export function basescanTxUrl(hash: `0x${string}`): string {
  return `${BASESCAN_TX_ORIGIN}${hash}`;
}

export function truncateHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-4)}`;
}

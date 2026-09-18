export const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://127.0.0.1:8788";

export type AgentStatus = {
  policy: {
    bufferUsdc: string;
    perCallCapUsdc: string;
    dailyCapUsdc: string;
    hardStopUsdc: string;
  };
  missingNow: string[];
  missingLater: string[];
  dryRun: boolean;
  paused: boolean;
  signer: "bankr";
  treasuryAddress: string | null;
  treasuryDisplay: string | null;
  payDestinations: string[];
  tokens: { usdc: string; usdt: string; nvdac: string; aerodromeRouter: string };
};

export type UnsignedTx = {
  chainId: number;
  to: string;
  data: `0x${string}`;
  value: "0x0";
};

export type ChatReply = {
  kind: string;
  summary: string;
  plan: Record<string, string | number | boolean>;
  unsignedTx?: UnsignedTx;
  error?: string;
  message?: string;
};

export type TreasuryStatus = {
  live: boolean;
  eth?: string;
  usdc?: string;
  usdt?: string;
  nvdac?: string;
  tokenCount?: number;
  treasuryDisplay: string | null;
};

export type FlashOrderLive = {
  id: string;
  rungPct: 2 | 4 | 6;
  limitPriceUsd: string;
  qtyUsdc: string;
  status: string;
};

export type FlashOrdersStatus = {
  live: boolean;
  orders: FlashOrderLive[];
};

export async function fetchStatus(): Promise<AgentStatus> {
  const res = await fetch(`${AGENT_URL}/status`);
  if (!res.ok) throw new Error("status failed");
  return (await res.json()) as AgentStatus;
}

export async function fetchTreasury(): Promise<TreasuryStatus> {
  const res = await fetch(`${AGENT_URL}/treasury`);
  if (!res.ok) throw new Error("treasury failed");
  return (await res.json()) as TreasuryStatus;
}

export async function fetchFlashOrders(): Promise<FlashOrdersStatus> {
  const res = await fetch(`${AGENT_URL}/flash-orders`);
  if (!res.ok) throw new Error("flash-orders failed");
  return (await res.json()) as FlashOrdersStatus;
}

export async function postChat(prompt: string): Promise<ChatReply> {
  const res = await fetch(`${AGENT_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const body = (await res.json()) as ChatReply;
  if (!res.ok) {
    return {
      kind: "error",
      summary: body.message ?? body.error ?? "chat failed",
      plan: { action: "error", code: body.error ?? "error" },
      error: body.error,
      message: body.message,
    };
  }
  return body;
}

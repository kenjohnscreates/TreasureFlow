import {
  CHAT_KEY_HEADER,
  CHAT_NONCE_HEADER,
  CHAT_SIG_HEADER,
} from "../../src/chat/agentUrl";

export const AGENT_URL = import.meta.env.PROD
  ? ""
  : import.meta.env.VITE_AGENT_URL || "http://127.0.0.1:8788";

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
  treasuryDisplay: string | null;
  payDestDisplays: string[];
  founderDisplay: string | null;
  tokens: { usdc: string; usdt: string; nvdac: string; aerodromeRouter: string };
};

export type UnsignedTx = {
  chainId: number;
  to: string;
  data: `0x${string}`;
  value: "0x0";
  label?: string;
};

export type ChatReply = {
  kind: string;
  summary: string;
  plan: Record<string, string | number | boolean>;
  unsignedTx?: UnsignedTx;
  encodedTxs?: UnsignedTx[];
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

export type ChatAuth = {
  chatKey?: string;
  nonce?: string;
  sig?: string;
};

export async function fetchStatus(): Promise<AgentStatus> {
  const res = await fetch(`${AGENT_URL}/status`);
  if (!res.ok) throw new Error("status failed");
  return (await res.json()) as AgentStatus;
}

export const TREASURY_POLL_MS = 15_000;

export async function fetchTreasury(): Promise<TreasuryStatus> {
  const res = await fetch(`${AGENT_URL}/treasury`);
  if (!res.ok) throw new Error("treasury failed");
  return (await res.json()) as TreasuryStatus;
}

export function emptyTreasury(): TreasuryStatus {
  return { live: false, treasuryDisplay: null };
}

export async function fetchFlashOrders(): Promise<FlashOrdersStatus> {
  const res = await fetch(`${AGENT_URL}/flash-orders`);
  if (!res.ok) throw new Error("flash-orders failed");
  return (await res.json()) as FlashOrdersStatus;
}

export async function fetchChallenge(): Promise<{ nonce: string; message: string }> {
  const res = await fetch(`${AGENT_URL}/auth/challenge`);
  if (!res.ok) throw new Error("challenge failed");
  return (await res.json()) as { nonce: string; message: string };
}

export async function fetchFounderOk(address: string): Promise<boolean> {
  const res = await fetch(
    `${AGENT_URL}/auth/founder-ok?address=${encodeURIComponent(address)}`,
  );
  if (!res.ok) return false;
  const body = (await res.json()) as { ok?: boolean };
  return body.ok === true;
}

export async function postPause(paused: boolean, chatKey?: string): Promise<{ paused: boolean }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (chatKey) headers[CHAT_KEY_HEADER] = chatKey;
  const res = await fetch(`${AGENT_URL}/pause`, {
    method: "POST",
    headers,
    body: JSON.stringify({ paused }),
  });
  const body = (await res.json()) as { paused?: boolean; message?: string; error?: string };
  if (!res.ok) {
    throw new Error(body.message ?? body.error ?? "pause failed");
  }
  return { paused: body.paused === true };
}

export async function postChat(prompt: string, auth?: ChatAuth): Promise<ChatReply> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth?.chatKey) headers[CHAT_KEY_HEADER] = auth.chatKey;
  if (auth?.nonce) headers[CHAT_NONCE_HEADER] = auth.nonce;
  if (auth?.sig) headers[CHAT_SIG_HEADER] = auth.sig;
  const res = await fetch(`${AGENT_URL}/chat`, {
    method: "POST",
    headers,
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

import { type Address, getAddress, isAddress } from "viem";
import { AppError } from "../errors.ts";
import { NVDAC_DECIMALS, USDC_DECIMALS } from "../config/constants.ts";

export type PayIntent = {
  kind: "pay";
  amountUsdc: bigint;
  to: Address;
  raw: string;
};

export type DepositToken = "USDC" | "NVDAc";

export type DepositIntent = {
  kind: "deposit";
  token: DepositToken;
  amount: bigint;
  raw: string;
};

export type SweepIntent = { kind: "sweep"; raw: string };
export type LpStocksIntent = { kind: "lp_stocks"; raw: string };
export type LimitsIntent = { kind: "limits"; raw: string };

export type RejectedIntent = {
  kind: "unknown";
  raw: string;
};

export type Intent =
  | PayIntent
  | DepositIntent
  | SweepIntent
  | LpStocksIntent
  | LimitsIntent
  | RejectedIntent;

const PAY_RE = /send\s+([\d,]+(?:\.\d+)?)\s*usdc\s+to\s+(0x[a-fA-F0-9]{40})/i;
const DEPOSIT_RE = /deposit\s+([\d,]+(?:\.\d+)?)\s*(usdc|nvdac?)\b/i;
const LP_RE = /^\s*lp(?:\s+(?:stocks|nvdac?))?\s*$/i;
const SWEEP_RE = /^\s*sweep\b/i;
const LIMITS_RE = /^\s*(limits|ladder)\b/i;

export function parseTokenAmount(rawAmount: string, decimals: number): bigint {
  const amount = rawAmount.replaceAll(",", "");
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt((whole ?? "0") + fracPadded);
}

function parsePay(raw: string): PayIntent | undefined {
  const match = raw.trim().match(PAY_RE);
  if (!match?.[1] || !match[2]) return undefined;
  if (!isAddress(match[2])) {
    throw new AppError("bad_address", `Not an address: ${match[2]}`);
  }
  return {
    kind: "pay",
    amountUsdc: parseTokenAmount(match[1], USDC_DECIMALS),
    to: getAddress(match[2]),
    raw,
  };
}

function parseDeposit(raw: string): DepositIntent | undefined {
  const match = raw.trim().match(DEPOSIT_RE);
  if (!match?.[1] || !match[2]) return undefined;
  const symbol = match[2].toLowerCase();
  const token: DepositToken = symbol === "usdc" ? "USDC" : "NVDAc";
  const decimals = token === "USDC" ? USDC_DECIMALS : NVDAC_DECIMALS;
  return { kind: "deposit", token, amount: parseTokenAmount(match[1], decimals), raw };
}

export function parseIntent(raw: string): Intent {
  return (
    parsePay(raw) ??
    parseDeposit(raw) ??
    (LP_RE.test(raw) ? { kind: "lp_stocks", raw } : undefined) ??
    (SWEEP_RE.test(raw) ? { kind: "sweep", raw } : undefined) ??
    (LIMITS_RE.test(raw) ? { kind: "limits", raw } : undefined) ?? {
      kind: "unknown",
      raw,
    }
  );
}

export function assertAllowlisted(to: Address, allowlist: Address[]): void {
  const needle = getAddress(to);
  const ok = allowlist.some((addr) => getAddress(addr) === needle);
  if (!ok) throw new AppError("not_allowlisted", `${needle} is not on the allowlist`);
}

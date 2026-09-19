import { type Address, getAddress, isAddress } from "viem";
import { AppError } from "../errors.ts";
import { NVDAC_DECIMALS, USDC_DECIMALS } from "../config/constants.ts";

export type PayDestAlias = "PAY_DEST_1" | "PAY_DEST_2";

export type PayIntent = {
  kind: "pay";
  amountUsdc: bigint;
  to: Address | PayDestAlias;
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
export type BalanceIntent = { kind: "balance"; raw: string };
export type ExternalWalletIntent = { kind: "external_wallet"; raw: string };

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
  | BalanceIntent
  | ExternalWalletIntent
  | RejectedIntent;

const PAY_RE = /send\s+([\d,]+(?:\.\d+)?)\s*usdc\s+to\s+(0x[a-fA-F0-9]{40}|PAY_DEST_[12])/i;
const DEPOSIT_RE = /deposit\s+([\d,]+(?:\.\d+)?)\s*(usdc|nvdac?)\b/i;
const FROM_EXT_DEPOSIT_RE =
  /send\s+\$?([\d,]+(?:\.\d+)?)\s+(?:usdc\s+)?from\s+(?:my\s+)?(?:external(?:\s+wallet)?|wallet(?:\s*\/\s*external)?)\s+to\s+(?:the\s+)?treasury/i;
const LP_RE = /^\s*lp(?:\s+(?:stocks|nvdac?))?\s*$/i;
const SWEEP_RE = /^\s*sweep\b/i;
const LIMITS_RE = /^\s*(limits|ladder)\b/i;
const EXTERNAL_WALLET_RE =
  /external\s+wallet|founder\s+wallet|\bmy\s+(?:external\s+)?wallet\b/i;
const BALANCE_RE =
  /\b(?:balance|treasury)\b|^\s*(?:status|how much)\b|how much\b|what is the treasury/i;

export function parseTokenAmount(rawAmount: string, decimals: number): bigint {
  const amount = rawAmount.replaceAll(",", "");
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt((whole ?? "0") + fracPadded);
}

function parsePay(raw: string): PayIntent | undefined {
  const match = raw.trim().match(PAY_RE);
  if (!match?.[1] || !match[2]) return undefined;
  const destRaw = match[2];
  if (/^PAY_DEST_[12]$/i.test(destRaw)) {
    const alias = destRaw.toUpperCase() as PayDestAlias;
    return {
      kind: "pay",
      amountUsdc: parseTokenAmount(match[1], USDC_DECIMALS),
      to: alias,
      raw,
    };
  }
  if (!isAddress(destRaw)) {
    throw new AppError("bad_address", `Not an address: ${destRaw}`);
  }
  return {
    kind: "pay",
    amountUsdc: parseTokenAmount(match[1], USDC_DECIMALS),
    to: getAddress(destRaw),
    raw,
  };
}

export function resolvePayDest(
  to: Address | PayDestAlias,
  allowlist: Address[],
): Address | undefined {
  if (to === "PAY_DEST_1") return allowlist[0];
  if (to === "PAY_DEST_2") return allowlist[1];
  return to;
}

function parseDeposit(raw: string): DepositIntent | undefined {
  const trimmed = raw.trim();
  const match = trimmed.match(DEPOSIT_RE);
  if (match?.[1] && match[2]) {
    const symbol = match[2].toLowerCase();
    const token: DepositToken = symbol === "usdc" ? "USDC" : "NVDAc";
    const decimals = token === "USDC" ? USDC_DECIMALS : NVDAC_DECIMALS;
    return { kind: "deposit", token, amount: parseTokenAmount(match[1], decimals), raw };
  }
  const fromExt = trimmed.match(FROM_EXT_DEPOSIT_RE);
  if (!fromExt?.[1]) return undefined;
  return {
    kind: "deposit",
    token: "USDC",
    amount: parseTokenAmount(fromExt[1], USDC_DECIMALS),
    raw,
  };
}

function parseExternalWallet(raw: string): ExternalWalletIntent | undefined {
  if (!EXTERNAL_WALLET_RE.test(raw)) return undefined;
  if (FROM_EXT_DEPOSIT_RE.test(raw.trim())) return undefined;
  return { kind: "external_wallet", raw };
}

function parseBalance(raw: string): BalanceIntent | undefined {
  if (EXTERNAL_WALLET_RE.test(raw)) return undefined;
  if (!BALANCE_RE.test(raw)) return undefined;
  return { kind: "balance", raw };
}

export function parseIntent(raw: string): Intent {
  return (
    parsePay(raw) ??
    parseDeposit(raw) ??
    (LP_RE.test(raw) ? { kind: "lp_stocks", raw } : undefined) ??
    (SWEEP_RE.test(raw) ? { kind: "sweep", raw } : undefined) ??
    (LIMITS_RE.test(raw) ? { kind: "limits", raw } : undefined) ??
    parseExternalWallet(raw) ??
    parseBalance(raw) ?? {
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

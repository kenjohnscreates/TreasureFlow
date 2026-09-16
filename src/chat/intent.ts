import { type Address, getAddress, isAddress } from "viem";
import { AppError } from "../errors.ts";

export type PayIntent = {
  kind: "pay";
  amountUsdc: bigint;
  to: Address;
  raw: string;
};

export type RejectedIntent = {
  kind: "unknown";
  raw: string;
};

export type Intent = PayIntent | RejectedIntent;

const PAY_RE = /send\s+([\d,]+(?:\.\d+)?)\s*usdc\s+to\s+(0x[a-fA-F0-9]{40})/i;

export function parseIntent(raw: string): Intent {
  const match = raw.trim().match(PAY_RE);
  if (!match?.[1] || !match[2]) return { kind: "unknown", raw };
  if (!isAddress(match[2])) {
    throw new AppError("bad_address", `Not an address: ${match[2]}`);
  }
  const amount = match[1].replaceAll(",", "");
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = (frac + "000000").slice(0, 6);
  const amountUsdc = BigInt(whole + fracPadded);
  return { kind: "pay", amountUsdc, to: getAddress(match[2]), raw };
}

export function assertAllowlisted(to: Address, allowlist: Address[]): void {
  const needle = getAddress(to);
  const ok = allowlist.some((addr) => getAddress(addr) === needle);
  if (!ok) throw new AppError("not_allowlisted", `${needle} is not on the allowlist`);
}

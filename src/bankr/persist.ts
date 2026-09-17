import { readFileSync, writeFileSync } from "node:fs";
import type { Address } from "viem";
import { AppError } from "../errors.ts";
import { isStranded } from "./parse.ts";

function upsertLine(text: string, key: string, value: string): string {
  const lines = text.split("\n");
  let found = false;
  const next = lines.map((line) => {
    if (!line.startsWith(`${key}=`)) return line;
    found = true;
    return `${key}=${value}`;
  });
  if (!found) next.push(`${key}=${value}`);
  return next.join("\n");
}

function existingValue(text: string, key: string): string {
  for (const line of text.split("\n")) {
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1).trim();
  }
  return "";
}

export function persistTreasury(
  envPath: string,
  address: Address,
  walletId?: string,
): { wroteAddress: boolean; wroteWalletId: boolean } {
  if (isStranded(address)) {
    throw new AppError(
      "stranded_dynamic",
      "refusing to persist a stranded Dynamic address",
    );
  }
  const raw = readFileSync(envPath, "utf8");
  const current = existingValue(raw, "TREASURY_ADDRESS");
  if (current && current.toLowerCase() !== address.toLowerCase()) {
    throw new AppError(
      "treasury_mismatch",
      "TREASURY_ADDRESS already set to a different address",
    );
  }
  let text = raw;
  let wroteAddress = false;
  if (current.toLowerCase() !== address.toLowerCase()) {
    text = upsertLine(text, "TREASURY_ADDRESS", address);
    wroteAddress = true;
  }
  let wroteWalletId = false;
  if (walletId) {
    const currentId = existingValue(text, "BANKR_WALLET_ID");
    if (currentId && currentId !== walletId) {
      throw new AppError(
        "wallet_id_mismatch",
        "BANKR_WALLET_ID already set to a different id",
      );
    }
    if (currentId !== walletId) {
      text = upsertLine(text, "BANKR_WALLET_ID", walletId);
      wroteWalletId = true;
    }
  }
  if (wroteAddress || wroteWalletId) writeFileSync(envPath, text);
  return { wroteAddress, wroteWalletId };
}

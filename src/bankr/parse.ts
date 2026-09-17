import { type Address, getAddress, isAddress } from "viem";
import { BASE } from "../config/constants.ts";
import { AppError } from "../errors.ts";

export const STRANDED_DYNAMIC_ADDRESSES = [
  "0xdf3066ebba9f29cb1e5766ceb5ce61da5b81f08d",
  "0x435424b3a15d5de2d38c01d3f00e04f5d471f294",
] as const;

const STRANDED = new Set<string>(STRANDED_DYNAMIC_ADDRESSES);

export type BankrMe = {
  address: Address;
  clubActive: boolean;
  walletId?: string;
};

export type BankrPortfolioSnap = {
  evmAddress: Address | null;
  eth: string;
  usdc: string;
  usdt: string;
  nvdac: string;
  tokenCount: number;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function truncateAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function asAddress(value: string, code: string): Address {
  if (!isAddress(value)) throw new AppError(code, "Bankr address is invalid");
  return getAddress(value);
}

function optionalId(record: Record<string, unknown>): string | undefined {
  for (const key of ["walletId", "wallet_id", "id"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function parseWalletMe(body: unknown): BankrMe {
  if (!isRecord(body) || body.success !== true) {
    throw new AppError("bankr_me", "Bankr /wallet/me was not successful");
  }
  if (!Array.isArray(body.wallets)) {
    throw new AppError("bankr_me", "Bankr /wallet/me has no wallets");
  }
  const evm = body.wallets.find(
    (row) => isRecord(row) && row.chain === "evm" && typeof row.address === "string",
  );
  if (!isRecord(evm) || typeof evm.address !== "string") {
    throw new AppError("bankr_me", "Bankr /wallet/me has no evm wallet");
  }
  const club = isRecord(body.bankrClub) ? body.bankrClub.active === true : false;
  const walletId = optionalId(body) ?? (isRecord(evm) ? optionalId(evm) : undefined);
  const parsed: BankrMe = {
    address: asAddress(evm.address, "bankr_me"),
    clubActive: club,
  };
  if (walletId) parsed.walletId = walletId;
  return parsed;
}

export function isStranded(address: string): boolean {
  return STRANDED.has(address.toLowerCase());
}

export function assertNotStranded(address: Address): void {
  if (isStranded(address)) {
    throw new AppError(
      "stranded_dynamic",
      "Bankr address matches a retired Dynamic wallet; refusing TREASURY_ADDRESS",
    );
  }
}

function tokenBalance(tokens: unknown[], wanted: Address): string {
  const needle = wanted.toLowerCase();
  for (const row of tokens) {
    if (!isRecord(row) || !isRecord(row.token) || !isRecord(row.token.baseToken))
      continue;
    const addr = row.token.baseToken.address;
    const bal = row.token.balance;
    if (
      typeof addr === "string" &&
      addr.toLowerCase() === needle &&
      typeof bal === "string"
    ) {
      return bal;
    }
  }
  return "0";
}

export function parsePortfolio(body: unknown): BankrPortfolioSnap {
  if (!isRecord(body) || body.success !== true) {
    throw new AppError("bankr_portfolio", "Bankr /wallet/portfolio was not successful");
  }
  const evmAddress =
    typeof body.evmAddress === "string" && isAddress(body.evmAddress)
      ? getAddress(body.evmAddress)
      : null;
  const balances = isRecord(body.balances) ? body.balances.base : undefined;
  const chain = isRecord(balances) ? balances : {};
  const tokens = Array.isArray(chain.tokenBalances) ? chain.tokenBalances : [];
  const eth = typeof chain.nativeBalance === "string" ? chain.nativeBalance : "0";
  return {
    evmAddress,
    eth,
    usdc: tokenBalance(tokens, BASE.usdc),
    usdt: tokenBalance(tokens, BASE.usdt),
    nvdac: tokenBalance(tokens, BASE.nvdac),
    tokenCount: tokens.length,
  };
}

export function assertPortfolioMatches(me: BankrMe, snap: BankrPortfolioSnap): void {
  if (snap.evmAddress && snap.evmAddress.toLowerCase() !== me.address.toLowerCase()) {
    throw new AppError(
      "bankr_mismatch",
      "Bankr portfolio evmAddress does not match /wallet/me",
    );
  }
}

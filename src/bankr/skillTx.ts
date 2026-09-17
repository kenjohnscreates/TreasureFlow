import { type Address, isAddress, isHex } from "viem";
import { BASE } from "../config/constants.ts";
import { AppError } from "../errors.ts";
import { isRecord } from "./parse.ts";

export const DEMO_LP_USD = 10;

export type SkillTx = {
  to: Address;
  data: `0x${string}`;
  value: string;
  chainId: number;
  label: string;
};

const SPEND_TOS = new Set<string>([
  BASE.usdc.toLowerCase(),
  BASE.usdt.toLowerCase(),
  BASE.nvdac.toLowerCase(),
  BASE.aerodromeRouter.toLowerCase(),
  BASE.slipstreamNpmEquity.toLowerCase(),
  BASE.slipstreamRouterEquity.toLowerCase(),
  BASE.nvdaGauge.toLowerCase(),
]);

export function parseSkillTx(row: unknown): SkillTx {
  if (!isRecord(row) || typeof row.to !== "string" || typeof row.data !== "string") {
    throw new AppError("skill_tx", "skill tx is missing to/data");
  }
  if (typeof row.value !== "string" || typeof row.chainId !== "number") {
    throw new AppError("skill_tx", "skill tx is missing value/chainId");
  }
  if (typeof row.label !== "string" || !row.label) {
    throw new AppError("skill_tx", "skill tx is missing label");
  }
  assertCalldataHygiene(row.to, row.data, row.value, row.chainId);
  if (!SPEND_TOS.has(row.to.toLowerCase())) {
    throw new AppError("skill_to", "skill tx to is not an allowlisted spender");
  }
  return {
    to: row.to as Address,
    data: row.data as `0x${string}`,
    value: row.value,
    chainId: row.chainId,
    label: row.label,
  };
}

export function assertCalldataHygiene(
  to: string,
  data: string,
  value: string,
  chainId: number,
): void {
  if (chainId !== 8453)
    throw new AppError("skill_chain", "skill tx chainId must be 8453");
  if (!isAddress(to) || to.length !== 42) {
    throw new AppError("skill_to", "skill tx to must be 42-char hex");
  }
  if (data.startsWith("0x0x")) {
    throw new AppError("skill_data", "skill tx data has duplicated 0x");
  }
  if (!isHex(data) || data.length < 10 || data.length % 2 !== 0) {
    throw new AppError("skill_data", "skill tx data is not even-length hex");
  }
  if (value !== "0" && value !== "0x0") {
    throw new AppError("skill_value", "skill tx value must be 0");
  }
}

export function spendNotionalUsdc(tx: SkillTx): number {
  const mint = /position \$([0-9]+(?:\.[0-9]+)?)/.exec(tx.label);
  if (mint?.[1]) return Number(mint[1]);
  const swap = /swap \$([0-9]+(?:\.[0-9]+)?)/.exec(tx.label);
  if (swap?.[1]) return Number(swap[1]);
  const samm = /add sAMM .* \$([0-9]+(?:\.[0-9]+)?)/.exec(tx.label);
  if (samm?.[1]) return Number(samm[1]);
  if (/^approve /i.test(tx.label) || /^stake /i.test(tx.label)) return 0;
  throw new AppError("skill_label", "skill tx label has no spend notional");
}

export function assertUnderHardStop(tx: SkillTx, hardStopUsdc: number): void {
  const notional = spendNotionalUsdc(tx);
  if (!(notional >= 0) || Number.isNaN(notional)) {
    throw new AppError("skill_label", "skill tx notional is invalid");
  }
  if (notional > hardStopUsdc) {
    throw new AppError("hard_stop", `skill tx notional ${notional} exceeds hard stop`);
  }
}

import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { encodeAddLiquidity, encodeTransfer } from "../src/aerodrome/encode.ts";
import { BASE } from "../src/config/constants.ts";
import { usdc } from "../src/config/constants.ts";

const to = getAddress("0x000000000000000000000000000000000000dEaD");

describe("unsigned Aerodrome calldata", () => {
  it("encodes stable addLiquidity", () => {
    const data = encodeAddLiquidity({
      amountUsdc: usdc(10),
      amountUsdt: usdc(10),
      to,
      deadlineSec: 1_800_000_000n,
    });
    expect(data.startsWith("0x")).toBe(true);
    expect(data.length).toBeGreaterThan(10);
    expect(data.toLowerCase()).toContain(BASE.usdc.slice(2).toLowerCase());
  });

  it("encodes USDC transfer", () => {
    const data = encodeTransfer(to, usdc(8));
    expect(data.startsWith("0x")).toBe(true);
  });
});

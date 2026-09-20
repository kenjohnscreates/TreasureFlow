import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import {
  encodeAddLiquidity,
  encodeRemoveLiquidity,
  encodeTransfer,
} from "../src/aerodrome/encode.ts";
import { sizeLpBurn, withPublicRpcs } from "../src/aerodrome/quote.ts";
import { BASE } from "../src/config/constants.ts";
import { AppError } from "../src/errors.ts";
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

  it("encodes stable removeLiquidity USDC then USDT", () => {
    const data = encodeRemoveLiquidity({
      liquidity: 1_000_000n,
      minUsdc: usdc(1),
      minUsdt: usdc(1),
      to,
      deadlineSec: 1_800_000_000n,
    });
    expect(data.startsWith("0x")).toBe(true);
    expect(data.toLowerCase()).toContain(BASE.usdc.slice(2).toLowerCase());
    expect(data.toLowerCase()).toContain(BASE.usdt.slice(2).toLowerCase());
  });
});

describe("sAMM remove quote sizing", () => {
  it("sizes LP burn from quoted USDC and never exceeds the position", () => {
    expect(
      sizeLpBurn({
        totalLiquidity: 1_000_000n,
        shortfallUsdc: usdc(5),
        fullAmountUsdc: usdc(20),
      }),
    ).toBe(250_000n);
    expect(
      sizeLpBurn({
        totalLiquidity: 1_000_000n,
        shortfallUsdc: usdc(21),
        fullAmountUsdc: usdc(20),
      }),
    ).toBe(1_000_000n);
    expect(
      sizeLpBurn({
        totalLiquidity: 0n,
        shortfallUsdc: usdc(1),
        fullAmountUsdc: usdc(1),
      }),
    ).toBe(0n);
  });

  it("maps exhausted RPC failures to aerodrome_quote", async () => {
    await expect(
      withPublicRpcs("https://example.invalid", async () => {
        throw new Error("RPC Request failed");
      }),
    ).rejects.toMatchObject({ code: "aerodrome_quote" });
    await expect(
      withPublicRpcs("https://example.invalid", async () => {
        throw new AppError("hard_stop", "quoted USDC exceeds hard stop");
      }),
    ).rejects.toMatchObject({ code: "hard_stop" });
  });
});

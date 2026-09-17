import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { decodeTransfer } from "../src/aerodrome/encode.ts";
import { STRANDED_DYNAMIC_ADDRESSES, truncateAddress } from "../src/bankr/parse.ts";
import { handleChat } from "../src/chat/handle.ts";
import { publicStatus } from "../src/chat/status.ts";
import { BASE } from "../src/config/constants.ts";
import { loadConfig } from "../src/config/load.ts";
import { AppError } from "../src/errors.ts";

const TREASURY = getAddress("0x1111111111111111111111111111111111111111");

describe("B1 unsigned deposit", () => {
  it("USDC calldata to is the token; transfer target is treasury", () => {
    const config = { ...loadConfig(), treasuryAddress: TREASURY };
    const reply = handleChat("deposit 8 USDC", config);
    expect(reply.unsignedTx?.to).toBe(BASE.usdc);
    expect(reply.plan.tokenAddress).toBe(BASE.usdc);
    expect(reply.plan.transferTo).toBe(TREASURY);
    const decoded = decodeTransfer(reply.unsignedTx!.data);
    expect(decoded.to).toBe(TREASURY);
    expect(decoded.amount).toBe(8_000_000n);
  });

  it("NVDAc calldata to is the token; transfer target is treasury", () => {
    const config = { ...loadConfig(), treasuryAddress: TREASURY };
    const reply = handleChat("deposit 1.5 NVDAc", config);
    expect(reply.unsignedTx?.to).toBe(BASE.nvdac);
    expect(reply.plan.tokenAddress).toBe(BASE.nvdac);
    expect(reply.plan.transferTo).toBe(TREASURY);
    const decoded = decodeTransfer(reply.unsignedTx!.data);
    expect(decoded.to).toBe(TREASURY);
    expect(decoded.amount).toBe(150_000_000n);
  });

  it("refuses stranded Dynamic treasury", () => {
    const config = {
      ...loadConfig(),
      treasuryAddress: getAddress(STRANDED_DYNAMIC_ADDRESSES[0]),
    };
    expect(() => handleChat("deposit 8 USDC", config)).toThrow(AppError);
    try {
      handleChat("deposit 8 USDC", config);
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      if (err instanceof AppError) expect(err.code).toBe("stranded_dynamic");
    }
  });

  it("status exposes Bankr treasury for the founder dApp", () => {
    const status = publicStatus({ ...loadConfig(), treasuryAddress: TREASURY });
    expect(status.signer).toBe("bankr");
    expect(status.treasuryAddress).toBe(TREASURY);
    expect(status.treasuryDisplay).toBe(truncateAddress(TREASURY));
    expect(status.tokens.usdc).toBe(BASE.usdc);
    expect(status.tokens.nvdac).toBe(BASE.nvdac);
  });
});

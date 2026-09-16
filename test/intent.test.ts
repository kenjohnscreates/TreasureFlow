import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { parseIntent, assertAllowlisted } from "../src/chat/intent.ts";
import { AppError } from "../src/errors.ts";

const dest = getAddress("0x000000000000000000000000000000000000dEaD");

describe("parseIntent", () => {
  it("parses send N USDC to 0x", () => {
    const intent = parseIntent(`send 8 USDC to ${dest}`);
    expect(intent.kind).toBe("pay");
    if (intent.kind === "pay") {
      expect(intent.amountUsdc).toBe(8_000_000n);
      expect(intent.to).toBe(dest);
    }
  });

  it("parses commas used in spoken demo copy", () => {
    const intent = parseIntent(`send 2,400 USDC to ${dest}`);
    expect(intent.kind).toBe("pay");
    if (intent.kind === "pay") expect(intent.amountUsdc).toBe(2_400_000_000n);
  });

  it("returns unknown for chatter", () => {
    expect(parseIntent("what is the buffer?").kind).toBe("unknown");
  });
});

describe("allowlist", () => {
  it("rejects unknown destinations", () => {
    expect(() => assertAllowlisted(dest, [])).toThrow(AppError);
  });
});

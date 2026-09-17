import { getAddress } from "viem";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { persistTreasury } from "../src/bankr/persist.ts";
import {
  STRANDED_DYNAMIC_ADDRESSES,
  assertNotStranded,
  parsePortfolio,
  parseWalletMe,
  truncateAddress,
} from "../src/bankr/parse.ts";
import { loadConfig } from "../src/config/load.ts";
import { missingLater, missingNow } from "../src/config/status.ts";

const SAMPLE_EVM = "0x1111111111111111111111111111111111111111";

function meBody(address = SAMPLE_EVM, club = true) {
  return {
    success: true,
    wallets: [
      { chain: "evm", address },
      { chain: "solana", address: "5DcKfake" },
    ],
    bankrClub: { active: club, subscriptionType: "monthly" },
  };
}

describe("bankr parse", () => {
  it("reads evm address and club from /wallet/me", () => {
    const me = parseWalletMe(meBody());
    expect(me.address).toBe("0x1111111111111111111111111111111111111111");
    expect(me.clubActive).toBe(true);
    expect(me.walletId).toBeUndefined();
  });

  it("persists vendor wallet id when present", () => {
    const me = parseWalletMe({ ...meBody(), walletId: "wal_abc" });
    expect(me.walletId).toBe("wal_abc");
  });

  it("rejects a missing evm wallet", () => {
    expect(() => parseWalletMe({ success: true, wallets: [] })).toThrow(/no evm wallet/);
  });

  it("refuses stranded Dynamic addresses", () => {
    expect(() => assertNotStranded(getAddress(STRANDED_DYNAMIC_ADDRESSES[0]))).toThrow(
      /retired Dynamic/,
    );
  });

  it("truncates without em dash", () => {
    expect(truncateAddress(SAMPLE_EVM)).toBe("0x1111...1111");
    expect(truncateAddress(SAMPLE_EVM).includes("\u2014")).toBe(false);
    expect(truncateAddress(SAMPLE_EVM).includes("\u2013")).toBe(false);
  });
});

describe("bankr portfolio", () => {
  it("pulls Base ETH and named tokens", () => {
    const snap = parsePortfolio({
      success: true,
      evmAddress: SAMPLE_EVM,
      balances: {
        base: {
          nativeBalance: "0.02",
          tokenBalances: [
            {
              token: {
                balance: "12.5",
                baseToken: {
                  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                  symbol: "USDC",
                },
              },
            },
          ],
        },
      },
    });
    expect(snap.eth).toBe("0.02");
    expect(snap.usdc).toBe("12.5");
    expect(snap.usdt).toBe("0");
    expect(snap.nvdac).toBe("0");
    expect(snap.tokenCount).toBe(1);
  });
});

describe("bankr persist", () => {
  it("writes TREASURY_ADDRESS into an env file", () => {
    const dir = mkdtempSync(join(tmpdir(), "tf-bankr-"));
    const path = join(dir, ".env");
    writeFileSync(path, "BANKR_API_KEY=x\nTREASURY_ADDRESS=\n");
    const result = persistTreasury(path, getAddress(SAMPLE_EVM), "wal_abc");
    expect(result.wroteAddress).toBe(true);
    expect(result.wroteWalletId).toBe(true);
    const text = readFileSync(path, "utf8");
    expect(text).toContain(`TREASURY_ADDRESS=${getAddress(SAMPLE_EVM)}`);
    expect(text).toContain("BANKR_WALLET_ID=wal_abc");
  });

  it("refuses stranded persist", () => {
    const dir = mkdtempSync(join(tmpdir(), "tf-bankr-"));
    const path = join(dir, ".env");
    writeFileSync(path, "TREASURY_ADDRESS=\n");
    expect(() =>
      persistTreasury(path, getAddress(STRANDED_DYNAMIC_ADDRESSES[1])),
    ).toThrow(/stranded/);
  });
});

describe("bankr env status", () => {
  it("treats BANKR_API_KEY as need-now", () => {
    const dir = mkdtempSync(join(tmpdir(), "tf-bankr-"));
    const path = join(dir, ".env");
    writeFileSync(path, "BANKR_API_KEY=\n");
    const config = loadConfig(path);
    expect(missingNow(config)).toContain("BANKR_API_KEY");
    expect(missingNow(config)).not.toContain("DYNAMIC_ENVIRONMENT_ID");
    expect(missingLater(config)).toContain("PAY_DEST_1");
  });
});

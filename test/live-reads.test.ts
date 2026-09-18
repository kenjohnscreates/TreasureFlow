import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, parseUnits } from "viem";
import { describe, expect, it } from "vitest";
import { parsePortfolio } from "../src/bankr/parse.ts";
import { portfolioToSnapshot } from "../src/bankr/snapshot.ts";
import { handleChat } from "../src/chat/handle.ts";
import { DEFAULT_AGENT_PORT } from "../src/chat/http.ts";
import { publicFlashOrders, publicTreasury } from "../src/chat/reads.ts";
import { usdc } from "../src/config/constants.ts";
import { loadConfig } from "../src/config/load.ts";
import { FLASH_ORDERS } from "../src/demo/evidence.ts";
import { parseFlashOrderStatus } from "../src/flash/parse.ts";

const SAMPLE_EVM = "0x1111111111111111111111111111111111111111";
const dest = getAddress(SAMPLE_EVM);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function portfolioBody() {
  return {
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
  };
}

describe("portfolio-to-snapshot", () => {
  it("maps Bankr balances into the treasury snapshot", () => {
    const snap = parsePortfolio(portfolioBody());
    const snapshot = portfolioToSnapshot(snap);
    expect(snapshot.usdcFree).toBe(parseUnits("12.5", 6));
    expect(snapshot.usdtFree).toBe(0n);
    expect(snapshot.lpValueUsdc).toBe(0n);
  });
});

describe("treasury live:false without keys", () => {
  it("omits balances when BANKR_API_KEY is empty", async () => {
    const body = await publicTreasury({ ...loadConfig(), bankrApiKey: "" });
    expect(body.live).toBe(false);
    expect(body.eth).toBeUndefined();
    expect(body.usdc).toBeUndefined();
    expect(body.usdt).toBeUndefined();
    expect(body.nvdac).toBeUndefined();
  });
});

describe("chat still dry on a live snapshot", () => {
  it("plans pay from live USDC and never marks sent", () => {
    const config = { ...loadConfig(), payDestinations: [dest] };
    const reply = handleChat(`send 8 USDC to ${dest}`, config, {
      snapshot: { usdcFree: usdc(21), usdtFree: 0n, lpValueUsdc: 0n },
    });
    expect(reply.kind).toBe("pay");
    expect(reply.plan.action).toBe("pay");
    expect(reply.plan.sent).toBe("false");
    expect(reply.summary).toContain("Chat does not submit");
    expect(reply.summary).toContain("not sent");
  });

  it("rejects Send 50 on a live snapshot", () => {
    const config = { ...loadConfig(), payDestinations: [dest] };
    const reply = handleChat(`send 50 USDC to ${dest}`, config, {
      snapshot: { usdcFree: usdc(21), usdtFree: 0n, lpValueUsdc: 0n },
    });
    expect(reply.plan.action).toBe("rejected");
    expect(reply.plan.code).toBe("per_call_cap");
  });

  it("keeps sweep dry when using live idle cash", () => {
    const reply = handleChat("sweep", loadConfig(), {
      snapshot: { usdcFree: usdc(21), usdtFree: usdc(5), lpValueUsdc: 0n },
    });
    expect(reply.summary).toContain("Chat does not submit");
    expect(reply.plan.action).toBe("add_liquidity");
  });
});

describe("flash order status parse", () => {
  it("reads status from the order body or nested order", () => {
    expect(parseFlashOrderStatus({ status: "ACCEPTED" })).toBe("ACCEPTED");
    expect(parseFlashOrderStatus({ order: { status: "FILLED" } })).toBe("FILLED");
    expect(parseFlashOrderStatus({})).toBe("unknown");
  });

  it("returns static resting evidence when Flash key or treasury is missing", async () => {
    const body = await publicFlashOrders({
      ...loadConfig(),
      flashApiKey: "",
      treasuryAddress: null,
    });
    expect(body.live).toBe(false);
    expect(body.orders).toHaveLength(3);
    expect(body.orders.map((order) => order.id)).toEqual(FLASH_ORDERS.map((o) => o.id));
    expect(body.orders.every((order) => order.status === "resting")).toBe(true);
  });
});

describe("Bankr-tree local ports", () => {
  it("defaults agent 8788, vite 5174, and VITE_AGENT_URL 8788", () => {
    expect(DEFAULT_AGENT_PORT).toBe(8788);
    const vite = readFileSync(join(root, "web/vite.config.ts"), "utf8");
    expect(vite).toMatch(/port:\s*5174/);
    const agent = readFileSync(join(root, "web/src/agent.ts"), "utf8");
    expect(agent).toContain("http://127.0.0.1:8788");
    const readme = readFileSync(join(root, "README.md"), "utf8");
    expect(readme).toContain("127.0.0.1:8788");
    expect(readme).toContain("127.0.0.1:5174");
  });
});

import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { handleChat } from "../src/chat/handle.ts";
import { publicStatus } from "../src/chat/status.ts";
import { loadConfig } from "../src/config/load.ts";
import { usdc } from "../src/config/constants.ts";

const dest = getAddress("0x1111111111111111111111111111111111111111");
const other = getAddress("0x2222222222222222222222222222222222222222");

describe("B2 prompt-to-pay orchestrator", () => {
  it("rejects 50 USDC in chat without calling Bankr", () => {
    const config = { ...loadConfig(), payDestinations: [dest] };
    const reply = handleChat(`send 50 USDC to ${dest}`, config);
    expect(reply.kind).toBe("pay");
    expect(reply.plan.action).toBe("rejected");
    expect(reply.plan.code).toBe("per_call_cap");
    expect(reply.summary).toContain("10 USDC");
  });

  it("dry-runs 8 USDC to an allowlisted dest", () => {
    const config = { ...loadConfig(), payDestinations: [dest] };
    const reply = handleChat(`send 8 USDC to ${dest}`, config);
    expect(reply.kind).toBe("pay");
    expect(reply.plan.action).toBe("pay");
    expect(reply.plan.sent).toBe("false");
    expect(reply.plan.amountUsdc).toBe("8");
    expect(reply.summary).toContain("not sent");
  });

  it("rejects a dest that is not PAY_DEST", () => {
    const config = { ...loadConfig(), payDestinations: [dest] };
    const reply = handleChat(`send 8 USDC to ${other}`, config);
    expect(reply.plan.action).toBe("rejected");
    expect(reply.plan.code).toBe("not_allowlisted");
  });

  it("does not treat the typed dest as the allowlist", () => {
    const config = { ...loadConfig(), payDestinations: [] };
    const reply = handleChat(`send 8 USDC to ${dest}`, config);
    expect(reply.plan.action).toBe("rejected");
    expect(reply.plan.code).toBe("missing_pay_dest");
  });

  it("exposes pay destinations on status for the dApp", () => {
    const status = publicStatus({ ...loadConfig(), payDestinations: [dest] });
    expect(status.payDestinations).toEqual([dest]);
  });
});

describe("B2 policy amounts", () => {
  it("keeps demo pay under the hard stop", () => {
    const config = loadConfig();
    expect(config.policy.demoPayUsdc).toBe(usdc(8));
    expect(config.policy.demoRejectUsdc).toBe(usdc(50));
    expect(config.policy.demoPayUsdc < config.policy.hardStopUsdc).toBe(true);
    expect(config.policy.demoRejectUsdc > config.policy.perCallCapUsdc).toBe(true);
  });
});

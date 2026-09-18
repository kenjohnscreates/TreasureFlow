import { getAddress } from "viem";
import { describe, expect, it, vi } from "vitest";
import { truncateAddress } from "../src/bankr/parse.ts";
import { handleChat } from "../src/chat/handle.ts";
import { publicStatus } from "../src/chat/status.ts";
import { maybeSubmitChatPay } from "../src/chat/submitPay.ts";
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
    expect(reply.plan.sent).toBe(false);
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

const MOCK_HASH =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

function submitDeps() {
  return {
    transferUsdc: vi.fn(async () => MOCK_HASH),
    appendSpend: vi.fn(async () => []),
  };
}

describe("B13 chat pay submit helper", () => {
  it("submits allowlisted 8 USDC pay via transferUsdc", async () => {
    const config = {
      ...loadConfig(),
      payDestinations: [dest],
      bankrApiKey: "test-key",
    };
    const prompt = `send 8 USDC to ${dest}`;
    const reply = handleChat(prompt, config);
    const deps = submitDeps();
    const out = await maybeSubmitChatPay(prompt, reply, config, deps);
    expect(deps.transferUsdc).toHaveBeenCalledOnce();
    expect(deps.transferUsdc).toHaveBeenCalledWith({
      apiKey: "test-key",
      recipient: dest,
      amountHuman: "8",
    });
    expect(deps.appendSpend).toHaveBeenCalledWith(usdc(8));
    expect(out.plan.action).toBe("pay");
    expect(out.plan.sent).toBe(true);
    expect(out.plan.txHash).toBe(truncateAddress(MOCK_HASH));
    expect(out.summary).toContain(truncateAddress(MOCK_HASH));
    expect(out.summary).not.toContain("not sent");
    expect(out.plan.to).toBe(truncateAddress(dest));
  });

  it("does not submit on per_call_cap reject", async () => {
    const config = { ...loadConfig(), payDestinations: [dest], bankrApiKey: "test-key" };
    const prompt = `send 50 USDC to ${dest}`;
    const reply = handleChat(prompt, config);
    const deps = submitDeps();
    const out = await maybeSubmitChatPay(prompt, reply, config, deps);
    expect(reply.plan.action).toBe("rejected");
    expect(reply.plan.code).toBe("per_call_cap");
    expect(deps.transferUsdc).not.toHaveBeenCalled();
    expect(deps.appendSpend).not.toHaveBeenCalled();
    expect(out.plan.action).toBe("rejected");
    expect(out.plan.sent).toBeUndefined();
  });

  it("does not submit unwind_and_pay", async () => {
    const config = { ...loadConfig(), payDestinations: [dest], bankrApiKey: "test-key" };
    const prompt = `send 8 USDC to ${dest}`;
    const reply = handleChat(prompt, config, {
      snapshot: { usdcFree: usdc(3), usdtFree: 0n, lpValueUsdc: usdc(20) },
    });
    expect(reply.plan.action).toBe("unwind_and_pay");
    const deps = submitDeps();
    const out = await maybeSubmitChatPay(prompt, reply, config, deps);
    expect(deps.transferUsdc).not.toHaveBeenCalled();
    expect(deps.appendSpend).not.toHaveBeenCalled();
    expect(out.plan.action).toBe("unwind_and_pay");
    expect(out.plan.code).toBe("unwind_not_live");
    expect(out.plan.sent).toBe(false);
    expect(out.summary).toContain("B14");
    expect(out.summary).toContain("not live");
  });

  it("does not submit sweep", async () => {
    const config = { ...loadConfig(), bankrApiKey: "test-key" };
    const reply = handleChat("sweep", config);
    const deps = submitDeps();
    const out = await maybeSubmitChatPay("sweep", reply, config, deps);
    expect(deps.transferUsdc).not.toHaveBeenCalled();
    expect(out.kind).toBe("sweep");
  });

  it("does not submit limits", async () => {
    const config = { ...loadConfig(), bankrApiKey: "test-key" };
    const reply = handleChat("limits", config);
    const deps = submitDeps();
    const out = await maybeSubmitChatPay("limits", reply, config, deps);
    expect(deps.transferUsdc).not.toHaveBeenCalled();
    expect(out.kind).toBe("limits");
  });
});

import { describe, expect, it } from "vitest";
import { extractTxHash, parseAgentJob, parsePromptAccepted } from "../src/bankr/agent.ts";
import { rawSubmitPrompt } from "../src/bankr/submitRaw.ts";
import {
  assertUnderHardStop,
  parseSkillTx,
  spendNotionalUsdc,
  type SkillTx,
} from "../src/bankr/skillTx.ts";
import { handleChat } from "../src/chat/handle.ts";
import { BASE } from "../src/config/constants.ts";
import { loadConfig } from "../src/config/load.ts";
import { AppError } from "../src/errors.ts";
import { coreAllowlist } from "../src/policy/allowlist.ts";

const mint: SkillTx = {
  to: BASE.slipstreamNpmEquity,
  data: "0xb5007d1f000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  value: "0",
  chainId: 8453,
  label: "mint NVDA position $10.00 at $209.38 - $228.86",
};

describe("skill tx hygiene", () => {
  it("rejects duplicated 0x and keeps to verbatim", () => {
    expect(() =>
      parseSkillTx({
        to: BASE.usdc,
        data: "0x0x095ea7b3",
        value: "0",
        chainId: 8453,
        label: "approve USDC -> NPM",
      }),
    ).toThrow(/duplicated 0x/);
    const tx = parseSkillTx({
      to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      data: "0x095ea7b3000000000000000000000000e1f8cd9ac4e4a65f54f38a5cdafca44f6dd68b53",
      value: "0",
      chainId: 8453,
      label: "approve USDC -> NPM",
    });
    expect(tx.to).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(spendNotionalUsdc(tx)).toBe(0);
  });

  it("reads sAMM add notional from the label", () => {
    const tx = parseSkillTx({
      to: BASE.aerodromeRouter,
      data: "0x14961387000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      value: "0",
      chainId: 8453,
      label: "add sAMM USDC/USDT $4.38",
    });
    expect(spendNotionalUsdc(tx)).toBe(4.38);
    expect(() => assertUnderHardStop(tx, 15)).not.toThrow();
  });

  it("reads sAMM remove notional and allows LP token approve", () => {
    const remove = parseSkillTx({
      to: BASE.aerodromeRouter,
      data: "0xbaa2abde000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      value: "0",
      chainId: 8453,
      label: "remove sAMM USDC/USDT $1.41",
    });
    expect(spendNotionalUsdc(remove)).toBe(1.41);
    expect(() => assertUnderHardStop(remove, 15)).not.toThrow();
    const approve = parseSkillTx({
      to: BASE.usdcUsdtSamm,
      data: "0x095ea7b3000000000000000000000000cf77a3ba9a5ca399b7c97c74d54e5b1beb874e43",
      value: "0",
      chainId: 8453,
      label: "approve LP -> router",
    });
    expect(approve.to).toBe(BASE.usdcUsdtSamm);
    expect(spendNotionalUsdc(approve)).toBe(0);
  });

  it("enforces hard stop on mint notional", () => {
    expect(spendNotionalUsdc(mint)).toBe(10);
    expect(() => assertUnderHardStop(mint, 15)).not.toThrow();
    expect(() =>
      assertUnderHardStop({ ...mint, label: "mint NVDA position $50.00 at $1 - $2" }, 15),
    ).toThrow(AppError);
  });

  it("raw prompt copies to/data/value unmodified", () => {
    const prompt = rawSubmitPrompt(mint);
    expect(prompt).toContain(`to: ${mint.to}`);
    expect(prompt).toContain(`data: ${mint.data}`);
    expect(prompt).toContain("value: 0");
    expect(prompt.includes("0x0x")).toBe(false);
    expect(prompt).toContain("submit_raw_transaction");
  });
});

describe("agent job parse", () => {
  it("reads jobId and hash from response text", () => {
    const accepted = parsePromptAccepted({
      success: true,
      jobId: "job_1",
      threadId: "thr_1",
      status: "pending",
    });
    expect(accepted.jobId).toBe("job_1");
    const job = parseAgentJob({
      success: true,
      jobId: "job_1",
      status: "completed",
      response:
        "mined 0x725611366d7ea9790ab7852740d7403c234f2c22057eb4ef9a573d9ccfb312fe",
    });
    expect(job.txHash).toBe(
      "0x725611366d7ea9790ab7852740d7403c234f2c22057eb4ef9a573d9ccfb312fe",
    );
    expect(extractTxHash("no hash")).toBeUndefined();
  });
});

describe("chat lp stocks", () => {
  it("plans lp stocks from chat without submitting", () => {
    const reply = handleChat("lp NVDAc", loadConfig());
    expect(reply.plan.action).toBe("lp_stocks");
    expect(reply.plan.sent).toBe(false);
    expect(coreAllowlist()).toContain(BASE.slipstreamNpmEquity);
    expect(coreAllowlist()).toContain(BASE.aerodromeRouter);
  });
});

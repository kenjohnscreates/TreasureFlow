import { unlink } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { truncateAddress } from "../src/bankr/parse.ts";
import {
  CHAT_KEY_HEADER,
  CHAT_NONCE_HEADER,
  CHAT_SIG_HEADER,
} from "../src/chat/agentUrl.ts";
import { assertFounderSubmit, issueChallenge } from "../src/chat/founderAuth.ts";
import { handleChat } from "../src/chat/handle.ts";
import {
  allowCorsOrigin,
  chatKeyGate,
  corsOriginHeader,
} from "../src/chat/hosting.ts";
import { app } from "../src/chat/http.ts";
import { writePaused } from "../src/chat/pause.ts";
import { publicStatus } from "../src/chat/status.ts";
import { maybeSubmitChatPay } from "../src/chat/submitPay.ts";
import { loadConfig } from "../src/config/load.ts";
import { usdc } from "../src/config/constants.ts";
import { AppError } from "../src/errors.ts";

const dest = getAddress("0x1111111111111111111111111111111111111111");
const founder = privateKeyToAccount(generatePrivateKey());

const saved = {
  VERCEL: process.env.VERCEL,
  CHAT_KEY: process.env.CHAT_KEY,
  PAY_DEST_1: process.env.PAY_DEST_1,
  FOUNDER_ADDRESS: process.env.FOUNDER_ADDRESS,
  BANKR_API_KEY: process.env.BANKR_API_KEY,
  PAUSED: process.env.PAUSED,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function cleanupFiles() {
  await unlink(".data/paused.json").catch(() => undefined);
  await unlink(".data/challenge.json").catch(() => undefined);
  await unlink("/tmp/treasureflow-paused.json").catch(() => undefined);
  await unlink("/tmp/treasureflow-challenge.json").catch(() => undefined);
}

describe("B26 hosting, pause, spend, founder", () => {
  beforeEach(async () => {
    await cleanupFiles();
  });
  afterEach(async () => {
    await cleanupFiles();
    restoreEnv();
  });

  it("denies localhost CORS on the agent when VERCEL=1", async () => {
    process.env.VERCEL = "1";
    const res = await app.request("/health", {
      headers: { Origin: "http://localhost:5174" },
    });
    expect(res.headers.get("access-control-allow-origin")).not.toBe(
      "http://localhost:5174",
    );
  });

  it("denies localhost CORS when VERCEL=1", () => {
    const env = { VERCEL: "1", VERCEL_URL: "tf.vercel.app" };
    expect(allowCorsOrigin("http://localhost:5174", env)).toBe(false);
    expect(allowCorsOrigin("http://127.0.0.1:5174", env)).toBe(false);
    expect(corsOriginHeader("http://localhost:5174", env)).toBe("");
    expect(allowCorsOrigin("https://tf.vercel.app", env)).toBe(true);
  });

  it("blocks submit on Vercel when CHAT_KEY is empty and still plans without a key", () => {
    const pay = { kind: "pay" as const, plan: { action: "pay" as const } };
    const env = { VERCEL: "1" };
    expect(chatKeyGate(pay, "any", "", env)).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(chatKeyGate(pay, undefined, "", env)).toEqual({
      ok: true,
      submit: false,
    });
  });

  it("plan-only POST /chat pay without Bankr does not use demo 55", async () => {
    process.env.VERCEL = "1";
    process.env.PAY_DEST_1 = dest;
    process.env.PAUSED = "false";
    process.env.BANKR_API_KEY = "";
    const res = await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "send 8 USDC to PAY_DEST_1" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      plan: { sent?: boolean; action?: string; code?: string };
    };
    expect(body.plan.action).toBe("rejected");
    expect(body.plan.code).toBe("no_live_snapshot");
    expect(body.plan.sent).toBeUndefined();
  });

  it("VERCEL + empty CHAT_KEY does not submit without a live snapshot", async () => {
    process.env.VERCEL = "1";
    process.env.CHAT_KEY = "";
    process.env.PAY_DEST_1 = dest;
    process.env.PAUSED = "false";
    process.env.BANKR_API_KEY = "";
    const plan = await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "send 8 USDC to PAY_DEST_1" }),
    });
    expect(plan.status).toBe(200);
    const submit = await app.request("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CHAT_KEY_HEADER]: "x",
      },
      body: JSON.stringify({ prompt: "send 8 USDC to PAY_DEST_1" }),
    });
    expect(submit.status).toBe(200);
    const body = (await submit.json()) as { plan: { action?: string; code?: string } };
    expect(body.plan.action).toBe("rejected");
    expect(body.plan.code).toBe("no_live_snapshot");
  });

  it("pause file flips /status and blocks pay", async () => {
    process.env.VERCEL = "1";
    process.env.PAUSED = "false";
    process.env.PAY_DEST_1 = dest;
    await writePaused(true);
    const statusRes = await app.request("/status");
    expect(statusRes.status).toBe(200);
    const status = (await statusRes.json()) as { paused: boolean };
    expect(status.paused).toBe(true);
    const config = { ...loadConfig(), payDestinations: [dest], paused: true };
    const reply = handleChat("send 8 USDC to PAY_DEST_1", config);
    expect(reply.plan.action).toBe("rejected");
    expect(reply.plan.code).toBe("paused");
    const deps = {
      transferUsdc: vi.fn(async () => "0xabc" as const),
      appendSpend: vi.fn(async () => []),
      assertSpendWritable: vi.fn(async () => undefined),
    };
    const out = await maybeSubmitChatPay(
      "send 8 USDC to PAY_DEST_1",
      { kind: "pay", summary: "plan", plan: { action: "pay", sent: false } },
      { ...loadConfig(), payDestinations: [dest], paused: true, bankrApiKey: "k" },
      deps,
    );
    expect(deps.transferUsdc).not.toHaveBeenCalled();
    expect(out.plan.action).toBe("rejected");
    expect(out.plan.code).toBe("paused");
  });

  it("spend probe failure rejects before transfer", async () => {
    const config = {
      ...loadConfig(),
      payDestinations: [dest],
      bankrApiKey: "test-key",
      paused: false,
    };
    const prompt = `send 8 USDC to ${dest}`;
    const reply = handleChat(prompt, config, {
      snapshot: { usdcFree: usdc(55), usdtFree: usdc(40), lpValueUsdc: 0n },
    });
    expect(reply.plan.action).toBe("pay");
    const deps = {
      transferUsdc: vi.fn(async () => "0xabc" as const),
      appendSpend: vi.fn(async () => []),
      assertSpendWritable: vi.fn(async () => {
        throw new AppError("spend_unwritable", "spend log is not writable");
      }),
    };
    const out = await maybeSubmitChatPay(prompt, reply, config, deps);
    expect(deps.transferUsdc).not.toHaveBeenCalled();
    expect(deps.appendSpend).not.toHaveBeenCalled();
    expect(out.plan.action).toBe("rejected");
    expect(out.plan.code).toBe("spend_unwritable");
  });

  it("requires founder sig when FOUNDER_ADDRESS is set", async () => {
    process.env.PAY_DEST_1 = dest;
    process.env.PAUSED = "false";
    process.env.CHAT_KEY = "unit-test-key";
    process.env.FOUNDER_ADDRESS = founder.address;
    process.env.BANKR_API_KEY = "";
    const missing = await app.request("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CHAT_KEY_HEADER]: "unit-test-key",
      },
      body: JSON.stringify({ prompt: "send 8 USDC to PAY_DEST_1" }),
    });
    expect(missing.status).toBe(200);
    const missingBody = (await missing.json()) as { plan?: { code?: string } };
    expect(missingBody.plan?.code).toBe("no_live_snapshot");

    const challenge = await issueChallenge();
    const sig = await founder.signMessage({ message: challenge.message });
    const ok = await assertFounderSubmit({
      founderAddress: founder.address,
      nonceHeader: challenge.nonce,
      sigHeader: sig,
    });
    expect(ok).toEqual({ ok: true });

    const challenge2 = await issueChallenge();
    const signed = await founder.signMessage({ message: challenge2.message });
    const submit = await app.request("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CHAT_KEY_HEADER]: "unit-test-key",
        [CHAT_NONCE_HEADER]: challenge2.nonce,
        [CHAT_SIG_HEADER]: signed,
      },
      body: JSON.stringify({ prompt: "send 8 USDC to PAY_DEST_1" }),
    });
    expect(submit.status).toBe(200);
    const body = (await submit.json()) as { plan?: { code?: string } };
    expect(body.plan?.code).toBe("no_live_snapshot");
  });

  it("GET /status JSON has no 42-char treasury or pay dest", () => {
    const status = publicStatus({
      ...loadConfig(),
      treasuryAddress: dest,
      payDestinations: [dest],
      founderAddress: dest,
    });
    const json = JSON.stringify(status);
    expect(status).not.toHaveProperty("treasuryAddress");
    expect(status).not.toHaveProperty("payDestinations");
    expect(json).not.toContain(dest);
    expect(status.treasuryDisplay).toBe(truncateAddress(dest));
    expect(status.payDestDisplays).toEqual([truncateAddress(dest)]);
    expect(status.founderDisplay).toBe(truncateAddress(dest));
    expect(status.treasuryDisplay).not.toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("GET /auth/founder-ok checksum-compares without echoing founder", async () => {
    process.env.FOUNDER_ADDRESS = founder.address;
    const ok = await app.request(`/auth/founder-ok?address=${founder.address}`);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true });
    const other = getAddress("0x2222222222222222222222222222222222222222");
    const no = await app.request(`/auth/founder-ok?address=${other}`);
    expect(await no.json()).toEqual({ ok: false });
    const status = await app.request("/status");
    const body = (await status.json()) as { founderDisplay: string | null };
    expect(JSON.stringify(body)).not.toContain(founder.address);
    expect(body.founderDisplay).toBe(truncateAddress(founder.address));
  });
});

describe("B26 dApp source guards", () => {
  it("keeps the write key in memory and chips on PAY_DEST_1", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const appSrc = readFileSync(join(root, "web/src/App.tsx"), "utf8");
    const landing = readFileSync(join(root, "web/src/Landing.tsx"), "utf8");
    expect(appSrc).not.toMatch(/sessionStorage/);
    expect(appSrc).not.toMatch(/CHAT_KEY_STORAGE/);
    expect(appSrc).toMatch(/type="range"/);
    expect(appSrc).not.toMatch(/>\s*Lend\s*</);
    expect(appSrc).toContain("send $10 USDC to wallet 1");
    expect(appSrc).toContain("send $50 USDC to wallet 2");
    expect(appSrc).toContain("Send 10");
    expect(appSrc).toContain("Send 50");
    expect(appSrc).toContain("Sweep extra cash");
    expect(appSrc).not.toContain("Sweep extra cash (plan only)");
    expect(appSrc).toContain("LP stocks");
    expect(appSrc).not.toContain("LP stocks (plan only)");
    expect(appSrc).toContain("buy cbBTC");
    expect(appSrc).toContain("Buy cbBTC now");
    expect(landing).toContain("not the connected wallet");
    expect(landing).toContain("founder signs deposits");
    expect(landing).toContain("Pause stops outbound");
    expect(landing).toContain("Fee yield only");
    expect(landing).not.toMatch(/\u2014/);
    expect(appSrc).not.toMatch(/\u2014/);
  });
});

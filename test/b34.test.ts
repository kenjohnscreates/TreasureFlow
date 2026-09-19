import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BANKR_LLM_BASE_URL,
  DEFAULT_BANKR_LLM_MODEL,
  canonicalizeMapperLine,
  llmSystemPrompt,
  mapUnknownPrompt,
} from "../src/bankr/llm.ts";
import { app } from "../src/chat/http.ts";
import { handleChat } from "../src/chat/handle.ts";
import { loadConfig } from "../src/config/load.ts";

const dest = getAddress("0x1111111111111111111111111111111111111111");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const LLM_URL = `${BANKR_LLM_BASE_URL}/v1/chat/completions`;

const saved = {
  BANKR_API_KEY: process.env.BANKR_API_KEY,
  BANKR_LLM_MODEL: process.env.BANKR_LLM_MODEL,
  PAY_DEST_1: process.env.PAY_DEST_1,
  FLASH_API_KEY: process.env.FLASH_API_KEY,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function completionRes(line: string): Response {
  return jsonRes(200, { choices: [{ message: { content: line } }] });
}

type FetchInput = Parameters<typeof fetch>[0];

function fetchUrl(input: FetchInput): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

describe("B34 Bankr LLM mapper", () => {
  const llmCalls: { url: string; body: string }[] = [];

  beforeEach(() => {
    llmCalls.length = 0;
    process.env.FLASH_API_KEY = "";
    vi.stubGlobal("fetch", async (input: FetchInput, init?: RequestInit) => {
      const url = fetchUrl(input);
      if (url.startsWith(BANKR_LLM_BASE_URL)) {
        llmCalls.push({ url, body: typeof init?.body === "string" ? init.body : "" });
        return jsonRes(500, { error: "unset" });
      }
      return jsonRes(401, { error: "nope" });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreEnv();
  });

  it("source uses llm.bankr.bot chat completions, not Agent prompt jobs", () => {
    const llm = readFileSync(join(root, "src/bankr/llm.ts"), "utf8");
    const http = readFileSync(join(root, "src/chat/http.ts"), "utf8");
    expect(llm).toContain("llm.bankr.bot");
    expect(llm).toContain("/v1/chat/completions");
    expect(llm).toContain("X-API-Key");
    expect(llm).toContain(DEFAULT_BANKR_LLM_MODEL);
    expect(llm).not.toContain("api.bankr.bot");
    expect(llm).not.toContain("/agent/prompt");
    expect(http).not.toContain("/agent/prompt");
    expect(llmSystemPrompt()).not.toContain("\u2014");
    expect(canonicalizeMapperLine('"UNKNOWN"')).toBe("UNKNOWN");
  });

  it("NL cash question maps to balance", async () => {
    process.env.BANKR_API_KEY = "test-key";
    vi.stubGlobal("fetch", async (input: FetchInput, init?: RequestInit) => {
      const url = fetchUrl(input);
      if (url === LLM_URL) {
        llmCalls.push({ url, body: typeof init?.body === "string" ? init.body : "" });
        return completionRes("how much USDC in the treasury");
      }
      return jsonRes(401, { error: "nope" });
    });
    const res = await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "what's our cash sitting in the company account" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      kind: string;
      plan: { action?: string; sent?: boolean };
    };
    expect(body.kind).toBe("balance");
    expect(body.plan.action).toBe("balance");
    expect(body.plan.sent).not.toBe(true);
    expect(llmCalls.length).toBe(1);
    const payload = JSON.parse(llmCalls[0]?.body ?? "{}") as { model?: string };
    expect(payload.model).toBe(DEFAULT_BANKR_LLM_MODEL);
  });

  it("exact chip sweep does not call the gateway", async () => {
    process.env.BANKR_API_KEY = "test-key";
    const res = await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "sweep" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { kind: string; plan: { sent?: boolean } };
    expect(body.kind).toBe("sweep");
    expect(body.plan.sent).not.toBe(true);
    expect(llmCalls).toEqual([]);
  });

  it("402 maps to credits copy", async () => {
    process.env.BANKR_API_KEY = "test-key";
    vi.stubGlobal("fetch", async (input: FetchInput) => {
      const url = fetchUrl(input);
      if (url === LLM_URL) return jsonRes(402, { error: "credits" });
      return jsonRes(401, { error: "nope" });
    });
    const res = await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "blorp the widgets please" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      kind: string;
      summary: string;
      plan: { reason?: string; sent?: boolean };
    };
    expect(body.kind).toBe("unknown");
    expect(body.summary).toContain("bankr.bot/llm");
    expect(body.summary.toLowerCase()).toContain("credit");
    expect(body.plan.reason).toBe("llm_402");
    expect(body.plan.sent).not.toBe(true);
    expect(body.summary).not.toContain("test-key");
  });

  it("UNKNOWN stays unknown", async () => {
    process.env.BANKR_API_KEY = "test-key";
    vi.stubGlobal("fetch", async (input: FetchInput) => {
      const url = fetchUrl(input);
      if (url === LLM_URL) return completionRes("UNKNOWN");
      return jsonRes(401, { error: "nope" });
    });
    const res = await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "what is the buffer?" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      kind: string;
      summary: string;
      plan: { sent?: boolean };
    };
    expect(body.kind).toBe("unknown");
    expect(body.summary).toBe("No matching intent.");
    expect(body.plan.sent).not.toBe(true);
  });

  it("send 50 still per_call_cap", async () => {
    process.env.BANKR_API_KEY = "test-key";
    process.env.PAY_DEST_1 = dest;
    vi.stubGlobal("fetch", async (input: FetchInput) => {
      const url = fetchUrl(input);
      if (url === LLM_URL) return completionRes("send 50 USDC to PAY_DEST_1");
      return jsonRes(401, { error: "nope" });
    });
    const mapped = await mapUnknownPrompt(
      "please send fifty bucks to dest one",
      "test-key",
    );
    expect(mapped).toBe("send 50 USDC to PAY_DEST_1");
    const reply = handleChat(mapped, {
      ...loadConfig(),
      payDestinations: [dest],
    });
    expect(reply.kind).toBe("pay");
    expect(reply.plan.action).toBe("rejected");
    expect(reply.plan.code).toBe("per_call_cap");
    expect(reply.plan.sent).not.toBe(true);

    const res = await app.request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "please send fifty bucks to dest one" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      kind: string;
      plan: { action?: string; code?: string; sent?: boolean };
    };
    expect(body.kind).toBe("pay");
    expect(body.plan.code).toBe("per_call_cap");
    expect(body.plan.sent).not.toBe(true);
  });
});

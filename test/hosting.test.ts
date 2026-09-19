import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { LOCAL_AGENT_URL, resolveAgentUrl } from "../src/chat/agentUrl.ts";
import {
  allowCorsOrigin,
  chatKeyGate,
  chatSubmitAllowed,
  corsOriginHeader,
  vercelCorsOrigins,
} from "../src/chat/hosting.ts";
import { app } from "../src/chat/http.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("AGENT_URL prod empty vs local 8788", () => {
  it("uses 8788 in Vite dev when VITE_AGENT_URL is unset", () => {
    expect(resolveAgentUrl(false, undefined)).toBe(LOCAL_AGENT_URL);
    expect(LOCAL_AGENT_URL).toBe("http://127.0.0.1:8788");
  });

  it("keeps an explicit local override in dev", () => {
    expect(resolveAgentUrl(false, "http://127.0.0.1:8788")).toBe("http://127.0.0.1:8788");
  });

  it("does not bake 8788 into a production build", () => {
    expect(resolveAgentUrl(true, undefined)).toBe("");
    expect(resolveAgentUrl(true, "")).toBe("");
    expect(resolveAgentUrl(true, "http://127.0.0.1:8788")).toBe("");
  });
});

describe("CORS", () => {
  it("allows localhost 5173 and 5174", () => {
    expect(allowCorsOrigin("http://127.0.0.1:5174")).toBe(true);
    expect(allowCorsOrigin("http://localhost:5174")).toBe(true);
    expect(allowCorsOrigin("http://127.0.0.1:5173")).toBe(true);
    expect(allowCorsOrigin("http://localhost:5173")).toBe(true);
  });

  it("allows Vercel deployment and production hosts", () => {
    const env = {
      VERCEL_URL: "tf-abc.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "treasureflow.vercel.app",
    };
    expect(vercelCorsOrigins(env)).toEqual([
      "https://tf-abc.vercel.app",
      "https://treasureflow.vercel.app",
    ]);
    expect(allowCorsOrigin("https://tf-abc.vercel.app", env)).toBe(true);
    expect(allowCorsOrigin("https://treasureflow.vercel.app", env)).toBe(true);
  });

  it("never uses origin *", () => {
    expect(corsOriginHeader("https://evil.example")).toBe("");
    expect(corsOriginHeader("http://localhost:5174")).toBe("http://localhost:5174");
    expect(corsOriginHeader("*")).toBe("");
  });
});

describe("CHAT_KEY write gate", () => {
  const pay = { kind: "pay" as const, plan: { action: "pay" as const } };
  const unwind = {
    kind: "pay" as const,
    plan: { action: "unwind_and_pay" as const },
  };
  const sweep = { kind: "sweep" as const, plan: { action: "sweep" as const } };

  it("allows submit when CHAT_KEY is unset", () => {
    expect(chatSubmitAllowed(undefined, undefined)).toBe(true);
    expect(chatSubmitAllowed(undefined, "")).toBe(true);
    expect(chatKeyGate(pay, undefined, undefined)).toEqual({
      ok: true,
      submit: true,
    });
  });

  it("requires a timing-safe header match when CHAT_KEY is set", () => {
    expect(chatSubmitAllowed("secret", "secret")).toBe(true);
    expect(chatSubmitAllowed("wrong", "secret")).toBe(false);
    expect(chatSubmitAllowed(undefined, "secret")).toBe(false);
    expect(chatSubmitAllowed("secr", "secret")).toBe(false);
    expect(chatKeyGate(pay, "secret", "secret")).toEqual({
      ok: true,
      submit: true,
    });
    expect(chatKeyGate(unwind, undefined, "secret")).toMatchObject({
      ok: false,
      status: 401,
      error: "unauthorized",
    });
  });

  it("leaves reads and non-submit chat plans ungated", () => {
    expect(chatKeyGate(sweep, undefined, "secret")).toEqual({
      ok: true,
      submit: false,
    });
  });

  it("is not exposed as a VITE_ var", () => {
    const agent = readFileSync(join(root, "web/src/agent.ts"), "utf8");
    const appSrc = readFileSync(join(root, "web/src/App.tsx"), "utf8");
    const envEx = readFileSync(join(root, "web/.env.example"), "utf8");
    expect(agent).not.toMatch(/VITE_.*CHAT_KEY/);
    expect(appSrc).not.toMatch(/VITE_.*CHAT_KEY/);
    expect(envEx).not.toMatch(/CHAT_KEY/);
  });
});

describe("agent HTTP CORS", () => {
  afterEach(() => {
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  });

  it("echoes an allowlisted origin and never *", async () => {
    const res = await app.request("/health", {
      headers: { Origin: "http://localhost:5174" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5174");
    expect(res.headers.get("access-control-allow-origin")).not.toBe("*");
  });

  it("does not reflect a foreign origin", async () => {
    const res = await app.request("/health", {
      headers: { Origin: "https://evil.example" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).not.toBe("*");
    expect(res.headers.get("access-control-allow-origin")).not.toBe(
      "https://evil.example",
    );
  });

  it("allows https://VERCEL_URL at request time", async () => {
    process.env.VERCEL_URL = "preview-123.vercel.app";
    const res = await app.request("/health", {
      headers: { Origin: "https://preview-123.vercel.app" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "https://preview-123.vercel.app",
    );
  });

  it("preflights the write-key header", async () => {
    const res = await app.request("/chat", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:5174",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,x-treasureflow-key",
      },
    });
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    const allow = (res.headers.get("access-control-allow-headers") ?? "").toLowerCase();
    expect(allow).toContain("x-treasureflow-key");
  });

  it("leaves GET /status open when CHAT_KEY is set", async () => {
    const prev = process.env.CHAT_KEY;
    process.env.CHAT_KEY = "unit-test-key";
    try {
      const res = await app.request("/status");
      expect(res.status).toBe(200);
    } finally {
      if (prev === undefined) delete process.env.CHAT_KEY;
      else process.env.CHAT_KEY = prev;
    }
  });
});

describe("vercel.json services", () => {
  it("routes agent first then SPA catch-all, maxDuration 60", () => {
    const raw = readFileSync(join(root, "vercel.json"), "utf8");
    const cfg = JSON.parse(raw) as {
      framework?: string;
      installCommand?: string;
      buildCommand?: string;
      services: {
        web: { root: string; framework: string };
        agent: { entrypoint: string; framework: string };
      };
      rewrites: { source: string; destination: unknown }[];
    };
    expect(JSON.stringify(cfg)).toContain("services");
    expect(cfg.framework).toBeUndefined();
    expect(cfg.installCommand).toBeUndefined();
    expect(cfg.buildCommand).toBeUndefined();
    expect(cfg.services.web.root).toBe("web");
    expect(cfg.services.web.framework).toBe("vite");
    expect(cfg.services.agent.entrypoint).toBe("src/chat/http.ts");
    expect(cfg.services.agent.framework).toBe("hono");
    expect(JSON.stringify(cfg)).toContain("maxDuration");
    expect(JSON.stringify(cfg)).toContain("60");
    expect(JSON.stringify(cfg)).not.toContain("includeFiles");
    expect(JSON.stringify(cfg)).not.toContain("nodejs22.x");
    expect(JSON.stringify(cfg)).not.toContain("nextjs");
    const sources = cfg.rewrites.map((row) => row.source);
    expect(sources.slice(0, 5)).toEqual([
      "/health",
      "/status",
      "/treasury",
      "/flash-orders",
      "/chat",
    ]);
    expect(sources.at(-1)).toBe("/(.*)");
  });
});

describe("agent is API-only", () => {
  afterEach(() => {
    delete process.env.VERCEL;
  });

  it("returns 404 for GET /app locally and with VERCEL=1", async () => {
    delete process.env.VERCEL;
    const local = await app.request("/app");
    expect(local.status).toBe(404);

    process.env.VERCEL = "1";
    const vercel = await app.request("/app");
    expect(vercel.status).toBe(404);
  });
});

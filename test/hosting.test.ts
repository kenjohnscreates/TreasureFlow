import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
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
import { resolveWebAsset, serveWebDist } from "../src/chat/static.ts";

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

describe("vercel.json Hobby single project", () => {
  it("drops services, builds Vite, and bundles web/dist", () => {
    const raw = readFileSync(join(root, "vercel.json"), "utf8");
    const cfg = JSON.parse(raw) as {
      framework?: string;
      buildCommand?: string;
      services?: unknown;
      functions?: Record<string, { maxDuration?: number; includeFiles?: string }>;
    };
    expect(cfg.services).toBeUndefined();
    expect(cfg.framework).toBe("hono");
    expect(cfg.buildCommand).toBe("pnpm --dir web build");
    expect(JSON.stringify(cfg)).not.toContain('"services"');
    const bundled = Object.values(cfg.functions ?? {});
    expect(bundled.some((row) => row.includeFiles === "web/dist/**")).toBe(true);
    expect(bundled.some((row) => row.maxDuration === 60)).toBe(true);
    const entry = readFileSync(join(root, "src/app.ts"), "utf8");
    expect(entry).toContain("hono");
    expect(entry).toMatch(/chat\/http/);
    expect(entry).toContain("export default");
  });
});

describe("Vercel web/dist static + SPA fallback", () => {
  const dist = mkdtempSync(join(tmpdir(), "tf-web-dist-"));
  mkdirSync(join(dist, "assets"));
  writeFileSync(join(dist, "index.html"), "<!doctype html><title>tf</title>");
  writeFileSync(join(dist, "logo.svg"), "<svg></svg>");
  writeFileSync(join(dist, "assets", "app.js"), "console.log(1)");

  afterEach(() => {
    delete process.env.VERCEL;
  });

  it("maps / and hashed assets to files, /app to index.html", () => {
    expect(resolveWebAsset("/", dist)).toBe(join(dist, "index.html"));
    expect(resolveWebAsset("/app", dist)).toBe(join(dist, "index.html"));
    expect(resolveWebAsset("/app/", dist)).toBe(join(dist, "index.html"));
    expect(resolveWebAsset("/logo.svg", dist)).toBe(join(dist, "logo.svg"));
    expect(resolveWebAsset("/assets/app.js", dist)).toBe(join(dist, "assets", "app.js"));
    expect(resolveWebAsset("/missing.js", dist)).toBeNull();
    expect(resolveWebAsset("/../etc/passwd", dist)).toBeNull();
  });

  it("serves SPA html on VERCEL and stays API-only locally", async () => {
    delete process.env.VERCEL;
    const local = await app.request("/app");
    expect(local.status).toBe(404);

    process.env.VERCEL = "1";
    const probe = new Hono();
    probe.get("*", (c, next) => {
      if (!process.env.VERCEL) return next();
      return serveWebDist(c, dist);
    });
    const spa = await probe.request("/app");
    expect(spa.status).toBe(200);
    expect(spa.headers.get("content-type")).toContain("text/html");
    expect(await spa.text()).toContain("<title>tf</title>");
    const asset = await probe.request("/assets/app.js");
    expect(asset.status).toBe(200);
    expect(await asset.text()).toBe("console.log(1)");
  });

  it("keeps API routes ahead of the static catch-all", async () => {
    process.env.VERCEL = "1";
    const health = await app.request("/health");
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true });
  });
});

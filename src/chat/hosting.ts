import { timingSafeEqual } from "node:crypto";

export const LOCAL_CORS_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5174",
  "http://localhost:5174",
] as const;

function withHttps(host: string): string {
  if (host.startsWith("https://") || host.startsWith("http://")) return host;
  return `https://${host}`;
}

export function vercelCorsOrigins(env: NodeJS.Dict<string> = process.env): string[] {
  const raw = [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL];
  const out: string[] = [];
  for (const value of raw) {
    if (!value) continue;
    const origin = withHttps(value);
    if (!out.includes(origin)) out.push(origin);
  }
  return out;
}

export function allowCorsOrigin(
  origin: string,
  env: NodeJS.Dict<string> = process.env,
): boolean {
  if (!env.VERCEL && (LOCAL_CORS_ORIGINS as readonly string[]).includes(origin)) {
    return true;
  }
  return vercelCorsOrigins(env).includes(origin);
}

export function corsOriginHeader(
  origin: string,
  env: NodeJS.Dict<string> = process.env,
): string {
  if (!origin) return "";
  return allowCorsOrigin(origin, env) ? origin : "";
}

export function chatSubmitAllowed(
  provided: string | undefined,
  expected: string | undefined,
): boolean {
  if (!expected) return true;
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function wouldSubmitChat(reply: {
  kind: string;
  plan: { action?: unknown };
}): boolean {
  const action = reply.plan.action;
  if (reply.kind === "pay") return action === "pay" || action === "unwind_and_pay";
  if (reply.kind === "sweep") return action === "add_liquidity" || action === "noop";
  if (reply.kind === "lp_stocks") return action === "lp_stocks";
  if (reply.kind === "demo_flash") return action === "demo_flash" || action === "noop";
  return false;
}

export function wouldSubmitChatPay(reply: {
  kind: string;
  plan: { action?: unknown };
}): boolean {
  return wouldSubmitChat(reply);
}

export type ChatKeyGate =
  | { ok: true; submit: boolean }
  | { ok: false; status: 401; error: "unauthorized"; message: string };

export function chatKeyGate(
  reply: { kind: string; plan: { action?: unknown } },
  header: string | undefined,
  expected: string | undefined,
  env: NodeJS.Dict<string> = process.env,
): ChatKeyGate {
  if (!wouldSubmitChat(reply)) return { ok: true, submit: false };
  if (!header) return { ok: true, submit: false };
  if (env.VERCEL && !expected) {
    return {
      ok: false,
      status: 401,
      error: "unauthorized",
      message: "x-treasureflow-key required",
    };
  }
  if (chatSubmitAllowed(header, expected)) return { ok: true, submit: true };
  return {
    ok: false,
    status: 401,
    error: "unauthorized",
    message: "x-treasureflow-key required",
  };
}

export type WriteKeyGate =
  | { ok: true }
  | { ok: false; status: 401; error: "unauthorized"; message: string };

export function requireWriteKey(
  header: string | undefined,
  expected: string | undefined,
  env: NodeJS.Dict<string> = process.env,
): WriteKeyGate {
  if (env.VERCEL && !expected) {
    return {
      ok: false,
      status: 401,
      error: "unauthorized",
      message: "x-treasureflow-key required",
    };
  }
  if (chatSubmitAllowed(header, expected)) return { ok: true };
  return {
    ok: false,
    status: 401,
    error: "unauthorized",
    message: "x-treasureflow-key required",
  };
}

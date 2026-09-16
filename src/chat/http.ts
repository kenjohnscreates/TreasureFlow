import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { formatUnits } from "viem";
import { BASE, USDC_DECIMALS } from "../config/constants.ts";
import { loadConfig } from "../config/load.ts";
import { missingLater, missingNow } from "../config/status.ts";
import { AppError } from "../errors.ts";
import { handleChat } from "./handle.ts";

const ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173"];
const HOST = "127.0.0.1";
const PORT = 8787;

function publicStatus() {
  const config = loadConfig();
  return {
    policy: {
      bufferUsdc: formatUnits(config.policy.bufferUsdc, USDC_DECIMALS),
      perCallCapUsdc: formatUnits(config.policy.perCallCapUsdc, USDC_DECIMALS),
      dailyCapUsdc: formatUnits(config.policy.dailyCapUsdc, USDC_DECIMALS),
      hardStopUsdc: formatUnits(config.policy.hardStopUsdc, USDC_DECIMALS),
    },
    missingNow: missingNow(config),
    missingLater: missingLater(config),
    dryRun: config.dryRun,
    paused: config.paused,
    treasuryAddress: config.treasuryAddress,
    tokens: {
      usdc: BASE.usdc,
      usdt: BASE.usdt,
      nvdac: BASE.nvdac,
      aerodromeRouter: BASE.aerodromeRouter,
    },
  };
}

const app = new Hono();
app.use(
  "*",
  cors({
    origin: ORIGINS,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));
app.get("/status", (c) => c.json(publicStatus()));

app.post("/chat", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new AppError("bad_json", "JSON body required");
  }
  const prompt =
    typeof body === "object" &&
    body &&
    "prompt" in body &&
    typeof body.prompt === "string"
      ? body.prompt
      : "";
  if (!prompt.trim()) throw new AppError("usage", "prompt is required");
  return c.json(handleChat(prompt, loadConfig()));
});

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.code, message: err.message }, 400);
  }
  return c.json({ error: "internal", message: "request failed" }, 500);
});

export { app };

if (import.meta.url === `file://${process.argv[1]}`) {
  serve({ fetch: app.fetch, hostname: HOST, port: PORT });
  process.stdout.write(`agent http://${HOST}:${PORT}\n`);
}

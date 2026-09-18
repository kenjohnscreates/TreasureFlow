import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadConfig } from "../config/load.ts";
import { AppError } from "../errors.ts";
import { handleChat } from "./handle.ts";
import { chatLiveOpts, publicFlashOrders, publicTreasury } from "./reads.ts";
import { publicStatus } from "./status.ts";
import { maybeSubmitChatPay } from "./submitPay.ts";

const ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5174",
  "http://localhost:5174",
];
const HOST = "127.0.0.1";
export const DEFAULT_AGENT_PORT = 8788;
const PORT = Number(process.env.AGENT_PORT || String(DEFAULT_AGENT_PORT));

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
app.get("/status", (c) => c.json(publicStatus(loadConfig())));
app.get("/treasury", async (c) => c.json(await publicTreasury(loadConfig())));
app.get("/flash-orders", async (c) => c.json(await publicFlashOrders(loadConfig())));

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
  const config = loadConfig();
  const reply = handleChat(prompt, config, await chatLiveOpts(config, prompt));
  return c.json(await maybeSubmitChatPay(prompt, reply, config));
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

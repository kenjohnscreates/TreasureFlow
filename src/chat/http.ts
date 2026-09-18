import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadConfig } from "../config/load.ts";
import { AppError } from "../errors.ts";
import { CHAT_KEY_HEADER } from "./agentUrl.ts";
import { handleChat } from "./handle.ts";
import { chatKeyGate, corsOriginHeader } from "./hosting.ts";
import { chatLiveOpts, publicFlashOrders, publicTreasury } from "./reads.ts";
import { publicStatus } from "./status.ts";
import { maybeSubmitChatPay } from "./submitPay.ts";

const HOST = "127.0.0.1";
export const DEFAULT_AGENT_PORT = 8788;
const PORT = Number(process.env.AGENT_PORT || String(DEFAULT_AGENT_PORT));

const app = new Hono();
app.use(
  "*",
  cors({
    origin: (origin) => corsOriginHeader(origin),
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", CHAT_KEY_HEADER],
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
  const gate = chatKeyGate(reply, c.req.header(CHAT_KEY_HEADER), process.env.CHAT_KEY);
  if (!gate.ok) {
    return c.json({ error: gate.error, message: gate.message }, gate.status);
  }
  if (!gate.submit) return c.json(reply);
  return c.json(await maybeSubmitChatPay(prompt, reply, config));
});

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.code, message: err.message }, 400);
  }
  return c.json({ error: "internal", message: "request failed" }, 500);
});

export { app };
export default app;

if (!process.env.VERCEL && import.meta.url === `file://${process.argv[1]}`) {
  serve({ fetch: app.fetch, hostname: HOST, port: PORT });
  process.stdout.write(`agent http://${HOST}:${PORT}\n`);
}

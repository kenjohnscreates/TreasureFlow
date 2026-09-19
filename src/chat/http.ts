import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadConfig } from "../config/load.ts";
import { AppError } from "../errors.ts";
import {
  CHAT_KEY_HEADER,
  CHAT_NONCE_HEADER,
  CHAT_SIG_HEADER,
} from "./agentUrl.ts";
import { assertFounderSubmit, founderOk, issueChallenge } from "./founderAuth.ts";
import { handleChat } from "./handle.ts";
import { chatKeyGate, corsOriginHeader, requireWriteKey } from "./hosting.ts";
import { writePaused } from "./pause.ts";
import { chatLiveOpts, publicFlashOrders, publicTreasury } from "./reads.ts";
import { publicStatus } from "./status.ts";
import { maybeSubmitChat } from "./submit.ts";

const HOST = "127.0.0.1";
export const DEFAULT_AGENT_PORT = 8788;
const PORT = Number(process.env.AGENT_PORT || String(DEFAULT_AGENT_PORT));

const app = new Hono();
app.use(
  "*",
  cors({
    origin: (origin) => corsOriginHeader(origin),
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", CHAT_KEY_HEADER, CHAT_NONCE_HEADER, CHAT_SIG_HEADER],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));
app.get("/status", (c) => c.json(publicStatus(loadConfig())));
app.get("/treasury", async (c) => c.json(await publicTreasury(loadConfig())));
app.get("/flash-orders", async (c) => c.json(await publicFlashOrders(loadConfig())));

app.get("/auth/challenge", async (c) => c.json(await issueChallenge()));
app.get("/auth/founder-ok", (c) => {
  const config = loadConfig();
  const address = c.req.query("address");
  return c.json({ ok: founderOk(address, config.founderAddress) });
});

app.post("/pause", async (c) => {
  const gate = requireWriteKey(c.req.header(CHAT_KEY_HEADER), process.env.CHAT_KEY);
  if (!gate.ok) {
    return c.json({ error: gate.error, message: gate.message }, gate.status);
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new AppError("bad_json", "JSON body required");
  }
  const paused =
    typeof body === "object" && body && "paused" in body ? body.paused : undefined;
  if (typeof paused !== "boolean") {
    throw new AppError("bad_json", "paused boolean required");
  }
  await writePaused(paused);
  return c.json({ paused: loadConfig().paused });
});

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
  const liveOpts = await chatLiveOpts(config, prompt);
  const reply = handleChat(prompt, config, liveOpts);
  const gate = chatKeyGate(reply, c.req.header(CHAT_KEY_HEADER), process.env.CHAT_KEY);
  if (!gate.ok) {
    return c.json({ error: gate.error, message: gate.message }, gate.status);
  }
  if (!gate.submit) return c.json(reply);
  const founder = await assertFounderSubmit({
    founderAddress: config.founderAddress,
    nonceHeader: c.req.header(CHAT_NONCE_HEADER),
    sigHeader: c.req.header(CHAT_SIG_HEADER),
  });
  if (!founder.ok) {
    return c.json({ error: founder.error, message: founder.message }, founder.status);
  }
  return c.json(await maybeSubmitChat(prompt, reply, config, liveOpts));
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
  const { serve } = await import("@hono/node-server");
  serve({ fetch: app.fetch, hostname: HOST, port: PORT });
  process.stdout.write(`agent http://${HOST}:${PORT}\n`);
}

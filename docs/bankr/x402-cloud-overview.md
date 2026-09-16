# x402 Cloud

> **Deploy paid API endpoints in minutes. Bankr handles hosting, payments, and discovery.**

# x402 Cloud

**Deploy paid API endpoints in minutes. Bankr handles hosting, payments, and discovery.**

x402 Cloud lets you deploy serverless API endpoints that agents and developers pay for automatically using the [x402 payment protocol](https://x402.org). Write a simple handler function, set your price, deploy with one command — and start earning.

:::tip Dashboard
Manage your endpoints at [bankr.bot/x402](https://bankr.bot/x402) — view usage, revenue, logs, and configure settings.
:::

## Why x402 Cloud?

| Feature                          | Benefit                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Zero x402 knowledge required** | Write plain `Request → Response` handlers. We wrap the payment layer.                           |
| **Deploy in seconds**            | `bankr x402 deploy` bundles and ships your code instantly                                       |
| **Any token on Base**            | Accept USDC by default, or price in any ERC-20 — see [Custom Tokens](/x402-cloud/custom-tokens) |
| **Real-time logs**               | See every request, payment, and console output in the dashboard                                 |
| **Agent discovery**              | Your endpoints are automatically discoverable by AI agents                                      |
| **Secure secrets**               | Environment variables are encrypted at rest and isolated per-service                            |
| **Usage-based pricing**          | Set a max price, settle only the actual cost with the `upto` scheme                             |
| **Settle-after-response**        | Payments are only collected if your endpoint returns successfully                               |

## How It Works

```
Developer                          Agent / Client
    │                                    │
    │  bankr x402 deploy                 │  GET /weather?city=London
    │──────────────────►                 │─────────────────────────►
    │                                    │  ◄── 402 + PaymentRequirements
    │  Handler runs on                   │
    │  Bankr infrastructure              │  Signs payment, retries
    │                                    │─────────────────────────►
    │                                    │  ◄── 200 { temp: 72 }
    │                                    │
    │  Revenue appears                   │  Payment settled on-chain
    │  in dashboard                      │
```

1. You write a handler and deploy via CLI
2. An agent calls your endpoint — gets a 402 with pricing
3. The agent's wallet signs a payment and retries
4. Bankr verifies the payment, runs your handler, settles on-chain
5. You see the request, logs, and revenue in your dashboard

## Create Endpoints via Chat

You can create, deploy, and manage x402 endpoints entirely through the Bankr agent — no CLI or local setup needed. Describe what you want and Bankr writes the TypeScript handler, deploys it, and gives you the live URL.

```
create an x402 endpoint called "sentiment" that takes a stock ticker
and returns a sentiment score from recent news. charge $0.005 per request.
```

The agent handles the full lifecycle:

| Action            | Example prompt                                                        |
| ----------------- | --------------------------------------------------------------------- |
| **Create**        | "deploy an x402 endpoint called hello that returns a joke for $0.001" |
| **Update code**   | "update my sentiment endpoint to also return a confidence score"      |
| **Update config** | "change the price of my sentiment endpoint to $0.01"                  |
| **Pause/Resume**  | "pause the sentiment endpoint"                                        |
| **View logs**     | "show me the recent logs for my hello endpoint"                       |
| **Delete**        | "delete the hello endpoint"                                           |
| **List all**      | "list my x402 endpoints"                                              |
| **Inspect**       | "show details for my sentiment endpoint"                              |

Endpoints created through chat are identical to CLI-deployed ones — same runtime, same URL format (`https://x402.bankr.bot/<wallet>/<name>`), same billing. You can manage chat-created endpoints with the CLI and vice versa.

### Handler Context

Your handler receives a `ctx` object with optional capabilities you can enable at deploy time:

| Capability     | What it provides                                     | Use case                                     |
| -------------- | ---------------------------------------------------- | -------------------------------------------- |
| `ctx.files`    | Read/write persistent files scoped to `/x402/<name>` | CSV ledgers, JSON state, uploaded assets     |
| `ctx.appKV`    | Key-value store shared with your Bankr apps          | Drive app dashboards from endpoint data      |
| `ctx.askAgent` | Send a prompt to your Bankr agent                    | Trigger Telegram notifications after payment |

Each capability is opt-in — the agent declares what your handler needs when deploying and only those fields are populated at runtime.

### Environment Variables

Endpoints can read secrets via `process.env`. Declare the variable **names** at deploy time (values are never passed through chat). Set the actual values through Terminal Settings or the CLI. The agent's x402 env vars are stored in a separate encrypted scope from your regular agent env vars.

## Pricing

| Plan       | Platform Fee | Requests          |
| ---------- | ------------ | ----------------- |
| Free       | 0%           | Up to 1,000/month |
| Pro        | 5%           | Unlimited         |
| Enterprise | 3%           | Contact sales     |

No credit card required. Your first 1,000 requests each month are completely free. After that, a flat 5% platform fee applies. Payments are settled on-chain on Base in the endpoint's configured token (USDC by default). Your earnings go directly to your wallet address — no invoicing, no delayed payouts.

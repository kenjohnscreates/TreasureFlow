# Agent API Overview

> The Agent API allows you to interact with Bankr's AI agent to execute prompts and transactions on behalf of your wallet.

# Agent API Overview

The Agent API allows you to interact with Bankr's AI agent to execute prompts and transactions on behalf of your wallet.

## Capabilities

Using the Agent API, you can:

- Submit prompts to the Bankr AI agent for your wallet
- Check the status of submitted jobs
- Cancel pending or processing jobs
- Manage your agent profile

:::tip Wallet Operations
Non-agentic operations (balances, signing, submitting transactions) live under the [Wallet API](/wallet-api/overview).
:::

## Getting Started

1. **Sign up** at [bankr.bot/api-keys](https://bankr.bot/api-keys)
2. **Generate an API key** and enable Agent API access
3. **Subscribe to [Bankr Club](/faq/bankr-club)** or **[top up LLM credits](/llm-gateway/overview)** for Max Mode — one of these is required
4. **Fund your account** with the assets you want to trade
5. **Start making requests** using your API key

:::warning Security
Do not share your Bankr API key with anyone or any untrusted app. If you share your API key with agent access enabled, you risk losing all assets in that Bankr account.

If you leak your API key, visit [bankr.bot/api-keys](https://bankr.bot/api-keys) and revoke it immediately.
:::

## Example Applications

Check out example apps built on the Agent API:

[github.com/BankrBot/bankr-api-examples](https://github.com/BankrBot/bankr-api-examples)

## Base URL

```
https://api.bankr.bot
```

## Authentication

All endpoints require an API key with Agent API access enabled:

```
X-API-Key: your_api_key_here
```

## Basic Flow

### 1. Submit a Prompt

```bash
POST /agent/prompt
```

```json
{
  "prompt": "what is the price of ETH?"
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "jobId": "abc123",
  "threadId": "thr_XYZ789",
  "status": "pending",
  "message": "Job created successfully"
}
```

### 2. Poll for Results

```bash
GET /agent/job/{jobId}
```

**Response (200 OK):**
```json
{
  "success": true,
  "jobId": "abc123",
  "status": "completed",
  "prompt": "what is the price of ETH?",
  "response": "ETH is currently trading at $3,245.67",
  "createdAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:30:03Z",
  "processingTime": 3000
}
```

## Job Statuses

| Status | Description |
|--------|-------------|
| `pending` | Job is queued for processing |
| `processing` | Job is currently being processed |
| `completed` | Job finished successfully |
| `failed` | Job encountered an error |
| `cancelled` | Job was cancelled by user |

## Recommended Usage

When starting out with the Agent API:

1. **Create a new account** — Sign up for a new Bankr account via email
2. **Generate a fresh API key** — Enable agent access on the key
3. **Start with limited funds** — Only deposit what you're willing to test with
4. **Keep your key secure** — Never share it publicly or with untrusted apps
5. **Explore carefully** — Understand the API before increasing assets

## Next Steps

- [Authentication](/agent-api/authentication) — API key setup details
- [Prompt Endpoint](/agent-api/prompt-endpoint) — Natural language commands
- [Job Management](/agent-api/job-management) — Polling, cancellation, status
- [Wallet API](/wallet-api/overview) — Direct wallet operations (balances, sign, submit, transfer)
- [Bankr CLI](/cli) — Command-line interface (`@bankr/cli`)

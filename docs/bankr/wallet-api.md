# Wallet API Overview

> The Wallet API provides direct access to wallet operations without going through the AI agent. Use it for reading balances, signing transactions, and submitting them on-chain.

# Wallet API Overview

The Wallet API provides direct access to wallet operations without going through the AI agent. Use it for reading balances, signing transactions, and submitting them on-chain.

## Wallet API vs Agent API

|                | Wallet API (`/wallet/*`)                             | Agent API (`/agent/*`)                  |
| -------------- | ---------------------------------------------------- | --------------------------------------- |
| **Auth**       | Any API key for reads; Wallet & Agent API for writes | Requires Wallet & Agent API enabled     |
| **Operations** | Direct wallet ops (balances, sign, submit, transfer) | Natural language prompts → AI execution |
| **Latency**    | Fast (no LLM)                                        | Slower (LLM reasoning)                  |
| **Use when**   | You know exactly what to do                          | You want AI to decide                   |

## Base URL

```
https://api.bankr.bot
```

## Authentication

All endpoints accept either:

- **API Key**: `X-API-Key: your_api_key_here` (CLI, SDK, external)
- **Privy JWT**: Cookie-based auth (web frontend)

## Access Control

| Layer                                        | Read endpoints |    Write endpoints    |
| -------------------------------------------- | :------------: | :-------------------: |
| **API key valid + has wallet**               |    Required    |       Required        |
| **IP allowlist** (`allowedIps`)              |    Enforced    |       Enforced        |
| **Wallet API** (`walletApiEnabled`)          |  Not required  |       Required        |
| **Read-only mode** (`readOnly`)              |      N/A       |    Blocks with 403    |
| **Allowed recipients** (`allowedRecipients`) |      N/A       | Enforced per-endpoint |

These flags are configured per key — see [API Keys](/security/developer-api) for the full reference.

### Read endpoints (any API key)

`GET /wallet/me` and `GET /wallet/portfolio` work with any valid API key that has an associated wallet — no feature flags needed. IP allowlist is still enforced.

### Write endpoints (Wallet API required)

`POST /wallet/transfer`, `/wallet/swap`, `/wallet/sign`, `/wallet/submit` require **Wallet API** (`walletApiEnabled`) enabled on your key. Additionally:

- **Read-only keys** are rejected with 403
- **Allowed recipients** restrict which addresses can receive funds:
  - `/wallet/transfer` — validates the recipient against the EVM allowlist
  - `/wallet/swap` — swap output always returns to the caller's wallet; `allowedRecipients` is not enforced
  - `/wallet/sign` — blocks `eth_signTransaction` and `eth_signTypedData_v4` (can't verify recipients from calldata); allows `personal_sign`
  - `/wallet/submit` — blocks all raw submissions (can't verify recipients from calldata)

Enable Wallet & Agent API at [bankr.bot/api-keys](https://bankr.bot/api-keys).

## Endpoints

| Method | Endpoint             | Auth               | Description                               |
| ------ | -------------------- | ------------------ | ----------------------------------------- |
| GET    | `/wallet/me`         | Any API key        | Wallet info, socials, club status         |
| GET    | `/wallet/portfolio`  | Any API key        | Token balances, PnL, NFTs                 |
| POST   | `/wallet/swap-quote` | Wallet & Agent API | Quote a swap (EVM, Solana, cross-chain)   |
| POST   | `/wallet/swap`       | Wallet & Agent API | Execute a swap (EVM, Solana, cross-chain) |
| POST   | `/wallet/transfer`   | Wallet & Agent API | Direct ERC20/native transfer (EVM only)   |
| POST   | `/wallet/sign`       | Wallet & Agent API | Sign messages and transactions            |
| POST   | `/wallet/submit`     | Wallet & Agent API | Submit + broadcast transactions           |

## CLI

```bash
bankr wallet                          # Show wallet info (whoami)
bankr wallet portfolio                # Token balances
bankr wallet portfolio --pnl          # With profit/loss
bankr wallet portfolio --nfts         # With NFT holdings
bankr wallet portfolio --all          # Everything
bankr wallet sign -t personal_sign -m "hello"
bankr wallet submit tx --to 0x... --chain-id 8453
```

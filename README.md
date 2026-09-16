# TreasureFlow

Policy-governed USDC treasury agent for [Runtime NYC](https://runtime.nyc) (Sep 2026).

One company's own USDC on a Dynamic server wallet on Base. Nightly sweep of idle cash into an Aerodrome stable pool. Prompt-to-pay unwinds only the shortfall. Limits live in the wallet (allowlist, per-call cap) and the orchestrator (buffer, daily cap).

This is a hackathon build. Not a pooled product. Not a yield promise: screens show trailing fee yield only.

## Status

Offline core (config, caps, intent, dry-run plans) can run without vendor keys. Live wallet, Aerodrome, and Flash calls wait on `.env`.

## Setup

```bash
pnpm install
cp .env.example .env
# fill secrets locally, never commit .env
pnpm lint
pnpm test
```

Dry-run sweep and demo (no chain):

```bash
pnpm sweep -- --dry-run
pnpm demo -- --dry-run
```

## Policy defaults (demo scale, $100 treasury)

- Buffer: 15 USDC
- Per-call cap: 10 USDC (Dynamic `maxPerCall`)
- Daily cap: 30 USDC (orchestrator, rolling 24h)
- Live demo pay: 8 USDC; rejection: 50 USDC
- Hard stop: 15 USDC per mainnet tx until the recorded demo

## Tracks

Built for Dynamic (server wallet + prompt-to-pay) and Flash (limit ladder). Bankr stretch is narrated only: stock LP would sign from a Bankr wallet, which splits custody.

## Layout

See `BUILD-PLAN.md` and `PRD.md`.

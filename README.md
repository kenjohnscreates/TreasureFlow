# TreasureFlow

Policy-governed USDC treasury agent for [Runtime NYC](https://runtime.nyc) (Sep 2026).

Founder connects one external rewards wallet (manual signatures). Deposits USDC / NVDAc into a Dynamic server treasury. In-app chat plans nightly USDC/USDT sweep, explicit stock LP, allowlisted pay, and Flash limits. The agent never controls the external wallet.

This is a hackathon build. Not a pooled product. Not a yield promise: screens show trailing fee yield only.

Geo / VPN for tokenized stocks: [docs/geo.md](docs/geo.md).

## Status

Offline core (config, caps, intent, dry-run plans) can run without vendor keys. Live wallet, Aerodrome, and Flash calls wait on `.env`. M1 Dynamic server-wallet create still needs NEED NOW keys. Never commit `.env`.

## Setup

```bash
pnpm install
cp .env.example .env
# fill secrets locally, never commit .env
pnpm lint
pnpm test
```

Local agent + dApp (no chain):

```bash
pnpm agent
pnpm web
```

Agent binds `http://127.0.0.1:8787`. Web is Vite on `http://127.0.0.1:5173`. Copy `web/.env.example` to `web/.env` and fill `VITE_DYNAMIC_ENVIRONMENT_ID` when Connect should work. Empty ID disables Connect; chat still works.

Dry-run sweep and demo (no chain):

```bash
pnpm env:check
pnpm sweep -- --dry-run
pnpm pay -- "send 8 USDC to 0x000000000000000000000000000000000000dEaD"
pnpm demo
```

Fill `.env` (gitignored). Same keys are listed in `.env.example`.

## Policy defaults (demo scale, $100 treasury)

- Buffer: 15 USDC
- Per-call cap: 10 USDC (Dynamic `maxPerCall`)
- Daily cap: 30 USDC (orchestrator, rolling 24h)
- Live demo pay: 8 USDC; rejection: 50 USDC
- Hard stop: 15 USDC per mainnet tx until the recorded demo

## Tracks

Built for Dynamic (server wallet + prompt-to-pay) and Flash (limit ladder). Bankr stretch is narrated only: stock LP would sign from a Bankr wallet, which splits custody. This week stock LP is planned from the Dynamic treasury (unwired until M2b).

## Layout

See `BUILD-PLAN.md` and `PRD.md`.

# TreasureFlow

Policy-governed USDC treasury agent for [Runtime NYC](https://runtime.nyc) (Sep 2026).

Founder connects one external rewards wallet (manual signatures). Deposits USDC / NVDAc into a Bankr embedded treasury. In-app chat plans nightly USDC/USDT sweep, explicit stock LP, allowlisted pay, and Flash limits. The agent never controls the external wallet. Bankr signs treasury txs.

This is a hackathon build. Not a pooled product. Not a yield promise: screens show trailing fee yield only.

Geo / VPN for tokenized stocks: [docs/geo.md](docs/geo.md).

## Status

This git branch is the Bankr-treasury fallback (`backup/bankr-treasury`). The Dynamic tree is a different workspace. Offline core runs without vendor keys. B0 needs `BANKR_API_KEY`. Never commit `.env`.

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

Agent binds `http://127.0.0.1:8788`. Web is Vite on `http://127.0.0.1:5174`. Copy `web/.env.example` to `web/.env` and fill `VITE_DYNAMIC_ENVIRONMENT_ID` to Connect the **founder** wallet only. Empty ID disables Connect; chat still works. Connect does not create a Bankr or Dynamic server wallet.

Dry-run sweep and demo (no chain):

```bash
pnpm env:check
pnpm bankr:me
pnpm bankr:limits
pnpm sweep -- --dry-run
pnpm pay -- "send 8 USDC to 0x000000000000000000000000000000000000dEaD"
pnpm demo
```

Fill `.env` (gitignored). Same keys are listed in `.env.example`.

## Policy defaults (demo scale, $100 treasury)

- Buffer: 15 USDC
- Per-call cap: 10 USDC (orchestrator; Bankr `allowedRecipients` is the on-wallet allowlist)
- Daily cap: 30 USDC (orchestrator, rolling 24h)
- Live demo pay: 8 USDC; rejection: 50 USDC
- Hard stop: 15 USDC per mainnet tx until the recorded demo

## Tracks

Built for Bankr grand prize (working product + onchain equities) and Flash (limit ladder). Dynamic $2k track is out of scope on this branch.

## Layout

See `BUILD-PLAN.md` and `PRD.md`.

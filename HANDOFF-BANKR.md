# TreasureFlow Bankr orchestrator handoff

Date: 2026-09-17. Demo Sat Sep 19 ~4-5pm EDT.
Workspace: `/Users/home/Code/TreasureFlow-bankr` on `backup/bankr-treasury` @ `7f61390` (pushed).
Remote: `https://github.com/kenjohnscreates/TreasureFlow` branch `backup/bankr-treasury`.
You are the next master orchestrator (Grok 4.6 High). Kenny is the human.
Previous session: [Bankr B0-B4](457f44ff-fa89-4e1c-b10e-fa16634f1e34).

## Do this first

1. Read this file, `NOTES.md`, `reviews/B0.md` through `reviews/B4.md`, `PRD.md` only for product intent.
2. `git status` in this worktree. Do not discard uncommitted files.
3. Never print or commit `.env`. Never paste secrets. Truncate treasury `0x4c9D...a6c2`.
4. Do not `git checkout` / `reset` / `clean` in `/Users/home/Code/Runtime`. That tree is dirty Dynamic work on `main` @ `b299e66` and is a parallel product, not this branch.

## One-liner now

Founder deposits USDC / NVDAc into a **Bankr embedded treasury**. Chat plans sweep, stock LP, allowlisted pay, Flash limits. Live writes are CLI `--live` only. Agent never controls Kenny's external wallet. Lean Bankr; Dynamic cut is TBD (do not merge this branch to `main` until Kenny says).

## Hard stops (do not weaken)

- Hard stop **15 USDC per mainnet tx**. Caps: buffer 15, per-call 10, daily 30, pay 8, reject 50. Demo sweep cap 5.
- No Uniswap. No token launch. No live Morpho. No guessing. One milestone, one commit `B<n>: <one line>` on `backup/bankr-treasury` only. Push only when asked, one SHA at a time.
- Reviewer = a **different** Grok 4.6 High session. APPROVE in `reviews/B<n>.md` before commit.
- Never create Dynamic wallets. Never clear Runtime `.data/create-lock.json`. Never fund stranded Dynamic addresses `0xdf3066ebba9f29cb1e5766ceb5ce61da5b81f08d` / `0x435424b3a15d5de2d38c01d3f00e04f5d471f294`. Never set `TREASURY_ADDRESS` to those.
- `/wallet/submit` is blocked when `allowedRecipients` is set. Raw txs (LP, sweep) go through Agent API `POST /agent/prompt` + `GET /agent/job/{id}` with unmodified `to` / `data` / `value`. Pay uses `POST /wallet/transfer`.
- Chat `POST /chat` must not submit pay, LP, or sweep. Copy says not sent from chat.
- Do not become a thin wrapper of `POST /agent/prompt`. Auth `X-API-Key`. Never log keys.
- First-party copy: fee yield only, no em dashes.

## What is shipped (live)

| Step | Commit | Live |
|---|---|---|
| B0 | `9a10630` | `GET /wallet/me` treasury `0x4c9D...a6c2`, Club true |
| B1 | `1be1ca5` | Unsigned deposit to Bankr treasury. Connect is founder-only |
| B2 | `2945f9e` | 8 USDC pay `0x725611366d7ea9790ab7852740d7403c234f2c22057eb4ef9a573d9ccfb312fe` to `PAY_DEST_1` (`0xD428...6d2A`) |
| B3 | `70535be` | Slipstream NVDAc mint `0x6875cfaa3a6eaca7e2da7802846367f9c836b255707b45f560536a7a9174f131` NFT `#6356494` staked. Stake `0x19dd797353ba41145bc56a201291684864eedbcc4ff1bf3b16591c4f8e0770bf` |
| B4 | `7f61390` | sAMM add `0xba78ae950e062fd2daeffc53d92f160a0544ce1aa50e24b920f02f7c31655e99` (4.382025 USDC + 5 USDT) |

Tests 51. `pnpm bankr:me`, `pnpm bankr:pay -- --live`, `pnpm bankr:lp -- --live`, `pnpm bankr:sweep -- --live`.

## Last known treasury snapshot (after B4)

- ETH ~0.0096 (above 0.0015 gas preflight)
- USDC ~16.59 (buffer 15)
- USDT ~0.50
- NVDAc ~0.068 plus staked NFT `#6356494`
- Daily spend (approx, `.data/spend.json` gitignored): 8 pay + ~5.09 LP USDC + 4.38 sweep. Under 30.

## Next

**B5 Flash** if `FLASH_API_KEY` is set: dry ladder already exists; live cbBTC limits under hard stop 15, reserve from surplus above buffer. Chat `limits` stays dry. If the key is empty, skip and prepare the Sat demo (deposit chip, send 8 / send 50 reject, LP NVDA pointer, Sweep pointer, BaseScan hashes).

Do not merge `backup/bankr-treasury` into `main` or delete the Runtime Dynamic tree until Kenny cuts Dynamic.

## Local run

Bankr agent `AGENT_PORT=8788 pnpm agent`. Web `VITE_AGENT_URL=http://127.0.0.1:8788 pnpm exec vite --host 127.0.0.1 --port 5174 --strictPort`. Leave Runtime `5173` / `8787` alone.

## Out of scope

Uniswap $1k track, token launch, live Morpho, agent control of the external wallet, pushing this branch to `main` without Kenny.

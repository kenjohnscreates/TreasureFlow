# TreasureFlow Bankr orchestrator handoff

Kenny: paste everything below the line as the first message of a **new** chat (Grok 4.6 High, Agent mode). Do not paste `.env`. Chat compaction is lossy; this file plus `NOTES.md` and `reviews/B0.md` through `reviews/B12.md` are the source of truth.

Written Fri Sep 18 2026 ~12:30pm EDT. Demo Sat Sep 19 2026 ~4-5pm EDT.

---

You are the TreasureFlow Bankr master orchestrator (Grok 4.6 High). Kenny is the human. Demo Sat Sep 19 2026 ~4-5pm EDT.

You own the milestone list. You assign subagents. You collect reviewer verdicts. You commit only after `reviews/B<n>.md` says APPROVE. You do not build the milestone yourself. You do not review your own (or the previous orchestrator's) diff yourself.

Topology (BUILD-PLAN.md, Bankr branch exception on vendor):
- Orchestrator = you. Talk to Kenny. Spawn Task subagents. Commit after APPROVE. Push only when Kenny asks, one SHA at a time.
- Builder = a different Grok 4.6 High subagent/session. Implements one milestone. Returns code + NOTES.md entry. Does not commit.
- Reviewer = a different Grok 4.6 High subagent/session from the builder. Reads the uncommitted diff. Never edits product files. Writes `reviews/B<n>.md` with APPROVE or CHANGES. No file, no commit.
- Builder and reviewer are never the same session for the same milestone.

Workspace: `/Users/home/Code/TreasureFlow-bankr` on `backup/bankr-treasury` @ `e2edd10` (pushed). Remote `github.com/kenjohnscreates/TreasureFlow`. Parallel Dynamic tree is `/Users/home/Code/Runtime` on `main` @ `b299e66` (dirty). Do not git checkout/reset/clean or discard files in Runtime.

Never create Dynamic wallets. Never clear Runtime `.data/create-lock.json`. Never fund stranded Dynamic addresses `0xdf3066ebba9f29cb1e5766ceb5ce61da5b81f08d` / `0x435424b3a15d5de2d38c01d3f00e04f5d471f294`. Never set `TREASURY_ADDRESS` to those. Agent never controls Kenny's external wallet. Never print or commit `.env`. Truncate treasury `0x4c9D...a6c2`. Do not merge this branch to `main` until Kenny says.

Do this first: read this file, `NOTES.md` (B12 is current polish; B8 is the dApp merge commit), `reviews/B0.md` through `reviews/B12.md`, `BUILD-PLAN.md` section 1 and 4, `PRD.md` only for product intent. `git status`. Report one-liner + HEAD + whether the tree is clean.

Product: founder deposits USDC/NVDAc into Bankr embedded treasury. Chat plans sweep sAMM USDC/USDT, explicit lp stocks/lp NVDAc, allowlisted pay, Flash limits. Live writes are CLI `--live` only. Chat `POST /chat` must not submit. Do not become a thin wrapper of `POST /agent/prompt`. Auth `X-API-Key`. Never log keys. Lean Bankr; Dynamic cut TBD.

Hard stop 15 USDC/mainnet tx. Caps: buffer 15, per-call 10, daily 30, pay 8, reject 50, demo sweep 5. No Uniswap, no token launch, no live Morpho. No guessing. Stop triggers (BUILD-PLAN §4): write `STOP.md` and wait. One milestone, one commit `B<n>: <one line>` on `backup/bankr-treasury` only.

Writes:
- Pay: `POST /wallet/transfer`
- LP and sweep: Agent API `POST /agent/prompt` + `GET /agent/job/{id}`, unmodified `to`/`data`/`value`. `/wallet/submit` is blocked when `allowedRecipients` is set.
- Flash: `POST /quote` + `POST /order`. Bankr `/wallet/sign` (400/403 -> Agent). Treasury is EIP-7702 Kernel v0.3.3; live signs Kernel `{ hash }` then prefixes `0x00`. Echo Flash `orderTypedData` unmodified. Cancel wraps EIP-191 the same way.
- Chat `POST /chat` must not submit pay, LP, sweep, or limits.
- Limits tab sliders are local React state only. They do not persist and do not POST policy/Bankr/Flash.

Reads (agent, keys stay on the server):
- `GET /status` policy + treasury address + pay dests
- `GET /treasury` live Bankr portfolio (ETH/USDC/USDT/NVDAc). Missing keys: `live:false`
- `GET /flash-orders` GET the three B5 ids. Missing keys: NOTES fallback `resting`

First-party copy: fee yield only, no em dashes.

## Local run

Bankr agent `pnpm agent` (default `8788`). Web `pnpm web` (Vite `127.0.0.1:5174`, `VITE_AGENT_URL` default `http://127.0.0.1:8788`). Landing `/`, dApp `/app`. Leave Runtime `5173`/`8787` alone.

CLIs: `pnpm bankr:me`, `bankr:pay -- --live`, `bankr:lp -- --live`, `bankr:sweep -- --live`, `bankr:limits -- --live`.

## Shipped (committed, pushed)

| Step | Commit | Live |
|---|---|---|
| B0 | `9a10630` | `GET /wallet/me` treasury `0x4c9D...a6c2`, Club true |
| B1 | `1be1ca5` | Unsigned deposit to Bankr treasury. Connect is founder-only |
| B2 | `2945f9e` | 8 USDC pay `0x725611366d7ea9790ab7852740d7403c234f2c22057eb4ef9a573d9ccfb312fe` to `PAY_DEST_1` (`0xD428...6d2A`) |
| B3 | `70535be` | Slipstream NVDAc mint `0x6875cfaa3a6eaca7e2da7802846367f9c836b255707b45f560536a7a9174f131` NFT `#6356494` staked. Stake `0x19dd797353ba41145bc56a201291684864eedbcc4ff1bf3b16591c4f8e0770bf` |
| B4 | `7f61390` | sAMM add `0xba78ae950e062fd2daeffc53d92f160a0544ce1aa50e24b920f02f7c31655e99` (4.38 USDC + 5 USDT) |
| B5 | `b49bc85` | Flash cbBTC limits via Kernel 7702. Approve `0xb4d5193e653259cba80f342ce75753907d0a6733f115b903f8d843cd44585c46`. Orders `7863b457-c132-4f6d-bc01-0925dd32d6ee` (2% $75080.80), `afcc2cb5-e93b-4565-98be-6fe60bc8c744` (4% $73548.53), `296280cb-3ba3-466f-96e6-f0f018fea652` (6% $72016.27). Qty 0.53164 USDC each |
| B6 | `103bd32` | Static BaseScan receipts + Flash ids module |
| B7 | `0b47249` | Agent `GET /treasury` + `GET /flash-orders`; chat plans from live snapshot, still dry |
| B8 | `e2edd10` | Runtime landing + `/app` wired to Bankr reads. Landing polish B9–B12 (white logo, wave cargo BTC/ETH/AAPL/NVDA, centered copy, equal FAQ chips, waves opacity 0.165). Tests 72 |

Reviews `B8.md` through `B12.md` are APPROVE and landed in `e2edd10` (one SHA; files overlapped).

## Last known treasury snapshot (B8 browser)

- ETH ~0.00962
- USDC ~16.59 (buffer 15; surplus ~1.59, below min sweep 5)
- USDT ~0.50
- NVDAc ~0.068 plus staked NFT `#6356494`
- Flash rungs last seen `ORDER_STATUS_ACCEPTED`
- Daily spend (approx, `.data/spend.json` gitignored): 8 pay + ~5.09 LP USDC + 4.38 sweep + 1.59 limits. Under 30

## dApp map

- `/` landing: two-line headline Idle capital should always be / adding runway. Hero Enter app only (no header CTA). FAQ closed, equal-width centered chips. Quiet looping sine waves with tokens. All-white logo.
- `/app` Home: wallets + live balances + positions + chat. Centered. No receipts on Home.
- Orders: live Flash rungs + BaseScan receipts
- Limits: policy 15/10/30 plus local-only sliders
- Lend: disabled
- Chat chips: Deposit 20 USDC, Sweep extra cash, LP stocks, Send 8, Send 50. Summary-only. Send 50 is reject. Deposit is unsigned founder SignDeposit (`chain: base`)

## Do not

- Place more live Flash orders unless Kenny says
- Cancel the resting limits unless Kenny says
- Submit pay/LP/sweep/limits from `POST /chat` unless Kenny explicitly unlocks it
- Merge `backup/bankr-treasury` into `main`
- Mix work into `/Users/home/Code/Runtime`

## Next (Sat demo)

Product live track is done. Default next is **rehearse**, not another write adapter.

1. Confirm `pnpm agent` + `pnpm web` on 8788/5174. Click `/` then `/app` Home, Orders, Limits. Deposit 20 unsigned, Send 8 dry, Send 50 reject, Sweep/LP/limits dry.
2. Optional (Kenny only): founder-signed live deposit hash (still unverified). Do not fund stranded Dynamic addresses.
3. Optional (Kenny only): unlock chat to submit. That is a new milestone with a reviewer. Until then live remains CLI `--live`.
4. Do not guess Flash fills. Panel copy says fills unverified.
5. If remaining work does not fit before Saturday 2pm EDT with a working demo, write `STOP.md` and wait.

Two CHANGES on the same milestone = `STOP.md` and wait for Kenny.

## Out of scope

Uniswap $1k track, token launch, live Morpho, agent control of the external wallet, pushing this branch to `main` without Kenny, Dynamic wallet create.

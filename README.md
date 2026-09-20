# TreasureFlow

A company's idle cash sits in a Bankr treasury on Base. The agent can sweep extra USDC into Aerodrome USDC/USDT LP for fee yield, add size to an existing NVDAc Slipstream NFT, pay allowlisted wallets, rest buy-the-dip Flash limits for cbBTC, and place a small market buy of cbBTC from free USDC.

The founder deposits. The agent never spends the founder's personal wallet.

Runtime NYC hackathon demo (Sep 2026). Not a pooled product. Screens show trailing fee yield only. No APY promise.

**Live app:** [treasureflow.vercel.app](https://treasureflow.vercel.app/) (landing) and [treasureflow.vercel.app/app](https://treasureflow.vercel.app/app) (dApp). Production tracks GitHub `main`. Host is Vercel Hobby, two services: Vite `web/` plus Hono agent `src/chat/http.ts`.

**Need access, a live write walkthrough, or help?** Message **Kenny** on GitHub ([@kenjohnscreates](https://github.com/kenjohnscreates)). Do not ask anyone else for keys. Keys are not in this repo.

Geo / VPN for tokenized stocks: [docs/geo.md](docs/geo.md).

## For hackathon judges

Start here: **[treasureflow.vercel.app](https://treasureflow.vercel.app/)**. Click **Enter app**.

The hosted site is **read-mostly on purpose**. You can inspect the live company treasury. You cannot spend it.

### You can

- Open the landing and the dApp with no wallet
- Read live total USD, cash, held assets, sAMM USDC/USDT, and Slipstream NFT `#6356494`
- Open **Limits & Orders** (Flash table + BaseScan receipts) and **Approved wallets**
- Drag the policy sliders (local UI only; they do not save and do not change live caps)
- Click chat chips or type a prompt and get a **plan** (`sent: false`)
- Click **Send $50** and see the per-call cap reject (no Bankr call)
- Connect any injected wallet via RainbowKit (Connect does not create a Bankr or Dynamic server wallet)

### You cannot (by design)

- Confirm a live pay, sweep, LP, or Flash order
- Pause / Resume outbound
- Sign a deposit (Sign deposit is founder-address only)
- See API keys, the write key, private keys, or full allowlist addresses
- Use **Lend & Borrow** (greyed out, not in this demo)

Live treasury writes need the **Write key** (`CHAT_KEY` on the server, header `x-treasureflow-key`). It is not published. If you need a confirmed onchain click during judging, message Kenny.

Proof already on Base is in [Proof on Base](#proof-on-base-mainnet) below. Those hashes are public BaseScan links.

## Click path in the dApp

1. **Home.** Cyan **Company treasury** card is live **total USD** (`0x4c9D...a6c2`). Positions are the table, not a second line on the card. Chat chips are under the composer, in demo order.
2. **Limits & Orders.** Sliders show 15 / 10 / 30. Flash table is B5 cbBTC limits. Receipts are static BaseScan rows.
3. **Approved wallets.** Wallet 1 (`0xD428...6d2A`) and Wallet 2 (`0x4D43...432f`). The agent can only pay those dests.
4. **Lend & Borrow.** Disabled.

`live:false` paints `--`. It never falls back to the old 55/40 demo snapshot.

## Chat chips (demo order)

| Chip | What it does | On Vercel without the Write key |
| --- | --- | --- |
| Deposit 20 USDC | Unsigned ERC-20 to the treasury. Founder signs in MetaMask. Agent does not broadcast. | Plan + Sign deposit only if you are the founder |
| Send $10 | Pay 10 USDC to Wallet 1 (at the per-call cap) | Plan. Confirm is blocked |
| Send $50 | Pay 50 USDC to Wallet 2 | **Rejected.** Per-call cap is 10 USDC |
| Buy the dip $1 | Flash **limit** buy of cbBTC, 0.001% below Chainlink spot, spend `min(free USDC, 1)` | Plan. Confirm is blocked |
| LP stocks $10 | `increaseLiquidity` on Slipstream NFT `#6356494` (mint only if no live NVDAc NFT) | Plan. Confirm is blocked |
| Sweep extra cash | Add surplus USDC (above the 15 buffer, min 5) to sAMM USDC/USDT | Plan. Confirm is blocked |
| Buy $1 cbBTC now | Flash **market** buy, 5% max slippage, spend `min(free USDC, 1)` | Plan. Confirm is blocked |

Typed `limits` stays dry (does not place or cancel the B5 rungs).

Chip and typed prompts parse first. Unknown NL goes through Bankr LLM Gateway (`llm.bankr.bot`, default `gemini-3-flash`) as a **text mapper only**. The mapper cannot set `sent: true`. It rewrites to one canonical line, then the same parser and caps run.

## How the build is put together

```
web/                  landing + dApp (RainbowKit, chat UI)
src/chat/             Hono agent: intent, Confirm gate, GET /treasury
src/bankr/            Bankr Wallet API + aero-stock-lp live path
src/aerodrome/        sAMM quoteRemoveLiquidity + Slipstream reads
src/flash/            Flash Network cbBTC (B5 limits, dip limit, market)
src/oracle/           Chainlink Base ETH/USD + Coinbase NVDA
src/demo/evidence.ts  BaseScan receipts + B5 order ids shown in the app
src/policy/           buffer, per-call, daily, hard stop
vendor/aero-stock-lp  vendored Bankr skill (plan / size / settle)
test/                 Vitest
docs/                 fetched vendor docs (not live product truth)
```

**Wallets**

- **Founder / External Wallet.** Kenny's personal wallet. Connect via RainbowKit. The agent does not control it. Deposits are unsigned ERC-20 the founder broadcasts.
- **Company treasury.** Bankr embedded wallet `0x4c9D...a6c2`. The agent can spend this, under the caps, to allowlisted dests only. Bankr signs treasury txs. Server auth is `X-API-Key` (never in `VITE_*`, never logged, never committed).

**Hosted writes**

- Confirm (pay, sweep, LP stocks, dip / market Flash) needs header `x-treasureflow-key` from the dApp **Write key** field (in-memory only). The connected External Wallet is not asked to `personal_sign` for those writes.
- That secret is `CHAT_KEY` on the server. Do not put it in `VITE_*`. Never commit it.
- **Sign deposit** is the only chip that opens MetaMask: unsigned ERC-20, gated on `GET /auth/founder-ok` for `FOUNDER_ADDRESS`.
- Pause / Resume uses the same Write key.

**Reads (keys stay on the server)**

- `GET /status`: policy, truncated treasury, founder display, pause
- `GET /treasury`: live Bankr portfolio + USD legs + LP quotes
- `GET /flash-orders`: B5 ids plus any later demo Flash id

Total USD sums legs that succeed: free USDC + free USDT (1:1), ETH * Chainlink Base ETH/USD, loose NVDAc * Chainlink Coinbase NVDA, sAMM quoted USDC+USDT, Slipstream principal USD. Failed legs are omitted, not invented.

`increaseLiquidity` on `#6356494` adds real LP NAV and pool fees. Extra size may not count toward gauge AERO until a later unstake/restake. That restake is not in this demo.

## Caps

Demo scale (~$50-100 treasury):

- Buffer: 15 USDC (never swept)
- Per-call cap: 10 USDC
- Daily cap: 30 USDC
- Hard stop: 15 USDC per mainnet tx
- Sweep min: 5 USDC surplus
- Reject demo: 50 USDC
- LP notional: 10 USDC
- Dip / market Flash: `min(free USDC, 1)` if free >= 0.10, else noop

Sliders on Limits & Orders are local React only (0-100). They do not save. They do not POST. Live policy is the numbers above.

Hosted spend log and pause file live under `/tmp` (ephemeral across serverless invocations). Daily cap is best-effort on Vercel.

## Proof on Base (mainnet)

Every hash is a BaseScan link. **Flash fills are unverified.** Chat Confirm (Write key) for dip / market Flash / Slipstream increase has not been broadcast from this repo (plans exist; Write key Confirm is how live writes happen).

| What | Proof |
| --- | --- |
| Pay 8 USDC to Wallet 1 (`0xD428...6d2A`) | [0x725611366d7ea9790ab7852740d7403c234f2c22057eb4ef9a573d9ccfb312fe](https://basescan.org/tx/0x725611366d7ea9790ab7852740d7403c234f2c22057eb4ef9a573d9ccfb312fe) |
| Slipstream NVDAc mint NFT `#6356494` | [0x6875cfaa3a6eaca7e2da7802846367f9c836b255707b45f560536a7a9174f131](https://basescan.org/tx/0x6875cfaa3a6eaca7e2da7802846367f9c836b255707b45f560536a7a9174f131) |
| Stake that NFT | [0x19dd797353ba41145bc56a201291684864eedbcc4ff1bf3b16591c4f8e0770bf](https://basescan.org/tx/0x19dd797353ba41145bc56a201291684864eedbcc4ff1bf3b16591c4f8e0770bf) |
| sAMM add (4.38 USDC + 5 USDT) | [0xba78ae950e062fd2daeffc53d92f160a0544ce1aa50e24b920f02f7c31655e99](https://basescan.org/tx/0xba78ae950e062fd2daeffc53d92f160a0544ce1aa50e24b920f02f7c31655e99) |
| Flash USDC approve | [0xb4d5193e653259cba80f342ce75753907d0a6733f115b903f8d843cd44585c46](https://basescan.org/tx/0xb4d5193e653259cba80f342ce75753907d0a6733f115b903f8d843cd44585c46) |
| Chat pay 8 USDC | [0x8a06a1b827f278f3a21d7eafd760b154f547e7613473aa52b7a2ca76ff1975cb](https://basescan.org/tx/0x8a06a1b827f278f3a21d7eafd760b154f547e7613473aa52b7a2ca76ff1975cb) |
| Unwind: approve LP | [0xb1f755bf5e0c6c304743975849f72d7e36e950af44d87b5031cf2df211f500e8](https://basescan.org/tx/0xb1f755bf5e0c6c304743975849f72d7e36e950af44d87b5031cf2df211f500e8) |
| Unwind: `removeLiquidity` | [0x85fe9aae46d2a9979d2950915565b410a64910f852c61131efc19d63b454c566](https://basescan.org/tx/0x85fe9aae46d2a9979d2950915565b410a64910f852c61131efc19d63b454c566) |
| Transfer 10 USDC | [0xe77dabe8c8f1dd9b895ecd378c49f3d9ee287b7ea71c10dc33d0b07997d0672b](https://basescan.org/tx/0xe77dabe8c8f1dd9b895ecd378c49f3d9ee287b7ea71c10dc33d0b07997d0672b) |

First five rows were CLI `--live`. Chat pay / unwind were live `POST /chat` after Confirm. Same gates still sit in front of sweep, LP increase, and Flash from chat.

### Flash cbBTC (resting B5 limits)

B5 rungs are **limit $/cbBTC**, not USDC size. Each rung spends **$0.53 USDC**. They fill only if spot dumps to that limit. Status last seen **ACCEPTED**. **Fills unverified.** Do not cancel or replace these ids.

| Rung | Order id | Limit $/cbBTC | USDC spend |
| --- | --- | --- | --- |
| 2% | `7863b457-c132-4f6d-bc01-0925dd32d6ee` | ~$75080.80 | $0.53 USDC |
| 4% | `afcc2cb5-e93b-4565-98be-6fe60bc8c744` | ~$73548.53 | $0.53 USDC |
| 6% | `296280cb-3ba3-466f-96e6-f0f018fea652` | ~$72016.27 | $0.53 USDC |

**Buy the dip $1** is a new Flash **limit** (0.001% below spot). **Buy $1 cbBTC now** is a Flash **market** buy. Neither cancels the B5 rungs. Copy: does not promise a fill.

## How to run locally

Message Kenny first if you need secrets. Never commit `.env`. Never paste keys into GitHub issues or chat logs.

```bash
pnpm install
cp .env.example .env
# fill secrets locally. Never commit .env.
pnpm agent   # http://127.0.0.1:8788
pnpm web     # http://127.0.0.1:5174
```

Landing is `/`. dApp is `/app`. Do not use Runtime ports 5173/8787.

Connect the **founder** wallet via RainbowKit. Chat still works without Connect. Connect does not create a Bankr or Dynamic server wallet.

Dry checks (no secrets required for `pnpm test`):

```bash
pnpm test
pnpm typecheck
```

CLI live writes exist (same Bankr/Flash paths as chat Confirm). Do not run `--live` unless Kenny asked:

```bash
pnpm env:check
pnpm bankr:me
pnpm bankr:pay -- --live
pnpm bankr:lp -- --live
pnpm bankr:sweep -- --live
pnpm bankr:limits -- --live
```

## Honest not-yet

- Flash fills are unverified. B5 rungs rest until spot hits the limit.
- Dip / market Flash and Slipstream increase from chat have not been Confirmed on the live treasury from this repo.
- Free USDC is often thin, so Send $10 / sweep / $10 LP need a founder deposit first.
- Extra LP size on `#6356494` may not earn extra gauge AERO until a later restake.
- Policy sliders do not persist.
- Lend is off.
- Nightly cron is not the hosted path.
- Spend / pause files do not survive every Vercel invocation.

## Docs map

| File | What it is |
| --- | --- |
| [README.md](README.md) | **Start here.** Live product + judge notes |
| [HANDOFF-BANKR.md](HANDOFF-BANKR.md) | Short builder note for this Bankr branch |
| [docs/geo.md](docs/geo.md) | VPN / B20 stock geo |
| [NOTES.md](NOTES.md) | Build log (B1...). Not the product spec |
| [reviews/](reviews/) | Per-milestone reviewer files |
| [HANDOFF.md](HANDOFF.md) | Historical Dynamic-tree handoff. Not live |
| [PUNCH-LIST.md](PUNCH-LIST.md) | Historical Dynamic-era checklist. Not live |
| [PRD.md](PRD.md) / [BUILD-PLAN.md](BUILD-PLAN.md) | Original process docs. Do not treat as live UI |
| [docs/](docs/) | Fetched vendor pages. Implementation in `src/` wins |

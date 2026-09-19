# TreasureFlow

A company's idle cash sits in a Bankr treasury on Base. The agent can sweep extra USDC into Aerodrome USDC/USDT LP for fee yield, LP NVDAc on Slipstream when asked, pay allowlisted people, rest buy-the-dip Flash limits for cbBTC, and place a small market buy of cbBTC from free USDC.

The founder deposits. The agent never spends the founder's personal wallet.

This is a Runtime NYC hackathon demo (Sep 2026). Not a pooled product. Screens show trailing fee yield only. No APY promise.

**Live app:** [treasureflow.vercel.app](https://treasureflow.vercel.app/) (landing) and [treasureflow.vercel.app/app](https://treasureflow.vercel.app/app) (dApp). Host is Vercel Hobby two-service (Vite `web/` + Hono agent `src/chat/http.ts`). Git SHA `0933378` (B40).

Geo / VPN for tokenized stocks: [docs/geo.md](docs/geo.md).

## What you see in the app

**Landing (`/`)**

Short pitch. Enter the dApp.

**dApp (`/app`)**

- **Company treasury card:** tag, TreasureFlow, truncated Bankr addr (`0x4c9D...a6c2`), live **total USD**. Positions live in the table below, not as a second line on the card.
- **External Wallet / Company:** founder Connect via RainbowKit (EIP-6963 injected wallets). Optional WalletConnect QR if `VITE_WALLETCONNECT_PROJECT_ID` is set. Connect does not create a Bankr or Dynamic server wallet.
- **Home:** Active positions + chat.
- **Limits & Orders:** local policy sliders, Flash table, BaseScan receipts.
- **Lend:** removed.

Active positions (when live): Cash USDC, Held USDT, Held NVDAc, Held ETH, LP USDC/USDT sAMM (quoted pair), LP NVDAc Slipstream (NFT `#6356494` staked). `live:false` shows `--`, never the old 55/40 demo snapshot.

Total USD sums legs that succeed: free USDC + free USDT (1:1), ETH * Chainlink Base ETH/USD, loose NVDAc * Chainlink Coinbase NVDA, sAMM quoted USDC+USDT, Slipstream principal USD. Failed legs are omitted, not invented.

Chat chips: Deposit 20 USDC, Sweep extra cash, LP stocks, Buy cbBTC now, Send 8.

Reads (keys stay on the server):

- `GET /status`: policy, truncated treasury, founder display, pause
- `GET /treasury`: live Bankr portfolio + USD legs + LP quotes
- `GET /flash-orders`: B5 ids plus any demo market id (NOTES "resting" if keys are missing)

## What the agent can spend

**Founder wallet (Connect)**

- Founder-only. The agent does not control it.
- Deposits are unsigned ERC-20 (`deposit 20 USDC`, `deposit $5 usdc`). The founder signs and broadcasts. The agent does not broadcast deposits.

**Bankr treasury (`0x4c9D...a6c2`, Club true)**

- The agent can spend this wallet, under the caps below.
- Pays go only to allowlisted dests (`PAY_DEST_1` / `PAY_DEST_2`).
- Bankr signs treasury txs. Server auth is `X-API-Key`. Keys are never logged.

**Hosted chat writes**

- Confirm needs header `x-treasureflow-key` (the dApp **Write key** field) plus founder `personal_sign` of `GET /auth/challenge`.
- That secret is `CHAT_KEY` on the server. Do not put `CHAT_KEY` in `VITE_*`. Never commit it.
- Pause / Resume is the same write key. Pause stops outbound.

### Chat: live vs plan

Chip and typed prompts parse first. Unknown NL goes through Bankr LLM Gateway (`llm.bankr.bot`, default `gemini-3-flash`) as a **text mapper only**. The mapper cannot set `sent: true`. It rewrites to one canonical line, then the same parser and gates run.

**Live from `POST /chat` after Confirm (write key + founder sig)**

- Allowlisted pay (B13)
- Unwind-then-pay (B14): pull USDC from sAMM LP, then transfer
- Sweep extra cash into USDC/USDT LP (B33)
- LP stocks / LP NVDAc (B33)
- Market buy cbBTC from free USDC (B38)

Without the write key, those return a plan (`sent: false`). Cancel on the confirm modal does not POST a second time.

**Always unsigned (founder signs)**

- Deposit USDC / NVDAc to the treasury, including optional `$` before the amount

**Rejected**

- Send 50: per-call cap is 10. Does not call Bankr.

Cash USDC is often below the 15 buffer. Sweep noops if surplus is under the 5 USDC min. Send 8 needs free USDC (or LP to unwind). Buy cbBTC now sizes to `min(free USDC, 1)` only if free is at least 0.10 USDC; otherwise it noops and does not invent funds.

## Proof on Base (mainnet)

Every hash is a BaseScan link. **Flash fills are unverified.** The B38 market buy was not placed from this repo (Confirm cancelled).

| Step | What | Proof |
| --- | --- | --- |
| B2 | Pay 8 USDC to `PAY_DEST_1` (`0xD428...6d2A`) | [0x725611366d7ea9790ab7852740d7403c234f2c22057eb4ef9a573d9ccfb312fe](https://basescan.org/tx/0x725611366d7ea9790ab7852740d7403c234f2c22057eb4ef9a573d9ccfb312fe) |
| B3 | Slipstream NVDAc mint NFT `#6356494` | [0x6875cfaa3a6eaca7e2da7802846367f9c836b255707b45f560536a7a9174f131](https://basescan.org/tx/0x6875cfaa3a6eaca7e2da7802846367f9c836b255707b45f560536a7a9174f131) |
| B3 | Stake that NFT | [0x19dd797353ba41145bc56a201291684864eedbcc4ff1bf3b16591c4f8e0770bf](https://basescan.org/tx/0x19dd797353ba41145bc56a201291684864eedbcc4ff1bf3b16591c4f8e0770bf) |
| B4 | sAMM add (4.38 USDC + 5 USDT) | [0xba78ae950e062fd2daeffc53d92f160a0544ce1aa50e24b920f02f7c31655e99](https://basescan.org/tx/0xba78ae950e062fd2daeffc53d92f160a0544ce1aa50e24b920f02f7c31655e99) |
| B5 | Flash USDC approve | [0xb4d5193e653259cba80f342ce75753907d0a6733f115b903f8d843cd44585c46](https://basescan.org/tx/0xb4d5193e653259cba80f342ce75753907d0a6733f115b903f8d843cd44585c46) |
| B13 | Chat Send 8 | [0x8a06a1b827f278f3a21d7eafd760b154f547e7613473aa52b7a2ca76ff1975cb](https://basescan.org/tx/0x8a06a1b827f278f3a21d7eafd760b154f547e7613473aa52b7a2ca76ff1975cb) |
| B14 | Unwind: approve LP | [0xb1f755bf5e0c6c304743975849f72d7e36e950af44d87b5031cf2df211f500e8](https://basescan.org/tx/0xb1f755bf5e0c6c304743975849f72d7e36e950af44d87b5031cf2df211f500e8) |
| B14 | Unwind: `removeLiquidity` | [0x85fe9aae46d2a9979d2950915565b410a64910f852c61131efc19d63b454c566](https://basescan.org/tx/0x85fe9aae46d2a9979d2950915565b410a64910f852c61131efc19d63b454c566) |
| B14 | Transfer 10 USDC | [0xe77dabe8c8f1dd9b895ecd378c49f3d9ee287b7ea71c10dc33d0b07997d0672b](https://basescan.org/tx/0xe77dabe8c8f1dd9b895ecd378c49f3d9ee287b7ea71c10dc33d0b07997d0672b) |

B2 through B5 were CLI `--live`. B13 and B14 were live `POST /chat`. Sweep / LP / market Flash can also submit from chat after Confirm.

### Flash cbBTC (B5 limits + B38 market)

B5 rungs are **limit $/cbBTC**, not USDC size. Each rung spends **$0.53 USDC**. They fill only if spot dumps to that limit. Status last seen **ACCEPTED**. **Fills unverified.** Do not cancel or replace these ids.

| Rung | Order id | Limit $/cbBTC | USDC spend |
| --- | --- | --- | --- |
| 2% | `7863b457-c132-4f6d-bc01-0925dd32d6ee` | ~$75080.80 | $0.53 USDC |
| 4% | `afcc2cb5-e93b-4565-98be-6fe60bc8c744` | ~$73548.53 | $0.53 USDC |
| 6% | `296280cb-3ba3-466f-96e6-f0f018fea652` | ~$72016.27 | $0.53 USDC |

**Buy cbBTC now** is a Flash **market** buy (`orderType: market`, 5% max slippage). Spend is `min(free USDC, 1)` when free is at least 0.10 USDC. It does not cancel the B5 rungs. Copy: this is a market order. Does not promise a fill.

## Limits / safety

Demo scale (~$50-100 treasury):

- Buffer: 15 USDC (leave this in cash)
- Per-call cap: 10 USDC
- Daily cap: 30 USDC
- Demo pay: 8 USDC
- Reject: 50 USDC
- Hard stop: 15 USDC per mainnet tx
- Demo sweep: 5 USDC min

Sliders on Limits & Orders are local React only (0-100). They do not save. They do not POST. Live policy is the numbers above.

Hosted spend log and pause file live under `/tmp` (ephemeral across serverless invocations). Daily cap is best-effort on Vercel.

## How to run locally

```bash
pnpm install
cp .env.example .env
# fill secrets locally. Never commit .env.
pnpm agent   # http://127.0.0.1:8788
pnpm web     # http://127.0.0.1:5174
```

Landing is `/`. dApp is `/app`. Do not use Runtime ports 5173/8787.

Connect the **founder** wallet via RainbowKit. Chat still works without Connect. Connect does not create a Bankr or Dynamic server wallet.

Dry checks:

```bash
pnpm env:check
pnpm test
pnpm bankr:me
```

CLI live writes still exist (same Bankr/Flash paths as chat Confirm):

```bash
pnpm bankr:pay -- --live
pnpm bankr:lp -- --live
pnpm bankr:sweep -- --live
pnpm bankr:limits -- --live
```

Hosted URLs are at the top of this file.

## Honest not-yet

- Flash fills are unverified. B5 rungs rest until spot hits the limit.
- Buy cbBTC now has not been Confirmed on the live treasury from this repo.
- Free USDC is often ~0.24, so Send 8 and sweep need a founder deposit first.
- Policy sliders do not persist.
- Lend is off.
- Nightly cron is not the hosted path.
- Spend / pause files do not survive every Vercel invocation.

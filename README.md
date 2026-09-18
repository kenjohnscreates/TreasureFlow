# TreasureFlow

A company's idle USDC sits in a Bankr treasury. The agent can sweep extra cash into Aerodrome USDC/USDT LP for fee yield, LP NVDAc on Slipstream when asked, pay allowlisted people, and rest buy-the-dip Flash limits for cbBTC.

The founder deposits. The agent never spends the founder's personal wallet.

This is a Runtime NYC hackathon demo (Sep 2026). Not a pooled product. Screens show trailing fee yield only. No APY promise.

**Live app:** [treasureflow.vercel.app](https://treasureflow.vercel.app/) (landing) and [treasureflow.vercel.app/app](https://treasureflow.vercel.app/app) (dApp).

Geo / VPN for tokenized stocks: [docs/geo.md](docs/geo.md).

## What you see in the app

**Landing (`/`)**

Short pitch. Enter the dApp.

**dApp (`/app`)**

- **Home:** founder Connect, Bankr treasury (`0x4c9D...a6c2`), live balances, positions, chat.
- **Orders:** three Flash cbBTC limit rungs plus BaseScan receipts.
- **Limits:** policy chips (buffer 15, per-call 10, daily 30). Sliders are local React only. They do not save. They do not POST.
- **Lend:** disabled.

Chat chips: Deposit 20 USDC, Sweep extra cash, LP stocks, Send 8, Send 50.

Reads (keys stay on the server):

- `GET /status`: policy, truncated treasury, pay dests
- `GET /treasury`: live Bankr portfolio
- `GET /flash-orders`: the three B5 ids (NOTES "resting" if keys are missing)

## What the agent can spend

**Founder wallet (Connect)**

- Founder-only. The agent does not control it.
- Deposits are unsigned ERC-20. The founder signs. The agent does not broadcast deposits.

**Bankr treasury (`0x4c9D...a6c2`, Club true)**

- The agent can spend this wallet, under the caps below.
- Pays go only to allowlisted dests (`PAY_DEST_1` / `PAY_DEST_2`).
- Bankr signs treasury txs. Server auth is `X-API-Key`. Keys are never logged.

**Hosted chat writes**

- Live pay needs header `x-treasureflow-key` (the dApp **Write key** field).
- That secret is `CHAT_KEY` on the server. Do not put `CHAT_KEY` in `VITE_*`. Never commit it.

### Chat: live vs dry

**Live from `POST /chat`**

- Allowlisted pay (B13)
- Unwind-then-pay (B14): pull USDC from sAMM LP, then transfer

**Dry from chat (not submitted)**

- Sweep extra cash into USDC/USDT LP
- LP stocks / LP NVDAc
- New Flash orders

Those three have live hashes from CLI `--live`, not from chat.

**Rejected**

- Send 50: per-call cap is 10. Does not call Bankr.

## Proof on Base (mainnet)

Every hash is a BaseScan link. **Flash fills are unverified.**

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

B2 through B5 were CLI `--live`. B13 and B14 were live `POST /chat`.

### Flash cbBTC limits (B5)

Qty **0.53164 USDC** each. Status last seen **ACCEPTED**. **Fills unverified.**

| Rung | Order id | Limit |
| --- | --- | --- |
| 2% | `7863b457-c132-4f6d-bc01-0925dd32d6ee` | ~$75080.80 |
| 4% | `afcc2cb5-e93b-4565-98be-6fe60bc8c744` | ~$73548.53 |
| 6% | `296280cb-3ba3-466f-96e6-f0f018fea652` | ~$72016.27 |

## Limits / safety

Demo scale (~$100 treasury):

- Buffer: 15 USDC (leave this in cash)
- Per-call cap: 10 USDC
- Daily cap: 30 USDC
- Demo pay: 8 USDC
- Reject: 50 USDC
- Hard stop: 15 USDC per mainnet tx
- Demo sweep: 5 USDC min

## How to run locally

```bash
pnpm install
cp .env.example .env
# fill secrets locally. Never commit .env.
pnpm agent   # http://127.0.0.1:8788
pnpm web     # http://127.0.0.1:5174
```

Landing is `/`. dApp is `/app`.

Copy `web/.env.example` to `web/.env` and fill `VITE_DYNAMIC_ENVIRONMENT_ID` to Connect the **founder** wallet only. Empty ID disables Connect. Chat still works. Connect does not create a Bankr or Dynamic server wallet.

Dry checks:

```bash
pnpm env:check
pnpm test
pnpm bankr:me
```

Live writes (CLI, not chat, for sweep / LP / new Flash):

```bash
pnpm bankr:pay -- --live
pnpm bankr:lp -- --live
pnpm bankr:sweep -- --live
pnpm bankr:limits -- --live
```

Hosted URLs are at the top of this file.

## Honest not-yet

- Chat does not submit sweep, LP, or new Flash orders. Use CLI `--live` for those.
- Production `treasureflow.vercel.app` last checked as SHA `12bec50` (B15 host). This git SHA is `23716fa` (B16 Hobby-safe Hono). Vercel git deploys of `23716fa` failed TypeScript. The live site is not B16.
- USDC in the treasury may be 0 until the founder deposits.
- Flash fills are unverified.
- Lend is off.

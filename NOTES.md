# NOTES

Running build notes. One entry per task.

## M0 scaffold

- Product name: TreasureFlow. GitHub repo name TreasureFlow. Runtime NYC hackathon.
- pnpm TypeScript, ESLint, Prettier, Vitest. Empty product surface until offline core.
- Docs fetched from BUILD-PLAN.md section 5 plus runbook gaps listed in the kickoff plan.
- Assumptions: Base mainnet for live paths; Sepolia for policy rejection only. No vendor keys at scaffold time.
- Not verified: Dynamic policy layers on the hackathon account; live Aerodrome pool depth; Flash DCA as a native order type (API index has no DCA page).

## Offline core (no vendor APIs)

- Config, buffer/daily-cap math, prompt parser, sweep/pay plans, Flash limit ladder sizing.
- Live adapters throw `*_unwired` until `.env` has Dynamic + RPC + Flash keys.
- Demo runner and sweep CLI operate in dry-run against a $55 USDC / $40 USDT snapshot.
- Tests cover cap math, intent parse, sweep/pay plans, and ladder rungs.

## Offline CLI (parallel with .env fill)

- `.env` created locally (gitignored). `pnpm env:check` prints NEED NOW vs later.
- Pay CLI, cron gate at 02:00 America/New_York, unsigned Aerodrome calldata, Flash quote types.
- No live HTTP unless FLASH_API_KEY is set.

## M1b local agent + dApp (no Dynamic wallet create)

- `docs/geo.md`: B20 US-person block, OFAC excludes, VPN UK/NL. Coinbase has no public country matrix. Bankr: sanctioned ranges / bad VPN egress. Aerodrome contracts are not geo; agent encodes from treasury.
- Intents: deposit USDC/NVDAc (unsigned ERC-20 to TREASURY_ADDRESS), sweep, lp stocks (unwired), pay, limits. NVDAc 8 decimals from Bankr aero-stock-lp skill. Treasury address empty until M1.
- Local Hono agent `pnpm agent` on 127.0.0.1:8787. Vite React `pnpm web`. External wallet connect only. Agent does not sign or broadcast deposits.
- Assumed: NVDAc `0xb200…8108C`, 8 decimals. TREASURY_ADDRESS later/empty. Slipstream NPM not in repo so lp stocks does not encode mint.
- Not verified: no live Dynamic, no mainnet, no VPN check in this milestone.

## B0 Bankr read (backup/bankr-treasury)

- Isolated worktree. GET-only `src/bankr/` client: `GET /wallet/me` and `GET /wallet/portfolio?chains=base&showLowValueTokens=true`. Auth `X-API-Key`. No POST. Vendor errors are status-only (no body dumps, no key in logs).
- `pnpm bankr:me` printed treasury `0x4c9D...a6c2`, `clubActive: true`, persisted `TREASURY_ADDRESS` in worktree `.env` only. Full address is not in git. Bankr payload had no wallet id; `BANKR_WALLET_ID` left unset (not invented).
- Portfolio (Base): ETH ~0.025, USDC ~21.01, USDT 0, NVDAc 0, `tokenCount` 1. Writes still blocked until Kenny confirms this wallet is the treasury.
- Refuses stranded Dynamic addresses (`0xdf3066...` / `0x435424...`) before persist. Dynamic keys are unused on this branch; `BANKR_API_KEY` is NEED NOW.
- Tests 33. typecheck/lint pass. Assumed: the `chain: "evm"` wallet is the Base treasury. Not verified: Wallet API transfer, Agent API, `allowedRecipients`, Slipstream.

## B1 deposit path

- Status `signer: bankr`. dApp shows Bankr treasury (full address in the wallets panel; logs stay truncated `0x4c9D...a6c2`). Connect is Dynamic JS for the founder wallet only; it does not create a server wallet.
- Chat `deposit N USDC` / `deposit N NVDAc` returns unsigned ERC-20 `transfer`. `unsignedTx.to` is the token (USDC / NVDAc). Calldata recipient is the Bankr treasury. Agent does not broadcast. Stranded Dynamic treasuries are refused.
- Browser: wallets panel + `deposit 8 USDC` / `deposit 1 NVDAc` against local agent. Lend still disabled. No injected wallet in the automation browser, so Sign deposit stayed on Connect.
- Tests 37. typecheck/lint pass. Not verified: a founder-signed live deposit hash.

## B2 prompt-to-pay live

- Orchestrator allowlist is `PAY_DEST_1` / `PAY_DEST_2` only (typed dest is not the allowlist). Per-call 10, hard stop 15, daily 30. Chat `send 50 USDC` returns `rejected` / `per_call_cap` and does not call Bankr.
- Live: `pnpm bankr:pay -- --live` sent 8 USDC via `POST /wallet/transfer` to `PAY_DEST_1` (`0xD428...6d2A`). Hash `0x725611366d7ea9790ab7852740d7403c234f2c22057eb4ef9a573d9ccfb312fe`. Spend log `.data/spend.json` (gitignored). Chat does not broadcast pays.
- dApp chips: Deposit 8 USDC, Send 8 (dry-run plan), Send 50 (reject). Browser confirmed the reject copy.
- Tests 43. Assumed: Bankr `amount` is a human decimal string. Not verified: Bankr `allowedRecipients` on the key (transfer succeeded, so dest was allowed or the list is empty).

## B3 Slipstream NVDAc

- Vendored `aero-stock-lp` at BankrBot/skills `8a007c297a17598dfe17d5917ddd3bd2b42a2a6a`. Scripts emit unsigned txs. `pnpm bankr:lp` runs plan/size/settle. Live is `--live` only. Chat `lp stocks` / `lp NVDAc` points at the CLI and does not POST `/agent/prompt`.
- Equity NPM is `0xe1f8...8b53` (not the AERO NPM). Gates used Yahoo NVDA 219.335 (age 0s) and OptiView 30d ATM IV 0.311 (2026-09-16 15:55 ET). `--usd 10`. No swap: loose NVDAc covered the stock leg. Mint notional $10 under hard stop 15. USDC in mint ~5.09 (daily cap after B2 pay still under 30).
- Wallet `/wallet/submit` is skipped (blocked when `allowedRecipients` is set). Each skill tx went through Agent API `submit_raw_transaction` via `POST /agent/prompt` + `GET /agent/job/{id}`, unmodified `to`/`data`/`value`.
- Live: mint `0x6875cfaa3a6eaca7e2da7802846367f9c836b255707b45f560536a7a9174f131`. NFT `#6356494`, route staked. Stake `0x19dd797353ba41145bc56a201291684864eedbcc4ff1bf3b16591c4f8e0770bf`. Approves: USDC `0x4970...6da1`, NVDAc `0xd376...5c00`, NFT `0x1d18...9e3e`.
- Tests 48. typecheck/lint pass. Assumed: Agent job text contains the 0x hash. Not verified: B4 USDT sweep (USDT still 0).

## B4 sAMM USDC/USDT sweep

- `pnpm bankr:sweep` reads live Bankr portfolio, `planSweep` + `sizeLiveSweep` (demo cap 5, hard stop 15, min 5). Chat `sweep` stays a dry-run plan and does not submit. Live is `--live` only via Agent API raw submit, not `/wallet/submit`.
- Pool `0x9650...07C1` (factory `0x420D...40Da`) quoted 4.382025 USDC + 5 USDT for a 5/5 desired add. Buffer 15 left unswept. Daily cap after B2+B3 still under 30.
- Live addLiquidity `0xba78ae950e062fd2daeffc53d92f160a0544ce1aa50e24b920f02f7c31655e99`. Approves: USDC `0x78e09ad57ff494834f0b2feb138cfbd5050a642ad44d76464363a17bfc4102cc`, USDT `0xb57a42514f57d9c43b7af1dfd09e9e1b4c146c7874c0616d064b5512bc5e1695`.
- Tests 51. typecheck/lint pass. Assumed: Router `quoteAddLiquidity` 6-arg (includes factory). Not verified: B5 Flash.

## B5 Flash cbBTC limits

- `pnpm bankr:limits` sizes reserve from surplus above buffer 15, capped by hard stop 15, per-call 10, and remaining daily 30. Chat `limits` stays a dry ladder (`Chat does not submit. Live is pnpm bankr:limits.`). Live is `--live` only. No `/wallet/submit`.
- Chainlink Base cbBTC/USD `0x07DA...9f9D` (8 decimals, heartbeat 1200s). Spot ~76613. Surplus 1.59492 USDC split into three rungs (2/4/6% below). Flash `POST /quote` then `POST /order`. Chat does not call Flash.
- Bankr treasury is EIP-7702 Kernel v0.3.3. `/wallet/sign` EIP-712 is a 65-byte ECDSA that Flash 1271 rejects. Live path signs Kernel `{ hash }` then prefixes `0x00`. Echo Flash `orderTypedData` unmodified. Cancel uses the same wrap over `personal_sign` / EIP-191. USDC approve via Agent API raw submit (not `/wallet/submit`).
- Live approve USDC `0xb4d5193e653259cba80f342ce75753907d0a6733f115b903f8d843cd44585c46`. Orders ACCEPTED: `7863b457-c132-4f6d-bc01-0925dd32d6ee` (2%, $75080.80), `afcc2cb5-e93b-4565-98be-6fe60bc8c744` (4%, $73548.53), `296280cb-3ba3-466f-96e6-f0f018fea652` (6%, $72016.27). Qty 0.53164 USDC each. Spend log +1.59492. Daily still under 30.
- Tests 62. typecheck/lint pass. Assumed: Bankr `/wallet/sign` is the Kernel owner ECDSA. Not verified: fill of the resting limits; orders WebSocket.

## B6 Sat demo prep

- dApp Live panel + Flash ladder from first-party `src/demo/evidence.ts` (static NOTES receipts, no live Flash/Bankr fetch). BaseScan `https://basescan.org/tx/<hash>` for pay `0x72561136...12fe`, Slipstream mint `0x6875cfaa...f131` (NFT #6356494; stake `0x19dd7973...70bf`), sAMM add `0xba78ae95...5e99` (4.38 USDC + 5 USDT), Flash USDC approve `0xb4d5193e...5c46`. Resting Flash ids `7863b457-...d6ee` (2% $75080.80), `afcc2cb5-...c744` (4% $73548.53), `296280cb-...a652` (6% $72016.27), qty 0.53164 USDC each. Copy: buys more on dips, no performance claim. Spot ~76613 Chainlink Base cbBTC/USD.
- Chat chips unchanged (Deposit 8 USDC, Send 8, Send 50, LP NVDA, Sweep, Limits). Send 50 uses `.reject-hint` on the chip; result still uses `.rejected`. All chips dry POST `/chat`. Copy: chat does not submit. Lend stays disabled. Caps unchanged.
- Assumed: local agent on 8788 / web 5174 for Sat demo; treasury still `0x4c9D...a6c2`. Not verified: Flash fills; live order status (static NOTES is demo truth).
- Browser on `127.0.0.1:5174` against agent `8788`: clicked Deposit 8 USDC (unsigned, no broadcast), Send 8 (dry `sent: false`), Send 50 (`.rejected` / `per_call_cap`), LP NVDA (CLI pointer), Sweep (dry addLiquidity not sent), Limits (dry ladder, chat does not submit). Live hrefs are `basescan.org/tx/<full hash>`. Resting order ids rendered. Lend disabled. None of those chats submitted.
- Tests 64. typecheck/lint/web tsc pass.

## B7 live Bankr/Flash reads

- Agent GET `/treasury` (Bankr `getWalletPortfolio` + `parsePortfolio`) and GET `/flash-orders` (Flash `getOrder` + `parseFlashOrderStatus` for the three B5 ids). Keys stay on the agent. `/status` stays sync config. Missing `BANKR_API_KEY` / `FLASH_API_KEY` / treasury: `live:false`, balances omitted, Flash falls back to NOTES "resting". Chat still works on `DEMO_SNAPSHOT`.
- POST `/chat` is async: live snapshot for sweep/pay, `loadSpend` for daily cap on pay, `sizeLiveLimits` + Chainlink spot for limits when oracle works. Dummy 110k / 9 ladder if oracle/RPC fails. Still `sent:false`. Copy: chat does not submit. No `/wallet/submit`, no POST `/order`, no cancel.
- dApp Idle cash from `/treasury`. Flash ladder shows live status, BaseScan receipts stay static (B6). Policy chips unchanged. Lend disabled. Connect is founder-only Dynamic JS.
- Ports: agent default `8788`, Vite `5174`, `VITE_AGENT_URL` `http://127.0.0.1:8788`. README matches. Runtime 5173/8787 untouched.
- Live read (truncated treasury `0x4c9D...a6c2`): ETH ~0.00962, USDC 16.59492, USDT 0.50372, NVDAc 0.06803417, tokenCount 3. Flash GET `ORDER_STATUS_ACCEPTED` on all three rungs (qty 0.53164 USDC). Logs truncate treasury; no API keys logged.
- Browser `127.0.0.1:5174` vs agent `8788`: Idle cash rendered those balances. Flash ladder live statuses. Clicked Deposit 8 (unsigned, not broadcast), Send 8 (dry `sent: false`, shortfall 0 vs live USDC), Send 50 (`.rejected` / `per_call_cap`), LP NVDA (CLI pointer), Sweep (live surplus 1.59492 below min 5, `noop`, not sent), Limits (dry 3 rungs sized 0.53164 from live surplus, chat does not submit). None submitted.
- Tests 72. typecheck/lint/web tsc pass. Assumed: local `.env` has Bankr + Flash keys for the live GET path; tests cover the no-key degrade. Not verified: Flash fills; a judge session without keys on the laptop.

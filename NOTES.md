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

## B8 Runtime frontend on Bankr agent

- Copied Runtime landing/dApp into this tree: `web/src/Landing.tsx`, `App.tsx`, `main.tsx`, `index.css`, `web/index.html` (Funnel Display, viewport 1920), `web/public/logo.svg`. Vite stays `127.0.0.1:5174` `strictPort` + `fs.allow` + `appType: "spa"` for `/app` refresh. `dynamicClient.ts` unchanged. `agent.ts` keeps Bankr `signer` / `treasuryDisplay` / `fetchTreasury` / `fetchFlashOrders` / default `8788` and adds Runtime `encodedTxs` / `UnsignedTx.label`.
- Routes without react-router: `/` landing, `/app` dApp (`pushState` + `popstate`). Landing copy untouched: two-line headline Idle capital should always be / adding runway, FAQ closed, faint looping sine waves, no kicker. Tiny `cmds[i]?.` for web `tsc` (`noUncheckedIndexedAccess`). Dark+cyan Runtime layout. Home = wallets + live balances + positions + chat only. Orders = Flash rungs + optional BaseScan receipts. Limits = `/status` policy chips. Lend disabled.
- Home Balance/positions from GET `/treasury`. Live USDC is the big cash figure. Table USDC/USDT/NVDAc plus ETH when present. `live:false` shows `--`, not 55/40/0.04. Orders from GET `/flash-orders` (2/4/6%, price, qty, status, id). Copy: Buys more on dips. No performance claim. Receipts stay on Orders. Chat chips: Deposit 20 USDC, Sweep extra cash, LP stocks, Send 8, Send 50 (`PAY_DEST_1` when status has it). Deposit shows SignDeposit (founder, `chain: base`). Compact Connect stays clickable with no injected providers. Caps unchanged. Chat POST `/chat` only. No `/wallet/submit`. No `--live`.
- Live read (truncated treasury `0x4c9D...a6c2`): ETH ~0.00962, USDC 16.59492, USDT 0.50372, NVDAc 0.06803417. Flash `ORDER_STATUS_ACCEPTED` on all three rungs (qty 0.53164).
- Browser `127.0.0.1:5174` vs agent `8788`: landing headline + closed FAQ + sine waves; Enter app -> `/app`; hard-load `/app` SPA fallback. Home live balances (not 55/40/0.04), no receipts/Flash table on Home. Clicked Connect (enabled, no injected wallet). Send 50 reject summary (per-call 10). Deposit 20 unsigned, not broadcast. Sweep dry (not sent). LP stocks CLI pointer (not sent). Typed `limits` dry (chat does not submit). Orders three rungs live ACCEPTED + BaseScan receipts. Limits 15 / 10 / 30 from `/status`. Lend disabled.
- Tests 72 (no new test; `liveAmt` stayed in `App.tsx`). typecheck/lint/web tsc pass. Assumed: already-running Bankr agent 8788 had keys; Runtime 5173/8787 left alone; Runtime tree was only copied from, not git-mutated. Not verified: founder-signed deposit hash; Flash fills; `live:false` Home in a browser without keys; 1920 desktop wrap of the landing headline (automation viewport is narrower).

## B9 landing logo, wave cargo, Limits sliders, Home center

- `web/public/logo.svg` lockup is all white (mark was cyan `#10CBFF`; wordmark already white). Landing header and `/app` both use this file. No second color.
- Landing `CapitalFlow` keeps faint looping cyan sine waves at 0.5 opacity. Replaced path dots with tokens that ride the tracks: USD/USDC coins (`$`), NVDA ticks, EUR/GBP, generic stock sparkline. Headline, subcopy, FAQ copy, closed FAQ, and the rest of the landing layout unchanged.
- Limits: three short cards (`align-items: start`, auto height, less padding) with range sliders under the numbers. Init from GET `/status` policy (buffer 15, per-call 10, daily 30). Local React state only. Displayed number follows the slider. Clamp 0-30; per-call max 15 (hard stop). No POST to policy, Bankr, Flash, or chat on drag.
- Home + always-visible wallets row: content center-justified (tags, titles, truncated treasury, balance, positions, chips, log, composer). Limits/Orders stay on their tabs. Receipts stay on Orders. Chat still dry POST `/chat` only. Lend disabled. Ports 5174/8788.
- Browser `127.0.0.1:5174` vs agent `8788`: landing all-white logo; waves carry coins/NVDA/currency; FAQ closed; copy unchanged. `/app` Home centered (wallets, 16.59492 USDC, positions, chat). Limits cards short with leftover black below the row; sliders 15/10/30 then local 8/15/12; fill past 15 stayed at 15; fetch spy saw GET `/logo.svg` only, no POST. Treasury logs truncated `0x4c9D...a6c2`.
- Tests 72. typecheck/lint/web tsc pass. No commit. No `--live`. Runtime git not touched. Assumed: already-running Bankr agent 8788. Not verified: 1920 desktop wrap of landing headline (automation viewport is narrower).

## B10 seamless waves, BTC/ETH/AAPL, centered landing + Home

- Wave seams: `CapitalFlow` no longer tiles two 800-wide paths with a second `M` at x=WAVE. Each track is one continuous sine over `2*WAVE` (1600) with integer periods (1/2/3). `y(0) = y(WAVE) = y(2*WAVE)`. CSS marquee is a 200% strip, `translateX(-50%)`, `overflow: hidden`. Opacity 0.5, cyan sines, not circuit traces.
- Cargo still USD/USDC/NVDA/EUR/GBP/stock, plus BTC, ETH, AAPL pills mixed across waves.
- Landing `/` copy (headline, subcopy, hero Enter app) is centered in `.landing-copy`. Words unchanged. FAQ still full-width and closed. Header logo left / Enter app right. Logo still all-white.
- `/app` Home: wallets + balance/positions/chat are a centered cluster (`max-width` cards, not a full-bleed two-column left stack). Receipts stay on Orders. Limits sliders stay local-only. Chat still dry `POST /chat` only. No `--live`.
- Browser `127.0.0.1:5174` vs agent `8788`: `/` copy centered; FAQ closed (7/7); waves opacity 0.5, overflow hidden, one `M` per path, `y(0)=y(800)=y(1600)`; cargo labels `$` NVDA BTC ETH AAPL £ € plus stock sparkline. `/app` Home wallets gutters 388/388, stack/chat gutters 308/308; live USDC 16.59492; treasury `0x4c9D...a6c2`; Orders/Receipts `display:none` on Home. No chip clicks (no `POST /chat`). No `--live`.
- Tests 72. typecheck/lint/web tsc pass. No commit. Runtime git not touched. Assumed: already-running Bankr agent 8788. Not verified: 1920 desktop wrap of landing headline (automation viewport is 852px).

## B11 landing header CTA, FAQ chips, un-squished tokens, quieter waves

- Header: removed top-right `Enter app`. Logo still left, all-white `/logo.svg`. Hero CTA under the subcopy stays. Headline and subcopy words unchanged. FAQ questions unchanged and closed by default (`open` not set).
- FAQ: `.landing-faq` centered (`align-items: center`). Each `<details>` is `width: fit-content` with `max-width: min(36rem, 100%)` so the outline is a short chip, not full page. `+` / `-` ::after kept.
- Wave tokens: outer track SVG still `preserveAspectRatio="none"` so sines fill the hero (same 200% marquee, one `M`, `y(0)=y(800)=y(1600)`). Tokens sit in a `translate` + `scale(1, sx/sy)` group, `sx/sy` from ResizeObserver on the stretched SVG, so coins stay circular and ticker pills keep 40x18 / 34x18. Nested `meet` SVGs do not work here (square user-space viewport still stretches with the parent).
- Wave field quieter: `.capital-flow` opacity 0.32; per-track 1 / 0.95 / 0.85 / 1 / 0.9 / 0.92. Effective ~0.27-0.32. Copy and hero CTA opacity 1. `/app`, Limits sliders, and logo file untouched.
- Browser `127.0.0.1:5174` vs agent `8788`: `/` has one `Enter app` (hero `.landing-cta` only). FAQ 7/7 closed, chips centered (cx 419 vs mid 418.5), max chip 570px on 837px page (not full bleed), `+` present. Circle tokens ratio 1.0; NVDA/AAPL rect 2.222; BTC/ETH 1.889. Paths 6x `mCount: 1`, wrap y match. Track effective opacity 0.32 / 0.304 / 0.272 / 0.32 / 0.288 / 0.294. CTA opacity 1. No `/app` restyle. No `--live`.
- Tests 72. typecheck/lint/web tsc pass. No commit. Runtime git not touched. Assumed: already-running Bankr agent 8788 / Vite 5174. Not verified: 1920 desktop wrap of landing headline (automation viewport is 837px).

## B12 equal FAQ chips, hero/FAQ gap, quieter waves

- FAQ: `.landing-faq` is a shared centered column (`width: 100%`, `max-width: min(36rem, 100%)`, `align-items: stretch`). Closed `<details>` are `width: 100%` of that column (no `fit-content`), still not full-page. `+` / `-` kept. Questions unchanged. Closed by default (`open` not set). Headline and subcopy unchanged.
- Gap: `.landing-faq` `padding-top: 72px` so Enter app and the FAQ heading are clearly separated. No other landing restyle.
- Waves: `.capital-flow` opacity 0.165 (25% below B12's 0.22). Per-track 1 / 0.95 / 0.85 / 1 / 0.9 / 0.92 unchanged. Copy and hero CTA stay opacity 1. Seamless tracks and un-squished tokens untouched.
- Browser `127.0.0.1:5174` vs agent `8788`: `/` one `Enter app` (hero `.landing-cta` only). FAQ 7/7 closed, `+` present, equal width (576px all on 1280 page, 352px all on 479 page; column not full bleed). CTA-to-FAQ heading gap 100px. `.capital-flow` 0.22; effective tracks 0.22 / 0.209 / 0.187 / 0.22 / 0.198 / 0.202. Copy + CTA opacity 1. Circles ratio 1.0; NVDA/AAPL rect 2.222; BTC/ETH 1.889. Paths 6x `mCount: 1`, wrap y match. No `/app` restyle. No `--live`.
- Tests 72. typecheck/lint/web tsc pass. No commit. Runtime git not touched. Assumed: already-running Bankr agent 8788 / Vite 5174. Not verified: 1920 desktop wrap of landing headline.

## B13 live chat pay

- `POST /chat` allowlisted 8 USDC pay submits on Base via Bankr `POST /wallet/transfer` (`transferUsdc`), same path as `pnpm bankr:pay -- --live`. `handleChat` stays plan-only (`sent: false`). `src/chat/http.ts` calls `maybeSubmitChatPay` after a successful `pay` plan. `unwind_and_pay` returns "Unwind is not live yet (B14)" and does not unwind. Sweep, lp stocks, limits, and unsigned deposit still do not submit. Dest not on `PAY_DEST_*` still rejects. Send 50 still `per_call_cap` and does not call Bankr. Caps unchanged: buffer 15, per-call 10, daily 30, hard stop 15, demo pay 8. Auth `X-API-Key`. `lpValueUsdc` stays `0n` from `portfolioToSnapshot`. `shortfallForPay` unchanged.
- Live: dApp `127.0.0.1:5174` Send 8 vs agent `8788`. Dest `PAY_DEST_1` (`0xD428...6d2A`). Hash `0x8a06a1b827f278f3a21d7eafd760b154f547e7613473aa52b7a2ca76ff1975cb` (BaseScan success, 8 USDC). Chat line: `Sent 8 USDC on Base. Tx 0x8a06...75cb.` (not dry-run). Idle USDC 16.59492 -> 8.59492. Spend log +8. Send 50: `Rejected. Per-call cap is 10 USDC.` Agent logged one `chat_pay` only.
- Tests 77. typecheck/lint/web tsc pass. No commit. Runtime 5173/8787 left alone.
- Assumed: 24h spend window had aged out B2-B5 events, so remaining daily was 30 before this tx (Kenny recalled ~11). 8 still under per-call 10 and hard stop 15. Not verified: Flash fills; unwind live path (B14).

## B14 unwind sAMM then pay

- Live sAMM USDC/USDT LP is quoted into `lpValueUsdc`. `balanceOf(treasury)` on pool `0x9650...07C1`, then Router `quoteRemoveLiquidity` (USDC, USDT, stable=true, factory). `lpValueUsdc` is quoted USDC out for the full position. Wired in `portfolioToSnapshot` / `chatLiveOpts` so `planPay` can return `unwind_and_pay` when free USDC < amount and LP covers the shortfall. `shortfallForPay` stays amount minus free USDC.
- `handleChat` stays plan-only. Submit is `maybeSubmitChatPay`. Action `pay` (shortfall 0) still transfers only, as B13. Send 50 / not allowlisted / missing dest: no unwind, no transfer. Deposit unsigned. Sweep / lp stocks / limits still do not submit from chat. No Flash. Caps unchanged: buffer 15, per-call 10, daily 30, hard stop 15, demo pay 8. Bankr path only. Dynamic `removeLiquidity` adapter still unwired.
- `unwind_and_pay` sizes the LP burn so quoted USDC out >= shortfall (not more than the position). No USDT->USDC swap. If whole-position USDC < shortfall, reject `insufficient_lp` and do not submit. After quote, if free USDC + quoted USDC < pay amount, reject. Encode `encodeApprove` (LP -> router) + `encodeRemoveLiquidity`. Each skill tx via Agent API `submit_raw_transaction` (`submitSkillTx` / `rawSubmitPrompt`), unmodified `to`/`data`/`value`. `/wallet/submit` stays blocked. Each unwind tx under hard stop 15 USDC notional. Then `transferUsdc` for the full pay amount. `appendSpend` the PAY amount only.
- Live (truncated treasury `0x4c9D...a6c2`): GET /treasury USDC 8.59492, USDT 0.50372. LP quote 4.36887 USDC + 5.01316 USDT. Send 8 would still be `pay` (no unwind); did not send another 8. Typed once `send 10 USDC to PAY_DEST_1` (`0xD428...6d2A`) at per-call cap. Shortfall 1.40508, covered by LP USDC. Chat `sent: true`. Idle USDC 8.59492 -> 0. USDT 0.50372 -> 2.116011. Remaining LP 2.96379 USDC + 3.400868 USDT. Spend log +10 (pay only).
- Live hashes (BaseScan success): approve LP `0xb1f755bf5e0c6c304743975849f72d7e36e950af44d87b5031cf2df211f500e8`, removeLiquidity `0x85fe9aae46d2a9979d2950915565b410a64910f852c61131efc19d63b454c566` (1.40508 USDC + 1.612291 USDT out), transfer 10 USDC `0xe77dabe8c8f1dd9b895ecd378c49f3d9ee287b7ea71c10dc33d0b07997d0672b`. Chat line: `Sent 10 USDC on Base. Remove 0x85fe...c566. Tx 0xe77d...672b.`
- Tests 85. typecheck/lint/web tsc pass. No commit. Runtime 5173/8787 left alone. Agent 8788 restarted with B14.
- Assumed: Router `quoteRemoveLiquidity` is 5-arg including factory (ABI matched on-chain Router; previous 4-arg entry would not quote). Token order matches B4 add (USDC, USDT, stable=true). Bankr `amount` is a human decimal string. Not verified: Flash fills; a second unwind of the leftover LP.

## B15 Vercel same-origin host (code slice, no deploy)

- One Vercel project, two services in `vercel.json`: Vite `web/` (SPA rewrite to `index.html` so `/app` hard-load works) and Hono agent `src/chat/http.ts`. Top-level rewrites send `/health` `/status` `/treasury` `/flash-orders` `/chat` to the agent first, then `/(.*)` to the web service. No Next.js. `export default app`. `serve({ hostname: 127.0.0.1, port })` only when `VERCEL` is unset, so `pnpm agent` still binds 8788 locally. `pnpm web` stays 5174. Runtime 5173/8787 untouched.
- Browser same-origin in production: `resolveAgentUrl` returns `""` when `import.meta.env.PROD` (does not bake 8788). Vite dev still defaults `http://127.0.0.1:8788` when `VITE_AGENT_URL` is unset. Keys stay server-side. No live deploy this slice (GitHub `main` is still Dynamic M1b); orchestrator links/deploys after APPROVE.
- CORS: localhost 5173/5174 kept. On Vercel, `https://${VERCEL_URL}`, `VERCEL_BRANCH_URL`, and `VERCEL_PROJECT_PRODUCTION_URL`. Never `origin: "*"`.
- Write gate: if `CHAT_KEY` is set, `maybeSubmitChatPay` (pay / unwind_and_pay) requires header `x-treasureflow-key` (timing-safe). Mismatch is 401. Reads and non-submit chat plans stay open. Unset locally = current live chat pay. Not a `VITE_*` var. dApp sends the header from `sessionStorage` (small Write key field on `/app`). Sweep / LP / limits still do not submit from chat. Caps unchanged. No more Flash. No Uniswap, token launch, live Morpho.
- Function time: `maxDuration` 60 on the agent entry. Unwind + Bankr job poll can exceed Hobby 10s; if the plan still clamps duration, `/chat` unwind may 504. Assumed, not verified (no live deploy).
- Spend log `.data/spend.json` file adapter kept. On serverless the file is ephemeral (and the FS may be read-only outside `/tmp`), so the daily cap is best-effort on Vercel. No KV/Redis (new vendor = stop 4).
- Vercel env names only (values stay in the dashboard / local `.env`, never git): `BANKR_API_KEY`, `TREASURY_ADDRESS`, `PAY_DEST_1`, `PAY_DEST_2`, `FLASH_API_KEY`, `BASE_RPC_URL`, `CHAT_KEY`, `VITE_DYNAMIC_ENVIRONMENT_ID` (frontend).
- Bankr IP allowlist risk: Vercel egress is not a single static IP. If `BANKR_API_KEY` is IP-locked to a laptop/home IP, hosted `/treasury` and chat pay may 401. Assumed, not verified.
- Assumed: Vercel Services + Hono `export default app` on Node (not Edge; spend log uses `fs`). Not verified: a live Vercel URL; Hobby vs Pro duration clamp; Bankr IP policy on this key. Treasury logs stay truncated `0x4c9D...a6c2`. No full treasury in git. No secrets.

## B16 Hobby-safe single Hono (no Vercel Services)

- Dropped `vercel.json` `services`. Hobby `treasureflow` deploys sat `INITIALIZING` with `framework: null` (~10min) because Services is not a Hobby build. One project, `framework: "hono"`. No Next.js. No KV. No new vendor.
- Hono app is still `export default app` from `src/chat/http.ts`. `src/app.ts` re-exports it so the Hono preset can find a listed entry (`src/app.ts` before `src/index.ts`, which is a library barrel). `serve({ hostname: 127.0.0.1, port })` only when `VERCEL` is unset; `pnpm agent` stays 8788. `pnpm web` stays 5174. Runtime 5173/8787 untouched.
- On `VERCEL`, the same app serves `web/dist` from disk (fs read, not Hono `serveStatic`, which the Hono preset ignores). `/` and hashed `/assets/*` are files. `/app` (and `/app/*`) SPA-fallback to `index.html`. API routes stay registered first. Local agent does not serve static.
- `buildCommand` is `pnpm --dir web build`. `installCommand` also installs `web/` (nested package, own lockfile). `includeFiles: web/dist/**` on `src/app.ts` and `src/chat/http.ts` so Vite output is in the function bundle. `maxDuration` 60 kept.
- Same-origin prod `AGENT_URL` `""` (B15). CORS + `CHAT_KEY` gate unchanged. Caps unchanged. Chat still does not place/cancel Flash. No live pay/unwind this slice.
- Assumed: Hono preset uses `src/app.ts`, includeFiles is applied after Vite build, Hobby will now detect `framework: hono` instead of hanging on Services. Not verified: a live Vercel URL (orchestrator deploys). Treasury logs stay truncated `0x4c9D...a6c2`. No secrets.

## B17 GitHub-facing docs (easy language)

- Rewrote `README.md` as the GitHub homepage: what the app does, spend vs no-spend, BaseScan proof (B2-B5 CLI hashes plus B13/B14 chat hashes), chat live vs dry, caps, local run (8788/5174), live URLs, honest not-yet. Replaced stale `HANDOFF-BANKR.md` (B12 / dry chat / do-not-merge) with a short current handoff pointing at README. Banners on `HANDOFF.md` and `PUNCH-LIST.md` only. Did not rewrite `PRD.md`, `BUILD-PLAN.md`, reviews, vendor docs, or product code. `evidence.ts` still omits B13/B14 hashes (left as-is). No `PROOF.md` (README stayed one page).
- Assumed: B17 product-truth brief (hosted alias SHA `12bec50` B15 host; git `23716fa` Vercel deploys ERROR on tsc; Club true; hashes match NOTES B2-B14). Not verified this slice: live Vercel SHA, Flash fills, current treasury USDC, a hosted chat pay, tsc ERROR reproduction. No commit. No `--live`. Runtime git not touched. Treasury stays truncated `0x4c9D...a6c2`. No secrets.

## B18 Home UI polish (Kenny screenshot)

- Product only: `web/src/App.tsx`, `web/src/index.css`. Landing copy untouched. Caps unchanged. Chat still does not submit sweep/LP/Flash. No `--live`. No Flash place/cancel. No live pay POST.
- Top cards: `.wallet` max-width 560px -> 640px (same `flex: 1 1 480px` as `#home .stack` / `#home .chat`) so Company treasury / Founder match Balance+positions / Ask TreasureFlow. Home stays centered. Receipts stay on Orders (`#home` hides `#orders`).
- Header: removed `ConnectButton`. Cyan dot + On Base kept. Founder connect is only in the Founder card.
- Founder card: one Connect wallet control; click expands options. Labels from Dynamic `metadata.displayName`, else Phantom / Trust Wallet / MetaMask, else Wallet. No vendor key strings as the primary label. Connected: truncated address + Disconnect in the card, not the header. Empty Dynamic id: muted disabled Connect wallet under You sign. Founder-only Dynamic JS. Does not create a Bankr or Dynamic server wallet. Never sets `TREASURY_ADDRESS`.
- Gutter: `html`/`body` dApp background `#000` -> `var(--bg)` (`#0b0d10`) so leftover viewport after the scaled 1920 stage matches the dApp. `html.page-landing` still uses `--bg`.
- Removed the Send 50 chip. Kept Deposit 20 USDC, Sweep extra cash, LP stocks, Send 8. Typed `send 50` still hits the existing parser reject (`per_call_cap`). Agent parser untouched.
- Browser `127.0.0.1:5174` vs agent `8788`: Home columns equal width (474/474 at 1600x800). No header Connect. One Connect wallet; expand showed No injected wallet found (no extensions in the automation browser). html/body/stage `rgb(11, 13, 16)`. No Send 50 chip. Lend disabled. Receipts `display:none` on Home. Orders: three ACCEPTED rungs + BaseScan receipts. Limits 15 / 10 / 30. Typed send 50: `Rejected. Per-call cap is 10 USDC.` Landing `/`: `page-landing`, FAQ 7/7 closed, headline unchanged. Treasury logs truncated `0x4c9D...a6c2`.
- web tsc pass. No new tests. No commit. Runtime git not touched.
- Assumed: already-running Vite 5174 / agent 8788; Dynamic env id present so Connect is enabled. Not verified: injected-wallet option labels with Phantom/MetaMask/Trust actually installed; founder-signed connect/disconnect; native 1920 desktop wrap (automation viewport override was 1600x800).

## B19 Orders tab + wallet card copy (Kenny screenshot)

- Product only: `web/src/App.tsx`, `web/src/index.css`. Landing FAQ untouched. Caps unchanged. Limits sliders still local-only (no persist/POST). Chat still does not submit sweep/LP/Flash. No `--live`. No Flash place/cancel. No live pay POST.
- Always-visible wallet card: tag `Your wallet` -> `External Wallet`. Heading `Founder` -> `Company`. Cut the `You sign` line in disconnected and Dynamic-off states. One Connect wallet control kept from B18. Connected still truncated address + Disconnect in-card. Header still no Connect.
- Orders: removed `Buys more on dips. No performance claim.` under the Flash table. No replacement claim. `FLASH_LADDER_COPY` left unused in `evidence.ts`.
- `#orders` stack centered like Home, max-width `calc(640px * 2 + var(--gap))` (1304px, same span as the two wallet cards). Not full-bleed 1920. `.panel { overflow: hidden }` plus `border-collapse: separate; border-spacing: 0` so table rules stay inside the rounded receipts box. BaseScan links not clipped.
- Browser `127.0.0.1:5174` `/app` vs agent `8788`: Home External Wallet / Company, no You sign, one Connect wallet, no header Connect. Orders: no dip copy; stack dx/dw 0 vs wallet cards; last receipts row inside panel (left/right/bottom bleed negative); five BaseScan links unclipped. Limits 15 / 10 / 30. Lend disabled. Treasury truncated `0x4c9D...a6c2`.
- No new tests. No commit. Runtime git not touched.
- Assumed: already-running Vite 5174 / agent 8788. Not verified: connected Disconnect click; native 1920 desktop wrap (automation viewport was the scaled 1920 stage).

## B20 combine Orders + Limits

- Product only: `web/src/App.tsx`, `web/src/index.css`. Landing untouched. Caps unchanged. Limits sliders still local React only (no persist, no POST). Chat still does not submit sweep/LP/Flash. No `--live`. No Flash place/cancel. No live pay POST.
- Nav: Limits tab removed. Home, Orders, Lend (disabled). View type is `"home" | "orders"` (no `"limits"`). Standalone `#limits` page gone. Orders is the combined page.
- Orders under the always-visible wallet row, top to bottom: three limit slider cards (Keep this much cash / Max per payment / Left to send today, same copy), then Buy-the-dip orders, then Receipts. Home stays Balance / positions / chat; no limits row on Home.
- Width: `#orders .limits` fills the Orders stack `max-width: calc(640px * 2 + var(--gap))` (1304px). Three equal columns + `--gap`, centered with the two 640px wallet cards and the order panels. Not full-bleed 1920. `#orders .panel` is `flex: 0 0 auto` so table last rows stay inside the rounded box; stack may scroll.
- Browser `127.0.0.1:5174` `/app` vs agent `8788`: nav Home / Orders / Lend disabled, no Limits tab. Home: External Wallet / Company, no You sign, no header Connect, no Send 50, Balance + positions + chat, no sliders. Orders: wallet span 1304 = limits 1304 = stack 1304; limit cards 419/419/419; sliders 15/10/30 then local cash 8 with no fetch; three ACCEPTED rungs; last receipts row inside panel (`bottomInside` 4.7, Flash USDC approve unclipped). Treasury truncated `0x4c9D...a6c2`.
- No new tests. No commit. Runtime git not touched.
- Assumed: already-running Vite 5174 / agent 8788. Not verified: native 1920 desktop wrap (automation viewport scaled the 1920 stage).

## B21 Limits & Orders label + document scroll

- Product only: `web/src/App.tsx`, `web/src/index.css`. Landing class `page-landing` overflow auto left as-is. Caps unchanged. Limits sliders still local React only (no persist, no POST). Chat still does not submit sweep/LP/Flash. No `--live`. No Flash place/cancel. No live pay POST.
- Nav: Orders button label is `Limits & Orders`. Still one combined view (no Limits tab). Home and Lend (disabled) stay. View type remains `"home" | "orders"`.
- dApp scroll: html/body `overflow-y: auto` (not hidden/100% clip). Stage is height auto (min-height 1080) in a `.stage-frame` sized to `scrollHeight * (innerWidth/1920)`. Scale is width-only so tall content is real document scroll. `#orders .stack` `overflow-y: auto` removed. Wallets are `position: static` and sit in the same document as the rest (not sticky/fixed, not outside a clipped inner scroller).
- B18-B20 kept: no header Connect; External Wallet / Company; no You sign; no Send 50 chip; no dip disclaimer; combined Orders+Limits; 1304px wallet/limits/stack widths; receipts last row inside the box; gutter `var(--bg)`.
- Browser `127.0.0.1:5174` `/app` vs agent `8788`: nav Home / Limits & Orders / Lend disabled. Limits & Orders: sliders 15/10/30, then buy-the-dip, then receipts; stack 1304 = wallet span 1304; last receipts row inside panel. At 1280x520, document scrollY 298; wallets `static`, bottom -114 (left the viewport); `#orders .stack` overflow visible. Home at same viewport: no sliders, no Send 50; document scrollY 200; wallets left the viewport. Landing `/`: `page-landing`, overflow auto, FAQ 7/7 closed, one Enter app, headline unchanged, document scrolls (scrollY 819 on 1339 content). Treasury truncated `0x4c9D...a6c2`.
- No new tests. No commit. Runtime git not touched.
- Assumed: already-running Vite 5174 / agent 8788. Not verified: native 1920 desktop wrap (automation used 1280x520 so wallets could leave); founder connect/disconnect.

## B22 Vercel tsc RequestInit/Response

- GitHub `main` `1fa24d9` (B21) deploy `dpl_ABheUFGYgDuYoNfvJsZr4Kvp8AqJ` ERROR `lint_or_type_error`. Same B16 tsc: `RequestInit` has no `headers`; `Response` has no `ok` / `json` / `status` in `src/flash/http.ts`. Alias `treasureflow.vercel.app` still SHA `12bec50` (B15). Local `pnpm typecheck` passed (`lib` ES2022, `types` `["node"]`); Vercel Hono preset typechecks `src/` and pulls DOM, so `@types/node` `web-globals/fetch.d.ts` collapses those names to `{}`.
- Stopped using the global names. `src/flash/http.ts`: local `FlashHeaders` bag + `FlashInit`, `FlashRes = Awaited<ReturnType<typeof fetch>> & { ok; status; json }`. Same pattern on `src/bankr/http.ts` and `src/bankr/quote.ts` (same clash, would fail next). `skipLibCheck` stays on. Builds not disabled. `vercel.json` unchanged: Hobby-safe `framework: hono`, `includeFiles` `web/dist`, `maxDuration` 60, no `services`, no Next.js.
- `pnpm typecheck` pass. `pnpm exec tsc -p tsconfig.json --noEmit --lib ES2022,DOM` pass (Vercel stand-in). `pnpm test` 104/104. No commit. Runtime git not touched. Caps unchanged. Chat still does not submit sweep/LP/Flash. No `--live`. No Flash place/cancel.
- Assumed: Hono git deploy of this tree will leave `lint_or_type_error` and go READY with B16 host + B18-B21 UI. Not verified: a live Vercel READY URL (orchestrator deploys). Treasury truncated `0x4c9D...a6c2`. No secrets.

## B23 Hono function Node runtime (boot 500s)

- B22 `a9d9ae5` production `dpl_GrbAyoG8tRWrs9aEHoXoYi7J7Ym3` READY and is the `treasureflow.vercel.app` alias, but `/` `/app` `/status` all `FUNCTION_INVOCATION_FAILED`. Runtime logs empty (boot crash; `/status` `onError` never runs). First Hobby Hono host that built READY; previous live site was B15 two-service SHA `12bec50`.
- Cause: `src/chat/http.ts` top-level `import { serve } from "@hono/node-server"` plus `src/chat/static.ts` `node:fs`. Hono preset can still emit Edge for `export default app`; those Node APIs crash the isolate at module eval.
- Fix (same Hono host, no new stack): `vercel.json` `functions` for `src/app.ts` and `src/chat/http.ts` set `runtime: "nodejs22.x"` (Node/Fluid, not Edge). Keep `includeFiles: web/dist/**` and `maxDuration` 60. No `services`, no Next.js. `serve` is `await import("@hono/node-server")` only when `VERCEL` is unset and the file is the process entry. `web/dist` still served with `fs` on Node.
- Local: `pnpm typecheck` pass. `pnpm test` 104/104. `VERCEL` unset: dynamic `serve` binds (`AGENT_PORT=8799` health `{"ok":true}`; existing 8788 left alone). `VERCEL=1` loads the module and does not listen. Caps unchanged. Chat still does not submit sweep/LP/Flash. No `--live`. No Flash place/cancel. No commit. Runtime git not touched.
- Assumed: next git deploy of this tree will invoke the function on Node so `/` `/app` `/status` stop 500ing at boot. Not verified: a live Vercel URL (orchestrator pushes). Treasury truncated `0x4c9D...a6c2`. No secrets.

## B24 Node runtime via function config export

- B23 deploy ERROR `invalid_function_runtime`: `vercel.json` `functions.runtime` is for custom runtimes (`vercel-php@x.y`), not Node. `"nodejs22.x"` is not a valid version there. Node version stays `package.json` `engines.node` `>=22`. Node vs Edge is `export const config = { runtime: "nodejs" }` on the function file (Vercel routing-middleware / functions runtimes).
- B22 `a9d9ae5` alias `treasureflow.vercel.app` still READY with every path `FUNCTION_INVOCATION_FAILED` (boot crash; logs empty). Likely Edge isolate plus `node:fs` / `@hono/node-server`.
- Fix (same Hono host, no new stack): dropped `runtime` from `vercel.json` `functions` for `src/app.ts` and `src/chat/http.ts`. Kept `includeFiles: web/dist/**` and `maxDuration` 60. No `services`, no Next.js. Both entries `export const config = { runtime: "nodejs" }` and keep `export default app`. B23 lazy `await import("@hono/node-server")` only when `VERCEL` is unset and the file is the process entry. `web/dist` still served with `fs` on Node.
- Local: `pnpm typecheck` pass. `pnpm test` 104/104. Caps unchanged. Chat still does not submit sweep/LP/Flash. No `--live`. No Flash place/cancel. No commit. Runtime git not touched.
- Assumed: next git deploy of this tree will build (no `invalid_function_runtime`) and invoke on Node so `/` `/app` `/status` stop 500ing at boot. Not verified: a live Vercel URL (orchestrator pushes). Treasury truncated `0x4c9D...a6c2`. No secrets.

## B25 restore B15 two-service host

- Kenny: stop blocking frontend updates; public URL must look good. Production was rolled back to B15 two-service host SHA `12bec50` / `dpl_29XUM33`, LIVE HTTP 200 on `https://treasureflow.vercel.app/` (`/` `/app` `/status`). That host already served Vite `web/` as its own service. HEAD already has B18-B21 UI in `web/`. The 500s were B16-B24 Hobby Hono serving `web/dist` via `node:fs`. No Next.js, no AMPLE, no new vendor, no extra runtime strings.
- Restored proven B15 host so current frontend can ship. `vercel.json` matches `git show 12bec50:vercel.json`: services `web` (Vite, SPA rewrite to `index.html`) + `agent` (`src/chat/http.ts`, `maxDuration` 60); top-level rewrites `/health` `/status` `/treasury` `/flash-orders` `/chat` to agent, then `/(.*)` to web. No top-level `framework` hono. No `installCommand` / `buildCommand` / `includeFiles` `web/dist`. No `functions.runtime`.
- Agent is API-only again. Dropped `vercelWebStatic` catch-all from `src/chat/http.ts`. Kept CORS, CHAT_KEY gate, chat pay/unwind submit, reads. Kept B23 lazy `await import("@hono/node-server")` only when `VERCEL` is unset and this file is the process entry. Removed `export const config = { runtime: "nodejs" }`. Deleted `src/app.ts` (B16 Hono-preset re-export) and `src/chat/static.ts` (Hono-fs static unused once Vite is its own service).
- Did not change `web/` product UI (B18-B21 stays). Did not revert B22 flash/bankr `RequestInit`/`Response` local types. Did not unlock chat sweep/LP/Flash submit. No `--live`. No Flash place/cancel. No Dynamic wallet create. Caps unchanged. `skipLibCheck` stays on. Builds not disabled.
- `pnpm typecheck` pass. `pnpm test` 102/102 (dropped Hono-fs static tests; restored services + API-only `/app` 404). No commit. Runtime git not touched.
- Assumed: git deploy of this tree will serve the new UI the same way `12bec50` did. Not verified until the orchestrator pushes. Treasury truncated `0x4c9D...a6c2`. No secrets.

## B26 founder sign, pause, spend path, confirm pay

- Server: `FOUNDER_ADDRESS` -> `AppConfig.founderAddress` (checksum, empty is null). Pause is env `PAUSED=true` OR `{ paused }` file (local `.data/paused.json`, Vercel `/tmp/treasureflow-paused.json`). `POST /pause` needs `x-treasureflow-key` (Vercel + empty `CHAT_KEY` is 401). Spend log local `.data/spend.json`, Vercel `/tmp/treasureflow-spend.json`. `assertSpendWritable` before any Bankr transfer/unwind; append after success. Localhost CORS only when `VERCEL` is unset. Plan-only `POST /chat` pay is 200 without the write key (`sent:false`). Confirm submit needs key + founder `personal_sign` of `GET /auth/challenge` (5 min TTL). Missing founder or bad sig rejects submit. `GET /auth/founder-ok?address=` checksum compare. `GET /status` drops full treasury/pay dests; truncated displays plus `founderDisplay`. `PAY_DEST_1` / `PAY_DEST_2` resolve server-side before allowlist. Caps still 15/10/30/15. Chat still does not submit sweep, LP stocks, or Flash.
- dApp: write key in memory only (no sessionStorage). Confirm modal before pay / unwind_and_pay. Cancel is no second POST. Confirm signs the challenge from the connected EVM account. Pause / Resume on Home and Limits & Orders. Sign deposit disabled unless founder-ok. Limits read-only from `/status`. Lend nav removed. Sweep extra cash and LP stocks chips are plan only. Send 8 uses `PAY_DEST_1`. Landing FAQ: cap is in the agent, founder signs deposits, Pause stops outbound, fee yield only.
- `pnpm typecheck` pass. `pnpm test` 115/115. No commit. No push. Runtime git not touched. No `--live`. No Dynamic wallet create. No AMPLE.
- Assumed: hosted Vercel still two-service (web + agent) with new `/pause` and `/auth/*` rewrites. Not verified: founder-signed live pay, live pause on the public URL, `/tmp` spend surviving across serverless invocations, injected-wallet confirm in a real browser. Treasury `0x4c9D...a6c2`. Founder `0xD428...6d2A`. No secrets.

## B27 restore Limits sliders (0-100 local)

- Product: `web/src/App.tsx` LimitsPanel. Range CSS in `web/src/index.css` already present; left as-is. `#orders .limits` still 1304px equal columns. Agent policy / env defaults unchanged (buffer 15, per-call 10, daily 30, hard stop 15). Sliders are local React state only: init from GET `/status` (fallback 15 / 10 / 30), `clampUsd(..., 100)`, drag updates the displayed number. No POST to policy, Bankr, Flash, or chat. Chat still does not submit sweep, LP stocks, or Flash. No `--live`. No Flash place/cancel.
- Limits & Orders: three `<input type="range" min={0} max={100} step={1}>` under Keep this much cash / Max per payment / Left to send today. Aria-labels kept. Subcopy kept (Never swept overnight / In the agent / Rolling 24h, orchestrator). Home has no limits row. Pause / confirm / founder / Lend-removed / plan-only chips from B26 stay.
- `pnpm --dir web exec tsc --noEmit` pass. B26 source guard now expects range inputs. No commit. No push. Runtime git not touched.
- Assumed: orchestrator will deploy this UI. Not verified until that deploy. Treasury `0x4c9D...a6c2`. No secrets.

## B28 chat panel + pause-bar layout

- Home `ChatPanel`: Linear/Intercom-style column. Header row is title left plus Live/Paused pill right. Admin toolbar is Pause + Resume (`POST /pause`) plus in-memory Write key (`type=password`, no sessionStorage, no `VITE_*`). Status is not duplicated in the toolbar. Log is flex-grow and left-aligned (agent name stays cyan). Chips sit above the composer, start-aligned wrap, labels unchanged (Deposit 20 USDC / Sweep extra cash (plan only) / LP stocks (plan only) / Send 8). Composer empty on load with placeholder `Deposit, sweep, or send`. No em dash.
- Limits & Orders: same `PauseBar`, `align-self: center` in `#orders .stack` (1304px). Compact horizontal cluster centered under the wallet pair (measured dx 0 vs card pair and stack). Not left full-bleed. Sliders / Flash table / receipts / wallets / nav / landing unchanged except this center CSS. Pause errors render under the toolbar so the control row stays nowrap.
- Chat still POST `/chat` for plans only. Sweep/LP chips stay plan-only. Caps unchanged. No src/ agent edits. No new deps, Tailwind, shadcn, Next.js, or fonts.
- Browser `127.0.0.1:5174` vs already-running agent `8788`: Home Pause/Resume clickable; Write key typed (password, length 8, sessionStorage 0); Sweep and LP chips returned plan-only summaries; composer Send `deposit 20 USDC` returned unsigned transfer; Send 8 chip POSTed. Orders Pause/Resume clickable; Write key typed; pause-bar center dx 0 vs wallets. `pnpm --dir web exec tsc --noEmit` pass. No commit. Runtime 5173/8787 left alone.
- Assumed: reused existing Vite 5174 / agent 8788. Not verified: live `POST /pause` success (running 8788 returned 404 / browser Failed to fetch; buttons still fired); Send 8 confirm modal (agent replied `No matching intent` for `PAY_DEST_1`); founder-signed confirm. Treasury `0x4c9D...a6c2`. No secrets.

## B29 RainbowKit External Wallet connector

- Replaced frontend Dynamic JS with RainbowKit + wagmi v2. Removed homemade `ConnectMenu` / `useGetAvailableWalletProvidersData` / `useConnectWithWalletProvider`. Deleted `web/src/dynamicClient.ts`. Uninstalled `@dynamic-labs-sdk/client`, `@dynamic-labs-sdk/evm`, `@dynamic-labs-sdk/react-hooks`. Added `@rainbow-me/rainbowkit@2.2.11` and `wagmi@2.19.5` (RainbowKit peer `wagmi ^2.9.0`; kept existing `viem@2.56.5`, React 19, `@tanstack/react-query@5.103.1`). No Next.js, Tailwind, or shadcn. RainbowKit CSS imported once in `main.tsx`.
- External Wallet / Company card uses RainbowKit `<ConnectButton showBalance={false} />`. Click Connect opens the RainbowKit modal (`Connect a Wallet`, `data-rk`, dialog `rk_connect_title`). Header stays cyan dot + On Base (no header Connect). Connected state is RainbowKit in-card address + disconnect. Dark theme `modalBackground` `#0b0d10`, accent `#10cbff`.
- Connectors: EIP-6963 injected via RainbowKit `injectedWallet` always. WalletConnect connector only if `VITE_WALLETCONNECT_PROJECT_ID` is a non-empty string. No dummy WC project id. Empty/missing env is injected-only; Connect still opens RainbowKit. Connect does not create a Bankr or Dynamic server wallet. Agent still does not control the external wallet.
- Signing: wagmi `useAccount` + `useWalletClient`. Confirm pay `signMessage` of `GET /auth/challenge` then POST `/chat` with nonce+sig+write key. No account: `Connect the founder wallet.` Sign deposit still gated on `GET /auth/founder-ok?address=`; `sendTransaction` unsigned ERC-20 (`to` token, agent `data`, `value` 0n, chain Base) after `switchChain` to Base if needed. Write key still in-memory, `type=password`, never sessionStorage, never `VITE_CHAT`.
- Env/docs names only: `web/.env.example` drops required `VITE_DYNAMIC_ENVIRONMENT_ID`, adds optional `VITE_WALLETCONNECT_PROJECT_ID=` (empty = injected only). Root `.env.example` stops saying VITE_DYNAMIC is needed for Connect; leftover Vercel `VITE_DYNAMIC_ENVIRONMENT_ID` kept as unused. README Connect sentence updated. `web/src/vite-env.d.ts` types optional WC id. Caps unchanged. Chat still does not submit sweep/LP/Flash. No `src/` agent edits. No vercel.json. No commit.
- Browser `127.0.0.1:5174` `/app` vs already-running agent `8788`: External Wallet / Company, RainbowKit Connect Wallet in that card, not the header. Click Connect opened RainbowKit modal (Installed / Browser Wallet; no WalletConnect; not the homemade `No injected wallet found` listbox). Home chips unchanged. Limits & Orders: sliders 15/10/30, receipts, Connect still in-card. Write key `type=password`, sessionStorage empty. Landing `/`: `page-landing`, one Enter app, FAQ 7, headline unchanged. `pnpm --dir web exec tsc --noEmit` pass. Runtime 5173/8787 left alone.
- Assumed: no WC id in `web/.env` (key absent). Not verified: live MetaMask connect/sign; founder-ok Sign deposit broadcast; confirm-pay recovered signer. Treasury `0x4c9D...a6c2`. No secrets.

## B30 Kenny Home layout (treasury+cash, founder bals, header PauseBar, chip block)

- Combined cyan Company treasury card: tag + TreasureFlow + truncated address + big USDC cash from GET `/treasury` (same `liveAmt` as before). Removed the separate Home Balance panel. Home left column is combined card (wallets row) then Active positions. Receipts stay on Limits & Orders. Caps unchanged. Chat still does not submit sweep / LP / Flash. Agent does not send from the founder wallet.
- External Wallet / Company: disconnected Connect uses RainbowKit `ConnectButton.Custom` (`openConnectModal`). Connected: truncated address, Base ETH (`useBalance` native), USDC (`useBalance` token = GET `/status` `tokens.usdc` or known Base USDC `0x8335...2913`), plus visible Disconnect (`useDisconnect`). Not GET `/treasury`. Read-only founder wallet.
- PauseBar moved into `header.top` (Pause / Resume / Write key `type=password`, in-memory, never sessionStorage, never `VITE_*`). Same `POST /pause`. On Home and Limits & Orders. Nav + On Base kept. Removed from ChatPanel and `#orders .stack`. Chat keeps Live/Paused pill. Landing `/` unchanged (no PauseBar).
- Chat chips in a bordered `.chip-block`, centered, labels unchanged: Deposit 20 USDC / Sweep extra cash (plan only) / LP stocks (plan only) / Send 8. Composer still below, empty + placeholder. B28 log left-aligned. B29 RainbowKit kept. Limits sliders still local 0-100. No src/ agent edits. No vercel.json. No commit.
- Browser `127.0.0.1:5174` `/app` vs already-running agent `8788`: Home combined cyan treasury `0x4c9D...a6c2` + `0 USDC`, then Active positions (no separate Balance panel, no receipts). External Wallet Connect Wallet; click opened RainbowKit `Connect a Wallet` (Installed / Browser Wallet). Header Pause / Resume / Write key (`type=password`, typed, sessionStorage 0). Chat Live pill kept; chips centered in `.chip-block`; composer empty + placeholder. Limits & Orders: same header PauseBar only (no second bar under wallets); sliders 15 / 10 / 30; receipts. Landing `/`: `page-landing`, Enter app, FAQ 7, no PauseBar. `pnpm --dir web exec tsc --noEmit` pass. Runtime 5173/8787 left alone.
- Assumed: reused Vite 5174 / agent 8788. Not verified: live founder ETH/USDC (`useBalance`) because the automation browser had no MetaMask; Disconnect structure is in source for the connected state. Not verified: live `POST /pause` success. Treasury `0x4c9D...a6c2`. No secrets.

## B31 chips under composer

- ChatPanel order is now chat-head, log, composer form, then chip-block. `.chip-block` is a sibling after `<form className="composer">`, not between the log and the input. Labels unchanged: Deposit 20 USDC, Sweep extra cash (plan only), LP stocks (plan only), Send 8. Sweep/LP stay plan-only. Submit stays gated. No new intents. Caps unchanged. Header PauseBar, treasury card, external wallet, landing, agent, vercel.json untouched.
- `.chip-block` dropped the inner boxed panel (no 3px frame, no padded dark well). `.chips button` is suggestion-sized: min-height 32px, 13px/500, 1px border, muted fill/text. Send stays the cyan primary.
- Browser `127.0.0.1:5174` `/app`: DOM children of `.chat` are chat-head, log, form.composer, chip-block (`chipAfterForm` true). Visual: log, then composer + cyan Send, then chips below. Deposit 20 USDC chip POST `http://127.0.0.1:8788/chat` body `{"prompt":"deposit 20 USDC"}` status 200; log showed unsigned ERC-20 transfer. `pnpm --dir web exec tsc --noEmit` pass. No commit. Runtime 5173/8787 left alone.
- Assumed: reused Vite 5174 / agent 8788. Treasury `0x4c9D...a6c2`. No secrets.

## B32 live treasury UI + live chat snapshot

- Cyan Company treasury card still uses GET `/treasury` USDC as the big cash figure (0 today). Same card now also shows live ETH, USDT, and NVDAc so ETH ~0.00962 is visible. Truncated address kept. Polls `/treasury` on mount, every 15s, and after a chat reply. `live:false` still `--`, never demo 55/40. External Wallet card is still the founder wallet (wagmi), not copied onto treasury.
- `chatLiveOpts` fetches Bankr portfolio for every prompt. If Bankr returns a snap, chat uses it. If Bankr fails, snapshot is omitted (no `DEMO_SNAPSHOT` 55/40). `handleChat` `snapshotOf` no longer substitutes 55/40; missing snap is honest empty (`no_live_snapshot`). Send 8 cannot plan against fake USDC.
- New intents (regex, no XAI): `balance` / status / how much / what is the treasury returns live USDC, USDT, NVDAc, ETH and truncated `0x4c9D...a6c2`. External-wallet questions tell the user the External Wallet card shows that wallet; the agent only reports company treasury and does not send from it. `send 5 USDC from my wallet/external to the treasury` / `send $5 from my external wallet to the treasury` maps to the existing unsigned USDC deposit path (founder signs). Pay still `send N USDC to PAY_DEST_*` / allowlisted 0x. Caps unchanged. Sweep/LP/Flash still plan-only from chat.
- Tests 126. `test/b32.test.ts` covers missing snapshot, live-shaped balance, send-from-external-to-treasury deposit, unknown still safe. `pnpm test` + `pnpm typecheck` + `pnpm --dir web exec tsc --noEmit` pass. Restarted Bankr `pnpm agent` on 8788. Runtime 5173/8787 left alone. No commit.
- Browser `127.0.0.1:5174` `/app` vs 8788: cyan card `0x4c9D...a6c2`, big **0 USDC**, ETH `0.009615168632760246` (plus USDT/NVDAc). After 16s still live (7 GET `/treasury` hits, not stuck). Chat `how much USDC in the treasury` returned live 0 USDC not 55. Deposit 20 USDC chip still unsigned ERC-20. Did not POST live pay. No secrets.

## B33 chat submit sweep/LP + $1 demo Flash

- POST `/chat` can submit sweep, LP stocks, and one demo Flash after the same gate as pay: plan-only (no key) is `sent:false`; confirm needs `x-treasureflow-key` + nonce + founder `personal_sign` of `GET /auth/challenge` with recovered signer `FOUNDER_ADDRESS`. Vercel missing `CHAT_KEY` or `FOUNDER_ADDRESS` is 401 on confirm. Pause and spend probe run before Bankr. Founder wallet still only signs deposits (unsigned ERC-20) in MetaMask. Agent does not send from a server key on the founder wallet.
- Sweep reuses `encodeAddLiquidity` + `submitSkillTx` (`src/bankr/sweepLive.ts` / CLI). Size via existing `sizeLiveSweep` (demo min/cap 5, buffer 15). 0 USDC or below buffer+min is an honest noop, not a fake add. LP reuses the aero-stock-lp live path (`src/bankr/lpLive.ts`) at $10 notional under hard stop 15; 0 USDC noops without mint.
- Demo Flash: `buy 1 USDC of cbBTC 0.01 percent below spot`. $1 USDC notional, 0.01% below Chainlink cbBTC/USD, under hard stop 15. Quote + Kernel wrap + `POST /order` like `limitsCli.ts`. Does not cancel or replace B5 ids `7863b457-c132-4f6d-bc01-0925dd32d6ee`, `afcc2cb5-e93b-4565-98be-6fe60bc8c744`, `296280cb-3ba3-466f-96e6-f0f018fea652`. New order id persisted in gitignored `.data/flash-demo.json` so `GET /flash-orders` can list it next to B5. Filled qty parsed from GET JSON only when present. Status string already live. `$1` order was not placed this slice (treasury USDC 0; no `--live` CLI).
- Skip this slice: LLM/XAI, nightly cron, KV, slider POST (sliders stay local 15/10/30), ETH/USD. Caps unchanged: hard stop 15, buffer 15, per-call 10, daily 30, demo sweep 5, pay 8.
- dApp chips: Sweep extra cash, LP stocks, Buy 1 USDC cbBTC, Send 8. Dropped "(plan only)". Confirm modal for sweep / lp_stocks / demo flash / pay. Copy: buys more on dips, no performance claim, does not promise a fill.
- Tests 138. `test/b33.test.ts` covers plan-only without key, confirm gate, pause, $1 under hard stop, B5 ids not cancelled, 0 USDC sweep noop. `pnpm test` + `pnpm typecheck` + `pnpm --dir web exec tsc --noEmit` pass. Restarted Bankr `pnpm agent` on 8788. Runtime 5173/8787 left alone. No commit.
- Browser `127.0.0.1:5174` `/app` vs 8788: chips Sweep extra cash / LP stocks / Buy 1 USDC cbBTC / Send 8 (no plan only). Sweep chip plan `Nothing to sweep. Confirm will noop.` then Confirm modal `Sweep extra cash into USDC/USDT. Caps 15 / 10 / 30.` Cancelled; no live submit. Limits sliders still 15 / 10 / 30. Live USDC 0. Did not place a $1 Flash order. Treasury `0x4c9D...a6c2`. No secrets.

## B34 Bankr LLM Gateway text mapper

- NL dApp chat uses Bankr LLM Gateway as a text mapper only. `POST /chat` parses first. Known chips skip the gateway. Unknown prompts with `AppConfig.bankrApiKey` rewrite to one canonical line (`deposit N USDC`, `send N USDC to PAY_DEST_1`, `sweep`, `lp stocks`, `buy 1 USDC of cbBTC 0.01 percent below spot`, `how much USDC in the treasury`, or `UNKNOWN`), then re-parse through existing `handleChat` + `chatLiveOpts` + `chatKeyGate` + founder sig + `maybeSubmitChat`. LLM never sets `sent: true`. No Agent API `/agent/prompt` jobs. No new cloud vendor.
- Gateway HTTP in `src/bankr/llm.ts`: host `llm.bankr.bot`, `POST /v1/chat/completions`, header `X-API-Key` from `bankrApiKey`. Default model `gemini-3-flash`. Optional `BANKR_LLM_MODEL`. 401/402 become user copy (enable gateway on the key / add LLM credits at bankr.bot/llm). Status-only logs, no secrets. System prompt: company treasury only, founder signs deposits, caps buffer 15 / per-call 10 / daily 30 / hard stop 15, no performance claims, no em dashes, compact live balances when present.
- Tests 144. `test/b34.test.ts` mocks gateway HTTP: NL cash maps to balance; chip `sweep` does not call the gateway; 402 credits copy; UNKNOWN stays unknown; send 50 still `per_call_cap`. `pnpm test` + `pnpm typecheck` + `pnpm --dir web exec tsc --noEmit` pass. Restarted Bankr `pnpm agent` on 8788. Runtime 5173/8787 left alone. No commit.
- Browser `127.0.0.1:5174` `/app` vs 8788: Deposit 20 USDC chip still unsigned ERC-20. `what is the buffer?` fallback `No matching intent.` `what's our cash sitting in the company account` mapped to live balance `Company treasury 0x4c9D...a6c2` USDC 0.235011. Did not place Flash or pay. Treasury `0x4c9D...a6c2`. No secrets.

## B35 ETH as USD on Company treasury card

- Cyan card big cash stays live USDC (not folded with ETH). ETH line on `.wallet-bals.treasury-held` is native plus USD when the oracle succeeds (`ETH 0.00762 ≈ $N`). USDT/NVDAc unchanged. `live:false` still `--`. No em dashes, no performance claim. Landing / RainbowKit / PauseBar / chips / chat / LLM mapper untouched. No slider POST. No KV. No cron. No Flash place/cancel. Caps still 15 / 10 / 30 / 15.
- Feed is the documented Chainlink Base ETH/USD **standard** proxy from `docs/oracles/base-price-feeds.html` (fetched 2026-09-16): blockchainName Base, name ETH / USD, product ETH/USD-RefPrice-DF-Base-001, path eth-usd-shared-svr-2, `secondaryProxyAddress` / ENS eth-usd `0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70`, heartbeat 1200s, 8 decimals, multiply 1e8. Not SVR `0x5001...a8b` / `0x5731...bd3` / `0xa425...6Ed`. `BASE.ethUsdFeed` sits next to `btcUsdFeed`. Same AggregatorV3Interface `latestRoundData` as cbBTC.
- ETH bounds 50-100_000 (documented, fail-closed). BTC `readSpotUsd` keeps SPOT_MIN=1000 / SPOT_MAX=1e6, which would reject a valid ETH print below $1k. Stale / non-positive answers fail closed. Heartbeat 2x 1200s (`ORACLE_MAX_AGE_S=2400`). Empty `config.baseRpcUrl` omits `ethUsd` / `ethUsdValue` and does not throw `/treasury`. Oracle errors omit USD fields and still return live Bankr eth/usdc. Logs status-only, treasury truncated.
- GET `/treasury`: keep `eth` native string; optional `ethUsd` (spot) and `ethUsdValue` (native * spot) as decimal strings when the oracle succeeds. Omit those fields when RPC missing, oracle stale/fail, or Bankr not live. No full treasury address in JSON.
- Tests 150. `test/b35.test.ts`: missing RPC omits USD fields; oracle failure keeps live eth/usdc; 0.01 ETH * 4000 = 40; standard proxy not SVR; caps 15/10/30/15. `pnpm test` + `pnpm typecheck` + `pnpm --dir web exec tsc --noEmit` pass. Started Bankr `pnpm agent` 8788 and `pnpm web` 5174 (were down). Runtime 5173/8787 left alone. No commit. No Vercel env edits.
- Browser `127.0.0.1:5174` `/app`: cyan card `0x4c9D...a6c2`, big **0.235011 USDC**, ETH `0.007624239970852408 ≈ $20` (spot `2623.15421656`, value `19.99955723`). USDT 2.116011 / NVDAc 0.06803417. Did not POST pay, sweep, LP, or Flash. No `--live`.
- Assumed: next Kenny push picks up already-present hosted `BASE_RPC_URL`; this slice did not add/edit Vercel env. Local `/status` missingLater is `XAI_API_KEY` only. One local `oracle_http` omit then recover (RPC flake, honest omit). Not verified: hosted `/treasury` ETH USD until that push. Treasury `0x4c9D...a6c2`. No secrets.

## B36 optional $ on deposit and pay

- Parser accepts optional `$` immediately before the amount. `DEPOSIT_RE` and `PAY_RE` now match `FROM_EXT_DEPOSIT_RE`'s `\$?`. Typed `deposit $5 usdc` / `deposit $5 USDC` / `deposit $5.50 USDC` are the same unsigned ERC-20 deposit as `deposit 5 USDC` (USDC 5e6 / 5.5e6). Typed `send $8 USDC to PAY_DEST_1` is the same pay-8 plan as `send 8 USDC to PAY_DEST_1`. `$` is notation only. Amounts, tokens, allowlist, and caps unchanged (buffer 15 / per-call 10 / daily 30 / hard stop 15). `send 50 USDC to PAY_DEST_1` still `per_call_cap`. Agent does not broadcast. Sign deposit still gated on founder-ok.
- Regex is the source of truth for this phrasing (B34 LLM mapper is fallback for other NL). Did not wrap POST `/agent/prompt`. Did not add a vendor. Optional: LLM system prompt canonical list now includes `deposit $N USDC` next to `deposit N USDC`. Mapper still cannot set `sent: true`.
- Tests 158. `test/b36.test.ts` plus `test/intent.test.ts`: `$5` deposit, plain `deposit 5 USDC`, `send $8` pay 8, `send 50` reject, caps 15/10/30/15, unsigned plan equality. `pnpm test` + `pnpm typecheck` + `pnpm --dir web exec tsc --noEmit` pass. Restarted Bankr `pnpm agent` on 8788. Reused Vite 5174. Runtime 5173/8787 left alone. No commit.
- Browser `127.0.0.1:5174` `/app`: typed composer `deposit $5 usdc` (not the chip). Agent reply `Unsigned ERC-20 transfer to the Bankr treasury. Sign from the external wallet. Agent does not broadcast.` plus `Connect the founder wallet.` (Sign deposit gated). Not `No matching intent.` Did not broadcast. Did not POST live pay/sweep/LP/Flash.
- Assumed: existing `send 50` dest form is the per-call reject (no-dest `send 50` still unknown, pre-existing PAY_RE). Not verified: founder-signed MetaMask deposit; live `send $8` pay. Treasury `0x4c9D...a6c2`. No secrets.

## B37 company treasury total USD + LP rows

- Cyan Company treasury card big figure is live total USD (label `USD`, not `USDC`). Sum of legs that succeed: free USDC + free USDT (1:1 cash dollars), ETH * Chainlink Base ETH/USD `0x7104...Bb70` (B35, 2400s), loose NVDAc * Chainlink Base Coinbase NVDA `0x04689a41629776563E6822F76f2e57D148d28513` from `docs/oracles/b20-tokenized-stocks.md` (8 decimals, 0.5% / 24h heartbeat, total-return; fail-closed at 2x 24h = 48h, not ETH 2400s; no Yahoo). sAMM USDC/USDT via `readSammLpValueUsdc` (`src/aerodrome/quote.ts`): pool `0x9650...07C1`, Router `quoteRemoveLiquidity`, quoted USDC+USDT at 1:1. Slipstream NVDAc via `src/aerodrome/slipstream.ts` (viem port of `vendor/aero-stock-lp/scripts/lib/positions.mjs` `readPosition`; not spawned .mjs): gauge `stakedValues(treasury)` at `BASE.nvdaGauge` `0x30d1...71A8` plus known B3 id `#6356494` in `src/demo/evidence.ts`; NPM `positions` + `decreaseLiquidity` eth_call from current holder (gauge if staked); `principalUsd` = principal0 USDC + principal1 NVDAc * pool sqrtPrice. ETH/USDT/NVDAc subline kept. `live:false` still `--`. Failed legs omitted, not invented. Caps 15 / 10 / 30 / 15.
- GET `/treasury` keeps existing fields. Adds `totalUsd`, `nvdacUsd` / `nvdacUsdValue`, `sammLpUsdc` / `sammLpUsdt`, `slipstream[]` (`tokenId`, `staked`, `usd`, amounts). Omit failed optional fields. No full treasury address. Logs status-only, truncated treasury. Missing `BASE_RPC_URL` skips chain quotes and still totals Bankr cash. Chain reads retry public Base RPCs on transport/rate-limit.
- Home Active positions keeps Cash USDC / Held USDT / Held NVDAc / Held ETH. Adds LP rows when live: `USDC/USDT sAMM` quoted pair, `NVDAc Slipstream` NFT # plus USD/NAV and staked. Flash orders stay on Limits & Orders. Landing / RainbowKit / PauseBar / chips / chat / LLM untouched except `TreasuryStatus` in `web/src/agent.ts`.
- Tests 166. `test/b37.test.ts`: totalUsd sum of mocked legs; missing oracle omits that leg; live:false omits totalUsd; Coinbase NVDA proxy not guessed; sAMM/slipstream rows when quotes succeed, omitted when zero/missing; caps 15/10/30/15. `pnpm test` + `pnpm typecheck` + `pnpm --dir web exec tsc --noEmit` pass. Restarted Bankr `pnpm agent` 8788. Reused Vite 5174. Runtime 5173/8787 left alone. No commit. No `--live`.
- Browser `127.0.0.1:5174` `/app`: cyan card `0x4c9D...a6c2`, big **53.9 USD**. ETH `0.007624239970852408 ≈ $20`, USDT 2.116011, NVDAc 0.06803417. Positions: Cash USDC 0.235011, Held USDT, Held NVDAc, Held ETH, LP `USDC/USDT sAMM` `2.972961 USDC + 3.391701 USDT ≈ $6.36`, LP `NVDAc Slipstream` `NFT #6356494 staked ≈ $10.06`. Did not POST pay, sweep, LP, or Flash.
- GET `/treasury` live shape (truncated): `live`, `eth`, `usdc`, `usdt`, `nvdac`, `tokenCount`, `treasuryDisplay` `0x4c9D...a6c2`, `ethUsd`, `ethUsdValue`, `nvdacUsd`, `nvdacUsdValue`, `sammLpUsdc`, `sammLpUsdt`, `slipstream` `[{tokenId,staked,amountUsdc,amountNvdac,usd}]`, `totalUsd`.
- Assumed: NVDA 48h max-age covers Saturday hold-last-close; 1:1 USDC/USDT as existing sweep/pay cash dollars; NVDA feed display-only. Not verified: hosted Vercel `/treasury`; a weekend NVDA print older than 48h. Treasury `0x4c9D...a6c2`. No secrets.

## B38 market buy cbBTC + order table labels

- Limits & Orders Flash table: Price -> `Limit $/cbBTC`, Qty -> `USDC spend`. One-line: B5 rungs fill only if spot drops to that limit. Buys more on dips. No performance claim. B5 ids `7863b457-c132-4f6d-bc01-0925dd32d6ee`, `afcc2cb5-e93b-4565-98be-6fe60bc8c744`, `296280cb-3ba3-466f-96e6-f0f018fea652` stay `ORDER_STATUS_ACCEPTED`. Those `$75080.80` / `$73548.53` / `$72016.27` cells are limit $/cbBTC, not USDC spend (qty 0.53164 each). They fill only if spot dumps to that limit. Demo path does not cancel or replace them (`isProtectedFlashOrderId`).
- Chat demo Flash is a Flash **market** buy of cbBTC on Base (target `BASE.cbBtc`, contra USDC `0x8335...2913`). `orderType: "market"`, `qty` = USDC spend, `maxSlippage: "0.05"`. No `limitNotionalPrice`. Same Kernel wrap quote/sign/submit as B5/B33 (`src/flash/demoOrder.ts`). Spend `min(free USDC, 1)` when free >= 0.10, else honest noop (no Flash POST, no invented funds). Hard stop 15, per-call 10, daily cap via spend log. Pause + spend probe + write key + founder sig unchanged. Plan-only without key: `sent:false`. Persist new id in gitignored `.data/flash-demo.json` (`rungPct` 0 / `limitPriceUsd` `market`).
- Chip `Buy cbBTC now` prompt `buy cbBTC`. Old `buy 1 USDC of cbBTC 0.01 percent below spot` still maps to the same market intent. LLM canonical `buy cbBTC`. Confirm: market buy, spend N USDC, 5% slippage, this is a market order, does not promise a fill. No em dash. No performance claim. Buys more on dips stays on B5 table copy only.
- Tests 176. `test/b38.test.ts`: 0 / <0.10 USDC noop no Flash POST; 0.235 sizes to 0.235 under hard stop 15; 2 USDC caps at 1; market quote shape; B5 ids protected; send 50 `per_call_cap`; caps 15/10/30/15. `pnpm test` + `pnpm typecheck` + `pnpm --dir web exec tsc --noEmit` pass. Restarted Bankr `pnpm agent` 8788. Reused Vite 5174. Runtime 5173/8787 left alone. No commit. No `--live`. No Flash POST `/order`.
- Browser `127.0.0.1:5174` `/app` vs 8788: Orders headers `Limit $/cbBTC` / `USDC spend`; B5 first row `$75080.80` / `0.53164` / ACCEPTED. Chip `Buy cbBTC now`. Click -> plan `buy cbBTC` / `Market buy cbBTC. Spend 0.235011 USDC. 5% slippage. This is a market order. Does not promise a fill. Confirm to place.` Modal same copy, caps 15 / 10 / 30. **Cancelled. Did not Confirm.** Agent log: portfolio USDC 0.235011, no `bankr_demo_flash`, no quote, no POST `/order`.
- Assumed: live free 0.235011 is enough to send without a deposit once Kenny confirms. Not verified: a live market fill after Confirm. Treasury `0x4c9D...a6c2`. No secrets.

## B39 USDC spend dollars not BTC dust

- Buy-the-dip `USDC spend` cells format `qtyUsdc` as USD spend so 0.53164 cannot be read as 0.5 BTC. Helper `web/src/formatUsdcSpend.ts`: finite number -> `$N.NN USDC` (`toFixed(2)`); empty/missing -> `--`; non-numeric stays raw. Same cell formatter for B5 rungs and a B38 market row. Flash qty strings, B5 ids, market-buy path, caps, chat submit, Landing, RainbowKit unchanged.
- `0.53164` renders `$0.53 USDC`. `0.235011` renders `$0.24 USDC`. Not BTC conversion.
- Tests 179. `test/b39.test.ts`: 0.53164 / 0.235011 / `--` / raw; App.tsx uses `formatUsdcSpend(order.qtyUsdc)`; B5 ids unchanged; caps 15/10/30/15. `pnpm test` + `pnpm --dir web exec tsc --noEmit` pass. Reused Vite 5174 and Bankr 8788. Runtime 5173/8787 left alone. No commit. No `--live`. No Flash POST `/order`.
- Browser `127.0.0.1:5174` `/app` Limits & Orders: headers `Limit $/cbBTC` / `USDC spend`; B5 rows `$75080.80` / `$0.53 USDC` / `ORDER_STATUS_ACCEPTED` (ids `7863b457-...`, `afcc2cb5-...`, `296280cb-...`). No raw `0.53164`. No market row (no `.data/flash-demo.json`). Did not Confirm Flash.
- Assumed: 2 fraction digits is enough for Kenny's 53 cents read. Not verified: a live market-row cell after Confirm. Treasury `0x4c9D...a6c2`. No secrets.

## B40 drop ETH/USDT/NVDAc from cyan card

- Cyan Company treasury card keeps tag, title, truncated addr, and the big live `totalUsd` figure with label `USD`. Removed the `.wallet-bals.treasury-held` row (`ETH … ≈ $N`, USDT, NVDAc) because Active positions already lists Held ETH / USDT / NVDAc. Deleted unused `liveEthLine` and `.wallet .treasury-held` CSS. Positions table rows unchanged. Same always-visible wallets row on Limits & Orders. Landing / RainbowKit / chat / agent GET `/treasury` fields unchanged. Caps 15 / 10 / 30 / 15.
- Tests 181. `test/b40.test.ts` plus `test/b35.test.ts` source guard: App.tsx has `liveTotalUsd` + `<small>USD</small>`, no `liveEthLine` / `treasury-held`; Held ETH / USDT / NVDAc still in the table. `pnpm test` + `pnpm --dir web exec tsc --noEmit` pass. Reused Vite 5174 and Bankr 8788. Runtime 5173/8787 left alone. No commit. No `--live`. No Flash place/cancel. No vercel.json.
- Browser `127.0.0.1:5174` `/app` Home: cyan card `Company treasury` / TreasureFlow / `0x4c9D...a6c2` / **53.95 USD** only. No ETH/USDT/NVDAc subline. Positions: Cash USDC 0.235011, Held USDT 2.116011, Held NVDAc 0.06803417, Held ETH 0.007624239970852408, LP sAMM, LP Slipstream NFT #6356494. Limits & Orders: same cyan card (tag + title + addr + 53.95 USD), sliders 15 / 10 / 30.
- Assumed: wallets row is shared, so one DOM change covers both views. Not verified: hosted Vercel `/app`. Treasury `0x4c9D...a6c2`. No secrets.

## Docs: README matches B40

- Rewrote `README.md` to the live B40 app: cyan card total USD, Active positions (cash + LPs), RainbowKit, Home / Limits & Orders, chips including Buy cbBTC now, chat Confirm (write key + founder sig) for pay / unwind / sweep / LP / market Flash, Bankr LLM mapper, optional `$` deposit, Flash table Limit $/cbBTC vs `$0.53 USDC` spend, B5 ids protected, hosted SHA `0933378`, two-service Vite + Hono, honest not-yet (fills unverified, market not Confirmed, thin USDC). Replaced stale B17 copy (dry sweep/LP/Flash, Send 50 chip, Lend disabled, SHA `12bec50` / `23716fa`).
- `HANDOFF-BANKR.md` shortened to the same product truth and docs map. Did not rewrite vendor `docs/*-readme.md`, `PRD.md`, `BUILD-PLAN.md`, reviews, or product code. `HANDOFF.md` / `PUNCH-LIST.md` banners still point at README. No em dashes. Caps 15 / 10 / 30 / 15. Treasury truncated `0x4c9D...a6c2`. No secrets.

## B41 approved wallets page + Lend & Borrow cue

- Nav: Home, Limits & Orders, **Approved wallets**, then disabled **Lend & Borrow** (`title="Coming later"`, existing grey `button:disabled`). Lend does not set a view and has no page. Caps unchanged. Chat / Flash / RainbowKit / vercel.json untouched.
- Approved wallets page (`#allowlist`) lists the two `GET /status` `payDestDisplays` (truncated `PAY_DEST_1` / `PAY_DEST_2`). Copy: The agent can only send to these wallets. Founder dest is labeled Founder when it matches `founderDisplay`. Full dests stay off `/status`. Wallets row (treasury + external) stays visible.
- Tests 184. `test/b41.test.ts` source + truncated dests + caps 15/10/30/15. Browser `127.0.0.1:5174` `/app`: nav Home / Limits & Orders / Approved wallets / grey **Lend & Borrow** (disabled, click refused). Approved wallets: Founder `0xD428...6d2A`, Wallet 2 `0x4D43...432f`, copy The agent can only send to these wallets. Limits sliders 15/10/30 still work. No `--live`. No Flash place/cancel. Treasury `0x4c9D...a6c2`. No secrets.

## Header logo to landing

- dApp and landing header logos are links to `https://treasureflow.vercel.app/`. In-app click uses `pushState("/")` so `/app` returns to the landing without a full reload. Caps unchanged.

## Receipt notes without milestone codes

- Receipts table notes for pay and Flash approve no longer say B2 / B5. Pay 8 USDC note is `To an approved wallet`. Flash USDC approve note is `Lets Flash spend USDC for cbBTC`. Other rows unchanged. Caps 15 / 10 / 30 / 15.

## B42 wallet 1 / wallet 2 pay names

- Approved wallets labels are always Wallet 1 / Wallet 2 (no Founder). Parser accepts `send $10 USDC to wallet 1` (PAY_DEST_1, 10 USDC, at per-call cap) and `send $50 USDC to wallet 2` (PAY_DEST_2, rejected `per_call_cap`). PAY_DEST_* still works. Chips: Send 10 / Send 50. LLM canonical lists those two lines. Caps 15 / 10 / 30 / 15.

## B43 buy-the-dip limit from chat

- Chip **Buy the dip** / prompt `buy the dip` (also `buy dip`). POST `/chat` plan is a Flash **limit** buy of cbBTC, **0.001%** below Chainlink spot, spend `min(free USDC, 1)` if free >= 0.10 else noop. Funder is Bankr treasury `0x4c9D...a6c2` (not the founder RainbowKit wallet). Confirm is write key + founder sig. Does not cancel B5 ids. **Buy cbBTC now** stays market. Typed `limits` stays dry. Caps 15 / 10 / 30 / 15.
- Tests 196. `test/b43.test.ts`: parse dip vs market, 0.001% limit quote, 0 / <0.10 noop, $1 when free >= 1, B5 ids protected, chip + LLM. `pnpm test` + `pnpm --dir web exec tsc --noEmit` pass. Browser `/app`: chip opened Confirm (spend 0.235011, 0.001% below, no fill promise). **Cancel**. Did not Confirm. No `--live`. No Flash POST `/order`. Treasury `0x4c9D...a6c2`. No secrets.

## B44 chips stay inside the chat card

- Quick-action chips wrap inside `.chip-block` only (`min-width: 0`, `max-width: 100%`, `overflow: hidden`). They no longer spill past the Ask TreasureFlow panel edge. Labels unchanged. Caps 15 / 10 / 30 / 15.

## B45 chip-block box

- `.chip-block` is a visible box under the composer (8px padding, 1px line, 12px radius). Chips wrap inside that box only. Caps 15 / 10 / 30 / 15.

## B46 increase existing Slipstream NFT

- Chat `lp stocks` Confirm adds $10 to live NVDAc NFT `#6356494` via `increaseLiquidity` (same token id, no unstake). Mint only if no live NVDAc NFT. Copy says add to NFT, not mint. Caps 15 / 10 / 30 / 15.
- Tests 202. `test/b44.test.ts` + `test/lp.test.ts`. Vendor selftest 37 including increase 6-word vector. `pnpm test` + `pnpm --dir web exec tsc --noEmit` pass. No `--live`. No Confirm. Treasury `0x4c9D...a6c2`. No secrets.

## Docs: judge README + Vercel click path

- Rewrote `README.md` for GitHub / Runtime judges: live Vercel is read-mostly, can vs cannot, chip table with amounts, repo map, truncated wallets, BaseScan proof, message Kenny (`kenjohnscreates`) for write access. No keys. Caps 15 / 10 / 30 / 15.
- Landing: judge note under Enter app plus FAQ "I'm a Runtime judge. What can I click?". `HANDOFF-BANKR.md` points at README. Historical banners on `PRD.md`, `BUILD-PLAN.md`, `docs/INDEX.md`.
- Assumed: judges land on treasureflow.vercel.app first. Not verified: a judge GitHub account without repo access. Treasury `0x4c9D...a6c2`. No secrets.

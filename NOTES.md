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

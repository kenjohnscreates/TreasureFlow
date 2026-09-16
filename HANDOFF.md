# TreasureFlow orchestrator handoff

Date: 2026-09-16. Runtime NYC. Demo Sat Sep 19 ~4-5pm EDT.
Repo: https://github.com/kenjohnscreates/TreasureFlow (private, `main` at `2ccddcd`).
Workspace: `/Users/home/Code/Runtime`
You are the master orchestrator (Grok 4.6 High). Kenny is the human.

## Do this first

1. Read `PRD.md`, `BUILD-PLAN.md`, `PUNCH-LIST.md`, `NOTES.md`, this file.
2. Read the latest product plan: Cursor plan `dapp_deposit_and_chat` (dApp deposit + chat). Older plan `treasureflow_kickoff` is the original M0-M6 process; product shape has moved.
3. `git status`. There is **uncommitted work after M0**. Do not discard it.
4. Never print or commit `.env`. Never paste secrets in chat.

## One-liner now

Founder connects one external rewards wallet (manual signatures only) and deposits USDC / NVDAc into a Dynamic **server** treasury wallet. In-app chat tells the agent to sweep idle USDC into Aerodrome sAMM USDC/USDT, optionally LP NVDAc/USDC on Slipstream from the treasury, pay allowlisted dests, and place Flash cbBTC limit buys. Lend/borrow is a mock panel. No token launch. No Uniswap chase. No Bankr-wallet writes.

## Locked product calls (Kenny)

- External wallet: Kenny's own. Agent **cannot** spend it. UI shows it as secondary. He will sign inbound deposits and will attempt a **real** USDC and tokenized-equity transfer.
- Treasury: Dynamic **server** wallet (not a multi-user embedded fleet this week).
- Nightly sweep: **only** sAMM USDC/USDT. Do **not** sweep idle USDC into stock pools.
- Stock LP: explicit chat (`lp stocks` / `lp NVDAc`) after both legs sit in treasury. Slipstream, signed by Dynamic, not Bankr.
- Geo: ignore product gates in code; Kenny will VPN. Document countries in `docs/geo.md` (not written yet). Recommend VPN exit **UK or NL**. Coinbase B20 stocks: US persons out (Reg S). OFAC blocked. Coinbase has no public full country list. Onchain secondary transfer is largely permissionless except sanctioned addresses; frontends geo-block US.
- Spoken demo numbers (2400 / 50000) vs live caps: buffer 15, per-call 10, daily 30, pay 8, reject 50, hard stop 15 USDC/tx until recorded demo. ~$100 total: ~$5 ETH, ~$55 USDC, ~$40 USDT.
- Bankr Club NFT is **not** Club. Do not live-write via Bankr. Stretch/stock LP via Dynamic or show encoded tx if mint reverts.
- Daily cap: orchestrator rolling 24h. Dynamic has `maxPerCall` and cumulative `totalLimit`, not a daily window.

## Process (BUILD-PLAN.md)

- One milestone, one commit (`M<n>: ...`), one push. Reviewer file `reviews/M<n>.md` APPROVE before commit. Builder and reviewer different vendors (Opus preferred; other-models quota failed once, Grok self-reviewed M0 as an exception).
- Stop triggers write `STOP.md` and wait. No guessing. No mainnet above hard stop. No new deps/chains/pools without Kenny.
- Language: fee yield only, no forward APY, no em dashes in first-party UI/copy.
- Subagents do not talk to mainnet unless the milestone says so.

## What is shipped

**On `main` (M0):** pnpm TS, ESLint, Prettier, Vitest, `docs/` ingestion, empty-then-offline core: config, cap math, `parseIntent` pay-only, `planSweep` / `planPay`, Flash ladder sizing, dry-run `pnpm demo` / `pnpm sweep`. Live adapters throw `*_unwired`. Tests were 13 at commit; local now 18 if uncommitted tests are present.

**Local, not committed:**

- `.env` exists (gitignored). Fill status unknown; `pnpm env:check` lists NEED NOW.
- `.env.example` updated with NEED NOW vs LATER.
- `src/chat/cli.ts`, `src/sweep/cron.ts`, `src/aerodrome/encode.ts`, `src/flash/types.ts` + `http.ts`, `src/config/status.ts`, tests `test/encode.test.ts` `test/cron-flash.test.ts`.
- `mockups/` HTML (index, operator, statement, terminal). Visual reference only; product UI plan is Vite+React `web/`, not these files unless they are clearly better. Inspect before discarding.
- Commands: `pnpm env:check`, `pnpm pay -- "send 8 USDC to 0x..."`, `pnpm demo`, `pnpm test`.

## Not done

- `docs/geo.md`
- M1 Dynamic wallet create + policy (blocked on `.env` NEED NOW: `DYNAMIC_ENVIRONMENT_ID`, `DYNAMIC_API_TOKEN`, `BASE_RPC_URL`, `BASE_SEPOLIA_RPC_URL`, `PAY_DEST_1`, `PAY_DEST_2`)
- Web dApp: Dynamic connect + two-wallet panel + chat
- Deposit intent (unsigned ERC-20 transfer for **user** wallet to sign)
- M2 stable LP probe, M2b Slipstream NVDAc, M3-M5 sweep/pay/Flash live, M6 recorded demo
- Mock lend panel

## Addresses (Base)

- USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- USDT `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2`
- Aerodrome Router `0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43`
- NVDAc `0xb20000000000000000000078ee7ce2fE4908108C`
- cbBTC `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf`
- BTC/USD feed in `src/config/constants.ts` is **assumed**; confirm before M5

## Next execution order

1. Commit uncommitted offline CLI/encode/cron **or** fold into next milestone; do not lose it.
2. `docs/geo.md` + README link.
3. If `.env` NEED NOW is filled: M1 wallet + policy (allowlist must include NVDAc + Slipstream NPM + stable path).
4. `web/`: Vite React, Dynamic connect external, show treasury vs secondary, chat to local agent HTTP.
5. Intents: deposit, sweep, lp stocks, send USDC, limits.
6. Probes: stable add/remove first; Slipstream second (VPN). STOP on M2 fail.
7. Mock lend. Record demo.

## Out of scope

Uniswap $1k track, Bankr writes, token launch, live Morpho/lend, agent control of external wallet, multi-company accounts.

## Prior chat

Parent conversation built M0, created the GitHub repo, then product-pivoted from CLI-only treasury sweeper to the two-wallet dApp. Kenny confirmed inbound user signatures and real equity transfer attempt.

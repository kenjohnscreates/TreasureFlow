# TreasureFlow Bankr handoff

**Judges and GitHub visitors: read [README.md](README.md).** That is the product page, the live Vercel click path, and the onchain proof table.

This file is a short builder note for the Bankr branch. Do not treat it as the judge brief.

Workspace: `/Users/home/Code/TreasureFlow-bankr` on `backup/bankr-treasury`. Production [treasureflow.vercel.app](https://treasureflow.vercel.app/) tracks GitHub `main`. Do not git commit, checkout, reset, clean, or pull unless Kenny asks. Do not touch `/Users/home/Code/Runtime`. Never create Dynamic wallets. Never print or commit `.env`. Truncate treasury `0x4c9D...a6c2`, founder / Wallet 1 `0xD428...6d2A`, Wallet 2 `0x4D43...432f`. Fee yield only. No APY. No Uniswap, token launch, or live Morpho. No Next.js / AMPLE / KV. Host stays two-service Vite + Hono.

## Current product

Idle cash sits in a Bankr treasury. Founder deposits (unsigned ERC-20, founder signs in MetaMask). Agent never spends the founder wallet. After Confirm (**Write key** only, header `x-treasureflow-key`) the agent can pay allowlisted wallets, unwind sAMM then pay, sweep extra cash into Aerodrome USDC/USDT LP, `increaseLiquidity` on Slipstream `#6356494` (mint only if no live NVDAc NFT), rest Flash cbBTC dip limits, and place a small market buy of cbBTC from free USDC. See [README.md](README.md) for judge copy.

**B49:** `chatLiveOpts` / `executeLp` retry public Base RPCs for NVDAc Slipstream discovery; RPC total failure falls back to demo NFT `#6356494` so `lp stocks` plans increase, not mint, when `/treasury` already shows that NFT.

Caps 15 / 10 / 30 / 15. RainbowKit Connect. Bankr LLM Gateway maps unknown NL (cannot set `sent: true`). Chat chips: Deposit 20 USDC, Send $10, Send $50, Buy the dip $1, LP stocks $10, Sweep extra cash, Buy $1 cbBTC now.

Hosted Confirm is blocked without the Write key. Judges on Vercel get plans, live reads, and the Send $50 cap reject. Message Kenny ([@kenjohnscreates](https://github.com/kenjohnscreates)) for access. Never hand out `CHAT_KEY`, `BANKR_API_KEY`, or `FOUNDER_ADDRESS`.

Onchain proof (full hashes + BaseScan links): README.

## Local run

`pnpm agent` (`http://127.0.0.1:8788`). `pnpm web` (`http://127.0.0.1:5174`). Landing `/`, dApp `/app`. CLIs: `pnpm bankr:me`, `bankr:pay -- --live`, `bankr:lp -- --live`, `bankr:sweep -- --live`, `bankr:limits -- --live`. Do not `--live` unless Kenny asked. Do not use Runtime ports 5173/8787.

## Docs map

- Live product / judges: `README.md`
- This Bankr handoff: `HANDOFF-BANKR.md`
- Old Dynamic-tree handoff (historical): `HANDOFF.md`
- Old Dynamic-era checklist (historical): `PUNCH-LIST.md`
- Process / intent (do not treat as live UI): `BUILD-PLAN.md`, `PRD.md`
- Running notes: `NOTES.md`

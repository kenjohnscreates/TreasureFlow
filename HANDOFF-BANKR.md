# TreasureFlow Bankr handoff

**Read [README.md](README.md) first.** That is the GitHub-facing product page. This file is a short builder note.

Workspace: `/Users/home/Code/TreasureFlow-bankr` on `backup/bankr-treasury` @ `0933378` (B40). Do not git commit, checkout, reset, clean, or pull unless Kenny asks. Do not touch `/Users/home/Code/Runtime`. Never create Dynamic wallets. Never print or commit `.env`. Truncate treasury `0x4c9D...a6c2`, founder / `PAY_DEST_1` `0xD428...6d2A`, `PAY_DEST_2` `0x4D43...432f`. Fee yield only. No APY. No Uniswap, token launch, or live Morpho. No Next.js / AMPLE / KV. Host stays two-service Vite + Hono.

## Current product (plain English)

Idle cash sits in a Bankr treasury. Founder deposits (unsigned ERC-20, founder signs). Agent never spends the founder wallet. Agent can pay allowlisted people, unwind sAMM then pay, sweep extra cash into Aerodrome USDC/USDT LP, LP NVDAc on Slipstream, rest Flash cbBTC dip limits, and Confirm a market buy of cbBTC from free USDC.

Live app: https://treasureflow.vercel.app/ and https://treasureflow.vercel.app/app. Hosted SHA `0933378` (B40). Cyan card is total USD only. Positions table holds USDC / USDT / NVDAc / ETH / sAMM / Slipstream `#6356494`. Connect is RainbowKit. Bankr LLM Gateway maps unknown NL. Caps 15 / 10 / 30 / 15.

## Chat vs CLI

- **Live from `POST /chat` after Confirm** (write key `x-treasureflow-key` + founder `personal_sign` of `GET /auth/challenge`): pay, unwind-then-pay, sweep, LP stocks, market buy cbBTC (`min(free USDC, 1)` if free >= 0.10).
- **Always unsigned:** deposit, including `deposit $5 usdc`. Agent does not broadcast.
- **Send 50:** reject, per-call cap 10. Does not call Bankr.
- **B5 Flash ids:** do not cancel. Table columns are Limit $/cbBTC and USDC spend (`$0.53 USDC`). Fills unverified.
- **Limits sliders:** local React only. Do not persist. Do not POST.
- **Lend:** gone.
- **Pause:** stops outbound. Same write key.
- **Bankr server auth:** `X-API-Key`. Never log keys. Never put `CHAT_KEY` in `VITE_*`.

Onchain proof (full hashes + BaseScan links): README.

## Local run

`pnpm agent` (`http://127.0.0.1:8788`). `pnpm web` (`http://127.0.0.1:5174`). Landing `/`, dApp `/app`. CLIs: `pnpm bankr:me`, `bankr:pay -- --live`, `bankr:lp -- --live`, `bankr:sweep -- --live`, `bankr:limits -- --live`. Do not use Runtime ports 5173/8787.

## Docs map

- Live product: `README.md`
- This Bankr handoff: `HANDOFF-BANKR.md`
- Old Dynamic-tree handoff (historical): `HANDOFF.md`
- Old Dynamic-era checklist (historical): `PUNCH-LIST.md`
- Process / intent (do not treat as live UI): `BUILD-PLAN.md`, `PRD.md`
- Running notes: `NOTES.md` (B40 is the last product slice; docs rewrite follows)

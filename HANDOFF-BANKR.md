# TreasureFlow Bankr handoff

**Read [README.md](README.md) first.** That is the GitHub-facing product page. This file is a short builder note. The old B12 / dry-chat / do-not-merge paste below is gone because it was stale.

Workspace: `/Users/home/Code/TreasureFlow-bankr` on `backup/bankr-treasury` @ `23716fa`. Do not git commit, checkout, reset, clean, or pull unless Kenny asks. Do not touch `/Users/home/Code/Runtime`. Never create Dynamic wallets. Never print or commit `.env`. Truncate treasury `0x4c9D...a6c2`. Fee yield only. No APY. No Uniswap, token launch, or live Morpho.

## Current product (plain English)

Idle USDC sits in a Bankr treasury. Founder deposits. Agent never spends the founder wallet. Agent can pay allowlisted people, sweep extra cash into Aerodrome USDC/USDT LP for fee yield, LP NVDAc on Slipstream, and rest Flash cbBTC dip limits.

Live app: https://treasureflow.vercel.app/ and https://treasureflow.vercel.app/app.

Hosted alias last checked as SHA `12bec50` (B15 host). B16 Hobby-safe Hono is this git SHA `23716fa`. Vercel git deploys of `23716fa` failed TypeScript. Do not say the live site is B16. Do not invent a host stack.

## Chat vs CLI

- **Live from `POST /chat`:** allowlisted pay (B13) and unwind-then-pay (B14) via `maybeSubmitChatPay`.
- **Dry from chat:** sweep, LP stocks, new Flash orders. Live hashes for those exist from CLI `--live`.
- **Send 50:** reject, per-call cap 10. Does not call Bankr.
- **Limits sliders:** local React only. Do not persist. Do not POST.
- **Lend:** disabled.
- **Hosted write gate:** `CHAT_KEY` header `x-treasureflow-key` (dApp Write key). Never put `CHAT_KEY` in `VITE_*`. Never document a real key.
- **Bankr server auth:** `X-API-Key`. Never log keys.

Caps: buffer 15, per-call 10, daily 30, demo pay 8, reject 50, hard stop 15 USDC per mainnet tx, demo sweep 5.

Onchain proof (full hashes + BaseScan links): README. Flash fills unverified.

## Local run

`pnpm agent` (8788). `pnpm web` (Vite `127.0.0.1:5174`). Landing `/`, dApp `/app`. CLIs: `pnpm bankr:me`, `bankr:pay -- --live`, `bankr:lp -- --live`, `bankr:sweep -- --live`, `bankr:limits -- --live`. Do not use Runtime ports 5173/8787.

## Docs map

- Live product: `README.md`
- This Bankr handoff: `HANDOFF-BANKR.md`
- Old Dynamic-tree handoff (historical): `HANDOFF.md`
- Old Dynamic-era checklist (historical): `PUNCH-LIST.md`
- Process / intent (do not treat as live UI): `BUILD-PLAN.md`, `PRD.md`
- Running notes: `NOTES.md` (B17 is the docs rewrite)

B17 is docs only. No product-code edits. No commit from this slice.

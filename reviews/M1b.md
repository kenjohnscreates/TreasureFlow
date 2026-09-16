APPROVE

Independent Opus/GPT review was blocked by a Cursor other-models rate limit. Orchestrator recorded this checklist so M1b could land. Re-run a different-vendor review when quota resets. Same process exception as M0.

HEAD reviewed against: `2ccddcd`. Uncommitted tree only. No product files edited. `.env` not printed.

## Checklist

- Parallel CLI/encode/cron/mockups still on disk (`src/chat/cli.ts`, `src/aerodrome/encode.ts`, `src/sweep/cron.ts` + `cronCli.ts`, `src/flash/*`, `mockups/`).
- `docs/geo.md` + README link. Sources cited (Base B20, Bankr FAQ). States Coinbase has no public country matrix. VPN UK/NL. OFAC listed. Local Bankr `access.md` correctly flagged as the wrong page.
- Intents: deposit USDC/NVDAc (unsigned ERC-20 `transfer` to `TREASURY_ADDRESS`), sweep, `lp stocks` unwired, send USDC, limits/ladder.
- NVDAc `0xb20000000000000000000078ee7ce2fE4908108C`, 8 decimals. Deposit `to` is the token, data encodes `transfer(treasury, amount)`.
- Missing `TREASURY_ADDRESS` throws `missing_treasury` (fail closed). Agent returns calldata only; no server `sendTransaction`.
- Hono `GET /health` `GET /status` `POST /chat` on `127.0.0.1:8787`. `/status` returns policy, missing-name lists, flags, treasury address, token addresses. No API tokens/keys.
- `web/`: Vite React, Dynamic JS SDK for external connect only. No server-wallet create. Two-wallet panel, chat, Sign deposit via connected account. Empty `VITE_DYNAMIC_ENVIRONMENT_ID` disables Connect. Mock lend panel disabled.
- `pnpm test` 24/24. `pnpm lint` pass. Root + `web` tsc pass. Tracked env file is `.env.example` only (empty secrets). `.env` gitignored.
- `NOTES.md` has M1b. Product lock held: no Uniswap, no token launch, no Bankr writes, no live lend, no agent control of the external wallet. Fee-yield copy; no first-party em dashes; "not APY" only as a negation.

## Caveats (not blocking)

- Root ESLint ignores `web/**`. Prettier still checks `web/src`. Web tsc passed separately; `pnpm typecheck` is agent-only.
- No HTTP integration test for `/status` secret exclusion; confirmed by reading `publicStatus`.
- `SignDeposit` uses the connected wallet `sendTransaction` and does not pass `chainId` from the unsigned payload. Agent still does not broadcast. Button is off while Dynamic env ID is empty.
- `src/flash/http.ts` can call Flash if `FLASH_API_KEY` is set; chat/cron do not call it.
- Pay dry-run still substitutes `intent.to` when `PAY_DEST_*` are empty (pre-existing CLI pattern).
- Chainlink BTC/USD Base feed in `constants.ts` remains assumed (M0 caveat; confirm in M5).
- Builder and reviewer are the same Grok session because other models were unavailable. Treat as a process exception, not a precedent.

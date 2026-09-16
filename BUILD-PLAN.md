# Treasury Sweeper: Build Plan v1

Companion to `treasury-sweeper-prd-v1.md`. Written 2026-09-16. The PRD says what; this file says who builds it, in what order, and when to stop.

## 1. Agent topology

| Role | Model | Job |
|---|---|---|
| Orchestrator | Grok 4.6 High (default) | Owns the milestone list, assigns subagents, collects reviewer verdicts, commits and pushes to `main` only after a written approval. Stops on any trigger in section 4. |
| Reviewer | Claude Opus (different vendor from the builder on purpose) | Reads every diff before commit. Checks correctness against the PRD, readability for a human dev, Prettier and lint clean, no secrets, no scope creep, language rules. Writes `reviews/M<n>.md` with APPROVE or CHANGES and the reasons. Never edits code. |
| Subagents | Assigned per task, table in section 2 | Build one milestone task each. Return code plus a short `NOTES.md` entry: what was built, what was assumed, what was not verified. |

Rules that do not bend:
- Reviewer approval is a file in the repo, not a chat message. No file, no commit.
- One milestone, one commit, one push. Never batch milestones. Never squash across milestones.
- Builder and reviewer are never the same model for the same milestone.
- Subagents do not talk to the wallet on mainnet unless the milestone says so and the test cap is set.
- When unsure which model to use, use the strongest available.

## 2. Subagent LLM assignment

| Task type | Model | Why |
|---|---|---|
| Wallet, policy, signing, anything that moves value | Claude Opus | Highest cost of error; strongest model on the roster for correctness |
| Contract calldata (Aerodrome Router, Permit2, Flash actions) | Claude Opus or Grok 4.6 High | Needs careful ABI work; either is fine, Opus if a probe already failed once |
| Orchestrator logic, cron, cap and buffer math | Grok 4.6 High | Default |
| Flash REST and WebSocket client | Grok 4.6 High | Default; docs are LLM-optimized |
| Chat intent parser (prompt to typed action) | Grok 4.6 High | Default |
| Demo runner, CLI, logging, README | GPT-5 or Claude Sonnet | Lower risk, faster |
| Docs ingestion (Milestone 0) | Claude Sonnet or Haiku | Fetch, save, index; no judgment needed |
| Tests | Same model as the builder of that module, different session | Keeps the tests honest to the module's assumptions |

## 3. Milestones

Each milestone has a definition of done, a reviewer checklist, and one commit. Commit message format: `M<n>: <one line>`. The orchestrator pushes only after `reviews/M<n>.md` says APPROVE.

**M0. Repo scaffold and docs ingestion.** Create repo, `pnpm` TypeScript project, Prettier, ESLint, `.env.example`, `docs/` folder populated from the manifest in section 5, `docs/INDEX.md` linking every file with the source URL and fetch date. No product code.
DoD: every manifest URL fetched and saved as `.md` or `.json`; INDEX lists all of them; `pnpm lint` passes on an empty `src/`.

**M1. Dynamic wallet and policy.** Create the server wallet on Base, persist wallet metadata, set the policy: allowlist plus `valueLimit.maxPerCall` on USDC. Prove a transfer over the cap is rejected pre-sign on Base Sepolia.
DoD: two tx hashes (one allowed, one rejected with the policy reason) in `NOTES.md`. Probe 4 result recorded.

**M2. Aerodrome stable LP adapter.** `addLiquidity`, `removeLiquidity`, `quoteAddLiquidity`, `quoteRemoveLiquidity`, LP balance read, all from the Dynamic wallet client. This is probe 1. Mainnet, tiny amounts, test cap set.
DoD: four hashes on BaseScan; partial removal returns expected USDC within slippage. If this fails, orchestrator STOPS (section 4).

**M3. Nightly sweep job.** Buffer math, minimum sweep size, cron, structured log, dry-run flag.
DoD: dry run prints the plan; live run on tiny balance produces one `addLiquidity` hash.

**M4. Prompt-to-pay and chat.** Intent parser, allowlist and cap check in the orchestrator, shortfall unwind, USDC transfer, reply with hashes. Includes the rejection path.
DoD: the three demo prompts from PRD section 8 run end to end on tiny amounts.

**M5. Flash limit ladder and oracle.** Chainlink BTC/USD read on Base, three limit buys for cbBTC via `/v1/quote` and `/v1/order` signed by the Dynamic wallet, cancel-before-replace, GET order, WebSocket orders stream. Probe 3 result recorded.
DoD: three resting orders visible via GET and on the stream; cancel works.

**M6. Demo runner and narrated stretch.** One command runs PRD section 8 in order with pauses. Narrated stretch screen with aero-stock-lp read-only status if probe 2 passed. README with setup steps.
DoD: full 5-minute run recorded once without manual intervention.

**M7. Stretch (only if Kenny says yes and M0 to M6 are approved).** aero-stock-lp via Bankr Agent API with the custody caveat printed in the UI.

Reviewer checklist, every milestone: matches the PRD section it implements; no banned words in UI copy or comments; no em dashes; Prettier and ESLint clean; functions under 40 lines where practical; every external call wrapped with a typed error; no secrets in the diff; `NOTES.md` updated; tests present for cap and buffer math.

## 4. Stop triggers

The orchestrator stops all work, writes `STOP.md` with the situation and the options, and waits for Kenny when any of these occur:
1. A probe fails (M1 rejection does not fire, M2 add or remove fails, M5 order rejected for a policy or geo reason).
2. Any action would move more than the test cap on mainnet, or touch an address not on the allowlist.
3. A vendor doc contradicts the PRD (a missing endpoint, a changed signature, a gate that was not in the constraints list).
4. A subagent proposes a scope change, a new dependency not in the manifest, or a different chain, pool, or token.
5. The reviewer returns CHANGES twice on the same milestone.
6. The estimated remaining work does not fit before Saturday 2 PM EDT with M0 to M4 complete.
7. Anything involving the custody split in the stretch tier.
8. Any uncertainty the orchestrator would otherwise resolve by guessing.

Stopping is not failure. Guessing is.

## 5. Docs manifest (fetch into `docs/` in M0)

**Dynamic**
- https://www.dynamic.xyz/docs/llms.txt (full index; save, then fetch the pages below)
- https://www.dynamic.xyz/docs/node/wallets/server-wallets/overview.md
- https://www.dynamic.xyz/docs/node/wallets/server-wallets/viem-wallet-client.md
- https://www.dynamic.xyz/docs/overview/wallets/embedded-wallets/mpc/policies/overview
- https://www.dynamic.xyz/docs/overview/wallets/embedded-wallets/mpc/policies/policy-layers
- https://www.dynamic.xyz/docs/overview/wallets/embedded-wallets/mpc/policies/creating-rules
- https://www.dynamic.xyz/docs/overview/wallets/embedded-wallets/mpc/policies/managing-layers
- https://www.dynamic.xyz/docs/overview/agents/agent-payments.md
- https://www.dynamic.xyz/docs/recipes/integrations/x402/implementation.md
- https://github.com/dynamic-labs-oss/dynamic-agent-payments (CLI and MCP server; clone README only)

**Flash (Definitive)**
- https://flash.definitive.fi/docs/llms.txt (index; fetch every linked page)
- https://flash.definitive.fi/v1/openapi.json
- https://flash.definitive.fi/docs/evm-overview.md
- https://flash.definitive.fi/docs/limit-order.md
- https://flash.definitive.fi/docs/minimal-authorization.md
- https://flash.definitive.fi/docs/for-agents.md
- https://flash.definitive.fi/docs/flash-mcp.md (MCP server: `@definitive-fi/flash-mcp`)
- https://flash.definitive.fi/docs/api-reference/flash/websocket.md

**Bankr**
- https://docs.bankr.bot/agent-api/overview/
- https://docs.bankr.bot/wallet-api (sign and submit; allowedRecipients)
- https://docs.bankr.bot/x402-cloud/overview/ (out of scope, reference only)
- https://github.com/BankrBot/skills (aero-stock-lp lives here; save its SKILL.md and references)
- https://atskills.one/bankrbot/aero-stock-lp (skill summary)
- https://github.com/BankrBot/claude-plugins (bankr-agent, bankr-agent-dev plugins with MCP server)
- https://github.com/BankrBot/bankr-api-examples

**Aerodrome**
- https://github.com/aerodrome-finance/contracts/blob/main/contracts/Router.sol
- https://github.com/aerodrome-finance/contracts/blob/main/SPECIFICATION.md
- https://github.com/aerodrome-finance/docs/blob/main/content/liquidity.mdx
- https://basescan.org/address/0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43 (Router, verified ABI)
- https://docs.base.org/agents/plugins/native/aerodrome.md (sugar-sdk calldata pattern)
- https://github.com/velodrome-finance/sugar-sdk

**Oracles and tokenized stocks**
- https://docs.chain.link/data-feeds/tokenized-equity-feeds/coinbase
- https://docs.chain.link/data-feeds/tokenized-equity-feeds/robinhood
- https://docs.base.org/base-chain/specs/reference/b20/tokenized-stocks-on-base
- Chainlink Base price feed address list for BTC/USD (fetch from docs.chain.link price feeds page for Base)

**Base MCP and agent tooling**
- https://docs.base.org/agents/plugins/native/index (Base MCP plugins incl. Aerodrome, Bankr)
- https://docs.base.org/ai-agents/core-concepts/agent-frameworks
- https://github.com/base/skills

**Hackathon and RFS**
- http://runtime.nyc
- https://runtime.bankr.bot/ (Luma page: tracks, sponsors, contact)
- https://www.ycombinator.com/blog/build-onchain
- https://blog.base.org/y-combinator-request-for-onchain-startups
- https://x.com/igoryuzo/status/2100040858737234210 (save as screenshot plus text)
- Igor's aero-stock-lp public note, 2026-08-25 (locate the exact post URL in M0 and add it; not pinned yet)

Anything not on this list is a new dependency and triggers stop 4.

## 6. Repo layout

```
treasury-sweeper/
  README.md
  PRD.md                    copy of treasury-sweeper-prd-v1.md
  BUILD-PLAN.md             this file
  PUNCH-LIST.md
  NOTES.md                  running build notes, one entry per subagent task
  STOP.md                   only exists while stopped
  reviews/M0.md ... M7.md
  docs/INDEX.md
  docs/dynamic/ flash/ bankr/ aerodrome/ oracles/ base-mcp/ hackathon/
  src/wallet/ policy/ aerodrome/ sweep/ pay/ flash/ oracle/ chat/ demo/
  test/
  .env.example
```

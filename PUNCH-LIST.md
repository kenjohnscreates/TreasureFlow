# Treasury Sweeper: Kenny's Punch List

> **This is the original Dynamic-era checklist.** It is not the live Bankr demo list. See [README.md](README.md) for what ships today.

Items only you can do. Ordered by when the build blocks on them. Check the box, drop the value into `.env` (never into chat, never into the repo).

## Before M0 (Wednesday or Thursday)
- [ ] Create GitHub repo `treasury-sweeper` (private is fine for now). Give the orchestrator push rights to `main` via a fine-grained PAT or deploy key, scoped to this one repo.
- [ ] LLM API keys for each vendor in the roster: xAI (Grok 4.6 High), Anthropic (Opus, Sonnet, Haiku), OpenAI (GPT-5) if used for low-risk tasks.
- [ ] Register for Runtime NYC and confirm team slot; note the demo submission format and any repo-visibility requirement.
- [ ] Decision: stretch tier (Bankr wallet custody split). Keep narrated, or cut. Tell the orchestrator in the first message.
- [ ] Decision: policy values for the demo. Buffer, per-call cap, daily cap, and the two demo payment destinations.

## Before M1 (Thursday)
- [ ] Dynamic account. Create an environment, copy Environment ID, create an API token. Enable embedded wallets and "multiple embedded wallets per chain" in the dashboard.
- [ ] Ask Dynamic (hackathon Slack or booth) whether wallet and signer policy layers are enabled on your environment; they are marked early access. Environment-level rules are the fallback.
- [ ] Base RPC key (Alchemy or QuickNode). The public RPC rate-limits batch calls.
- [ ] Base Sepolia test ETH and test USDC for the policy rejection test.

## Before M2 (Thursday night)
- [ ] Deposit into the Dynamic wallet on Base mainnet: a small amount of ETH for gas, about 20 USDC and 20 USDT. Set the test cap to match.
- [ ] Confirm which Aerodrome stable pool is live and deepest for USDC today (USDC/USDT assumed). Reply with the pool address.

## Before M5 (Friday)
- [ ] Flash API key from Definitive (`dpka_...`). Check whether hackathon keys are handed out at the event.
- [ ] Install the Flash MCP server (`@definitive-fi/flash-mcp`) in Claude Code so subagents can test quotes without writing a client first.
- [ ] Line up a non-US tester or VPN endpoint for probe 3. Without it, the tokenized stock variant stays narrated.

## Before M6 or M7 (Friday, only if stretch stays)
- [ ] Bankr account and API key with Agent API access enabled; Bankr Club or a Max Mode top-up, one is required.
- [ ] Install the Bankr Claude Code plugin (`bankr-agent@bankr-claude-plugins`) and locate the `aero-stock-lp` SKILL.md in `BankrBot/skills`.
- [ ] Find and save Igor's 2026-08-25 aero-stock-lp public note URL; the PRD references it but it is not pinned.

## Optional MCPs and tooling
- [ ] Base MCP (mcp.base.org) in Claude Code; useful for reads and for the Aerodrome plugin's sugar-sdk calldata pattern.
- [ ] `dynamic-agent-payments` MCP server; only if you want to show an x402 payment from the Dynamic wallet as a bonus, out of scope for v1.

## Saturday
- [ ] Approve the recorded demo run from M6 before 2 PM EDT.
- [ ] Bring the demo machine with `.env` loaded and the wallet topped up; BaseScan tabs open for the wallet and the Router.

# Treasury Sweeper PRD v1

> **Historical.** This is the original Dynamic-era PRD. Live product, Vercel click path, and onchain proof: [README.md](README.md).

Runtime NYC hackathon. Written 2026-09-16 for review by a second agent. No code in this document. Deadline Sat Sep 19 2026, 4 PM EDT; demos 5 PM.

**Status**
- Scope decided: three tiers locked. Core = nightly sweep into an Aerodrome stable pool plus prompt-to-pay. Second = Flash limit ladder into one Base token. Stretch = Bankr aero-stock-lp, narrated only from a US machine.
- Probes pending: four, Friday night, in the order listed in section 7. Probe 1 runs first and alone; if it fails the core tier is not demoable from a US machine.
- Biggest risk: Dynamic wallet policies document an allowlist and a per-transaction value cap, but no daily cap field. The daily cap lives in the orchestrator unless probe 4 finds a wallet-level option. That weakens the "limits enforced in the wallet" claim for one of the three limits.
- Decision needed from Kenny: the stretch tier executes through a Bankr wallet, not the Dynamic wallet (aero-stock-lp writes via Bankr's arbitrary-transaction flow). That breaks the single-wallet policy story for that tier. Keep it as a narrated stretch with an explicit custody caveat, or cut it and use the time on tier 2.
- Docs pinned: every call in section 5 links to a live page checked 2026-09-16. Two assumptions from the handoff did not survive the check: Flash has no native DCA order type in its v1 API (limit, TWAP, stop, SL, TP, bracket only), and Dynamic policies are per-call, not per-day.

## 1. One-liner and pitch

One-liner: Your company's idle USDC earns yield every night and is back in the wallet the second you need to pay someone.

Pitch: Treasury Sweeper is an agent that runs one company's own USDC treasury from a Dynamic server wallet on Base. Each night it sweeps everything above a cash buffer into an Aerodrome stable LP position, and any time the founder types "send N USDC to 0x...", it unwinds only what is needed and pays. The founder sets buffer, caps, and allowed destinations once at the wallet level; the agent suggests and executes inside those limits and never outside them.

## 2. User and job to be done

User: founder of a 2 to 20 person company holding roughly $50k to $2M USDC in a hot wallet or exchange account. No finance team. Nobody whose job is treasury.

Job: "Make idle cash earn something without me watching it, and never make me wait to pay someone."

Not the user: DAOs pooling other people's money, anyone taking third-party deposits, anyone who wants leverage or borrowing.

## 3. Scope tiers

**Tier 1, Core (must ship).** Dynamic server wallet holds USDC on Base. Nightly job sweeps balance above the buffer into an Aerodrome stable pool (assumption: sAMM USDC/USDT; probe 1 confirms the live pool). Chat prompt "send N USDC to 0x..." checks the buffer, removes only the shortfall from the pool, sends N USDC to an allowlisted address, and returns the Dynamic tx hash.

**Tier 2, Second.** From sweep surplus, place a ladder of Flash limit buy orders into one Base token (assumption: cbBTC) at oracle-derived levels below spot, refreshed nightly. Copy says "buys more on dips" and makes no performance claim. Tokenized stock as target only if probe 3 passes from a non-US context; the demo machine is US, so the stock variant is narrated.

**Tier 3, Stretch.** Bankr aero-stock-lp skill opens a Slipstream position in an accumulated tokenized stock (NVDAc, AAPLc, GOOGLc, METAc). Behind a geo check. Narrated, not executed, on the demo machine.

**Out of scope for v1.** Pooled or third-party deposits. Borrowing or lending (Morpho markets are gated). Perps (Avantis is hours-gated and closed Saturday; perps are not the same thing as short-term liquidity). Token launch (so the Bankr prize track does not apply). Solana or xStocks. Identity, KYB, or reputation. Multi-wallet or multi-company. Fiat off-ramp. Bankr x402 Cloud (it is a seller-side product for deploying paid endpoints; not needed here). Gauge staking of the stable LP (v1 is fee yield only; emissions are a v2 line item).

## 4. User flows

**4.1 Onboarding and limit setup.** Founder creates the Dynamic server wallet, deposits USDC into it, then sets four values in a setup screen: cash buffer (USDC amount always kept liquid), per-transaction cap, daily cap, and destination allowlist. Setup writes the buffer and daily cap to the orchestrator config and writes the allowlist plus per-call cap as Dynamic policy rules. Founder approves the policy once. No per-trade approvals after that.

**4.2 Nightly sweep (cron, 02:00 local).** Read USDC balance. If balance minus buffer is above the minimum sweep size, quote add-liquidity on the Router, approve USDC and USDT if needed, call addLiquidity with stable=true, log the LP token amount and tx hash. If the surplus is below the minimum, do nothing and log why.

**4.3 Prompt-to-pay.** Founder types "send 2,400 USDC to 0xABC". Agent parses to a typed action, checks the destination is on the allowlist and the amount is under the per-call and remaining daily cap, computes shortfall = amount minus free USDC, quotes and removes only that much liquidity, sends the USDC transfer, and replies with the Dynamic tx hash and the new buffer state. If the policy rejects, the agent shows the rejection reason and does nothing else.

**4.4 DCA (tier 2).** After the sweep, if surplus above buffer exceeds the DCA reserve, the agent reads the Chainlink BTC/USD feed on Base, places three Flash limit buys at 2, 4, and 6 percent below spot for cbBTC, sized from the reserve, and cancels any unfilled orders from the prior night before placing new ones. Order status is polled via GET order and streamed via the orders WebSocket for the demo.

**4.5 Stock LP (stretch).** Once the tokenized stock balance crosses a threshold, the agent sends a Bankr Agent API prompt invoking aero-stock-lp to open a Slipstream position, then runs a manage pass nightly. Custody caveat: this executes from the Bankr wallet, not the Dynamic wallet, so Dynamic policies do not cover it.

## 5. Architecture

| Step | Exact call | Source | Track |
|---|---|---|---|
| Create wallet | `@dynamic-labs-wallet/node-evm` `createWalletAccount`, then `getWalletClient({chainId: 8453})` for a viem client | https://www.dynamic.xyz/docs/node/wallets/server-wallets/overview and https://www.dynamic.xyz/docs/node/wallets/server-wallets/viem-wallet-client | Dynamic |
| Wallet policy | `WaasPolicyRule` with `ruleType: allow`, `addresses` (allowlist), `valueLimit.maxPerCall` on USDC | https://www.dynamic.xyz/docs/overview/wallets/embedded-wallets/mpc/policies/overview | Dynamic |
| Read balance | viem `readContract` USDC `balanceOf` (USDC Base 0x8335...2913) | standard ERC-20 | none |
| Sweep in | Aerodrome Router 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43: `quoteAddLiquidity` then `addLiquidity(USDC, USDT, stable=true, ...)`, signed and sent by the Dynamic wallet client | https://github.com/aerodrome-finance/contracts/blob/main/contracts/Router.sol | Dynamic (tx hash) |
| Read position | LP token `balanceOf(wallet)` plus Router `quoteRemoveLiquidity` | same | none |
| Unwind | Router `removeLiquidity(...)` for the shortfall only | same | Dynamic (tx hash) |
| Pay | USDC `transfer(to, amount)` via the Dynamic wallet client | Dynamic viem client | Dynamic (tx hash), Igor #4 |
| Oracle read | Chainlink V3 aggregator `latestRoundData()` on Base BTC/USD (tier 2); B20 tokenized equity feeds carry the Coinbase multiplier (stretch) | https://docs.chain.link/data-feeds/tokenized-equity-feeds/coinbase | none |
| Limit ladder | Flash `POST /v1/quote` with `orderType: "limit"`, sign the returned actions with the Dynamic wallet (EIP-712 or Permit2 per EVM overview), `POST /v1/order`; `GET` order detail; orders WebSocket channel | https://flash.definitive.fi/docs/llms.txt (limit-order, evm-overview, get-order, websocket) | Flash (advanced order) |
| Stock LP | Bankr Agent API `POST /agent/prompt` invoking `aero-stock-lp` (open, recenter, exit); requires Bankr Club or Max Mode on the key | https://docs.bankr.bot/agent-api/overview/ and https://atskills.one/bankrbot/aero-stock-lp | none (no launch) |
| Chat and orchestration | LLM parses intent into a typed action; orchestrator enforces buffer and daily cap, then calls the row above | own code | none |

Calldata helper for the Aerodrome rows: Velodrome `sugar-sdk` (referenced by the Base Aerodrome plugin) builds deposit and withdraw calldata; use it if raw encoding costs more than an hour.

## 6. Wallet policy and protective measures

- **Buffer.** USDC amount never swept. Enforced by the orchestrator before any sweep.
- **Per-transaction cap.** Wallet level: Dynamic `valueLimit.maxPerCall` on USDC. Also mirrored in the orchestrator for a clearer error message.
- **Daily cap.** Orchestrator level, rolling 24 hours, unless probe 4 finds a wallet-level option. Stated plainly in the demo.
- **Allowlist.** Wallet level. Must include every touched address: payment destinations, Aerodrome Router, the pool contract, USDC, USDT, Permit2 and Flash's settlement contracts for tier 2. Dynamic evaluates every participant in the call path including proxies and implementations, so a missing address fails closed. That is the intended behavior.
- **Kill switch.** A deny-all rule applied through the policy API, plus a local paused flag that stops the cron. Either one halts all outbound activity.
- **Stable pool exposure.** The core position holds USDT risk. Cap LP share at 70 percent of treasury so the buffer plus 30 percent stays in USDC.
- **IL exposure on stock pools (stretch).** Slipstream ranges go one-sided out of range, and the underlying equity moves while the pool trades 24/7. Cap the stretch tier at a fixed small percentage and label it a position, not treasury.
- **Key shares.** `backUpToDynamic: true` for the hackathon. Production stores shares in the company's own vault.
- **Approval model.** Founder approves the policy, not each trade. The agent surfaces every action with its tx hash after the fact.

## 7. Friday-night probes

| # | Probe | Pass | Fail fallback |
|---|---|---|---|
| 1 | Stable LP from the Dynamic wallet: approve, `addLiquidity` stable=true, read LP balance, `removeLiquidity` partial | Four tx hashes on BaseScan, LP balance reads back, partial removal returns the expected USDC within slippage | Core collapses to stock LP only and inherits geo; demo becomes narrated end to end. Run this probe first and alone. |
| 2 | `aero-stock-lp` actual scope: open, recenter, exit, gate checks, which wallet signs | Skill runs a read-only status call from a US machine and the write path is documented as Bankr wallet | Stretch stays narrated with a screenshot of the skill's status output; no live position. |
| 3 | Flash limit order on a tokenized stock from a non-US context (VPN or teammate abroad) | Order accepted and visible via GET order | DCA target is cbBTC on Base for both build and demo. Stock variant is narrated. |
| 4 | Dynamic policy: per-call cap, allowlist, and any daily or rolling cap set at the wallet level and rejected pre-sign | A test transfer over the cap is rejected by the policy, not by our code; a rolling cap field exists | Daily cap stays in the orchestrator; demo says so out loud. |

## 8. Demo script (5 minutes, US machine)

- 0:00 Founder view: wallet balance, buffer, caps, allowlist. One sentence: "This is one company's own USDC, run by an agent, limits enforced before signing."
- 0:40 Trigger the sweep manually. Show the Router `addLiquidity` tx hash on BaseScan from the Dynamic wallet. Show the LP balance.
- 1:40 Type "send 2,400 USDC to 0x...". Agent shows shortfall, `removeLiquidity` hash, USDC transfer hash. This is the Dynamic prize evidence.
- 2:40 Type "send 50,000 USDC to 0x...". Policy rejects at signing. Show the rejection. Nothing moved.
- 3:20 Tier 2: show the three resting Flash limit orders for cbBTC with their oracle-derived levels, and the orders WebSocket stream. This is the Flash prize evidence.
- 4:10 Stretch, narrated: "From a non-US wallet, the same surplus can ladder into a tokenized stock and the aero-stock-lp skill can LP it. Not executed here; US machine." Show the skill's read-only status screen if probe 2 passed.
- 4:40 Close on the company thesis from section 12.

## 9. RFS coverage

- Igor #6 Autonomous Financial Agents: core tier is the whole product. #4 Payments: prompt-to-pay. #2 Trading automations: tier 2. #3 LP management: core and stretch.
- YC and Base "Fintech 3.0": Apps and Agents bucket. Sources: https://www.ycombinator.com/blog/build-onchain , https://blog.base.org/y-combinator-request-for-onchain-startups , https://x.com/igoryuzo/status/2100040858737234210
- Framing: a real product with company potential; Bankr is not core infra here, which matches Igor's note.

RFS vs API gap, one per tier:
- Core: the RFS asks for autonomous treasury; the wallet API gives per-call limits and allowlists but no rolling daily limit, so one of the three limits sits in app code.
- Second: the RFS asks for trading automations; Flash exposes limit, TWAP, and trigger orders but no DCA primitive, so DCA is composed from limit orders.
- Stretch: the RFS asks for LP management; the only documented stock LP path executes from a Bankr wallet, not from the policy-governed Dynamic wallet.

## 10. Risks

1. Probe 1 fails on Aerodrome stable pool mechanics from an MPC wallet. Decision: run it first Friday; if it fails by 10 PM, cut tier 2 and spend Saturday on a narrated core.
2. Dynamic policy layers are marked early access and may not be enabled on a hackathon account. Decision: confirm with the Dynamic table before Friday; fallback is environment-level rules only.
3. Flash order signing needs Permit2 or contract approvals that the allowlist blocks. Decision: add Flash and Permit2 addresses during probe 3, not on demo day.
4. Bankr Agent API requires Club or Max Mode. Decision: one teammate buys it Thursday or the stretch is fully narrated.
5. Judges read "yield" as a promise. Decision: every screen says "fee yield" with the pool's trailing rate and no forward number.

## 11. Open questions for the reviewing agent

- Is USDC/USDT the right stable pool, or is there a deeper sAMM pair on Aerodrome today with better fee yield and no depeg step-up?
- Should the demo use Base Sepolia for the rejection step and mainnet for the rest, or mainnet with small amounts throughout?
- Does a limit ladder count as "advanced order type used" for the Flash track, or should one order be a TWAP to remove doubt?
- Is the custody split in the stretch tier disqualifying for the "limits in the wallet" story, or acceptable if labeled?
- Is there any documented rolling-window limit in Dynamic's policy layers that this review missed?

## 12. Post-hackathon company thesis

- Wedge: every small crypto-native company has idle USDC and nobody assigned to it. One wallet, one policy, one agent. No pooling, so no custody or issuer burden.
- Revenue: 10 to 15 percent of realized fee yield, or a flat per-sweep fee for companies that prefer a fixed cost. Both are billable onchain from the same wallet the agent already operates.
- Expansion: the same policy-governed agent extends to invoice-style payments, vendor allowlists, and multi-chain treasuries; each is a rule, not a new product.

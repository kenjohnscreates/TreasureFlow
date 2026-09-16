# Bankr Club

> Without a subscription you get 5 messages per day on the terminal. Beyond that you need either a Bankr Club subscription or [Max Mode](/llm-gateway/max-mode) (LLM credits).

# Bankr Club

## What is Bankr Club?

Without a subscription you get 5 messages per day on the terminal. Beyond that you need either a Bankr Club subscription or [Max Mode](/llm-gateway/max-mode) (LLM credits).

**Bankr Club** ($20/mo or $198/yr) gives you unlimited messages on the terminal and social platforms, plus access to all features. On the [Agent API](/security/developer-api#rate-limits) Club is capped at 1,000 requests/day (vs. 100/day for non-members). Pay with USDC (default), BNKR, ETH, or any Base ERC-20 from your wallet — non-USDC/BNKR tokens are swapped to USDC at checkout (≤ 5% slippage). **Max Mode** charges per request from your LLM credit balance — unlimited messages on the terminal (the Agent API separately caps non-Club Max Mode at 100/day).

To subscribe: ask Bankr `Subscribe to Bankr Club` and it will walk you through payment.

## What do I get with Bankr Club?

<!-- Numbers below are hardcoded because Markdown can't import. They mirror
     AUTOMATION_LIMIT_FOR_CLUB and FREE_TIER_DAILY_MESSAGE_LIMIT in
     @bankr/shared — update both together. -->

- **The most powerful AI models** — Club requests route to the top-tier models
- **Unlimited messages** — no daily cap on the terminal
- **Up to 20 concurrent automations** — recurring agent commands, limit/stop/DCA/TWAP orders
- **Browser sessions** — let Bankr browse the web on your behalf (private surfaces only)
- **Advanced research** — Bankr score, PnL & volume analytics, web search, social sentiment
- **Early access** to new features, occasional airdrops, and the private Bankr Club chat

## Can I upgrade from monthly to yearly?

**Yes.** If you're an active monthly member, ask Bankr `Upgrade to yearly Bankr Club` and it will charge the full yearly price ($198). Your remaining monthly time is preserved and stacked on top of the new yearly term — you never lose what you've already paid for.

Once you're on a yearly term you can't downgrade back to monthly until it expires.

## Can I transfer my Bankr Club membership to someone else?

**No.** Membership transfers are currently disabled. Two alternatives:

- **Stop your own subscription:** cancel auto-renewal — your benefits stay active until the end of the current billing period.
- **Give someone a subscription:** use the gift flow to pay for a new subscription for them.

## I own a Bankr Club NFT — does that give me Club access?

**No.** The original Bankr Club NFTs were commemorative tokens given to the first 1,000 subscribers — they are not the membership itself.

Holding the NFT does **not** grant Club benefits. If you bought the NFT on a secondary market (e.g. OpenSea), you received the collectible NFT but not the underlying subscription.

To get membership, subscribe directly through Bankr.

## I'm using MetaMask / Coinbase Wallet / an external wallet — can I subscribe?

**No.** Bankr Club subscriptions require an embedded Bankr wallet (auto-created when you sign in with email, X, Farcaster, or Telegram). External/connected wallets can't subscribe because Club payments are signed by Privy on your behalf, and Bankr doesn't have signing keys for external wallets.

What to do:

- Sign in with email or a social account to get an embedded wallet, transfer funds in, and subscribe from that wallet.
- Or use [Max Mode](/llm-gateway/max-mode) — pay-per-token with LLM credits, works with any wallet including external/connected.

## I purchased the Bankr Club NFT but I don't have membership — why?

The NFT is a commemorative collectible, not the membership. Membership is tied to an **active Bankr Club subscription**, not NFT ownership.

If you already subscribed and still don't have access:

1. Make sure you're logged into the same wallet/account that completed the payment
2. Try asking Bankr: `What is my Club status?`
3. If still not showing, open a ticket at the [Bankr Help Center](https://help.bankr.bot) with your transaction hash and wallet address

## I was deploying tokens and now I can't use Bankr — why?

Bankr has automated protections to detect and block spam behavior.

If you've been deploying tokens at high volume in a short period, you may have triggered spam detection — which can result in temporary or permanent account restrictions.

Limit:

- Every Bankr wallet—including Standard, Bankr Club, partner organization, and provisioned partner wallets—can make up to 3 counted launch attempts per rolling 24 hours. All 3 are eligible for gas sponsorship when the wallet is otherwise eligible.

Repeatedly hitting these limits or bot-like behavior can flag your account. If you believe your account was restricted unfairly, open a ticket at the [Bankr Help Center](https://help.bankr.bot) explaining your use case. Legitimate high-volume use (e.g. building a product that deploys tokens programmatically) may be accommodated.

# Access: Free, Bankr Club & Max Mode

> **Three tiers — start free on the terminal, upgrade to Bankr Club for unlimited chat and full features (with default Gemini Flash model), or use Max Mode for premium models pay-as-you-go.**

# Access: Free, Bankr Club & Max Mode

**Three tiers — start free on the terminal, upgrade to Bankr Club for unlimited chat and full features (with default Gemini Flash model), or use Max Mode for premium models pay-as-you-go.**

|                                           | Free                | Bankr Club                                                          | Max Mode                                                       |
| ----------------------------------------- | ------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Cost**                                  | $0                  | $20/mo or $198/yr in USDC (default) or BNKR / ETH / any Base ERC-20 | Pay-per-token from LLM credits                                 |
| **Messages/day**                          | 5 (terminal only)   | 1,000                                                               | Unlimited (pay-per-token)                                      |
| **Model**                                 | Gemini Flash (fast) | Gemini 3 Flash (base model)                                         | Any gateway model (Claude Opus, GPT-5.4, Gemini 3.1 Pro, etc.) |
| **Token launches / Browser tools / Apps** | ❌                  | ✅                                                                  | ✅                                                             |
| **@bankrbot on X**                        | ❌                  | ✅                                                                  | ✅                                                             |
| **Resets**                                | UTC midnight        | —                                                                   | —                                                              |

You can mix tiers — Club for everyday chat, Max Mode when you need more horsepower.

## Free Tier — Terminal Only

The free tier lets you try Bankr without subscribing. **5 messages per day on the [bankr.bot](https://bankr.bot) terminal**, resetting at UTC midnight. You're on the fast standard model — no model picker until you upgrade.

**What free tier includes**:

- Chat, trading, swaps, transfers, market data, portfolio, NFTs, Polymarket, Avantis, Hyperliquid

**What free tier doesn't include** (Bankr Club or Max Mode required):

- Token launches
- Browser tools
- Apps
- Replies from @bankrbot on X — these are silently ignored for non-Club users (no free quota applies on X at all)

**Other surfaces**: the 5-message/day quota applies **only** to the bankr.bot terminal. Twitter, Telegram, Farcaster, the API, and webhooks each have their own access gates — most require Bankr Club. See the relevant integration doc for details.

**Max Mode bypasses the daily limit** — Max Mode requests don't count against your free messages; they draw from your LLM credit balance instead.

## Bankr Club — the Base Model Plan

Bankr Club is the simple flat-rate plan. Pay once per month (or year), get the base model (Gemini 3 Flash) with a generous 1,000 messages/day, and access to every feature — trading, token launches, automations, prediction markets, the works.

**To subscribe**: ask Bankr in chat:

```
Subscribe to Bankr Club
```

It'll walk you through payment. **Default is USDC** — pass a different token (BNKR, ETH, any Base ERC-20) and the agent will swap it to USDC at checkout (≤5% slippage). Yearly ($198/yr) is the better deal if you use Bankr every day.

:::info Want to pay in BNKR?
You need BNKR in your wallet first. Just ask Bankr:

```
swap $25 of ETH to BNKR on base
```

Then: `subscribe to Bankr Club with BNKR`
:::

:::warning Embedded wallets only
Club subscriptions require a Bankr embedded wallet (auto-created when you sign in with email, X, Farcaster, or Telegram). **External/connected wallets** (MetaMask, Coinbase Wallet, Sign-In with Ethereum) **cannot subscribe** — payments are signed by Privy on your behalf, and Bankr doesn't hold keys for external wallets. Options: sign in with email/social to get an embedded wallet, or use [Max Mode](/llm-gateway/max-mode) which works with any wallet.
:::

**Check your status**:

```
what is my Club status?
```

:::note Bankr Club NFTs
If you hold an original Bankr Club NFT from the initial drop, that's a commemorative collectible — **it does not grant membership**. To get Club access, subscribe through the chat flow above.
:::

## Max Mode — Premium Models, Pay As You Go

Max Mode swaps out the default model for a more capable one (Claude Opus, Gemini 3.1 Pro, GPT-5.4, etc.). You pay per token from an LLM credit balance, so cost scales with usage.

Your Max Mode choice syncs across every surface (web, Twitter, Telegram, CLI, automations).

### Enabling Max Mode

**Web terminal**: at [bankr.bot](https://bankr.bot), click the **Max** button above the chat input, then click the model name to pick one.

**CLI**: pass `--model` to any prompt:

```bash
bankr "analyze my portfolio" --model claude-opus-4.8
```

See the full [Max Mode docs](/llm-gateway/max-mode) for every model and flag.

### Adding Credits

LLM credits are denominated in USDC and drawn down as you send Max Mode messages. Top up from chat, the web, or CLI:

**Ask Bankr directly**:

```
what's my LLM credit balance?
add $25 in LLM credits
```

Bankr reports your spendable balance, your active Max Mode model, and the soonest-expiring credit grant if you hold any.

**Web**: [bankr.bot/llm?tab=credits](https://bankr.bot/llm?tab=credits)

**CLI**:

```bash
bankr llm credits           # check balance
bankr llm credits add 25    # add $25
bankr llm credits auto --enable   # auto top-up (never run dry)
```

### What Happens If Credits Run Out

The agent replies asking you to top up rather than answering on the default model — on X it quietly falls back to the standard model instead, so a public thread never turns into a top-up nag. If credits run out partway through a turn, it stops there and saves its progress in the thread so you can top up and ask it to continue. Enable auto top-up above to avoid the interruption. Full detail: [Max Mode](/llm-gateway/max-mode).

## FAQ

**Do I need both?**
No. Either one unlocks Bankr. Most users start with Bankr Club.

**Can Club members use Max Mode too?**
Yes. Club + Max Mode stack — Club covers the 1,000 msgs/day of base-model chat, and Max Mode lets you run premium models on top whenever you need them.

**Are there any model discounts?**
Yes. The LLM Gateway supports time-bounded per-model discounts. See [LLM Gateway → Model Discounts](/llm-gateway/overview#model-discounts) and check [bankr.bot/llm](https://bankr.bot/llm) for active promos.

**What happens on the free tier?**
5 free terminal messages/day on the fast standard model. Past that, subscribe to Bankr Club or use Max Mode (unlimited on the terminal, pay-per-token from LLM credits). The [Agent API](/security/developer-api#rate-limits) caps non-Club users at 100 messages/day; that limit doesn't apply on the terminal.

**Where do I ask for help?**
Ask Bankr in chat, or open a ticket at the [Bankr Help Center](https://help.bankr.bot).

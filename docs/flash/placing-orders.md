> ## Documentation Index
> Fetch the complete documentation index at: https://flash.definitive.fi/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Placing Orders

> How Flash API defines trading pairs and order parameters using the target/contra convention.

Flash API uses a target/contra framework to define every trade. Understanding these two terms is the key to constructing correct order parameters.

## Definitions

**Target asset** is the asset being traded, set by `targetAsset` (plus `targetChain`). In a WETH/USDC market, WETH is the target asset. When you buy, you are buying the target. When you sell, you are selling the target.

**Contra asset** is the pricing and payment asset, set by `contraAsset` (plus `contraChain`). In a WETH/USDC market, USDC is the contra asset. It is the asset you spend when buying and the asset you receive when selling.

For same-chain orders, `targetChain` and `contraChain` are the same value. Crosschain market orders use different values for the two chains. Assets are always referenced by address, not symbol.

<Note>
  Native asset behavior is chain-specific. If you spend a native gas asset, request a quote through that chain's native-asset flow, send the returned `wrap` action, then submit with the wrapped-native asset from the quote. See [EVM native assets](/docs/evm-overview#native-eth-and-wrapped-assets) and [Solana native SOL](/docs/solana-overview#native-sol-and-wsol).
</Note>

## Finding asset addresses

Because both legs are addresses, use `GET /search` to turn a symbol, a name, or a pasted address into the values an order needs. Results are ranked, most relevant first.

```bash cURL theme={null}
curl "https://flash.definitive.fi/v1/search?query=weth&chain=base" \
  -H "x-definitive-api-key: YOUR_API_KEY"
```

Each result's `address` and `chain` go straight into `targetAsset` / `targetChain` or `contraAsset` / `contraChain`, alongside `decimals`, `price`, `liquidity`, and a `riskFlagged` caution signal. Pass `chain` to pin results to one chain, or omit it to search every supported chain, in which case a query like `usdc` returns the Base, Solana, and Ethereum listings as separate results. See [Search assets](/docs/api-reference/flash/search).

## How `qty` works

The meaning of `qty` depends on the `side` of the trade. It is always the amount of the asset being spent:

| Side   | `qty` represents                     | What happens                   |
| ------ | ------------------------------------ | ------------------------------ |
| `buy`  | Contra asset quantity (spend amount) | Spend 100 USDC to buy WETH     |
| `sell` | Target asset quantity (sell amount)  | Sell 0.05 WETH to receive USDC |

Buy `qty` is always denominated in the contra asset. Sell `qty` is always denominated in the target asset.

## Pricing basis

Every price you set on an order — a limit price or a trigger price — is expressed in one of two bases. You choose per price.

**Notional** is the **USD value of the target asset**. If WETH is trading at \$4,000 per WETH, the notional price is `"4000"`. Set it with `limitNotionalPrice` on a limit, or `notionalPrice` on a trigger.

**Cross** is the **pair rate**: how many `contraAsset` units one `targetAsset` unit is worth (target / contra). It is the price of the target asset denominated in the contra asset, never inverted. With WETH as the target and USDC as the contra, a cross price of `"4000"` means 4,000 USDC per WETH; with cbBTC as the contra it would be cbBTC per WETH. The frame is the same on `buy` and `sell`. Set it with `limitCrossPrice` on a limit, or `crossPrice` on a trigger.

The two bases are mutually exclusive on the same price — send exactly one. Either way the price is the price of one target-asset unit, never the contra asset's price. Quote responses report each leg's `notional` and the estimated fee in USD regardless of which basis you priced in.

## Price protection on market orders

Market orders do not take a price field. Instead, you bound execution with `maxSlippage` and `maxPriceImpact`.

Flash enforces slippage offchain through its execution engine. If the swap cannot meet your `maxSlippage`, no funds are moved.

## Crosschain market orders

Crosschain market orders are live. Set `targetChain` and `contraChain` to different supported chains and include `recipientAddress`, the address that receives funds on the destination chain, in both the quote and order requests.

On a buy, funds move from `contraChain` to `targetChain`. On a sell, they move from `targetChain` to `contraChain`. The quote returns signing and funding actions for that source chain. If it returns a non-null `bridgeQuoteId`, pass the value back when you submit the order.

Crosschain execution supports `market` orders only. QuickTrade is not supported. See [Crosschain Orders](/docs/crosschain-orders) for the request flow and example.

## QuickTrade market orders

QuickTrade is a low-latency execution mode for market orders, built for sniping newly launched tokens. Set `quickTrade: true` on a market order to trade fresh quoting for speed. It is exclusive to market swaps.

See [QuickTrade](/docs/quicktrade) for how it works, when to use it, the trade-offs, and constraints. [Reach out](https://www.definitive.fi/flash-api#contact) to the Definitive team to find out whether QuickTrade is a good fit for your use case.

## Limit pricing

Use a limit order when getting your specified entry or exit price matters more than getting into the trade — the order won't fill unless the market meets that price. That means if slippage is too high, limit orders may not execute because the fill price inclusive of slippage does not meet your specified entry / exit price.

`limit` orders require a limit price in exactly one basis: `limitNotionalPrice` (USD price of the target asset) or `limitCrossPrice` (pair rate, target / contra). Sending both is rejected. Either one prices the traded asset, `targetAsset` — the contra asset is the unit of account, never the thing being priced.

**Buy limit** executes at or below the limit price. You are saying: buy the target asset only if the price is this good or better.

**Sell limit** executes at or above the limit price. You are saying: sell the target asset only if the price is this good or better.

A limit price is also optional on `twap`, `stop`, `stop-loss`, and `take-profit`, in either basis. Only `market` rejects a limit price outright.

Once a limit order is resting, its price can be changed without cancelling and re-placing — see [Updating Orders](/docs/updating-orders). The same applies to the limit price on a resting `stop-limit` or `take-profit-limit` order.

## Trigger orders

`stop`, `stop-loss`, and `take-profit` orders all fire on a price condition instead of a fixed limit. Each entry in `triggers` carries exactly one of `notionalPrice` (USD price of the target asset) or `crossPrice` (pair rate, target / contra) — sending both, or neither, is rejected — plus a `triggerType`: `lower` fires when the market drops to or below the price, `upper` fires when it rises to or above. Each takes exactly one trigger. A limit price is optional on all three, in either basis — see [Limit pricing](#limit-pricing).

### Stop

Use `stop` when getting into the trade matters more than the entry price. It's a market buy order that fires once price crosses your specified trigger level.

* **`triggerType: lower`** — fires once price crosses down through the trigger level. Enter on a pullback without babysitting the market for a bottom.
* **`triggerType: upper`** — fires once price crosses up through the trigger level. Enter on a breakout once the move is confirmed, rather than guessing the breakout price with a limit order.

Set `orderType: "stop"`, one `triggers` entry with `notionalPrice` or `crossPrice` plus `triggerType`. Add a limit price (`limitNotionalPrice` / `limitCrossPrice`) to cap execution price once triggered; omit it to fire as a market order. Optional `expireTime` for GTT.

### Stop Loss

Use `stop-loss` to protect a position you already hold. It's a market sell order that fires once price crosses your specified trigger level, capping the downside if the market turns against you.

Fires once price crosses down through the trigger level (`triggerType: "lower"`).

Set `orderType: "stop-loss"`, one `triggers` entry with `triggerType: "lower"`. Add a limit price to bound the exit; omit it to sell at market once triggered. Optional `expireTime` for GTT.

### Take Profit

Use `take-profit` to lock in gains on a position you already hold. It's a market sell order that fires once price crosses your specified trigger level, closing the position once the market reaches your target.

Fires once price crosses up through the trigger level (`triggerType: "upper"`).

Set `orderType: "take-profit"`, one `triggers` entry with `triggerType: "upper"`. Add a limit price to bound the exit; omit it to sell at market once triggered. Optional `expireTime` for GTT.

## Bracket orders

A `market`, `limit`, or `twap` order can carry an attached bracket order: a take-profit / stop-loss pair placed together with the entry order in one quote, sign, and submit flow. Add `attachedBracket` to the quote request with a trigger price for each leg; the quote returns a second signing payload for the pair, and the pair activates on the entry's first fill, protecting the asset the entry receives. Attached brackets are available on same-chain EVM orders and require `funderAddress`. See [Bracket Orders](/docs/brackets) for the request fields, lifecycle, and an end-to-end example.

## Order expiry

`FlashOrder.deadline` is enforced onchain, but you do not set the signed deadline directly — Flash derives it from your quote request. Control expiry through the quote-request parameters below so the API order expiration and the onchain signature deadline stay aligned; prefer these over editing the deadline inside the signed payload.

| Order type                                                                                                  | How the deadline is set                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `market`                                                                                                    | A short deadline (roughly 5 minutes from quote time). No expiry parameter.                                                                                                                                                                                 |
| `twap`                                                                                                      | Set `durationSeconds` on the quote request. It is converted into an internal expiration and signed with a 60-second execution buffer. Add `startTime` to schedule the start; the duration is then measured from `startTime`. `expireTime` is not accepted. |
| `limit`, `stop`, `stop-loss`, `take-profit` (including their limit variants when a limit price is supplied) | Set `expireTime` for good-til-time (GTT) behavior. Omit it for good-til-cancelled (GTC), which uses an effectively non-expiring sentinel (`2^48 - 1`).                                                                                                     |

## Examples

All examples buy or sell WETH (`0x4200000000000000000000000000000000000006`) against USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) on Base.

**Market buy: spend 100 USDC to buy WETH, with 5% slippage protection**

The `qty` is `"100"`, meaning spend 100 USDC (contra asset).

```jsonc theme={null}
{
  "targetChain": "base",
  "contraChain": "base",
  "targetAsset": "0x4200000000000000000000000000000000000006", // WETH
  "contraAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  "side": "buy",
  "qty": "100",
  "orderType": "market",
  "maxSlippage": "0.05"
}
```

**Market sell: sell 0.05 WETH for USDC, with 5% slippage protection**

The `qty` is `"0.05"`, meaning sell 0.05 WETH (target asset).

```jsonc theme={null}
{
  "targetChain": "base",
  "contraChain": "base",
  "targetAsset": "0x4200000000000000000000000000000000000006", // WETH
  "contraAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  "side": "sell",
  "qty": "0.05",
  "orderType": "market",
  "maxSlippage": "0.05"
}
```

**Limit buy: buy WETH at \$1,000 or better**

The `qty` is `"100"`, meaning spend up to 100 USDC. The order executes only when WETH is available at \$1,000 per WETH or lower.

```jsonc theme={null}
{
  "targetChain": "base",
  "contraChain": "base",
  "targetAsset": "0x4200000000000000000000000000000000000006", // WETH
  "contraAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  "side": "buy",
  "qty": "100",
  "orderType": "limit",
  "limitNotionalPrice": "1000"
}
```

**Limit sell: sell WETH at \$4,000 or better**

The `qty` is `"0.05"`, meaning sell 0.05 WETH (target asset). The order executes only when WETH reaches \$4,000 per WETH or higher.

```jsonc theme={null}
{
  "targetChain": "base",
  "contraChain": "base",
  "targetAsset": "0x4200000000000000000000000000000000000006", // WETH
  "contraAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  "side": "sell",
  "qty": "0.05",
  "orderType": "limit",
  "limitNotionalPrice": "4000"
}
```

**Limit buy priced in the pair rate: buy WETH at 1,000 USDC per WETH or better**

The same order as the limit buy above, priced in the pair rate (target / contra) instead of USD. Use this basis when the contra asset is not a dollar stablecoin, or when you want the constraint to track the pair rather than the dollar.

```jsonc theme={null}
{
  "targetChain": "base",
  "contraChain": "base",
  "targetAsset": "0x4200000000000000000000000000000000000006", // WETH
  "contraAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
  "side": "buy",
  "qty": "100",
  "orderType": "limit",
  "limitCrossPrice": "1000"
}
```

<Tip>
  The snippets above are request bodies. For complete, runnable end-to-end scripts (quote, sign, and submit) on both EVM and Solana, see the End-To-End Flows under AI Integration: [Market](/docs/market-order), [Limit](/docs/limit-order), [TWAP](/docs/twap-order), and [Trigger orders](/docs/trigger-orders).
</Tip>

## Quick reference

| Field                         | When to use                                                               | Meaning                                                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `targetAsset` / `targetChain` | Always                                                                    | The asset being traded, by address and chain                                                                                                                                                            |
| `contraAsset` / `contraChain` | Always                                                                    | The pricing/payment asset, by address and chain                                                                                                                                                         |
| `side`                        | Always                                                                    | `"buy"` = buy the target; `"sell"` = sell the target                                                                                                                                                    |
| `qty`                         | Always                                                                    | Contra quantity for buys; target quantity for sells                                                                                                                                                     |
| `quickTrade`                  | Market orders only                                                        | Low-latency execution mode                                                                                                                                                                              |
| `maxSlippage`                 | Optional                                                                  | Slippage tolerance as a decimal (default `"0.05"`)                                                                                                                                                      |
| `maxPriceImpact`              | Optional                                                                  | Max price impact as a decimal (default `"0.05"`)                                                                                                                                                        |
| `recipientAddress`            | Crosschain market orders                                                  | Address that receives funds on the destination chain; send it on both quote and order requests                                                                                                          |
| `flashIntegratorFeeBps`       | Optional for integrator fees                                              | Fee in basis points; set the same string value on the quote and order requests                                                                                                                          |
| `erc8021AttributionCode`      | Optional, order request only                                              | Base builder code appended to the settlement transaction for [ERC-8021 attribution](/docs/monetizing-your-integration#base-builder-code-attribution) (EVM only); send it on the order request, not the quote |
| `limitNotionalPrice`          | Required on limit orders (one basis); optional on TWAP and trigger orders | USD price of the target asset (`targetAsset`), not the contra asset; buy at or below, sell at or above                                                                                                  |
| `limitCrossPrice`             | Required on limit orders (one basis); optional on TWAP and trigger orders | Pair rate (target / contra), same frame on buy and sell; mutually exclusive with `limitNotionalPrice`                                                                                                   |
| `triggers`                    | Stop / stop-loss / take-profit                                            | Each entry takes exactly one of `notionalPrice` (USD price of the target asset) or `crossPrice` (pair rate, target / contra), plus `triggerType` (`upper` / `lower`)                                    |
| `attachedBracket`             | Optional on same-chain EVM market / limit / TWAP orders                   | Take-profit / stop-loss pair placed with the entry; requires `funderAddress` — see [Bracket Orders](/docs/brackets)                                                                                          |
| `expireTime`                  | Optional for limit / trigger orders                                       | Order expiration for good-til-time behavior; omit for good-til-cancelled                                                                                                                                |
| `durationSeconds`             | TWAP orders                                                               | Order duration in seconds; converted to the onchain deadline with a 60s execution buffer. Quote-time only                                                                                               |
| `startTime`                   | Optional for TWAP                                                         | ISO-8601 scheduled start; `durationSeconds` is measured from it. Send the same value on the quote and the order                                                                                         |

<CardGroup cols={2}>
  <Card title="EVM Overview" icon="cube" href="/docs/evm-overview">
    How quoting, routing, and signing work on EVM.
  </Card>

  <Card title="Non-Custodial by Design" icon="shield-halved" href="/docs/non-custodial">
    How Flash keeps funds in the user's wallet for every order type.
  </Card>
</CardGroup>

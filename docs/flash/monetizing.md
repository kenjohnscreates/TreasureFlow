> ## Documentation Index
> Fetch the complete documentation index at: https://flash.definitive.fi/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Monetize Your Integration

> Collect fees on every trade executed through Flash. Set your rate, attach your wallets, and start earning.

As an integrator, you can collect a fee on every trade Flash executes on behalf of your users. You choose the rate, Flash collects it at execution time, and the proceeds accumulate in the Flash Portfolio of your Definitive account.

## How it works

When you call Flash, include the `flashIntegratorFeeBps` parameter on both `POST /quote` and `POST /order`. Choose the fee before quoting, then submit the same string value with the signed order. Flash deducts your fee from the trade output and routes it to the vault in your Flash Portfolio, controlled by your fee wallet. Your Definitive account has a single Flash Portfolio, and that is where every integrator fee lands.

| Concept            | Detail                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Parameter**      | `flashIntegratorFeeBps`                                                                                                  |
| **Format**         | String, in basis points. `"50"` = 0.50%, `"100"` = 1.00%.                                                                |
| **Where it goes**  | The Flash Portfolio of your Definitive account, in a vault owned by the fee wallet connected to your integrator account. |
| **When to set it** | On `POST /quote` and `POST /order`, with the same value on both calls.                                                   |

## Definitive's fee

<Note>
  The 10 bps rate is a **promotional launch rate**, in effect through **December 2026**. Pricing may change after the promotional period. **Enterprise plans are structured differently** — [reach out](https://www.definitive.fi/flash-api#contact) to the Definitive team to discuss.
</Note>

Definitive charges a 10 bps (0.10%) base fee on every trade, across all order types. This is separate from your integrator fee: `flashIntegratorFeeBps` stacks on top, so the total a user pays is Definitive's fee plus whatever rate you set. Both are already included in the quote's `estimatedFeeNotional`, so you always quote the true all-in cost regardless of the current rate.

## Which token your fee is paid in

Your fee is paid in one of the trade's two tokens. Flash pays out in a stablecoin or major (e.g. WETH) if that's on either side of the trade, and defaults to the input token when neither side is a stablecoin or major. (The `feeTicker` field on each fill tells you which token a given fee was collected in.) You can always swap into stables/majors using Definitive if preferred.

## Set your fee on quote and order

Pass `flashIntegratorFeeBps` as a string when calling `POST /quote`. Example: buying WETH with 100 USDC on Base with a 50 bps fee.

```bash cURL theme={null}
curl -X POST https://flash.definitive.fi/v1/quote \
  -H "x-definitive-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "targetChain": "base",
    "contraChain": "base",
    "targetAsset": "0x4200000000000000000000000000000000000006",
    "contraAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "side": "buy",
    "qty": "100",
    "orderType": "market",
    "flashIntegratorFeeBps": "50"
  }'
```

After the user signs the quote payload, submit the order with the same `flashIntegratorFeeBps` value.

```bash cURL theme={null}
curl -X POST https://flash.definitive.fi/v1/order \
  -H "x-definitive-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "targetChain": "base",
    "contraChain": "base",
    "targetAsset": "0x4200000000000000000000000000000000000006",
    "contraAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "side": "buy",
    "qty": "100",
    "orderType": "market",
    "funderAddress": "0xUSER_WALLET",
    "quoteId": "q_abc123",
    "userSignature": "0x...",
    "evmOrderTypedData": "...",
    "flashIntegratorFeeBps": "50"
  }'
```

**To use the same fee on every trade**, hardcode `flashIntegratorFeeBps` in your integration logic and send it on both calls. **To vary fees per trade**, choose the value before `POST /quote` and reuse it unchanged on `POST /order`.

## Withdraw your fees

<Steps>
  <Step title="Log in to Definitive">
    Go to [app.definitive.fi](https://app.definitive.fi) and sign in with your Flash integrator credentials.
  </Step>

  <Step title="Open your Flash Portfolio">
    Your accrued fees are held there. Connect the EVM or Solana wallet associated with the vault you want to withdraw from.
  </Step>

  <Step title="Withdraw">
    Click **Withdraw** and sign the transaction in your wallet to move funds from the vault to your fee wallet.
  </Step>
</Steps>

## Track your fees

Every fill returned by `GET /orders/{orderId}` includes fee fields so you can reconcile earnings programmatically. Sum `integratorFeeNotional` across fills for your total earnings. You can also track your fees on the Flash Integrator Dashboard - see details in [Become an Integrator](https://flash.definitive.fi/docs/getting-started).

| Fill field            | What it contains                                                       |
| --------------------- | ---------------------------------------------------------------------- |
| `integratorFeeAmount` | **Your integrator fee** for this fill, in the fee token                |
| `feeAmount`           | Total fee (platform + network + your integrator fee), in the fee token |
| `feeNotional`         | Total fee in USD                                                       |
| `tradeFeeAmount`      | Definitive's platform fee, in the fee token (excludes your fee)        |
| `networkFeeAmount`    | Gas/network portion, in the fee token                                  |
| `feeTicker`           | Token the fees were denominated in                                     |

## Quick reference

| Question                          | Answer                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| Where do I set my fee?            | `flashIntegratorFeeBps` on `POST /quote` and `POST /order`                                      |
| Can I change my fee per trade?    | Yes. Set it on each order individually.                                                         |
| What if I omit the fee parameter? | No integrator fee is charged for that order.                                                    |
| Where do fees accumulate?         | The Flash Portfolio of your Definitive account.                                                 |
| How do I withdraw?                | Sign in at [app.definitive.fi](https://app.definitive.fi), connect your wallet, click Withdraw. |

## Base builder-code attribution

Base runs a builder-grant program that rewards the builders behind onchain activity. Attribution uses [ERC-8021](https://docs.base.org/base-chain/builder-codes/builder-codes) builder codes: a short code you register on [base.dev](https://base.dev) that identifies you as the builder behind a transaction. Pass your code to Flash on an order, and Flash stamps it onto the settlement transaction's calldata so Base's indexers attribute that activity to you.

Attribution is independent of [integrator fees](#how-it-works) — use either feature without the other.

### How it works

1. Register a builder code on [base.dev](https://base.dev). The code is a lookup key in Base's onchain Code Registry — a plain string such as `myapp`, not a key:value pair.
2. Include `erc8021AttributionCode` on `POST /order`. Flash appends it to the settlement transaction calldata as an ERC-8021 suffix, alongside Definitive's own code.
3. Base's indexers decode the suffix and attribute the transaction to your registered code.

| Concept             | Detail                                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Parameter**       | `erc8021AttributionCode`                                                                                                                                       |
| **Format**          | String, 1–32 characters of `[a-zA-Z0-9_.-]`. Commas are rejected (the comma is the ERC-8021 multi-code delimiter). Use your plain registry code, e.g. `myapp`. |
| **Where to set it** | `POST /order` only. It has no pricing effect, so it is not accepted on `POST /quote`.                                                                          |
| **Chains**          | EVM orders only. Silently ignored on Solana orders.                                                                                                            |

An invalid value is rejected at order placement with `erc8021AttributionCode must be 1–32 characters of [a-zA-Z0-9_.-] (no commas)`.

<Note>
  Unlike `flashIntegratorFeeBps`, the attribution code is an order-only field. The fee must be sent identically on the quote and order because it changes pricing; the attribution code has no pricing effect, so you send it only on `POST /order`.
</Note>

### Pass your code on the order

Include `erc8021AttributionCode` when you submit the signed order. Nothing else about the order flow changes.

```bash cURL theme={null}
curl -X POST https://flash.definitive.fi/v1/order \
  -H "x-definitive-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "targetChain": "base",
    "contraChain": "base",
    "targetAsset": "0x4200000000000000000000000000000000000006",
    "contraAsset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "side": "buy",
    "qty": "100",
    "orderType": "market",
    "funderAddress": "0xUSER_WALLET",
    "quoteId": "q_abc123",
    "userSignature": "0x...",
    "evmOrderTypedData": "...",
    "erc8021AttributionCode": "myapp"
  }'
```

An unregistered or misspelled code never fails the order — the trade still settles, but indexers cannot resolve the code to a payout address, so the activity goes unattributed. Confirm your code matches your [base.dev](https://base.dev) registration.

### Verify attribution onchain

Flash encodes the codes as an ERC-8021 Schema-0 suffix at the tail of the settlement transaction's calldata. To confirm your code landed, decode the calldata tail from the end:

* The last 16 bytes are the ERC-8021 marker beginning `0x8021` — its presence signals a Schema-0 attribution suffix.
* The byte immediately before the marker is the payload length.
* Before the length is the payload itself: the attribution codes joined by commas.

The codes are comma-separated, with Definitive's own registered code first and yours second. Definitive only registers a code on Base, so on non-Base EVM chains the suffix carries your code alone.

<CardGroup cols={2}>
  <Card title="Become an Integrator" icon="key" href="/docs/getting-started">
    Set up your integrator account and API key.
  </Card>

  <Card title="Order endpoint" icon="paper-plane" href="/docs/api-reference/flash/order">
    Full parameter reference for `POST /order`, including `flashIntegratorFeeBps`.
  </Card>
</CardGroup>

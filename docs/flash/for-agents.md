> ## Documentation Index
> Fetch the complete documentation index at: https://flash.definitive.fi/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# AI Integration

> Everything an AI agent needs to start trading with the Flash API.

# AI Integration

Machine-readable references:

* [`/llms.txt`](/docs/llms.txt) — index of doc pages with links. Best for agents that can fetch URLs.
* [`/llms-full.txt`](/docs/llms-full.txt) — all docs concatenated into one file. Best for pasting into a prompt or uploading as a single context file.
* [`/openapi.json`](https://flash.definitive.fi/v1/openapi.json) — OpenAPI spec.

## Flash MCP server

Want a working example instead of wiring the API yourself? The [Flash MCP server](https://www.npmjs.com/package/@definitive-fi/flash-mcp) is an open-source [Model Context Protocol](https://modelcontextprotocol.io) server that implements the full quote → sign → submit flow described below, and it doubles as a reference implementation you can read and copy from.

Add it to Claude Code:

```
claude mcp add definitive-flash -- npx -y @definitive-fi/flash-mcp
```

Or add it to Claude Desktop, Cursor, or any MCP client via config:

```json theme={null}
{
  "mcpServers": {
    "definitive-flash": {
      "command": "npx",
      "args": ["-y", "@definitive-fi/flash-mcp"]
    }
  }
}
```

It exposes tools for the whole trading lifecycle — `flash_setup`, `flash_status`, `flash_quote`, `flash_balances`, `flash_submit_order`, `flash_get_order`, `flash_list_orders`, and `flash_cancel_order` — handling wrapping, approvals, signing, and fill polling across EVM wallets and Solana.

* **npm:** [`@definitive-fi/flash-mcp`](https://www.npmjs.com/package/@definitive-fi/flash-mcp)
* **Source:** [github.com/DefinitiveCo/flash-mcp](https://github.com/DefinitiveCo/flash-mcp)

Prefer to integrate the REST API directly? Keep reading.

## Integrate with an LLM

1. **Get an API key** — follow [Become an Integrator](/docs/getting-started).
2. **Give your LLM the docs** — point it at [`/llms.txt`](/docs/llms.txt) or paste [`/llms-full.txt`](/docs/llms-full.txt) into its context.
3. **Call the API** — `POST /quote`, sign the returned payload, then `POST /order` (details below).

## Auth

Pass an API key in the `x-definitive-api-key` header on every request. If you only want to trade, you can use the prefilled Definitive integrator key:

```
dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b
```

To register your own org as the integrator, follow [Become an Integrator](/docs/getting-started).

## Find an asset

Users name assets by symbol; the API takes addresses. `GET /search` bridges the two. It accepts a symbol, a name, or a pasted address and returns ranked matches, most relevant first.

```bash cURL theme={null}
curl "https://flash.definitive.fi/v1/search?query=weth&chain=base&limit=1" \
  -H "x-definitive-api-key: YOUR_API_KEY"
```

```json theme={null}
{
  "assets": [
    {
      "chain": "base",
      "address": "0x4200000000000000000000000000000000000006",
      "symbol": "WETH",
      "name": "Wrapped Ethereum",
      "decimals": 18,
      "price": "1886.63606082",
      "marketCap": "527528552",
      "liquidity": "47702954",
      "volume24h": "104218305",
      "priceChange24h": "-0.01768310032441419",
      "holders": 4973090,
      "imageUrl": "https://definitive-icons-prod.s3.amazonaws.com/id/4f74a37d-dd42-4758-93bc-3d729a8a6a05",
      "riskFlagged": false
    }
  ]
}
```

`address` and `chain` feed straight into `targetAsset` / `targetChain` or `contraAsset` / `contraChain` on the quote. `chain` is optional (omit it to search every supported chain), and `limit` defaults to 10 and is capped at 25.

## Flow

Base URL: `https://flash.definitive.fi/v1`

Three steps: quote → sign → submit. The walkthrough below covers both EVM chains and Solana (SVM); for the full per-chain reference see [EVM Overview](/docs/evm-overview) and [Solana Overview](/docs/solana-overview). Set the chain with `targetChain` / `contraChain` (`solana` for SVM). The quote response and submit fields follow the chain of the spent asset: EVM sources return an `evm` block, Solana sources return a `svm` block, and the other block is always null.

### 1. Get a quote

`POST /quote` — returns pricing for a swap. Pass `targetAsset` / `contraAsset`, their `targetChain` / `contraChain`, `side` (`buy` or `sell`), `qty` as a decimal string in the spent asset's units (`contraAsset` units on a `buy`, `targetAsset` units on a `sell`), and `orderType`. Crosschain market orders use different chain values and require `recipientAddress`; other order types are same-chain. Also pass `funderAddress`, the wallet that will sign and fund the order, so Flash can build the signing payloads. The payload encodes the signer's address, so omitting it returns an empty signing payload (an empty `evm.orderTypedData` on EVM, a null `svm.orderMessage` on Solana). On EVM, asset and wallet addresses are hex (`0x...`); on Solana, they are base58 mint and wallet addresses. If you charge an integrator fee, include `flashIntegratorFeeBps` and send the same value on `POST /order`.

To place a take-profit / stop-loss pair together with a `market`, `limit`, or `twap` order (same-chain EVM), add `attachedBracket` to the quote and submit requests — the quote returns a second payload to sign for the pair. See [Bracket Orders](/docs/brackets).

You can spend a native gas asset two ways, and both settle against the wrapped token. **1) Wrap first:** wrap it yourself, then quote and submit against the wrapped token address like any other token. **2) Quote native:** quote with the native asset and Flash returns a `wrap` action to send from `funderAddress` before submitting.

* **EVM.** Quote with `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee` as the spent asset, send the returned `wrap.evmTx`, then submit using the wrapped-native asset returned by the quote.
* **Solana.** Quote with `So11111111111111111111111111111111111111112` as the spent asset and `svmUseNativeSOL: true`, then send the returned `wrap.svmInstructions` before submitting. Omit the flag and the mint is treated as an ordinary wSOL balance (the wrap-first path).

See [EVM native assets](/docs/evm-overview#native-eth-and-wrapped-assets) and [Solana native SOL](/docs/solana-overview#native-sol-and-wsol).

Returns:

* `quoteId` — echo back on submit to lock pricing
* `bridgeQuoteId` — for crosschain quotes, echo back on submit when non-null
* `from` / `to` — directional legs, each with `asset` (`"target"` or `"contra"`), `amount`, and `notional`
* `fees.estimatedFeeNotional` — total fee in USD notional
* `wrap` — pre-trade wrapping action, always present but null unless the quote spends a native gas asset

Plus chain-specific signing payloads (the other block is always null):

<AccordionGroup>
  <Accordion title="EVM" defaultOpen>
    * `evm.orderTypedData` — EIP-712 payload to sign
    * `evm.permitTypedData` *(optional, Permit2)* — typed-data payload to sign, present only when the order uses Permit2 and a new permit signature is still needed
    * `evm.approveTx` *(optional)* — ERC-20 allowance transaction to submit onchain; its spender is the settlement contract, or the Permit2 contract on the Permit2 path
  </Accordion>

  <Accordion title="SVM (Solana)" defaultOpen>
    * `svm.orderMessage` — UTF-8 message the user must Ed25519-sign
    * `svm.nonce` / `svm.deadline` — order nonce and Unix-seconds expiry, echoed back on submit
    * `svm.ataSetupIxs` *(optional)* — idempotent instructions to create the funder's input/output token accounts, present when either is missing on-chain
    * `svm.delegateIx` *(optional)* — raw delegation instruction to submit onchain yourself; the default path
    * `svm.sponsoredDelegateTx` *(optional)* — base64 `VersionedTransaction`, a sponsor-paid alternative to `svm.delegateIx`; present only for specific accounts
  </Accordion>
</AccordionGroup>

### 2. Sign the payload

<AccordionGroup>
  <Accordion title="EVM" defaultOpen>
    **Token allowance (one-time per token).** Flash uses one of two allowance mechanisms — a direct ERC-20 approval to the settlement contract, or Permit2 — chosen at quote time from the wallet's current allowance state. With nothing approved yet it defaults to the direct approval (two signatures for a first trade instead of three); to force Permit2, pre-approve the token to the canonical Permit2 contract (`0x000000000022D473030F116dDEE9F6B43aC78BA3`) before quoting. If the quote returns `evm.approveTx`, submit it onchain first; it already targets the correct spender (the settlement contract, or the Permit2 contract on the Permit2 path). Once landed, future orders for the same token skip this step.

    **Permit2.** If the quote returns `evm.permitTypedData`, the order uses Permit2: sign it the same way as `evm.orderTypedData`. On submit, pass the signature as `evmPermitSignature` and echo the payload back as `evmPermitTypedData`. The permit establishes a reusable allowance, so later orders for the same token will not return `evm.permitTypedData` again.

    **Neither field returned.** If `evm.approveTx` is null and `evm.permitTypedData` is empty while `evm.orderTypedData` is present, the order is already authorized: an onchain allowance covers it, or Flash holds a permit your wallet signed with an earlier order (even one that was cancelled or expired unfilled) and will submit it onchain with this order's settlement. This is a valid quote — sign `evm.orderTypedData` and submit. Do not treat the absence as an error, and do not conclude authorization is missing from onchain allowance or nonce reads: a held permit is invisible onchain until the first order that uses it executes.

    **Order signature.** `evm.orderTypedData` is a JSON-stringified EIP-712 payload. Parse it and sign with `signTypedData`. On submit, pass the signature as `userSignature` and echo the payload back as `evmOrderTypedData`. Example with viem:

    ```ts theme={null}
    import { privateKeyToAccount } from "viem/accounts";

    const account = privateKeyToAccount("0x...");
    const { domain, types, primaryType, message } = JSON.parse(quote.evm.orderTypedData);
    const userSignature = await account.signTypedData({ domain, types, primaryType, message });
    ```
  </Accordion>

  <Accordion title="SVM (Solana)" defaultOpen>
    **Token accounts (first time per token).** The swap needs the funder wallet's input and output associated token accounts (ATAs) to exist. When either is missing, the quote returns `svm.ataSetupIxs` — idempotent create-account instructions with the funder wallet in the payer slot. Send them from the funder wallet before delegating, signing, and submitting; the funder wallet pays the account rent and owns the accounts. They are a no-op when the account already exists, and `svm.ataSetupIxs` is null once both accounts exist. When an order also wraps native SOL or needs delegation, run the onchain steps in this order: create token accounts, wrap, delegate.

    **Token delegation (one-time per token).** Solana has no ERC-20 approval. Instead, Flash grants itself delegate authority over the spent token using an SPL `Approve` instruction scoped to the Flash program. The quote returns the delegation in one of two mutually exclusive forms: `svm.delegateIx` (a raw instruction you wrap in a transaction, sign with your funder wallet, and submit yourself, paying the network fee) or `svm.sponsoredDelegateTx` (a base64 `VersionedTransaction` you sign and echo back as `svmSponsoredDelegateTx`, with Definitive covering the fee and broadcasting it). When both are null, the existing delegation already covers this order. Assume you pay the fee: `svm.delegateIx` is the default path, and sponsorship is off for new accounts. Build against the `delegateIx` path, keep SOL in the funder wallet for it, and do not assume `sponsoredDelegateTx` will always appear. Delegation and the order signature are separate actions and cannot be batched: one is an onchain or sponsored transaction, the other a gasless offchain signature. `svm.ataSetupIxs` and `svm.delegateIx` can share one transaction, though, in that order; if you run your own sponsor wallet, make it the fee payer and co-signer there, and rebuild the create-account instructions with the sponsor in the payer slot to cover rent as well.

    **Order signature.** `svm.orderMessage` is a plaintext UTF-8 message, so a wallet's message-signing flow surfaces the order's mint and amount to the user. Sign it with the wallet's Ed25519 key, encode the 64-byte signature as base58, and pass it as `userSignature`. Example with @solana/web3.js:

    ```ts theme={null}
    import { Keypair } from "@solana/web3.js";
    import nacl from "tweetnacl";
    import bs58 from "bs58";

    const keypair = Keypair.fromSecretKey(bs58.decode("..."));
    const message = new TextEncoder().encode(quote.svm.orderMessage);
    const signature = nacl.sign.detached(message, keypair.secretKey);
    const userSignature = bs58.encode(signature);
    ```
  </Accordion>
</AccordionGroup>

### 3. Submit the order

`POST /order` — executes the swap. Pass the same trade fields as the quote plus `funderAddress` (wallet funding the swap), `quoteId` from step 1, and `userSignature` from step 2. For crosschain market orders, also pass `recipientAddress` and echo a non-null `bridgeQuoteId`. If you included `flashIntegratorFeeBps` on the quote, include the same string value here.

<AccordionGroup>
  <Accordion title="EVM" defaultOpen>
    Also pass `evmOrderTypedData` (echo of `quote.evm.orderTypedData`). If Permit2 was used, also include `evmPermitTypedData` (echo of `quote.evm.permitTypedData`) and `evmPermitSignature`. The EVM deadline is encoded inside `evmOrderTypedData` — no separate deadline field needed. To attribute the settlement transaction to your [Base builder code](/docs/monetizing-your-integration#base-builder-code-attribution), include `erc8021AttributionCode` (order-only — it does not affect quotes).
  </Accordion>

  <Accordion title="SVM (Solana)" defaultOpen>
    Also pass `svmNonce` and `svmDeadline` (echoed back unchanged from the quote). If the quote returned `svm.sponsoredDelegateTx`, sign it and include it as `svmSponsoredDelegateTx`. The EVM-only fields (`evmOrderTypedData`, `evmPermitTypedData`, `evmPermitSignature`) must not be present on Solana submissions.
  </Accordion>
</AccordionGroup>

Returns an `orderId`.

<Note>
  To track the order after submit, either poll `GET /orders`, or stream live updates over the [Orders WebSocket](/docs/api-reference/flash/websocket) instead of polling.
</Note>

## Supported chains

`arbitrum`, `avalanche`, `base`, `bsc`, `ethereum`, `optimism`, `polygon`, `solana`, `hyperevm`, `plasma`, `monad`, `robinhood`, `ink`

## Errors

All errors return:

```json theme={null}
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": {}
  }
}
```

HTTP status codes: `400` (bad request), `401` (invalid API key), `404` (not found), `429` (rate limited — see [Rate Limits](/docs/rate-limits)), `500`/`503`/`504` (server error).

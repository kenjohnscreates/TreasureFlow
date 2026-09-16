> ## Documentation Index
> Fetch the complete documentation index at: https://flash.definitive.fi/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# EVM Overview

> How quoting, routing, token approvals, and signing work for Flash orders on EVM chains.

Flash API supports advanced orders for any ERC-20 token on 12 EVM chains: Ethereum, Base, Arbitrum, Avalanche, BNB Chain, HyperEVM, Ink, Monad, Optimism, Plasma, Polygon, and Robinhood Chain. Aggregated liquidity across 200+ DEXs and liquidity sources feeds the Flash smart order router.

This page walks through how quoting, routing, and signing work on EVM at a high level. For the full endpoint reference, see [Quote](/docs/api-reference/flash/quote) and [Order](/docs/api-reference/flash/order).

Base URL for all Flash API requests: `https://flash.definitive.fi/v1`

## EVM order flow

Every EVM order follows four steps: quote, approve, sign, submit. The user's wallet must authorize every action. Flash never takes custody of funds.

<Steps>
  <Step title="Get a quote">
    Call `POST /quote` with the asset pair (`targetAsset` / `contraAsset` and their `targetChain` / `contraChain`), `side` (`buy` or `sell`), `qty` (a decimal string in the spent asset's units: `contraAsset` on a buy, `targetAsset` on a sell), and `orderType`. Crosschain orders use different chain values and require `recipientAddress`; see [Crosschain Orders](/docs/crosschain-orders). Pass `funderAddress`, the wallet that will sign and fund the order, so Flash can build `evm.orderTypedData` — the EIP-712 payload encodes the signer's address, so if you omit it the quote returns an empty `evm.orderTypedData`. If you charge an integrator fee, include `flashIntegratorFeeBps` in this quote request and send the same value when you submit the order. Flash's smart order router evaluates routes across 200+ DEXs and liquidity sources and returns the best pricing.

    The response includes:

    * `quoteId`: reference ID to lock this pricing on submit
    * `bridgeQuoteId` *(crosschain, conditional)*: bridge quote to echo back on submit when non-null
    * `from` / `to`: the spent and received legs, each with `asset` (`target` or `contra`), `amount`, and `notional`
    * `fees.estimatedFeeNotional`: total fee (gas, trading, integrator) in USD notional
    * `evm.orderTypedData`: the EIP-712 payload the user must sign
    * `evm.approveTx` *(conditional)*: an ERC-20 allowance transaction, included when the spent asset's current allowance is insufficient. Its spender is the Flash settlement contract, or the canonical Permit2 contract when the order uses Permit2 (see below)
    * `evm.permitTypedData` *(conditional)*: a Permit2 typed-data payload for gasless approval, present only when the order uses Permit2 and a new permit signature is still needed
    * `wrap` *(conditional)*: a pre-trade wrap action, included when the quote spends the native gas asset
  </Step>

  <Step title="Handle token approval (one-time per token)">
    Flash supports two allowance mechanisms, both fully supported: a direct ERC-20 approval to the Flash settlement contract, or Permit2. The API picks one at quote time from the spent asset's current onchain allowance — the same way on every supported EVM chain — and the quote returns the fields for the chosen path. Respond to what it returns rather than assuming either one.

    With no allowance set yet, the API defaults to the direct approval: it lets a wallet place its first trade in two steps (approval transaction + order signature) instead of three (approval transaction + Permit2 signature + order signature). To use Permit2 instead, approve the spent token from the `funderAddress` to the canonical Permit2 contract (`0x000000000022D473030F116dDEE9F6B43aC78BA3`) for at least the order amount *before* requesting the quote; the quote will then return `evm.permitTypedData` the first time a permit is needed for that token. If the token already carries both a direct approval to the Flash settlement contract and a Permit2 allowance, Flash uses the direct approval; revoke that direct approval to keep the order on Permit2.

    If the quote response includes `evm.approveTx`, the `funderAddress` must submit this transaction onchain before the order can execute. This grants allowance for Flash to pull the spent asset (the `contraAsset` on a buy). It is a standard ERC-20 `approve` for an unlimited amount, already scoped to the correct spender (the settlement contract, or the Permit2 contract on the Permit2 path) — submit it as returned.

    The approval is required once per token per wallet. After the approval transaction lands onchain, future orders for the same token skip this step.

    With `forceMinimalAllowance: true`, the approval to the settlement contract is instead sized to the cumulative amount of this quote plus unfilled open orders, and `evm.approveTx` can recur as open orders change. Pair the flag with `evmUsePermit2: true` on EVM. See [Minimal authorization](/docs/minimal-authorization).

    **When the quote returns neither field.** A quote with `evm.approveTx` null and `evm.permitTypedData` empty — while `evm.orderTypedData` is present — means no authorization action is needed for this order. Either an existing onchain allowance already covers it, or Flash already holds a Permit2 permit your wallet signed with an earlier order that has not yet been used onchain. Signed permits are kept until first use and are submitted onchain automatically as part of order settlement — including permits signed for orders that were later cancelled or expired unfilled. This state is not visible onchain: the Permit2 allowance and nonce for the token stay at zero until the first order that uses the held permit executes, so do not infer missing authorization from onchain reads, and do not treat this quote shape as an error. Sign `evm.orderTypedData` and submit.

    <Note>
      The approval transaction (`evm.approveTx`) and the order signature (`evm.orderTypedData`) cannot be batched into a single user interaction. The approval is an onchain transaction that costs gas. The order signature is a gasless offchain signature. They are separate actions by design.
    </Note>
  </Step>

  <Step title="Sign the order payload">
    The user signs `evm.orderTypedData` using EIP-712 `signTypedData`. This produces the `userSignature` that authorizes Flash to execute the trade on behalf of the user's wallet.

    ```ts theme={null}
    import { privateKeyToAccount } from "viem/accounts";

    const account = privateKeyToAccount("0x...");
    const { domain, types, primaryType, message } = JSON.parse(quote.evm.orderTypedData);
    const userSignature = await account.signTypedData({ domain, types, primaryType, message });
    ```

    **If the quote returned `evm.permitTypedData`**, sign it the same way and pass the result as `evmPermitSignature` on submit. Echo `evmPermitTypedData` back unchanged. The `permitTypedData.spender` is scoped to the Definitive Flash settlement contract for that specific chain, not a generic Permit2 contract.
  </Step>

  <Step title="Submit the order">
    Call `POST /order` with the original trade parameters plus `funderAddress`, `quoteId`, `userSignature`, and `evmOrderTypedData` (echoed back unchanged). For a crosschain market order, also send `recipientAddress` and echo a non-null `bridgeQuoteId`. If you set `flashIntegratorFeeBps` on the quote, include the same string value here. If you want [Base builder-code attribution](/docs/monetizing-your-integration#base-builder-code-attribution) on the settlement transaction, include `erc8021AttributionCode` here (order request only — it does not affect quotes). If Permit2 was used, also include `evmPermitTypedData` and `evmPermitSignature`. The deadline is encoded inside `evmOrderTypedData` — Flash derives it from your quote request (see [Order expiry](/docs/placing-orders#order-expiry)), so no separate deadline field is needed.

    Flash handles gas, MEV protection, simulation, and onchain landing. The response returns an `orderId` for tracking.
  </Step>
</Steps>

## Native ETH and wrapped assets

Flash can quote trades that spend native ETH or another EVM chain's native gas asset, but settlement spends the wrapped ERC-20 token. To spend the native asset, set the spent side of the quote to `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`:

* For `side: "sell"`, set `targetAsset` to the native address.
* For `side: "buy"`, set `contraAsset` to the native address.

When wrapping is required, the quote response includes `wrap.evmTx` and `wrap.wrappedAsset`. Send `wrap.evmTx` from the `funderAddress` before submitting the order. Then submit the order using the quoted `targetAsset` / `contraAsset` values; the spent side will be the wrapped-native token from `wrap.wrappedAsset`, such as WETH.

Submitting an order with `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee` as the spent asset is rejected. The native address is only submit-safe when it is the received asset. On EVM chains, you can receive native ETH or the chain's native gas asset as the output of a trade.

## Smart wallet support

Flash accepts **EIP-1271 smart-wallet signatures** on all EVM chains. This means integrators can use smart contract wallets (multi-sigs, MPC wallets, embedded wallets) as the `funderAddress`, not just EOAs.

**Coinbase Smart Wallet sub-accounts** are supported. Set `funderAddress` to the sub-account address directly, and the sub-account itself signs `orderTypedData` (returning a valid EIP-1271 signature). The parent Coinbase Smart Wallet does not need to sign on the sub-account's behalf.

Supported wallet types include EOAs, embedded smart wallets (e.g. Privy, Turnkey, Dynamic),institutional-grade custody solutions (e.g. Fireblocks, Fordefi, Utila), Coinbase Smart Wallet (including sub-accounts), and any wallet that implements EIP-1271.

### EIP-7702 delegated EOAs

Flash chooses how to validate an order signature from the `funderAddress`'s onchain code, not from the address type. If the address has **any** code, Flash validates the signature via EIP-1271 (`isValidSignature`) instead of plain ECDSA recovery. An EIP-7702 authorization installs delegated code on an EOA (the 23-byte `0xef0100…` delegation indicator), so once an EOA is 7702-delegated Flash treats it as a smart account and routes to the delegate's `isValidSignature`.

Because of this, a raw EOA `eth_signTypedData_v4` signature — even though it recovers correctly to the account address — is **rejected** whenever the delegate's `isValidSignature` does not accept a bare ECDSA signature (`PERMISSION_DENIED: signature verification failed`). Whether it does is set by the delegate implementation: some accept a bare ECDSA signature, others require it wrapped in a specific format.

To place orders from a 7702-delegated account, produce a signature the delegate's `isValidSignature` accepts by signing through the delegated smart-account's typed-data flow, then submit that as `userSignature`. For example, with an Alchemy Modular Account V2 delegate, build the account with `toModularAccountV2({ mode: "7702" })` and sign `orderTypedData` via its smart-account `signTypedData`. If a wallet cannot produce a signature its delegate will validate, remove the 7702 delegation (or trade from a plain EOA or a dedicated smart wallet) so validation falls back to ECDSA recovery.

## Slippage and price protection

You can set slippage tolerance on the quote request via `maxSlippage` (e.g., `"0.05"` = 5%, the default). Flash enforces slippage offchain through its execution engine (the keeper), not through the settlement contract. The signed `FlashOrder` payload does not contain a minimum-output amount, so price protection is applied when the swap is built and submitted:

| Order type                             | How price is protected                                                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Market**                             | The keeper computes a minimum-output amount from `maxSlippage` and injects it into the swap calldata at submission. If the swap cannot meet it, the transaction reverts and no funds move. |
| **Limit**                              | The limit price is the binding constraint. The order only fills at or better than the limit price.                                                                                         |
| **Stop, Stop Loss, Take Profit, TWAP** | These execute at a future time, so the keeper re-evaluates pricing at execution and applies an execution-time slippage schedule bounded by `maxSlippage` / `maxPriceImpact`.               |

`maxSlippage` is a quote-time parameter and is not part of the signed `FlashOrder` struct.

<Note>
  Flash orders must be signed by a standard wallet signer: an EOA signing with its ECDSA key, or a smart-contract wallet producing an EIP-1271 signature. Owners of a multisig that cannot produce an EIP-1271 order signature should trade from a dedicated wallet (or a future delegate-registration flow) rather than the multisig address itself.
</Note>

## Routing and MEV protection

Flash routes every order through a smart order router that aggregates 200+ DEXs and offchain market makers. Before submitting any transaction onchain, Flash simulates the swap offchain to detect malicious or compromised liquidity pools and to optimize for the best execution price.

Orders are submitted through private channels to prevent front-running and sandwich attacks. Auto-slippage optimization is built into the execution pipeline.

<CardGroup cols={2}>
  <Card title="Solana Overview" icon="circle-nodes" href="/docs/solana-overview">
    How quoting, delegation, and signing work on Solana.
  </Card>

  <Card title="Supported Chains" icon="link" href="/docs/supported-chains">
    Full chain and asset coverage.
  </Card>
</CardGroup>

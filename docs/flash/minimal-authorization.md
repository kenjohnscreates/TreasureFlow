> ## Documentation Index
> Fetch the complete documentation index at: https://flash.definitive.fi/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Minimal authorization

> Bound EVM approvals, Permit2 permits, and Solana delegations to the amount Flash requires, and replace unlimited or oversized grants.

Set `forceMinimalAllowance: true` on your [`POST /quote`](/docs/api-reference/flash/quote) request to bound spending authorization to the amount Flash requires. The flag supports EVM and Solana, including [streaming quotes](/docs/api-reference/flash/websocket-quotes). Omit it or set it to `false` to keep the default behavior.

Add the flag to your existing quote request:

```ts theme={null}
const request = {
  ...quoteRequest,
  forceMinimalAllowance: true,
};
```

## Which amounts change

| Authorization                                  | New amount when enabled          |
| ---------------------------------------------- | -------------------------------- |
| ERC-20 approval directly to FlashAllowance     | The required source-token amount |
| Permit2 permit whose spender is FlashAllowance | The required source-token amount |
| ERC-20 approval to the Permit2 contract        | Unlimited                        |
| Solana SPL delegation to the Flash orders PDA  | The required source-token amount |

On EVM, pair the flag with `evmUsePermit2: true`. See [Pair with Permit2 on EVM](#pair-with-permit2-on-evm). On Solana, the same amount applies to standalone delegation, sponsored delegation, and combined setup transactions.

## How Flash sizes authorization

Flash includes unfilled open orders in the same source-token scope plus your new quote. For example, a new 25-USDC order with 40 USDC outstanding requires 65 USDC of authorization, or `65000000` raw units for a six-decimal token.

Use the approval transaction, permit payload, or delegation instruction returned by the quote unchanged. Do not replace its amount with the new order's quantity: doing so can leave existing orders without enough authorization.

## Existing authorization is reused only on an exact match

Flash reuses an existing authorization only when it exactly equals the cumulative amount: this quote plus unfilled open orders in the same source-token scope. Anything else, including an unlimited or oversized grant, is replaced with a fresh authorization sized to that amount on the next order. This is how the flag revokes an unlimited or oversized grant.

| Authorization                                  | What the quote returns when the existing amount differs                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| ERC-20 approval directly to FlashAllowance     | `evm.approveTx` with an `approve` to FlashAllowance for the cumulative amount                                                              |
| Permit2 permit whose spender is FlashAllowance | `evm.permitTypedData` for a fresh `PermitSingle` at the cumulative amount. Permit2 overwrites the prior allowance when the order executes  |
| Solana SPL delegation to the Flash orders PDA  | `svm.delegateIx` or `svm.sponsoredDelegateTx` with an SPL `Approve` for the cumulative amount. The `Approve` replaces the delegated amount |

EVM reuse also applies to a Permit2 permit signed for an earlier order and held for settlement: the held permit is reused only when it exactly equals the cumulative amount. On Solana, the token account must have the expected Flash delegate and exactly the cumulative delegated amount.

The ERC-20 approval to the Permit2 contract itself stays unlimited and is never replaced. Requests without `forceMinimalAllowance` are unaffected.

After a fill consumes part of a bounded authorization, the remaining amount no longer equals the cumulative amount, so a later quote requests another approval, permit, or delegation. Always handle the returned authorization fields, even if the wallet previously traded the token.

## Pair with Permit2 on EVM

Set `evmUsePermit2: true` alongside `forceMinimalAllowance: true` on EVM.

On the direct-approval path, bounding the allowance means `evm.approveTx` can change a non-zero allowance to a different non-zero value. Some ERC-20 tokens, notably USDT on Ethereum mainnet, revert on a non-zero-to-non-zero `approve`, so that transaction fails. Under Permit2, the one-time ERC-20 approval to the Permit2 contract goes from zero to unlimited, which every token accepts. Every subsequent bound is an offchain `PermitSingle` signature, which has no such restriction and costs no gas.

A wallet that already holds an unlimited direct approval to FlashAllowance keeps using it until that approval is revoked by setting it to `0`. The direct path takes precedence whenever it covers the order, so `evmUsePermit2` does not move such a wallet to Permit2 on its own.

## Sign and submit

Follow the existing [EVM](/docs/evm-overview) or [Solana](/docs/solana-overview) setup and signing flow. Submit the returned signing payloads unchanged. You do not need to pass `forceMinimalAllowance` to `POST /order`.

You cannot combine `forceMinimalAllowance: true` with `attachedBracket`. The quote request is rejected for that combination.

The required amount is a snapshot of open orders when Flash prepares the quote. It excludes other quotes that have not been submitted and does not make concurrent setup and submission atomic. Avoid overlapping setup transactions for the same source token; request a fresh quote when the order or authorization state changes.

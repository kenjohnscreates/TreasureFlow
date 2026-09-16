> ## Documentation Index
> Fetch the complete documentation index at: https://www.dynamic.xyz/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Agent Payments

> How agents can pay for API access automatically using HTTP 402 payment flows, with Dynamic server wallets and x402 or MPP.

Agents often need to pay for services—API calls, data access, compute—without a human approving each payment. HTTP **402 Payment Required** is designed for this: when the agent calls a 402-protected API, the server returns payment requirements; the agent pays and retries; the server delivers the resource.

Dynamic server wallets provide the signing and key management layer. The wire format and settlement depend on which protocol you use.

### Cross-chain funding via Fireblocks Flow

Agents often hold different tokens than what a paywall requires — ETH on Base when the API wants SOL, or USDC on Arbitrum when the payment must settle on Ethereum. Dynamic's [Fireblocks Flow API](/docs/overview/fireblocks-flow-api) handles this automatically: it quotes a swap or bridge route, returns a signing payload, and settles funds to any target token on any chain.

The complete closed loop uses the Flow API together with any Dynamic SDK for signing:

```
POST /server/{envId}/flow/{mode} → POST /source → POST /quote
  → POST /prepare → SDK sign + broadcast on-chain → POST /broadcast → poll settlement
```

Any Dynamic SDK can be used for the signing step — Node, React, React Native, Flutter, Swift, Kotlin, or Unity. See [docs.dynamic.xyz](https://docs.dynamic.xyz) for your platform.

<Note>
  Fireblocks Flow requires feature enablement per-environment. If you see `400 "Flow is not enabled"`, request access below.
</Note>

<Card title="Request Flow Access" icon="envelope" href="mailto:hello@dynamic.xyz?subject=Flow%20API%20Access%20Request&body=Hi%2C%20I%27d%20like%20to%20enable%20the%20Flow%20API%20for%20environment%20ID%3A%20%5Byour-env-id%5D">
  Email the Dynamic team with your environment ID to enable Fireblocks Flow.
</Card>

<Card title="Fireblocks Flow API guide" href="/docs/overview/fireblocks-flow-api">
  Full guide: flow creation, quote, signing (EVM + Solana), broadcast, and settlement polling.
</Card>

### Reference implementation

[`dynamic-agent-payments`](https://github.com/dynamic-labs-oss/dynamic-agent-payments) is a working CLI and MCP server that pays both x402 and MPP APIs from a Dynamic server wallet. When the agent holds the wrong token or chain, it calls [Fireblocks Flow](/docs/overview/fireblocks-flow-api) to swap or bridge before signing.

```bash theme={"system"}
npx dynamic-agent-payments wallet
npx dynamic-agent-payments pay https://x402-api.fly.dev/api/price-feed
npx dynamic-agent-payments pay-mpp https://api.example.com/resource
```

<Card title="dynamic-agent-payments on GitHub" href="https://github.com/dynamic-labs-oss/dynamic-agent-payments">
  CLI and MCP server for paying x402 and MPP APIs from a Dynamic server wallet, with cross-chain auto-funding via Fireblocks Flow.
</Card>

***

### Build with x402

The [x402 protocol](https://www.x402.org/) defines how onchain payment is negotiated over HTTP. The client receives payment requirements in the 402 response, signs with its wallet, and retries the request with an `X-Payment` header. A facilitator (for example, the [Fireblocks x402 facilitator](https://developers.fireblocks.com/docs/x402-facilitator-overview)) verifies and settles onchain.

**Best for:** x402-protected APIs, USDC payments on Base or Solana, Fireblocks facilitator.

<Card title="Using Dynamic with x402" href="/docs/recipes/integrations/x402/implementation">
  Wire up a Dynamic wallet as the x402 payment client on EVM or Solana.
</Card>

***

### MPP

The [Machine Payments Protocol (MPP)](https://mpp.dev) extends HTTP 402 for machine-to-machine traffic. The `mppx` client handles negotiation, signing, and retry automatically. Dynamic's Node SDK provides the MPC-backed signing account.

**Best for:** APIs and services that speak MPP.

<Card title="Machine Payments with MPP (Node.js)" href="/docs/recipes/integrations/mpp">
  Create a Dynamic server wallet, fund it, and make MPP payments.
</Card>

## Choosing a protocol

If you're building your own integration, x402 and MPP target different protocol stacks:

|                | x402                                      | MPP                                |
| -------------- | ----------------------------------------- | ---------------------------------- |
| Protocol       | x402                                      | MPP                                |
| Settlement     | Onchain (Base, Solana, and others)        | Tempo or Solana                    |
| Client library | `x402-fetch`, `x402-axios`, `x402-solana` | `mppx` (+ `@solana/mpp` on Solana) |
| Facilitator    | Fireblocks (and others)                   | Chain-native / server              |

For a full comparison and background on how 402 flows work, see the [HTTP 402 overview](/docs/recipes/integrations/x402/overview).

## Related

* [Server Wallets Setup](/docs/node/wallets/server-wallets/overview) — create and manage the wallets your agent uses to pay
* [Agents Overview](/docs/overview/agents/overview) — wallet patterns for autonomous agents and agents acting for users

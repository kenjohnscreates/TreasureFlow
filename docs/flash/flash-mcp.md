> ## Documentation Index
> Fetch the complete documentation index at: https://flash.definitive.fi/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Flash MCP server

> Trade on Flash from any MCP client (Claude Code, Claude Desktop, Cursor, Codex) with the open-source @definitive-fi/flash-mcp server. It handles the full quote → sign → submit → poll flow for EVM and Solana.

The **Flash MCP server** ([`@definitive-fi/flash-mcp`](https://www.npmjs.com/package/@definitive-fi/flash-mcp)) lets an AI agent quote, execute, and manage Flash trades directly from any [MCP](https://modelcontextprotocol.io) client — Claude Code, Claude Desktop, Cursor, Codex, and others. It's the fastest way to give an agent a working Flash integration: no code to write, no signing flow to implement.

The server handles the entire order lifecycle for you — **quote → wrap/approve → sign → submit → poll for fill** — across both EVM wallets and Solana, routing over 200+ liquidity sources on 13 chains.

<CardGroup cols={2}>
  <Card title="npm" icon="npm" href="https://www.npmjs.com/package/@definitive-fi/flash-mcp">
    `@definitive-fi/flash-mcp`
  </Card>

  <Card title="GitHub" icon="github" href="https://github.com/DefinitiveCo/flash-mcp">
    Open source — MIT. Doubles as a reference implementation of the quote → sign → submit flow.
  </Card>
</CardGroup>

## Tools

| Tool                 | Purpose                                                                                          | Moves funds |
| -------------------- | ------------------------------------------------------------------------------------------------ | ----------- |
| `flash_setup`        | Connect your account: link to generate a Flash API key, then store the key and funder wallet(s). | No          |
| `flash_status`       | Show what's configured (API key, wallets) and the supported chains.                              | No          |
| `flash_quote`        | Price a trade without executing. No wallet required.                                             | No          |
| `flash_balances`     | Native + token balances for any wallet, via the built-in per-chain RPCs.                         | No          |
| `flash_submit_order` | Execute a trade end to end (market, limit, twap, stop, take-profit).                             | **Yes**     |
| `flash_get_order`    | Status, fills, and detail for one order.                                                         | No          |
| `flash_list_orders`  | Recent orders for a funder wallet.                                                               | No          |
| `flash_cancel_order` | Cancel a resting order.                                                                          | No          |

## Install

The server is published to npm — no clone or build needed. Pick your client:

<Tabs>
  <Tab title="Claude Code">
    ```bash theme={null}
    claude mcp add definitive-flash -- npx -y @definitive-fi/flash-mcp
    ```

    Or install the plugin, which bundles the server plus a trading-workflow skill:

    ```
    /plugin marketplace add DefinitiveCo/flash-mcp
    /plugin install definitive-flash@flash-mcp
    ```
  </Tab>

  <Tab title="Cursor">
    Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per-project):

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
  </Tab>

  <Tab title="Codex">
    ```bash theme={null}
    codex mcp add definitive-flash -- npx -y @definitive-fi/flash-mcp
    ```

    Or add to `~/.codex/config.toml`:

    ```toml theme={null}
    [mcp_servers.definitive-flash]
    command = "npx"
    args = ["-y", "@definitive-fi/flash-mcp"]
    ```
  </Tab>

  <Tab title="Claude Desktop / other">
    Add the same stdio server to the client's config JSON:

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
  </Tab>
</Tabs>

## First-run setup

Run the interactive wizard in your own terminal — it walks through everything in one pass:

```bash theme={null}
npx -y @definitive-fi/flash-mcp setup
```

<Steps>
  <Step title="Generate a Flash API key">
    The wizard opens the Definitive MCP setup page (`app.definitive.fi/account/organization/mcp-setup`). Log in, click **Generate API Key**, **Copy & Close**, and paste the key when prompted.
  </Step>

  <Step title="Add your funder wallet(s)">
    Paste your EVM funder wallet private key, your Solana funder wallet secret, or both. Press Enter to skip either — you can add one later. Secrets are typed into **hidden prompts** and written straight to the OS keychain; they never appear on screen, in shell history, or in any chat transcript.
  </Step>

  <Step title="(Optional) Set custom RPCs">
    Provide a personal RPC endpoint per chain. The public defaults work but are rate-limited — a personal endpoint is recommended if you trade often.
  </Step>
</Steps>

Then, in your MCP client: `flash_status` to confirm, `flash_quote` to price, `flash_submit_order` to trade.

<Warning>
  **Never paste a wallet private key into the chat** — it would pass through the model and the conversation transcript. The `flash_setup` tool does not accept private keys; add wallets only via the setup wizard or the CLI. Your **API key is safe to paste** in chat if you prefer (`flash_setup { "apiKey": "dpka_…" }`) — it enables quoting and cannot move funds. Fund movement always requires your wallet's per-order signature, which the API key can't produce.
</Warning>

### Individual CLI commands

Each wizard step is also available as a one-shot command (prompts are hidden, secrets go to the keychain):

```bash theme={null}
flash-mcp set-key evm     # or: svm, api
flash-mcp set-rpc base https://your-rpc
flash-mcp set-org 5VYFCW7M
flash-mcp status          # show what's configured
flash-mcp remove-key evm
```

If it isn't on your PATH, run it via npx: `npx -y @definitive-fi/flash-mcp set-key evm`.

## Credential storage

Secrets are stored in the **macOS Keychain** (service `definitive-flash-mcp`), encrypted at rest by the OS — never written to a dotfile in plaintext. On non-macOS hosts, or to inject credentials without running `flash_setup`, set environment variables (these take precedence over the keychain):

| Variable                     | Value                                                   |
| ---------------------------- | ------------------------------------------------------- |
| `DEFINITIVE_API_KEY`         | Your Flash API key                                      |
| `DEFINITIVE_PRIVATE_KEY`     | EVM funder wallet private key (`0x` hex)                |
| `DEFINITIVE_SVM_PRIVATE_KEY` | Solana funder wallet secret (base58 or JSON byte array) |

RPC precedence, highest first: per-call `rpcUrl` argument → `DEFINITIVE_RPC_<CHAIN>` env var → `flash_setup` config (`~/.config/definitive-flash-mcp/config.json`) → public default.

## Good to know

* **`flash_submit_order` spends real funds.** It quotes fresh, signs with your stored key, and submits. For market orders it polls until the order reaches a terminal status.
* EVM trades may send a one-time ERC-20 approve (and a wrap tx for native-asset trades) before signing — your wallet needs a little gas for those.
* `qty` is the amount being **spent**: `contraAsset` units for buys, `targetAsset` units for sells. See [Placing Orders](/docs/placing-orders) for the target/contra model.
* **Supported chains:** ethereum, optimism, bsc, polygon, base, arbitrum, avalanche, hyperevm, robinhood, plasma, monad, ink, solana.

<Note>
  Prefer to build the flow yourself instead of running the server? The MCP is a reference implementation of the same three steps documented in [AI Integration](/docs/for-agents): quote → sign → submit.
</Note>

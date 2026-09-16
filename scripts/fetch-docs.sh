#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATE="$(date -u +%Y-%m-%d)"
UA="TreasureFlow-RuntimeHackathon/0.1"

fetch() {
  local dest="$1"
  local url="$2"
  mkdir -p "$(dirname "$dest")"
  echo "FETCH $url -> $dest"
  if curl -fsSL -A "$UA" -L --retry 2 --retry-delay 1 "$url" -o "$dest"; then
    printf '%s\n' "$url" > "${dest}.source"
    printf '%s\n' "$DATE" > "${dest}.fetched"
  else
    echo "FAIL $url" >&2
    printf 'FAILED %s %s\n' "$DATE" "$url" >> "$ROOT/docs/FETCH-FAILURES.md"
    return 0
  fi
}

# Dynamic
fetch "$ROOT/docs/dynamic/llms.txt" "https://www.dynamic.xyz/docs/llms.txt"
fetch "$ROOT/docs/dynamic/server-wallets-overview.md" "https://www.dynamic.xyz/docs/node/wallets/server-wallets/overview.md"
fetch "$ROOT/docs/dynamic/viem-wallet-client.md" "https://www.dynamic.xyz/docs/node/wallets/server-wallets/viem-wallet-client.md"
fetch "$ROOT/docs/dynamic/policies-overview.md" "https://www.dynamic.xyz/docs/overview/wallets/embedded-wallets/mpc/policies/overview.md"
fetch "$ROOT/docs/dynamic/policy-layers.md" "https://www.dynamic.xyz/docs/overview/wallets/embedded-wallets/mpc/policies/policy-layers.md"
fetch "$ROOT/docs/dynamic/creating-rules.md" "https://www.dynamic.xyz/docs/overview/wallets/embedded-wallets/mpc/policies/creating-rules.md"
fetch "$ROOT/docs/dynamic/managing-layers.md" "https://www.dynamic.xyz/docs/overview/wallets/embedded-wallets/mpc/policies/managing-layers.md"
fetch "$ROOT/docs/dynamic/agent-payments.md" "https://www.dynamic.xyz/docs/overview/agents/agent-payments.md"
fetch "$ROOT/docs/dynamic/x402-implementation.md" "https://www.dynamic.xyz/docs/recipes/integrations/x402/implementation.md"
fetch "$ROOT/docs/dynamic/agents-overview.md" "https://www.dynamic.xyz/docs/overview/agents/overview.md"
fetch "$ROOT/docs/dynamic/tokens-api-keys.md" "https://www.dynamic.xyz/docs/overview/developer-dashboard/tokens-api-keys.md"
fetch "$ROOT/docs/dynamic/sandbox-vs-live.md" "https://www.dynamic.xyz/docs/overview/developer-dashboard/sandbox-vs-live.md"
fetch "$ROOT/docs/dynamic/sign-typed-data.md" "https://www.dynamic.xyz/docs/node/evm/sign-typed-data.md"
fetch "$ROOT/docs/dynamic/policy-violation-webhooks.md" "https://www.dynamic.xyz/docs/overview/wallets/embedded-wallets/mpc/policies/violation-webhooks.md"
fetch "$ROOT/docs/dynamic/dynamic-agent-payments-readme.md" "https://raw.githubusercontent.com/dynamic-labs-oss/dynamic-agent-payments/main/README.md"

# Flash
fetch "$ROOT/docs/flash/llms.txt" "https://flash.definitive.fi/docs/llms.txt"
fetch "$ROOT/docs/flash/openapi.json" "https://flash.definitive.fi/v1/openapi.json"
fetch "$ROOT/docs/flash/evm-overview.md" "https://flash.definitive.fi/docs/evm-overview.md"
fetch "$ROOT/docs/flash/limit-order.md" "https://flash.definitive.fi/docs/limit-order.md"
fetch "$ROOT/docs/flash/minimal-authorization.md" "https://flash.definitive.fi/docs/minimal-authorization.md"
fetch "$ROOT/docs/flash/for-agents.md" "https://flash.definitive.fi/docs/for-agents.md"
fetch "$ROOT/docs/flash/flash-mcp.md" "https://flash.definitive.fi/docs/flash-mcp.md"
fetch "$ROOT/docs/flash/websocket.md" "https://flash.definitive.fi/docs/api-reference/flash/websocket.md"
fetch "$ROOT/docs/flash/getting-started.md" "https://flash.definitive.fi/docs/getting-started.md"
fetch "$ROOT/docs/flash/placing-orders.md" "https://flash.definitive.fi/docs/placing-orders.md"
fetch "$ROOT/docs/flash/cancelling-orders.md" "https://flash.definitive.fi/docs/cancelling-orders.md"
fetch "$ROOT/docs/flash/supported-chains.md" "https://flash.definitive.fi/docs/supported-chains.md"
fetch "$ROOT/docs/flash/order-statuses.md" "https://flash.definitive.fi/docs/order-statuses.md"
fetch "$ROOT/docs/flash/quote.md" "https://flash.definitive.fi/docs/api-reference/flash/quote.md"
fetch "$ROOT/docs/flash/order.md" "https://flash.definitive.fi/docs/api-reference/flash/order.md"
fetch "$ROOT/docs/flash/get-order.md" "https://flash.definitive.fi/docs/api-reference/flash/get-order.md"
fetch "$ROOT/docs/flash/monetizing.md" "https://flash.definitive.fi/docs/monetizing-your-integration.md"

# Bankr
fetch "$ROOT/docs/bankr/llms.txt" "https://docs.bankr.bot/llms.txt"
fetch "$ROOT/docs/bankr/agent-api-overview.md" "https://docs.bankr.bot/agent-api/overview.md"
fetch "$ROOT/docs/bankr/wallet-api.md" "https://docs.bankr.bot/wallet-api/overview.md"
fetch "$ROOT/docs/bankr/x402-cloud-overview.md" "https://docs.bankr.bot/x402-cloud/overview.md"
fetch "$ROOT/docs/bankr/aero-stock-lp.md" "https://atskills.one/bankrbot/aero-stock-lp"
fetch "$ROOT/docs/bankr/club-faq.md" "https://docs.bankr.bot/docs/faq/bankr-club.md"
fetch "$ROOT/docs/bankr/access.md" "https://docs.bankr.bot/docs/agent/access.md"
fetch "$ROOT/docs/bankr/prompt-endpoint.md" "https://docs.bankr.bot/docs/agent-api/prompt-endpoint.md"
fetch "$ROOT/docs/bankr/skills-readme.md" "https://raw.githubusercontent.com/BankrBot/skills/main/README.md"
fetch "$ROOT/docs/bankr/claude-plugins-readme.md" "https://raw.githubusercontent.com/BankrBot/claude-plugins/main/README.md"
fetch "$ROOT/docs/bankr/api-examples-readme.md" "https://raw.githubusercontent.com/BankrBot/bankr-api-examples/main/README.md"

# Aerodrome / Velodrome
fetch "$ROOT/docs/aerodrome/Router.sol" "https://raw.githubusercontent.com/aerodrome-finance/contracts/main/contracts/Router.sol"
fetch "$ROOT/docs/aerodrome/SPECIFICATION.md" "https://raw.githubusercontent.com/aerodrome-finance/contracts/main/SPECIFICATION.md"
fetch "$ROOT/docs/aerodrome/liquidity.mdx" "https://raw.githubusercontent.com/aerodrome-finance/docs/main/content/liquidity.mdx"
fetch "$ROOT/docs/aerodrome/base-aerodrome-plugin.md" "https://docs.base.org/agents/plugins/native/aerodrome.md"
fetch "$ROOT/docs/aerodrome/sugar-sdk-readme.md" "https://raw.githubusercontent.com/velodrome-finance/sugar-sdk/main/README.md"

# Oracles
fetch "$ROOT/docs/oracles/coinbase-tokenized-equity.md" "https://docs.chain.link/data-feeds/tokenized-equity-feeds/coinbase.md"
fetch "$ROOT/docs/oracles/robinhood-tokenized-equity.md" "https://docs.chain.link/data-feeds/tokenized-equity-feeds/robinhood.md"
fetch "$ROOT/docs/oracles/b20-tokenized-stocks.md" "https://docs.base.org/base-chain/specs/reference/b20/tokenized-stocks-on-base.md"
fetch "$ROOT/docs/oracles/chainlink-data-feeds.md" "https://docs.chain.link/data-feeds.md"

# Base MCP
fetch "$ROOT/docs/base-mcp/plugins-index.md" "https://docs.base.org/agents/plugins/native/index.md"
fetch "$ROOT/docs/base-mcp/agent-frameworks.md" "https://docs.base.org/ai-agents/core-concepts/agent-frameworks.md"
fetch "$ROOT/docs/base-mcp/skills-readme.md" "https://raw.githubusercontent.com/base/skills/main/README.md"

# Hackathon
fetch "$ROOT/docs/hackathon/runtime-nyc.html" "https://runtime.nyc"
fetch "$ROOT/docs/hackathon/luma.html" "https://runtime.bankr.bot/"
fetch "$ROOT/docs/hackathon/yc-build-onchain.md" "https://www.ycombinator.com/blog/build-onchain"
fetch "$ROOT/docs/hackathon/base-yc-rfs.md" "https://blog.base.org/y-combinator-request-for-onchain-startups"
fetch "$ROOT/docs/hackathon/hacker-runbook.txt" "https://docs.google.com/document/d/1rupTAUYSds9NBqaYHtXB-NP6r9mFTKETMxZ8_I_yfZc/export?format=txt"

echo "DONE"

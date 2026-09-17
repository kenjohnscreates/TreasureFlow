# Portfolio Endpoint

> Retrieve token balances, PnL, and NFT holdings for the authenticated wallet.

Source: https://docs.bankr.bot/docs/wallet-api/portfolio.md
Fetched: 2026-09-16

## Endpoint

```
GET /wallet/portfolio
```

Query: `chains` (e.g. `base`), `showLowValueTokens` (tokens under $1 USD), `include` (`pnl`,`nfts`).

`token.balance` is a decimal string. Tokens below $1 USD are filtered unless `showLowValueTokens=true`.

B0 uses `?chains=base&showLowValueTokens=true` and does not request PnL or NFTs.

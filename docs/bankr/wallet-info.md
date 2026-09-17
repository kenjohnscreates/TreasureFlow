# Wallet Info

> Retrieve wallet addresses, social accounts, and Bankr Club status.

Source: https://docs.bankr.bot/docs/wallet-api/wallet-info.md
Fetched: 2026-09-16

## Endpoint

```
GET /wallet/me
```

## Response (200)

```json
{
  "success": true,
  "wallets": [
    { "chain": "evm", "address": "0x1234...5678" },
    { "chain": "solana", "address": "5DcK...NdR" }
  ],
  "socialAccounts": [],
  "refCode": "A1B2C3D4-BNKR",
  "bankrClub": {
    "active": true,
    "subscriptionType": "monthly",
    "renewOrCancelOn": 1720000000000
  },
  "leaderboard": { "score": 1250, "rank": 42 }
}
```

Auth: `X-API-Key`. Any valid API key. `/agent/me` is deprecated.

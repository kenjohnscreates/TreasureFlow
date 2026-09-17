# Transfer Endpoint

> Execute a direct ERC20 or native token transfer.

Source: https://docs.bankr.bot/docs/wallet-api/transfer.md
Fetched: 2026-09-17

## Endpoint

```
POST /wallet/transfer
```

Body: `tokenAddress`, `recipientAddress`, `amount` (human-readable decimal string), `isNativeToken`, optional `chain` (default `base`).

Success: `{ success: true, txHash }`.

Allowed recipients: if configured on the API key, the recipient must be in the allowlist. Read-only keys: 403.

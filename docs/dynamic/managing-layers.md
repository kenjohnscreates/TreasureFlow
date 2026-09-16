> ## Documentation Index
> Fetch the complete documentation index at: https://www.dynamic.xyz/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Managing layers

> Create, read, update, and remove policy rules on account, wallet, and signer layers through the Dynamic API.

<Note>
  Wallet and signer policy layers are in **early access**. [Talk to us](https://www.dynamic.xyz/talk-to-us) if you'd like to participate.
</Note>

Rules are composed in layers. Environment-wide rules are set in the [Developer Dashboard](/docs/overview/developer-dashboard/general) or through the [environment policy API](/docs/overview/wallets/embedded-wallets/mpc/policies/creating-rules). Account, wallet, and signer layers are set with the Dynamic SDK API or JavaScript SDK helpers.

For JavaScript SDK helpers, see the [business accounts policies guide](/docs/javascript/reference/business-accounts/policies/overview).

## Before you start

The examples below use `https://app.dynamicauth.com/api/v0` as the base URL, your environment ID, and a bearer token for an authorized user.

* For business-account layers, the caller must be a business-account owner or admin.
* For wallet and signer layers, the caller must be the wallet owner. A business-account owner or admin can also manage layers for wallets and signers in their account.

## Account-Layer

The account layer applies to every wallet in a business account. It is created when you first write to it.

### Read the account-Layer

```bash theme={"system"}
curl "https://app.dynamicauth.com/api/v0/sdk/<environment_id>/businessAccounts/<business_account_id>/policy-layer" \
  -H "Authorization: Bearer <your_token>"
```

### Add or update a rule

<Tabs>
  <Tab title="cURL">
    ```bash theme={"system"}
    curl -X PATCH \
    "https://app.dynamicauth.com/api/v0/sdk/<environment_id>/businessAccounts/<business_account_id>/policy-layer" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <your_token>" \
    -d '{
      "op": "upsert",
      "rule": {
        "name": "Allow USDC on Ethereum mainnet",
        "ruleType": "allow",
        "chain": "EVM",
        "chainIds": [1],
        "addresses": ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"],
        "valueLimit": { "maxPerCall": "100000000000" }
      }
    }'
    ```
  </Tab>

  <Tab title="JavaScript SDK">
    ```javascript theme={"system"}
    import { createPolicy } from '@dynamic-labs-sdk/client/waas';

    const businessAccountId = '<business_account_id>';

    const layer = await createPolicy({
      scope: { businessAccountId },
      chain: 'EVM',
      chainIds: [1],
      rules: {
        allowAddresses: ['0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'],
        maxAmountPerTransaction: { amount: '100000000000' },
      },
    });
    ```
  </Tab>
</Tabs>

### Remove a rule

```bash theme={"system"}
curl -X PATCH \
"https://app.dynamicauth.com/api/v0/sdk/<environment_id>/businessAccounts/<business_account_id>/policy-layer" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <your_token>" \
-d '{
  "op": "remove",
  "ruleId": "<existing_rule_id>"
}'
```

## Wallet-Layer

The wallet-Layer applies to a single wallet.

### Read the wallet-Layer

```bash theme={"system"}
curl "https://app.dynamicauth.com/api/v0/sdk/<environment_id>/waas/<wallet_id>/policy-layer" \
  -H "Authorization: Bearer <your_token>"
```

### Add or update a rule

<Tabs>
  <Tab title="cURL">
    ```bash theme={"system"}
    curl -X PATCH \
    "https://app.dynamicauth.com/api/v0/sdk/<environment_id>/waas/<wallet_id>/policy-layer" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <your_token>" \
    -d '{
      "op": "upsert",
      "rule": {
        "name": "Block private key export",
        "ruleType": "deny",
        "chain": "EVM",
        "chainIds": [1],
        "operationRestrictions": { "blockExport": true }
      }
    }'
    ```
  </Tab>

  <Tab title="JavaScript SDK">
    ```javascript theme={"system"}
    import { createPolicy } from '@dynamic-labs-sdk/client/waas';

    const walletId = '<wallet_id>';

    const layer = await createPolicy({
      scope: { walletId },
      chain: 'EVM',
      chainIds: [1],
      rules: { blockExport: true },
    });
    ```
  </Tab>
</Tabs>

### Remove a rule

```bash theme={"system"}
curl -X PATCH \
"https://app.dynamicauth.com/api/v0/sdk/<environment_id>/waas/<wallet_id>/policy-layer" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <your_token>" \
-d '{
  "op": "remove",
  "ruleId": "<existing_rule_id>"
}'
```

## Signer-Layer

The signer-Layer applies to a single signer share set on a wallet. This includes the caller's own share set, delegated access share sets, and additional signers on a business-account wallet. Omit `shareSetId` to target the caller's own active share set. To find a share set id for another signer, use `getWalletAccountShareSets` from the JavaScript SDK; see the [business accounts policies guide](/docs/javascript/reference/business-accounts/policies/overview).

<Note>
  A `shareSetId` is the current identifier for a signer. It rotates when wallet shares are refreshed or reshared, so re-read it with `getWalletAccountShareSets` before each update. The policy is bound to a stable `signerId` that the enclave mints, so a rotated `shareSetId` still points to the same policy.
</Note>

### Read the signer-Layer

```bash theme={"system"}
curl "https://app.dynamicauth.com/api/v0/sdk/<environment_id>/waas/<wallet_id>/signers/self/policy-layer?shareSetId=<share_set_id>" \
  -H "Authorization: Bearer <your_token>"
```

### Add or update a rule

<Tabs>
  <Tab title="cURL">
    ```bash theme={"system"}
    curl -X PATCH \
    "https://app.dynamicauth.com/api/v0/sdk/<environment_id>/waas/<wallet_id>/signers/self/policy-layer" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <your_token>" \
    -d '{
      "op": "upsert",
      "rule": {
        "name": "Deny transfers to flagged address",
        "ruleType": "deny",
        "chain": "EVM",
        "chainIds": [1, 8453],
        "addresses": ["0x..."]
      },
      "shareSetId": "<share_set_id>"
    }'
    ```
  </Tab>

  <Tab title="JavaScript SDK">
    ```javascript theme={"system"}
    import { createPolicy } from '@dynamic-labs-sdk/client/waas';

    const walletId = '<wallet_id>';
    const shareSetId = '<share_set_id>';

    const layer = await createPolicy({
      scope: { walletId, shareSetId },
      chain: 'EVM',
      chainIds: [1, 8453],
      rules: { denyAddresses: ['0x...'] },
    });
    ```
  </Tab>
</Tabs>

### Remove a rule

```bash theme={"system"}
curl -X PATCH \
"https://app.dynamicauth.com/api/v0/sdk/<environment_id>/waas/<wallet_id>/signers/self/policy-layer" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <your_token>" \
-d '{
  "op": "remove",
  "ruleId": "<existing_rule_id>",
  "shareSetId": "<share_set_id>"
}'
```

## Signer-modifiable rules

To let a signer edit or remove a wallet or signer-layer rule later, set `modifiableBySigner: true` when you create or update the rule. The signer can only modify the rule's constraint fields, such as `addresses` and `valueLimit`. They cannot change the rule type or security settings.

`modifiableBySigner` cannot be used on environment-scope rules, and it cannot be combined with `disableBlockaidSecurityChecks` or `operationRestrictions`.

### Wallet-layer example

```bash theme={"system"}
curl -X PATCH \
"https://app.dynamicauth.com/api/v0/sdk/<environment_id>/waas/<wallet_id>/policy-layer" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <your_token>" \
-d '{
  "op": "upsert",
  "rule": {
    "name": "Allow USDC with signer-editable limit",
    "ruleType": "allow",
    "chain": "EVM",
    "chainIds": [1],
    "addresses": ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"],
    "valueLimit": { "maxPerCall": "100000000000" },
    "modifiableBySigner": true
  }
}'
```

### Signer-layer example

```bash theme={"system"}
curl -X PATCH \
"https://app.dynamicauth.com/api/v0/sdk/<environment_id>/waas/<wallet_id>/signers/self/policy-layer" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <your_token>" \
-d '{
  "op": "upsert",
  "rule": {
    "name": "Signer-editable allowlist",
    "ruleType": "allow",
    "chain": "EVM",
    "chainIds": [1],
    "addresses": ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"],
    "modifiableBySigner": true
  },
  "shareSetId": "<share_set_id>"
}'
```

## Rule fields

For the fields used in the examples above, see [Rule fields](/docs/overview/wallets/embedded-wallets/mpc/policies/overview#rule-fields) on the Policies overview page.

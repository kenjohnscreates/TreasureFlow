> ## Documentation Index
> Fetch the complete documentation index at: https://www.dynamic.xyz/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Creating & Managing Rules

> Create, update, and delete policy rules from the developer dashboard or the Dynamic API.

<Info>
  The dashboard and API steps below set **environment-wide** policy rules. For account, wallet, and signer layers, see [Managing layers](/docs/overview/wallets/embedded-wallets/mpc/policies/managing-layers) for API examples, or the [JavaScript SDK business accounts guide](/docs/javascript/reference/business-accounts/policies/overview) for SDK helpers.
</Info>

<Note>
  Wallet and signer policy layers are in **early access**. [Talk to us](https://www.dynamic.xyz/talk-to-us) if you'd like to participate.
</Note>

## Creating a Rule

### Step 1: Navigate to the Policies Tab

On the developer dashboard, navigate to the **Policies** tab under the **Wallets** section. Click on **Create your first rule** to get started.

<Frame>
  <img src="https://mintcdn.com/dynamic-docs-testing/ycIti82Y4pSidMFY/images/policies/policies_dashboard_entrypoint.png?fit=max&auto=format&n=ycIti82Y4pSidMFY&q=85&s=b3433572fb6c83149df97b1ddc171991" alt="Policies Setup Screenshot" width="1640" height="735" data-path="images/policies/policies_dashboard_entrypoint.png" />
</Frame>

### Step 2: Configure the Rule

In **Basic Settings**, you can configure the following for the rule:

* **Rule Name**: A descriptive name for the rule
* **Rule Description**: A description of the rule
* **Rule Type**: The type of rule to create. You can choose between:
  * **Allow**: This rule allows the operation to proceed
  * **Deny**: This rule blocks the operation
* **Network/Environment**: The specific network or environment, such as Sepolia, Base Sepolia, etc.
* **Addresses**: The addresses the rule applies to

Below is an example of configuring a rule to only allow users interacting with the WETH contract on Ethereum mainnet.

<Frame>
  <img src="https://mintcdn.com/dynamic-docs-testing/ycIti82Y4pSidMFY/images/policies/policies_dashboard_weth_example.png?fit=max&auto=format&n=ycIti82Y4pSidMFY&q=85&s=33d49ee3561fbd1eceafac6db887e777" alt="Policies Setup Screenshot" width="1669" height="900" data-path="images/policies/policies_dashboard_weth_example.png" />
</Frame>

### Step 3: Add/Update a Rule

There are two ways to add/update a rule: you can either update using the dashboard or send an API request with your authorized token.

#### Creating a Rule

1. Click on **Save Rule** to create a rule by clicking on **Add Rule** in **Basic Settings** once you have configured the rule.
2. You can also send an API request with your authorized token to create/update a rule. The payload can be found in the JSON tab of the Rule creation page.

Below is an example of creating a rule via curl:

```bash theme={"system"}
curl -X POST \
"https://app.dynamicauth.com/api/v0/environments/<environment_id>/waas/policies" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <your_token>" \
-d '{
  "rulesToAdd": [
    {
        "chain": "EVM",
        "chainIds": [1],
        "name": "Allow only transaction with WETH contract on ETH mainnet",
        "ruleType": "allow",
        "addresses": ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"]
    }
  ]
}'
```

#### Update a Rule

If you have active rules, you will see the **Policy & Rules Management** tab in the Policies tab.

1. Click on the rule you want to update, which will expand to the **Edit Rule** page
2. Update the rule configuration and click on **Save Rule** to update the rule

<Frame>
  <img src="https://mintcdn.com/dynamic-docs-testing/ycIti82Y4pSidMFY/images/policies/policies_rules_list.png?fit=max&auto=format&n=ycIti82Y4pSidMFY&q=85&s=6c1d8781b9d7c0ce2e75daae752bfea1" alt="Policies Setup Screenshot" width="1251" height="277" data-path="images/policies/policies_rules_list.png" />
</Frame>

Below is an example of updating a rule via curl:

```bash theme={"system"}
curl -X PUT \
"https://app.dynamicauth.com/api/v0/environments/<environment_id>/waas/policies" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <your_token>" \
-d '{
  "rulesToUpdate": [
    {
        "id": <existing_rule_id>,
        "chain": "EVM",
        "chainIds": [1],
        "name": "Allow only transaction with WETH contract on ETH mainnet",
        "ruleType": "allow",
        "addresses": ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"]
    }
  ]
}'
```

### Step 4: Verifying Policy

To confirm that your policy rule is enforced, attempt to send a transaction that matches or violates the rule you configured. We recommend performing these tests on a testnet within a sandbox environment.

**Expected Behavior:**

* If the transaction complies with the policy, it will be processed as normal.
* If the transaction violates the policy, the SDK or wallet connector will return an error indicating that the operation is not permitted.

Below is an example of a policy violation error displayed when a transaction does not meet the configured rule criteria:

<Frame>
  <img src="https://mintcdn.com/dynamic-docs-testing/ycIti82Y4pSidMFY/images/policies/policies_policy_violation_error.png?fit=max&auto=format&n=ycIti82Y4pSidMFY&q=85&s=54acd85e80a87c6cecfe6cab11c20741" alt="Policies Setup Screenshot" width="530" height="602" data-path="images/policies/policies_policy_violation_error.png" />
</Frame>

### Step 5: Deleting a Rule

If you have active rules, you will see the **Policy & Rules Management** tab in the Policies tab.

1. Click `...` next to the rule you want to delete, which will expand a dropdown menu with the option to delete the rule
2. Check the box to confirm you want to delete the rule and click on **Delete Rule** button

<Frame>
  <img src="https://mintcdn.com/dynamic-docs-testing/ycIti82Y4pSidMFY/images/policies/policies_rules_delete.png?fit=max&auto=format&n=ycIti82Y4pSidMFY&q=85&s=51232d68a7df29f05f1d7b1c975d5a2d" alt="Policies Setup Screenshot" width="896" height="1254" data-path="images/policies/policies_rules_delete.png" />
</Frame>

Below is an example of deleting a rule via curl:

```bash theme={"system"}
curl -X DELETE \
"https://app.dynamicauth.com/api/v0/environments/<environment_id>/waas/policies" \
-H "Authorization: Bearer <your_token>" \
-H "Content-Type: application/json" \
-d '{
  "ruleIdsToDelete": ["<existing_rule_id>"]
}'
```

## Creating, Updating, and Deleting Rules in Bulk

You can programmatically create or update multiple policy rules at once using the API. To do this, provide an array of rules in the `rulesToAdd`, `rulesToUpdate`, or `ruleIdsToDelete` fields of your request payload.

Here is an example of how to create multiple rules using a POST request (SDKs or HTTP clients):

```bash theme={"system"}
curl -X POST \
"https://app.dynamicauth.com/api/v0/environments/<environment_id>/waas/policies" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <your_token>" \
-d '{
  "rulesToAdd": [
    {
        "chain": "EVM",
        "chainIds": [1],
        "name": "Allow only transaction with the WETH contract on ETH mainnet",
        "ruleType": "allow",
        "addresses": ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"]
    },
    {
        "chain": "EVM",
        "chainIds": [8453],
        "name": "Allow only transaction with USDC contract on Base mainnet",
        "ruleType": "allow",
        "addresses": ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"]
    }
  ]
}'
```

Here is an example of how to update multiple rules using curl:

```bash theme={"system"}
curl -X PUT \
"https://app.dynamicauth.com/api/v0/environments/<environment_id>/waas/policies" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <your_token>" \
-d '{
  "rulesToUpdate": [
    {
        "id": <existing_rule_id>,
        "chain": "EVM",
        "chainIds": [1],
        "name": "Allow only transaction with the WETH contract on ETH mainnet",
        "ruleType": "allow",
        "addresses": ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"]
    },
    {
        "id": <existing_rule_id>,
        "chain": "EVM",
        "chainIds": [8453],
        "name": "Allow only transaction with USDC contract on Base mainnet",
        "ruleType": "allow",
        "addresses": ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"]
    }
  ]
}'
```

Here is an example of how to delete multiple rules using curl:

```bash theme={"system"}
curl -X DELETE \
"https://app.dynamicauth.com/api/v0/environments/<environment_id>/waas/policies" \
-H "Authorization: Bearer <your_token>" \
-H "Content-Type: application/json" \
-d '{
  "ruleIdsToDelete": ["<existing_rule_id>", "<existing_rule_id>"]
}'
```

## USDC allowlist example (Ethereum mainnet, proxy + implementation) to a single address:

USDC on Ethereum mainnet uses a proxy pattern. To allow interactions, add both the proxy and the current implementation addresses to your allowlist, on this example we are allowing interactions to a single address (0x5f09B2caaafD345EaE7B711A32CcBdf59befB4bB):

```bash theme={"system"}
curl -X POST \
"https://app.dynamicauth.com/api/v0/environments/<environment_id>/waas/policies" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <your_token>" \
-d '{
  "rulesToAdd": [
    {
        "chain": "EVM",
        "chainIds": [1],
        "name": "Allow USDC proxy (ETH mainnet)",
        "ruleType": "allow",
        "addresses": ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48","0x43506849d7c04f9138d1a2050bbf3a0c054402dd","0x5f09B2caaafD345EaE7B711A32CcBdf59befB4bB"]
    }
  ]
}'
```

## Value Limit Example (Ethereum mainnet):

On this example we are allowing interactions to a single address (0x5f09B2caaafD345EaE7B711A32CcBdf59befB4bB) with a value limit of 100 USDC:

```bash theme={"system"}
curl -X POST \
"https://app.dynamicauth.com/api/v0/environments/<environment_id>/waas/policies" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <your_token>" \
-d '{
  "rulesToAdd": [
    {
      "chain": "EVM",
      "chainIds": [1],
      "name": "Allow USDC (ETH mainnet) with value limit",
      "ruleType": "allow",
      "addresses": ["0x43506849d7c04f9138d1a2050bbf3a0c054402dd","0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x5f09B2caaafD345EaE7B711A32CcBdf59befB4bB"],
      "valueLimit": {
        "asset": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
        "maxPerCall": "100000000000", // 100 USDC
      }
    }
  ]
}'
```

## Next steps

<CardGroup cols={2}>
  <Card title="Policy Layers" href="/docs/overview/wallets/embedded-wallets/mpc/policies/policy-layers">
    Understand how environment, account, wallet, and signer rules combine.
  </Card>

  <Card title="Violation Webhooks" href="/docs/overview/wallets/embedded-wallets/mpc/policies/violation-webhooks">
    Receive and handle policy violation events.
  </Card>
</CardGroup>

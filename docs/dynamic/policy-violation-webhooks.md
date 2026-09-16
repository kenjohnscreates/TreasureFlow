> ## Documentation Index
> Fetch the complete documentation index at: https://www.dynamic.xyz/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Policy Violation Webhooks

> Receive and handle waas.policy.violation events when a transaction is blocked by a policy rule.

<Note>
  Wallet and signer policy layers are in **early access**. [Talk to us](https://www.dynamic.xyz/talk-to-us) if you'd like to participate.
</Note>

Dynamic emits a `waas.policy.violation` webhook event whenever a transaction is blocked by your configured policy rules. This event provides detailed information about what was blocked and why, making it invaluable for monitoring security, debugging rules, and discovering which addresses your users need to interact with.

## Use Cases

* **Building Allow-Only Rules**: The webhook includes all counterparties involved in a transaction, helping you identify which addresses to add to your allowlist
* **Security Monitoring**: Track blocked transactions and identify potential threats or unusual activity
* **Rule Debugging**: Understand why legitimate transactions are being blocked and adjust rules accordingly
* **Audit Trail**: Maintain a complete log of all policy violations for compliance and security review

## Event Payload

The webhook payload structure varies based on the violation type. Below are the fields you can expect:

### Always Present

| Field                | When present                     | Description                                                                                        |
| -------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `eventName`          | Always                           | Always `waas.policy.violation`                                                                     |
| `data.errorMessage`  | Always                           | Human-readable description of the violation                                                        |
| `data.reasonCode`    | Always                           | Type of violation (see Violation Types section for all possible codes)                             |
| `data.publicKey`     | Most violations                  | The wallet's public key that attempted the transaction                                             |
| `data.walletId`      | Most violations                  | The wallet ID that attempted the transaction                                                       |
| `data.operationType` | Transaction/operation violations | Type of operation blocked: `evmTransaction`, `evmUserOperation`, `svmTransaction`, or `svmMessage` |
| `data.chainId`       | Transaction/operation violations | The chain ID where the violation occurred                                                          |

### Conditionally Present

The following fields may be included depending on the violation type and context:

| Field                       | When Present                    | Description                                                        |
| --------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| `data.deniedAddresses`      | Address-related violations      | Array of addresses that triggered the violation                    |
| `data.notAllowedAddresses`  | Allowlist violations            | Array of addresses not on the allowlist                            |
| `data.counterparties`       | Address and security violations | Array of all counterparties involved with address and label fields |
| `data.asset`                | Value limit violations          | Object containing asset details (address, type, symbol)            |
| `data.maxPerCallLimit`      | Value limit violations          | The configured maximum value limit                                 |
| `data.totalOutgoingValue`   | Value limit violations          | The attempted transaction value that exceeded the limit            |
| `data.simulationStatus`     | Security validation failures    | Status of the transaction simulation                               |
| `data.validationResultType` | Security risk violations        | Type of security validation result (e.g., "Malicious")             |
| `data.address`              | Authentication violations       | Specific address involved in the violation                         |

## Example Payloads

Below are examples of policy violation webhooks for different violation types:

### Address Denied Violation

When a transaction is blocked due to an address not being on the allowlist:

```json theme={"system"}
{
  "messageId": "8ada4f21-a1ad-43bf-92eb-9f42ad9f30fc",
  "eventId": "32d6be06-f069-434f-a345-6609e83961cc",
  "eventName": "waas.policy.violation",
  "timestamp": "2025-10-14T22:23:16.853Z",
  "webhookId": "b94e376c-795a-4ecb-a8b5-b216288c6d23",
  "userId": null,
  "environmentId": "5d76149e-a703-48d0-9977-f46f1ec6ad5a",
  "environmentName": "sandbox",
  "data": {
    "errorMessage": "Policy violation: This action was blocked because '0xf892...fe9c' is not allowed due to a security policy. These policies help protect your account.",
    "publicKey": "0x5d6d4764bd316f25a0048fd5e4aa606c5ebf1569",
    "walletId": "026f9b53-eacf-46a2-bbd6-0174ec670b60",
    "reasonCode": "address_denied",
    "operationType": "evmUserOperation",
    "chainId": "11155111",
    "deniedAddresses": ["0xf892531a10b0060d3f0eceea2da5dfbe7c41fe9c"],
    "counterparties": [
      {
        "address": "0xf892531a10b0060d3f0eceea2da5dfbe7c41fe9c",
        "label": ""
      }
    ]
  }
}
```

### Value Limit Exceeded Violation

When a transaction exceeds the configured value limit for an asset:

```json theme={"system"}
{
  "messageId": "9bda5f32-b2be-54cg-03fc-0g53bf0g41gd",
  "eventId": "43e7cf17-g180-545g-b456-7710g94f72dd",
  "eventName": "waas.policy.violation",
  "timestamp": "2025-10-14T22:25:30.123Z",
  "webhookId": "b94e376c-795a-4ecb-a8b5-b216288c6d23",
  "userId": "a5914498-7a8b-4c58-b04c-9624fef2897c",
  "environmentId": "5d76149e-a703-48d0-9977-f46f1ec6ad5a",
  "environmentName": "sandbox",
  "data": {
    "errorMessage": "Policy violation: Transaction value exceeds the maximum allowed limit",
    "publicKey": "0x5d6d4764bd316f25a0048fd5e4aa606c5ebf1569",
    "walletId": "026f9b53-eacf-46a2-bbd6-0174ec670b60",
    "reasonCode": "value_limit_exceeded",
    "operationType": "evmTransaction",
    "chainId": "1",
    "asset": {
      "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "type": "ERC20",
      "symbol": "USDC"
    },
    "maxPerCallLimit": "100000000",
    "totalOutgoingValue": "150000000"
  }
}
```

### Security Risk Malicious Violation

When a transaction is identified as malicious during security validation:

```json theme={"system"}
{
  "messageId": "7cda6f43-c3cf-65dh-14gd-1h64ch1h52he",
  "eventId": "54f8dg28-h291-656h-c567-8821h05g83ee",
  "eventName": "waas.policy.violation",
  "timestamp": "2025-10-14T22:27:45.456Z",
  "webhookId": "b94e376c-795a-4ecb-a8b5-b216288c6d23",
  "userId": "a5914498-7a8b-4c58-b04c-9624fef2897c",
  "environmentId": "5d76149e-a703-48d0-9977-f46f1ec6ad5a",
  "environmentName": "sandbox",
  "data": {
    "errorMessage": "Policy violation: This transaction was blocked because it was identified as potentially malicious",
    "publicKey": "0x5d6d4764bd316f25a0048fd5e4aa606c5ebf1569",
    "walletId": "026f9b53-eacf-46a2-bbd6-0174ec670b60",
    "reasonCode": "security_risk_malicious",
    "operationType": "evmTransaction",
    "chainId": "1",
    "validationResultType": "Malicious",
    "counterparties": [
      {
        "address": "0x1234567890123456789012345678901234567890",
        "label": "Phishing Contract"
      }
    ]
  }
}
```

### Violation Types

The `reasonCode` field indicates the type of policy violation. The webhook payload structure varies based on the violation type, but always includes the core fields needed to understand what was blocked and why.

#### Address-Related Violations

* **`address_denied`**: Transaction blocked because an address is explicitly denied or not on the allowlist
  * Additional fields: `deniedAddresses`, `counterparties`, `operationType`, `chainId`
* **`address_not_allowed`**: Transaction blocked because address is not explicitly allowed in an allowlist-only configuration
  * Additional fields: `notAllowedAddresses`, `counterparties`, `operationType`, `chainId`

#### Value Limit Violations

* **`value_limit_exceeded`**: Transaction blocked because it exceeds the configured value limit
  * Additional fields: `asset` (address, type, symbol), `maxPerCallLimit`, `totalOutgoingValue`, `operationType`, `chainId`

#### Simulation and Security Violations

* **`simulation_failed`**: Transaction simulation did not succeed, so the transaction was not sent. Either the transaction would revert or the simulation provider could not simulate it
  * Additional fields: `simulationStatus`, `operationType`, `chainId`
* **`security_risk_malicious`**: Transaction identified as malicious by security validation
  * Additional fields: `counterparties`, `validationResultType`, `operationType`, `chainId`

#### Message Format Violations

* **`invalid_message_format`**: Message format validation failed (EVM personal message, EIP-712, UserOperation, or SVM transaction/message format issues)

### Setting Up Webhooks

To receive policy violation events, configure a webhook endpoint in your Developer Dashboard and subscribe to the `waas.policy.violation` event. For more information on webhook setup and signature validation, see the [webhooks documentation](/docs/overview/developer-dashboard/webhooks/overview#webhooks-overview).

## Next steps

<CardGroup cols={2}>
  <Card title="Policies & Rules Overview" href="/docs/overview/wallets/embedded-wallets/mpc/policies/overview">
    Review the security model, allowlist mode, and rule fields.
  </Card>

  <Card title="Creating & Managing Rules" icon="plus" href="/docs/overview/wallets/embedded-wallets/mpc/policies/creating-rules">
    Set rules in the dashboard or API.
  </Card>
</CardGroup>

> ## Documentation Index
> Fetch the complete documentation index at: https://www.dynamic.xyz/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Policies

> Control wallet interactions with fine-grained, tamper-resistant rules across EVM, Solana, Stellar, Bitcoin, and Sui.

<Warning>
  This feature is available for all Dynamic v3 embedded wallets (TSS-MPC). [Upgrade](/docs/react/wallets/embedded-wallets/mpc/upgrade-guide) is required if you are on v2 or earlier.
</Warning>

<Note>
  Wallet and signer policy layers are in **early access**. [Talk to us](https://www.dynamic.xyz/talk-to-us) if you'd like to participate.
</Note>

## Overview

**Policies** gives developers fine-grained control over how wallets interact. Policies are enforced before a transaction is signed, ensuring there is validation before execution.

This allows you to:

* Block malicious or unauthorized counterparties
* Create custom workflows around wallet interactions
* Ensure transactions are simulated and verified before execution

Policies are chain-agnostic, working seamlessly across **EVM** (including Account Abstraction wallets), **Solana**, **Stellar**, **Bitcoin**, and **Sui**.

## Security Model

Dynamic's policy system is designed with security and transparency at its core:

* **Tamper Resistance**: Policies are created and enforced in a trusted execution environment, ensuring they cannot be bypassed at the client level. Only administrators and those with permissions can update and modify rules
* **Auditability**: Every policy update is logged and traceable.
* **Transaction Simulation**: Before a transaction is signed, it is simulated against your rules. Non-compliant requests are automatically rejected.
* **Malicious Transaction Detection**: Before a transaction is signed, all transactions will be validated to ensure they are not being sent to a malicious address.
* **Pre-Signing Enforcement**: Rules apply at signing time, not just after execution. This means developers can trust that no transaction leaves the wallet unless it passes policy checks.

## Policy types

You can apply three types of policy rules to control how wallets interact:

### Allowlist Mode

When you configure an allowlist, only addresses included in your allow rules are permitted. Everything not on the list is blocked.

### Address Evaluation

Policies evaluate all participant addresses involved in a transaction's execution path. If a transaction calls contract A that then calls contract B, every touched address (A and B) is considered a participant for evaluation.
When using an allowlist (only listed addresses are permitted), ensure you include all relevant contract addresses, including proxies and their underlying implementations, to avoid unintended rejections.

### Value Limits

You can add a value limit to any rule to restrict the maximum amount that can be transferred in a single transaction. When a value limit is set, the policy will evaluate the transaction amount and automatically block any transaction that exceeds the specified limit. Value limits work for EVM, Solana (SVM), Stellar, and Bitcoin chains, and can be applied to native tokens (like ETH, SOL, XLM, or BTC) as well as custom tokens (such as ERC-20, SPL, or Stellar assets).

To set a value limit for the native token of the chain, leave the address field for the value limit blank.

## Rule fields

A `WaasPolicyRule` has the following fields:

| Field                               | Description                                                                                                      |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `name`                              | Human-readable rule name.                                                                                        |
| `ruleType`                          | `allow` or `deny`.                                                                                               |
| `chain`                             | Chain the rule applies to, e.g. `EVM`, `SVM`, `BTC`, `STELLAR`, `SUI`.                                           |
| `chainIds`                          | Array of chain IDs the rule applies to.                                                                          |
| `addresses`                         | Array of addresses the rule applies to.                                                                          |
| `valueLimit.maxPerCall`             | Maximum value per transaction, in the asset's smallest unit.                                                     |
| `operationRestrictions.blockExport` | When `true` on a `deny` rule, blocks private key export.                                                         |
| `modifiableBySigner`                | When `true`, the signer the rule applies to can edit or remove the rule. Only valid on wallet and signer layers. |

For more details on `modifiableBySigner`, see [Policy Layers](/docs/overview/wallets/embedded-wallets/mpc/policies/policy-layers).

## Additional Notes

* The list of available chains in the dashboard depends on your configuration settings. Some networks may not be available for policy validation.
* Policies and rules are currently supported for most EVM, Solana, Stellar, Bitcoin, and Sui chains, including their respective testnets.
* On Sui, every signature request is checked against the policy and the signed payload is verified to match the transaction or message the request declares, and operation restrictions such as `blockExport` apply. Address rules and value limits depend on transaction simulation, which does not cover Sui yet.

## Next steps

<CardGroup cols={2}>
  <Card title="Policy Layers" href="/docs/overview/wallets/embedded-wallets/mpc/policies/policy-layers">
    Understand how environment, account, wallet, and signer rules combine.
  </Card>

  <Card title="Creating & Managing Rules" icon="plus" href="/docs/overview/wallets/embedded-wallets/mpc/policies/creating-rules">
    Create and update environment-wide rules in the dashboard or through the API.
  </Card>

  <Card title="Managing layers" icon="server" href="/docs/overview/wallets/embedded-wallets/mpc/policies/managing-layers">
    Create and update account, wallet, and signer layers through the API.
  </Card>
</CardGroup>

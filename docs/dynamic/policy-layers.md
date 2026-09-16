> ## Documentation Index
> Fetch the complete documentation index at: https://www.dynamic.xyz/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Policy Layers

> How Dynamic composes policy rules across environment, account, wallet, and signer layers.

<Note>
  Wallet and signer policy layers are in **early access**. [Talk to us](https://www.dynamic.xyz/talk-to-us) if you'd like to participate.
</Note>

Dynamic composes rules in layers. At sign time, the enclave evaluates the layers that apply to a wallet and signer, in this order:

1. **Environment**: rules set by the developer for the whole environment. See [Creating & Managing Rules](/docs/overview/wallets/embedded-wallets/mpc/policies/creating-rules) for how to configure them.
2. **Account** *(business accounts only)*: rules set by a business-account owner or admin; apply to every wallet in that account.
3. **Wallet**: rules set on a specific wallet.
4. **Signer**: rules set on a specific signer share set.

A transaction must pass every layer. Broader layers enforce org-wide or account-wide guardrails, and narrower layers add further restrictions for individual wallets or signers.

## Who can set each layer

* **Environment**: set by the developer in the [Developer Dashboard](/docs/overview/developer-dashboard/general) or through the [API](/docs/overview/wallets/embedded-wallets/mpc/policies/creating-rules). These rules apply to every wallet in the environment.
* **Account**: set by a business-account owner or admin through the JavaScript SDK or the [Dynamic API](/docs/overview/wallets/embedded-wallets/mpc/policies/managing-layers). This layer only exists for business accounts.
* **Wallet**: set by the wallet owner, or by a business-account owner or admin for business-account wallets. See [Managing layers](/docs/overview/wallets/embedded-wallets/mpc/policies/managing-layers) for API examples.
* **Signer**: set by the signer through the SDK, or by a business-account owner or admin for any signer in the account. See [Managing layers](/docs/overview/wallets/embedded-wallets/mpc/policies/managing-layers) for API examples.

For business-account policy workflows, see the [JavaScript SDK business accounts guide](/docs/javascript/reference/business-accounts/policies/overview).

## Signer-modifiable rules

A rule on the wallet or signer layer can be marked with `modifiableBySigner: true`. This makes the rule a recommended default that the signer can later edit or remove, instead of a constraint only an admin or wallet owner can change.

Use this when you want signers to manage their own constraints. For example, a business-account owner can set an `allow` rule with a list of approved addresses and a value limit, and the signer can update those constraint fields as their needs change.

A signer can only edit the rule's constraint fields, such as `addresses` and `valueLimit`. They cannot change the rule type, disable Blockaid security checks, or add operation restrictions.

<Warning>
  `modifiableBySigner` cannot be set on environment-scope rules, and it cannot be combined with `disableBlockaidSecurityChecks` or `operationRestrictions`.
</Warning>

For API examples, see [Managing layers](/docs/overview/wallets/embedded-wallets/mpc/policies/managing-layers).

## Next steps

<CardGroup cols={2}>
  <Card title="Policies & Rules Overview" href="/docs/overview/wallets/embedded-wallets/mpc/policies/overview">
    Learn the security model, allowlist mode, and value limits.
  </Card>

  <Card title="Creating & Managing Rules" icon="plus" href="/docs/overview/wallets/embedded-wallets/mpc/policies/creating-rules">
    Set environment-wide rules in the dashboard or API.
  </Card>

  <Card title="Managing layers" icon="server" href="/docs/overview/wallets/embedded-wallets/mpc/policies/managing-layers">
    Set account, wallet, and signer layers through the API.
  </Card>
</CardGroup>

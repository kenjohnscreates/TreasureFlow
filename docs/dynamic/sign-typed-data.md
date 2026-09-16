> ## Documentation Index
> Fetch the complete documentation index at: https://www.dynamic.xyz/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Sign typed data (EIP-712)

> Sign EIP-712 typed data with your EVM wallet using the Node SDK

## Overview

Use the Node SDK to sign [EIP-712](https://eips.ethereum.org/EIP-712) typed data with your server wallet. Typed data signing is used for permits, order signing, and other structured data that requires a recoverable signature.

## Prerequisites

* [Created an EVM wallet](/docs/node/evm/create-wallet)

## Sign typed data

Call `signTypedData` on your authenticated `DynamicEvmWalletClient` with the wallet address and the typed data (viem `TypedData` format):

```typescript theme={"system"}
import { authenticatedEvmClient } from './client';
import type { TypedData } from 'viem';

const evmClient = await authenticatedEvmClient();

const typedData = {
  domain: {
    name: 'My App',
    version: '1',
    chainId: 8453,
  },
  types: {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
  primaryType: 'Permit',
  message: {
    owner: '0xYourWalletAddress',
    spender: '0xContractAddress',
    value: 1000000n,
    nonce: 0n,
    deadline: 1735689600n,
  },
} as TypedData;

const signature = await evmClient.signTypedData({
  walletMetadata,
  typedData,
});

console.log('Signature:', signature);
```

The method returns the serialized ECDSA signature as a hex string.

## Key shares and password

* **Automatic backup:** If you created the wallet with `backUpToDynamic: true`, you usually do not need to pass `externalServerKeyShares`.
* **Manual backup:** If you created the wallet with `backUpToDynamic: false`, pass your stored key shares as `externalServerKeyShares`.
* **Password:** Pass `password` only if the wallet was created with a password.

Example with optional parameters:

```typescript theme={"system"}
const signature = await evmClient.signTypedData({
  walletMetadata,
  typedData,
  password: 'your-password',           // if wallet is password-protected
  externalServerKeyShares: keyShares,  // if using manual backup
});
```

## Using the Viem wallet client

If you prefer viem's API, use [getWalletClient](/docs/node/wallets/server-wallets/viem-wallet-client) to get a Viem `WalletClient`. Its `signTypedData` method uses the same signing under the hood.

## Next steps

* [signTypedData reference](/docs/node/reference/evm/sign-typed-data) — Full API details
* [Sign messages](/docs/node/evm/sign-messages) — Sign raw messages
* [Sign transactions](/docs/node/evm/sign-transactions) — Sign and send transactions

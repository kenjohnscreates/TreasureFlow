> ## Documentation Index
> Fetch the complete documentation index at: https://www.dynamic.xyz/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Get a Viem wallet client

> Use getWalletClient to interact with server wallets using Viem's WalletClient interface.

## Overview

Use `getWalletClient` to create a Viem `WalletClient` for your server wallet. This allows you to interact with EVM chains using Viem's familiar API for signing messages, transactions, and typed data.

## Prerequisites

* A Dynamic server wallet (see [Server Wallets Setup](/docs/node/wallets/server-wallets/overview))
* `@dynamic-labs-wallet/node-evm` installed
* An authenticated `DynamicEvmWalletClient` instance

## Usage

### Basic example

```typescript theme={"system"}
import { DynamicEvmWalletClient } from '@dynamic-labs-wallet/node-evm';

const evmClient = new DynamicEvmWalletClient({
  environmentId: 'your-environment-id',
});

await evmClient.authenticateApiToken('your-api-token');

// Get a Viem wallet client
const walletClient = await evmClient.getWalletClient({
  accountAddress: '0x1234567890123456789012345678901234567890',
  chainId: 11155111, // Sepolia
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
});

// Use the wallet client
const chainId = await walletClient.getChainId();
console.log('Chain ID:', chainId);
```

### With external server key shares

If you're storing key shares externally, pass them when creating the wallet client:

```typescript theme={"system"}
const walletClient = await evmClient.getWalletClient({
  accountAddress: '0x1234567890123456789012345678901234567890',
  externalServerKeyShares: keyShares, // From wallet creation
  chainId: 11155111,
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
});
```

### With password protection

For password-protected wallets:

```typescript theme={"system"}
const walletClient = await evmClient.getWalletClient({
  accountAddress: '0x1234567890123456789012345678901234567890',
  password: 'your-wallet-password',
  chainId: 11155111,
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
});
```

### Using Viem chain objects

You can pass a Viem `Chain` object directly instead of `chainId` and `rpcUrl`:

```typescript theme={"system"}
import { mainnet, sepolia } from 'viem/chains';

const walletClient = await evmClient.getWalletClient({
  accountAddress: '0x1234567890123456789012345678901234567890',
  chain: sepolia,
});
```

### Custom chain configuration

For custom or unsupported chains, use `chainId` and `rpcUrl`:

```typescript theme={"system"}
const walletClient = await evmClient.getWalletClient({
  accountAddress: '0x1234567890123456789012345678901234567890',
  chainId: 12345, // Custom chain ID
  rpcUrl: 'https://custom-chain-rpc.example.com',
});
```

<Note>
  When providing `chainId`, you must also provide `rpcUrl`. The chain will be automatically configured with default ETH currency settings.
</Note>

## Common operations

### Sign a message

```typescript theme={"system"}
const message = 'Hello from Dynamic Wallet SDK!';
const signature = await walletClient.signMessage({ message });
console.log('Signature:', signature);
```

### Sign typed data

```typescript theme={"system"}
const signature = await walletClient.signTypedData({
  domain: {
    name: 'Dynamic Wallet Demo',
    version: '1',
    chainId: walletClient.chain.id,
  },
  types: {
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' },
    ],
  },
  primaryType: 'Person',
  message: {
    name: 'Alice',
    wallet: accountAddress as `0x${string}`,
  },
});
```

### Send a transaction

```typescript theme={"system"}
const hash = await walletClient.sendTransaction({
  to: '0x0000000000000000000000000000000000000000',
  value: BigInt(1000000000000000), // 0.001 ETH
});
console.log('Transaction hash:', hash);
```

## Parameters

| Parameter                 | Type               | Required | Description                                                      |
| ------------------------- | ------------------ | -------- | ---------------------------------------------------------------- |
| `accountAddress`          | `string`           | Yes      | The wallet address to create a client for.                       |
| `password`                | `string`           | No       | Password for password-protected wallets.                         |
| `externalServerKeyShares` | `ServerKeyShare[]` | No       | External key shares if stored outside Dynamic's service.         |
| `chain`                   | `Chain`            | No       | Viem chain object. Takes precedence over `chainId` and `rpcUrl`. |
| `chainId`                 | `number`           | No       | Chain ID. Requires `rpcUrl` when provided.                       |
| `rpcUrl`                  | `string`           | No       | RPC URL for the chain. Required when `chainId` is provided.      |

<Note>
  If no chain configuration is provided, the wallet client defaults to Ethereum mainnet.
</Note>

## Return value

Returns a Viem `WalletClient<Transport, Chain, Account>` instance with the following properties:

* `account` - The wallet account adapter
* `chain` - The configured chain
* `transport` - HTTP transport for RPC calls

The wallet client supports all standard Viem wallet client methods including `signMessage`, `signTypedData`, `sendTransaction`, and more.

## Related

* [Server Wallets Setup](/docs/node/wallets/server-wallets/overview)
* [Create Wallet Account](/docs/node/reference/evm/create-wallet-account)
* [Sign Message](/docs/node/reference/evm/sign-message)
* [Sign Typed Data](/docs/node/reference/evm/sign-typed-data)
* [Sign Transaction](/docs/node/reference/evm/sign-transaction)

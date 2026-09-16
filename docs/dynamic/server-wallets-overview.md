> ## Documentation Index
> Fetch the complete documentation index at: https://www.dynamic.xyz/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Server Wallets Setup

Spin up millions of secure, server-controlled wallets with battle-tested MPC infrastructure. Built for onchain automation, Dynamic Server Wallets let you trigger transactions, interact with contracts, and run complex flows—all without user involvement, and fully owned by your backend.

<Warning>
  The server wallet SDK (`@dynamic-labs-wallet/node-evm`, `@dynamic-labs-wallet/node-svm`) relies on native binary addons for MPC cryptography, so it runs only on a standard Node.js 18+ runtime — Linux (x64/arm64) or macOS (arm64).

  It will not run in environments without native addon support, including browsers, edge runtimes (Cloudflare Workers, Vercel Edge Functions), or alternative runtimes (Deno, Bun). For serverless, deploy to a Node.js runtime such as an AWS Lambda Node function or Cloud Function — not an edge or custom runtime.
</Warning>

<Info>
  Find pricing for server wallets [here](https://www.dynamic.xyz/pricing?tab=onchain-automation).
</Info>

## Setup

<Tip>
  Reference example: [GitHub example](https://github.com/dynamic-labs-oss/examples/blob/main/examples/nodejs-server-wallets)
</Tip>

<Steps>
  <Step title="Enable multiple embedded wallets per chain">
    Navigate to the [Dynamic Dashboard](https://app.dynamic.xyz/dashboard/embedded-wallets/dynamic) and enable multiple embedded wallets per chain.
  </Step>

  <Step title="Retrieve your auth token">
    Navigate to the [Dynamic Dashboard](https://app.dynamic.xyz/dashboard/developer/api) and create a new API token.
  </Step>

  <Step title="Install desired Node SDKs">
    ```bash theme={"system"}
    npm i @dynamic-labs-wallet/node-evm
    npm i @dynamic-labs-wallet/node-svm
    ```
  </Step>

  <Step title="Create client with authenticateApiToken">
    Separate clients are needed for each chain.

    ```typescript theme={"system"}
    import { DynamicEvmWalletClient } from "@dynamic-labs-wallet/node-evm";

    export const authenticatedEvmClient = async ({
      authToken,
      environmentId,
    }: {
      authToken: string;
      environmentId: string;
    }) => {
      const client = new DynamicEvmWalletClient({
        environmentId,
      });

      await client.authenticateApiToken(authToken);
      return client;
    };
    ```
  </Step>

  <Step title="Access MPC functionality by creating a new wallet account">
    ```typescript theme={"system"}
    import { ThresholdSignatureScheme } from '@dynamic-labs-wallet/node';
    import { authenticatedEvmClient } from '<path-to-dynamic-authenticated-client>';

    const AUTH_TOKEN = "your-auth-token";
    const ENVIRONMENT_ID = "your-environment-id";

    const evmClient = await authenticatedEvmClient({
      authToken: AUTH_TOKEN,
      environmentId: ENVIRONMENT_ID,
    });

    const thresholdSignatureScheme = ThresholdSignatureScheme.TWO_OF_TWO; // or TWO_OF_THREE
    const password = "your-password"; // Required when backUpToDynamic is true
    const onError = (error: Error) => {
      // handle error
      console.error(error);
    };

    const {
      walletMetadata,
      rawPublicKey,
      publicKeyHex,
      externalServerKeyShares,
    } = await evmClient.createWalletAccount({
      thresholdSignatureScheme,
      password,
      onError,
      backUpToDynamic: true, // Optional: backs up key shares to Dynamic's service (important-comment)
    });
    ```

    The Node SDK is **stateless**. `createWalletAccount()` returns two pieces of state that you must persist on the customer side:

    * **`walletMetadata`** — non-sensitive identity + backup-pointer info. Cache it in Redis, Postgres, or similar. You'll pass it to every subsequent sign / export / backup operation.
    * **`externalServerKeyShares`** — sensitive MPC key material. Store in a secrets vault (HSM, KMS-wrapped column, Secret Manager).

    See [Storage Best Practices](/docs/node/wallets/server-wallets/storage-best-practices) for the cache + vault split. The wallet's address is at `walletMetadata.accountAddress` — pass `walletMetadata` to subsequent calls rather than reconstructing args from individual fields.

    <Note>
      **Removed in V1.** The Node SDK no longer holds wallet state internally. If you are migrating from a pre-V1 SDK, the following have been removed: the in-memory `walletMap`, `client.getWallet(address)`, `initializeWalletMapEntry`, and `ensureCeremonyCompletionBeforeBackup`. `recoverEncryptedBackupByWallet` no longer accepts `storeRecoveredShares` — the caller now decides what to do with the returned shares. Every sign / export / backup operation now takes explicit `walletMetadata` (and `externalServerKeyShares` when supplying shares yourself), so the caller owns persistence.
    </Note>

    <Warning>
      `backUpToDynamic` is `false` by default, which means Dynamic will **not** store the key shares for you. You are responsible for securely storing the `externalServerKeyShares` returned by `createWalletAccount`. Losing these shares means losing access to the wallet. See [Storage Best Practices](/docs/node/wallets/server-wallets/storage-best-practices) for guidance on secure storage.

      Alternatively, set `backUpToDynamic: true` to leverage Dynamic's key share service, in which case you do not need to manage storage yourself.
    </Warning>
  </Step>

  <Step title="Example: Sign a message with the MPC wallet account">
    ```typescript theme={"system"}
    import { authenticatedEvmClient } from '<path-to-dynamic-authenticated-client>';

    const AUTH_TOKEN = 'your-auth-token';
    const ENVIRONMENT_ID = 'your-environment-id';

    const evmClient = await authenticatedEvmClient({
      authToken: AUTH_TOKEN,
      environmentId: ENVIRONMENT_ID,
    });

    const message = 'Hello, world!';
    const password = 'your-password'; // Required if the wallet was created with backUpToDynamic: true

    // Load walletMetadata + externalServerKeyShares from where you persisted them.
    const walletMetadata = JSON.parse(await redis.get(`wallet:${accountAddress}`));
    const externalServerKeyShares = await vault.read(`wallet:${accountAddress}/shares`);

    const serializedSignature = await evmClient.signMessage({
      message,
      walletMetadata,
      externalServerKeyShares,
      password,
    });
    ```
  </Step>
</Steps>

## End-to-end example: agent signs a transaction

A complete example showing a backend agent that receives a webhook, recovers key shares, signs an EVM transaction, and broadcasts it:

```typescript theme={"system"}
import { DynamicEvmWalletClient } from "@dynamic-labs-wallet/node-evm";
import { WalletOperation } from "@dynamic-labs-wallet/node";
import { createPublicClient, http, parseEther } from "viem";
import { base } from "viem/chains";

const AUTH_TOKEN = process.env.DYNAMIC_API_TOKEN!;
const ENVIRONMENT_ID = process.env.DYNAMIC_ENVIRONMENT_ID!;

// 1. Authenticate
const evmClient = new DynamicEvmWalletClient({ environmentId: ENVIRONMENT_ID });
await evmClient.authenticateApiToken(AUTH_TOKEN);

// 2. Load persisted wallet state (from your DB).
// walletMetadata must be the full object returned by createWalletAccount —
// it carries externalServerKeySharesBackupInfo, which recovery and signing require.
const walletMetadata = JSON.parse(await redis.get(`wallet:${agentAddress}`));

// 3. Recover the key shares from Dynamic's backup service.
// Returns { externalServerKeyShares }; persist them to your vault if you plan to reuse them.
const { externalServerKeyShares } = await evmClient.recoverEncryptedBackupByWallet({
  walletMetadata,
  password: process.env.WALLET_PASSWORD!,
});

// 4. Sign a raw EVM transaction
const signedTx = await evmClient.signTransaction({
  walletMetadata,
  externalServerKeyShares,
  transaction: {
    to: "0xRecipientAddress",
    value: parseEther("0.01").toString(),
    chainId: 8453, // Base
  },
});

// 5. Broadcast via any RPC
const publicClient = createPublicClient({ chain: base, transport: http() });
const txHash = await publicClient.sendRawTransaction({ serializedTransaction: signedTx });
console.log("Broadcast:", txHash);
```

<Note>
  This pattern works for any automation: cron jobs, webhook handlers, AI agents, or queue consumers. The SDK is stateless — load `walletMetadata` and key shares per operation, sign, then discard.
</Note>

## Custom EVM networks

Server wallets work on any EVM-compatible chain — you are not limited to chains pre-configured in the dashboard. Pass `chainId` and `rpcUrl` when creating a Viem wallet client:

```typescript theme={"system"}
const walletClient = await evmClient.getWalletClient({
  accountAddress: walletMetadata.accountAddress,
  chainId: 42170,  // Arbitrum Nova, or any custom chain ID
  rpcUrl: "https://nova.arbitrum.io/rpc",
});

// Now use standard viem methods on your custom chain
const hash = await walletClient.sendTransaction({
  to: "0xRecipientAddress",
  value: parseEther("0.1"),
});
```

<Note>
  When using `chainId`, you must also provide `rpcUrl`. The SDK configures the chain with default ETH currency settings. For full details, see [Get a Viem wallet client — Custom chain configuration](/docs/node/wallets/server-wallets/viem-wallet-client#custom-chain-configuration).

  Signing is chain-agnostic — the SDK signs transactions via MPC and does not require the network to be enabled in your Dynamic dashboard, so any custom or non-listed EVM network works (you just supply the `rpcUrl` above).
</Note>

## Next Steps

You can find the full SDK reference for server wallets for each chain below:

<Columns cols={2}>
  <Card title="EVM" href="/docs/node/reference/evm/create-wallet-account">
    EVM Guides
  </Card>

  <Card title="SVM" href="/docs/node/reference/svm/create-wallet-account">
    SVM Guides
  </Card>
</Columns>

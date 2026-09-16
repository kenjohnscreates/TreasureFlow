> ## Documentation Index
> Fetch the complete documentation index at: https://www.dynamic.xyz/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Using Dynamic with x402

> Implement x402 payments on EVM and Solana with Dynamic embedded and external wallets

## Overview

This guide shows you how to implement x402 payments using Dynamic's wallet infrastructure on EVM and Solana. On EVM we use `@x402/fetch` (or `@x402/axios`) with `@x402/evm`. On Solana we use `x402-solana`, which accepts any wallet with `address` and `signTransaction`.

Dynamic supports embedded wallets and external wallets for both chains.

<Note>
  This recipe uses the Dynamic JavaScript SDK (`@dynamic-labs-sdk/client` + `@dynamic-labs-sdk/react-hooks`) with either `@dynamic-labs-sdk/evm` or `@dynamic-labs-sdk/solana`. See the [React Quickstart](/docs/javascript/reference/react-quickstart) for the base setup. For Solana, call [`addSolanaExtension()`](/docs/javascript/reference/solana/adding-solana-extensions) when you initialize the client.
</Note>

## The x402 protocol

The [x402 payment protocol](https://www.x402.org/) defines how onchain payment is negotiated over HTTP 402 responses: the server returns payment requirements; the client signs and retries the request (often with an `X-Payment` header); a **facilitator** can verify and help settle onchain.

The [Fireblocks x402 facilitator](https://developers.fireblocks.com/docs/x402-facilitator-overview) runs facilitator infrastructure used by many x402 integrations, including:

* Zero-fee USDC payments on Base (and other supported networks, including Solana)
* Onchain settlement
* Compliance and risk screening
* Integration with client libraries (see [Installation](#installation))

For how 402 flows work in general and when to choose x402 versus MPP, see the [HTTP 402 overview](/docs/recipes/integrations/x402/overview).

## Prerequisites

Before implementing x402 with Dynamic, ensure you have:

* A Dynamic project with your environment ID and the JS SDK wired up
* EVM and/or Solana enabled in the dashboard, matching the chain you will pay on
* Basic understanding of HTTP status codes and request/response patterns
* The x402 client package for your chain (see [Installation](#installation))

## Installation

Install the x402 client for your chain. These libraries wrap your HTTP calls with payment handling when the server returns 402. On EVM you also need `@x402/evm`, which provides the `ExactEvmScheme` used to sign payments.

<Tabs>
  <Tab title="EVM">
    ```bash theme={"system"}
    npm install @x402/fetch @x402/evm
    # or
    npm install @x402/axios @x402/evm
    ```

    <Info>
      `@x402/fetch` and `@x402/axios` are the official x402 protocol **v2** packages (the older `x402-fetch` / `x402-axios` packages are v1 and deprecated). You can use other HTTP libraries with x402, but these provide the best EVM integration experience.
    </Info>
  </Tab>

  <Tab title="Solana">
    ```bash theme={"system"}
    npm install x402-solana
    ```

    <Info>
      `x402-solana` works with any wallet that exposes `address` and `signTransaction`, including Dynamic Solana wallet accounts via [`signTransaction`](/docs/javascript/reference/solana/signing-sending-transactions). The v2 Solana package (`@x402/svm`) instead expects a [`@solana/kit`](https://www.npmjs.com/package/@solana/kit) `TransactionSigner`, so use `x402-solana` for Dynamic Solana wallets.
    </Info>
  </Tab>
</Tabs>

## Implementation

Connect a wallet account for your chain, adapt it to the x402 client's expected signer, then call the protected URL. The client handles the 402 challenge, signing, and retry.

<Tabs>
  <Tab title="EVM">
    Create a viem `WalletClient` with `createWalletClientForWalletAccount`, register its `account` with x402's `ExactEvmScheme`, then wrap `fetch` with `wrapFetchWithPaymentFromConfig` so x402 handles the 402 challenge and payment automatically. Read the active EVM wallet account from `useGetWalletAccounts` and narrow it with `isEvmWalletAccount`.

    ```tsx theme={"system"}
    import { useState } from "react";
    import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
    import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
    import { useGetWalletAccounts } from "@dynamic-labs-sdk/react-hooks";
    import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
    import { ExactEvmScheme } from "@x402/evm";

    const x402PaymentUrl = "https://example.com/x402-payment";

    export function X402PaymentButton() {
      const { data: walletAccounts = [] } = useGetWalletAccounts();
      const walletAccount = walletAccounts.find(isEvmWalletAccount);
      const [status, setStatus] = useState<string>("");

      const handlePayment = async () => {
        if (!walletAccount) {
          setStatus("Connect an EVM wallet first.");
          return;
        }

        try {
          const walletClient = await createWalletClientForWalletAccount({ walletAccount });

          const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
            schemes: [
              {
                network: "eip155:8453", // Base Mainnet
                client: new ExactEvmScheme(walletClient.account),
              },
            ],
          });

          const response = await fetchWithPayment(x402PaymentUrl);

          const paymentHeader = response.headers.get("PAYMENT-RESPONSE");
          if (paymentHeader) {
            console.log("Payment details:", decodePaymentResponseHeader(paymentHeader));
          }

          setStatus(`Got ${response.status} from ${x402PaymentUrl}`);
        } catch (error) {
          console.error("Payment failed:", error);
          setStatus(`Payment failed: ${(error as Error).message}`);
        }
      };

      return (
        <>
          <button onClick={handlePayment} disabled={!walletAccount}>
            Pay with x402
          </button>
          {status && <p>{status}</p>}
        </>
      );
    }
    ```
  </Tab>

  <Tab title="Solana">
    `x402-solana` expects a wallet with `address` and `signTransaction`. Read the active Solana wallet account from `useGetWalletAccounts`, narrow it with `isSolanaWalletAccount`, and pass Dynamic's [`signTransaction`](/docs/javascript/reference/solana/signing-sending-transactions) into `createX402Client`.

    ```tsx theme={"system"}
    import { useState } from "react";
    import {
      isSolanaWalletAccount,
      signTransaction as dynamicSignTransaction,
    } from "@dynamic-labs-sdk/solana";
    import { useGetWalletAccounts } from "@dynamic-labs-sdk/react-hooks";
    import { createX402Client } from "x402-solana/client";

    const x402PaymentUrl = "https://example.com/x402-payment";

    export function X402PaymentButton() {
      const { data: walletAccounts = [] } = useGetWalletAccounts();
      const walletAccount = walletAccounts.find(isSolanaWalletAccount);
      const [status, setStatus] = useState<string>("");

      const handlePayment = async () => {
        if (!walletAccount) {
          setStatus("Connect a Solana wallet first.");
          return;
        }

        try {
          const client = createX402Client({
            wallet: {
              address: walletAccount.address,
              signTransaction: async (tx) => {
                const { signedTransaction } = await dynamicSignTransaction({
                  transaction: tx,
                  walletAccount,
                });
                return signedTransaction;
              },
            },
            network: "solana-devnet", // or "solana" for mainnet
          });

          // Make the request; x402 will handle payment automatically
          const response = await client.fetch(x402PaymentUrl);

          setStatus(`Got ${response.status} from ${x402PaymentUrl}`);
        } catch (error) {
          console.error("Payment failed:", error);
          setStatus(`Payment failed: ${(error as Error).message}`);
        }
      };

      return (
        <>
          <button onClick={handlePayment} disabled={!walletAccount}>
            Pay with x402
          </button>
          {status && <p>{status}</p>}
        </>
      );
    }
    ```

    <Note>
      The facilitator is the fee payer for the Solana transaction, so the wallet does not need SOL. The wallet does need an associated token account for the payment asset (for example USDC on the requested network). `x402-solana` throws before signing if that account is missing.
    </Note>
  </Tab>
</Tabs>

Mount the button anywhere inside your `<DynamicProvider>` tree. The wallet accounts from `useGetWalletAccounts` are reactive: log out or switch wallets and the component re-renders automatically.

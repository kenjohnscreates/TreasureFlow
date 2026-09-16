> ## Documentation Index
> Fetch the complete documentation index at: https://flash.definitive.fi/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Limit Order

> End-to-end limit order on EVM and Solana. Quote, sign, and submit with runnable TypeScript.

A limit order fills only at your limit price or better. A buy fills at or below the limit; a sell fills at or above it. Price it in either basis: `limitNotionalPrice`, the USD price of the target asset, or `limitCrossPrice`, the pair rate (target / contra). For the concepts behind the parameters, see [Placing Orders](/docs/placing-orders).

This page shows the full flow end to end (quote, sign, submit) as a runnable script for each chain. The EVM example places a buy limit for WETH against USDC on Base; the Solana example does the same for WSOL against USDC. The signing and submit plumbing is identical to a market order; only the request fields differ.

## Limit parameters

| Field                | Required       | Meaning                                                                                                |
| -------------------- | -------------- | ------------------------------------------------------------------------------------------------------ |
| `orderType`          | Yes            | `"limit"`                                                                                              |
| `side`               | Yes            | `"buy"` or `"sell"`                                                                                    |
| `qty`                | Yes            | Spend amount, as a string. Contra units on a buy, target units on a sell                               |
| `limitNotionalPrice` | One of the two | USD price of the target asset. Buy fills at or below, sell fills at or above                           |
| `limitCrossPrice`    | One of the two | Pair rate (target / contra), same frame on buy and sell. Buy fills at or below, sell fills at or above |
| `expireTime`         | Optional       | ISO-8601 expiry for good-til-time behavior. Omit for good-til-cancelled                                |

A limit order requires exactly one of `limitNotionalPrice` or `limitCrossPrice`; sending both is rejected. Limit orders do not accept `triggers`.

## End-to-end example

<Note>
  **Prerequisites.** EVM examples use [`viem`](https://viem.sh); Solana examples use `@solana/web3.js`, `tweetnacl`, and `bs58`. All requests go to `https://flash.definitive.fi/v1` with your key in the `x-definitive-api-key` header. The public integrator key `dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b` is safe for development. The onchain steps also need an RPC endpoint and the funder wallet's key, supplied here through environment variables.
</Note>

<AccordionGroup>
  <Accordion title="EVM" defaultOpen>
    Buy WETH with up to 100 USDC, only when WETH is available at \$1,000 per WETH or lower. If the spent token needs an allowance, the quote returns `evm.approveTx` (or `evm.permitTypedData` on the Permit2 path); handle whichever it returns, then sign the order payload and submit.

    ```ts theme={null}
    import { createWalletClient, createPublicClient, http } from "viem";
    import { privateKeyToAccount } from "viem/accounts";
    import { base } from "viem/chains";

    const BASE_URL = "https://flash.definitive.fi/v1";
    const API_KEY = "dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b";

    const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);
    const wallet = createWalletClient({ account, chain: base, transport: http(process.env.EVM_RPC_URL) });
    const publicClient = createPublicClient({ chain: base, transport: http(process.env.EVM_RPC_URL) });

    const post = (path: string, body: unknown) =>
      fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-definitive-api-key": API_KEY },
        body: JSON.stringify(body),
      }).then((r) => r.json());

    const order = {
      targetChain: "base",
      contraChain: "base",
      targetAsset: "0x4200000000000000000000000000000000000006", // WETH
      contraAsset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
      side: "buy",
      qty: "100",
      orderType: "limit",
      limitNotionalPrice: "1000",
    };

    const quote = await post("/quote", { ...order, funderAddress: account.address });

    if (quote.evm.approveTx) {
      const hash = await wallet.sendTransaction({
        to: quote.evm.approveTx.to,
        data: quote.evm.approveTx.data,
        value: 0n,
      });
      await publicClient.waitForTransactionReceipt({ hash });
    }

    let permitFields = {};
    if (quote.evm.permitTypedData) {
      const evmPermitSignature = await account.signTypedData(JSON.parse(quote.evm.permitTypedData));
      permitFields = { evmPermitTypedData: quote.evm.permitTypedData, evmPermitSignature };
    }

    const { domain, types, primaryType, message } = JSON.parse(quote.evm.orderTypedData);
    const userSignature = await account.signTypedData({ domain, types, primaryType, message });

    const { orderId } = await post("/order", {
      ...order,
      funderAddress: account.address,
      quoteId: quote.quoteId,
      userSignature,
      evmOrderTypedData: quote.evm.orderTypedData,
      ...permitFields,
    });

    console.log("orderId", orderId);
    ```
  </Accordion>

  <Accordion title="SVM (Solana)" defaultOpen>
    Buy WSOL with up to 100 USDC, only when WSOL is available at \$150 per WSOL or lower. Before the first trade of a token the swap needs the funder's token accounts (`svm.ataSetupIxs`) and a delegation (`svm.delegateIx` or a sponsor-paid `svm.sponsoredDelegateTx`). Run the onchain steps in order, then sign the order message offchain and submit.

    ```ts theme={null}
    import {
      Connection,
      Keypair,
      PublicKey,
      TransactionInstruction,
      TransactionMessage,
      VersionedTransaction,
    } from "@solana/web3.js";
    import nacl from "tweetnacl";
    import bs58 from "bs58";

    const BASE_URL = "https://flash.definitive.fi/v1";
    const API_KEY = "dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b";

    const connection = new Connection(process.env.SOLANA_RPC_URL!, "confirmed");
    const funder = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_SECRET_KEY!));

    const post = (path: string, body: unknown) =>
      fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-definitive-api-key": API_KEY },
        body: JSON.stringify(body),
      }).then((r) => r.json());

    const toIx = (ix: any) =>
      new TransactionInstruction({
        programId: new PublicKey(ix.programId),
        keys: ix.accounts.map((a: any) => ({
          pubkey: new PublicKey(a.pubkey),
          isSigner: a.isSigner,
          isWritable: a.isWritable,
        })),
        data: Buffer.from(bs58.decode(ix.data)),
      });

    async function sendIxs(instructions: any[]) {
      const { blockhash } = await connection.getLatestBlockhash();
      const message = new TransactionMessage({
        payerKey: funder.publicKey,
        recentBlockhash: blockhash,
        instructions: instructions.map(toIx),
      }).compileToV0Message();
      const tx = new VersionedTransaction(message);
      tx.sign([funder]);
      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(sig, "confirmed");
    }

    const order = {
      targetChain: "solana",
      contraChain: "solana",
      targetAsset: "So11111111111111111111111111111111111111112", // WSOL
      contraAsset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      side: "buy",
      qty: "100",
      orderType: "limit",
      limitNotionalPrice: "150",
    };

    const quote = await post("/quote", { ...order, funderAddress: funder.publicKey.toBase58() });

    if (quote.svm.ataSetupIxs) await sendIxs(quote.svm.ataSetupIxs);

    let delegateFields = {};
    if (quote.svm.sponsoredDelegateTx) {
      const tx = VersionedTransaction.deserialize(Buffer.from(quote.svm.sponsoredDelegateTx, "base64"));
      tx.sign([funder]);
      delegateFields = { svmSponsoredDelegateTx: Buffer.from(tx.serialize()).toString("base64") };
    } else if (quote.svm.delegateIx) {
      await sendIxs([quote.svm.delegateIx]);
    }

    const signature = nacl.sign.detached(new TextEncoder().encode(quote.svm.orderMessage), funder.secretKey);
    const userSignature = bs58.encode(signature);

    const { orderId } = await post("/order", {
      ...order,
      funderAddress: funder.publicKey.toBase58(),
      quoteId: quote.quoteId,
      userSignature,
      svmNonce: quote.svm.nonce,
      svmDeadline: quote.svm.deadline,
      ...delegateFields,
    });

    console.log("orderId", orderId);
    ```
  </Accordion>
</AccordionGroup>

For a sell limit, set `side` to `"sell"`, denominate `qty` in the target asset (for example `"0.05"` WETH), and read the limit price as the floor: the order fills at or above that price. To price against the pair instead of the dollar, swap `limitNotionalPrice` for `limitCrossPrice` — `limitCrossPrice: "1000"` on the EVM example above is 1,000 USDC per WETH. Add `expireTime` (an ISO-8601 timestamp) to make the order expire; omit it for good-til-cancelled.

<Note>
  To track the order after submit, poll `GET /orders` or stream live updates over the [Orders WebSocket](/docs/api-reference/flash/websocket).
</Note>

<CardGroup cols={2}>
  <Card title="TWAP Order" icon="clock" href="/docs/twap-order">
    Slice a large order into tranches over a duration.
  </Card>

  <Card title="Trigger Orders" icon="bell" href="/docs/trigger-orders">
    Stop, stop-loss, and take-profit orders.
  </Card>

  <Card title="Bracket Orders" icon="shield-halved" href="/docs/brackets">
    Attach a take-profit / stop-loss pair to this order at placement.
  </Card>
</CardGroup>

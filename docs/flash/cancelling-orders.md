> ## Documentation Index
> Fetch the complete documentation index at: https://flash.definitive.fi/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Cancelling Orders

> How to cancel an open Flash order by signing a cancel message with the funder wallet.

Cancel any open order with [`POST /orders/{orderId}/cancel`](/docs/api-reference/flash/cancel). Like placing an order, cancelling one requires a **wallet signature** in addition to your API key — but where an order signs the payload returned by the quote, a cancel signs a short plaintext message you construct yourself. The cancel signature is offchain and gasless; no transaction is sent. To change a resting order's limit price without cancelling it, see [Updating Orders](/docs/updating-orders).

## The cancel message

Construct this exact UTF-8 string, substituting the `orderId` returned when the order was placed:

```text theme={null}
Definitive Flash v1 — Cancel Order
Order: <orderId>
```

In code, that is one string with a single newline:

```ts theme={null}
const cancelMessage = `Definitive Flash v1 — Cancel Order\nOrder: ${orderId}`;
```

The message bytes are identical on EVM and Solana; only the signing primitive differs. The server validates the message byte-for-byte, so:

* The separator after `v1` is an **em dash** (`—`, U+2014), not a hyphen.
* The line break is a single `\n`.
* `<orderId>` is the order's UUID exactly as returned by [`POST /order`](/docs/api-reference/flash/order).

Send the exact string you signed back as `cancelMessage` in the request body. The message is plaintext by design: a wallet's message-signing prompt shows the user precisely which order they are cancelling.

## Signing the message

Sign with the **funder wallet** — the same wallet that signed the order. A signature from any other key is rejected.

| Chain  | Scheme                                         | `userSignature` format      |
| ------ | ---------------------------------------------- | --------------------------- |
| EVM    | EIP-191 `personal_sign` over the message bytes | 65 bytes, `0x`-prefixed hex |
| Solana | Ed25519 over the message bytes                 | 64 bytes, base58            |

<Note>
  On EVM, the signature is verified onchain against the funder address using ERC-1271 with ERC-6492 support. EOAs, deployed smart accounts, and counterfactual (not-yet-deployed) smart accounts all work — sign with whatever `personal_sign` flow the wallet provides.
</Note>

## Example

<AccordionGroup>
  <Accordion title="EVM" defaultOpen>
    ```ts theme={null}
    import { privateKeyToAccount } from "viem/accounts";

    const BASE_URL = "https://flash.definitive.fi/v1";
    const API_KEY = "dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b";

    const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

    const orderId = "..."; // from POST /order
    const cancelMessage = `Definitive Flash v1 — Cancel Order\nOrder: ${orderId}`;
    const userSignature = await account.signMessage({ message: cancelMessage }); // EIP-191 personal_sign

    const res = await fetch(`${BASE_URL}/orders/${orderId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-definitive-api-key": API_KEY },
      body: JSON.stringify({ cancelMessage, userSignature }),
    }).then((r) => r.json());

    console.log(res); // { ok: true }
    ```
  </Accordion>

  <Accordion title="SVM (Solana)" defaultOpen>
    ```ts theme={null}
    import { Keypair } from "@solana/web3.js";
    import nacl from "tweetnacl";
    import bs58 from "bs58";

    const BASE_URL = "https://flash.definitive.fi/v1";
    const API_KEY = "dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b";

    const funder = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_SECRET_KEY!));

    const orderId = "..."; // from POST /order
    const cancelMessage = `Definitive Flash v1 — Cancel Order\nOrder: ${orderId}`;
    const signature = nacl.sign.detached(new TextEncoder().encode(cancelMessage), funder.secretKey);
    const userSignature = bs58.encode(signature); // 64-byte Ed25519 signature

    const res = await fetch(`${BASE_URL}/orders/${orderId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-definitive-api-key": API_KEY },
      body: JSON.stringify({ cancelMessage, userSignature }),
    }).then((r) => r.json());

    console.log(res); // { ok: true }
    ```
  </Accordion>
</AccordionGroup>

## What a cancel does

A successful cancel takes effect immediately: the order is removed from the execution queue and Flash will not attempt any further fills. The order's status becomes `ORDER_STATUS_CANCELLED` with `closeReason` `REASON_USER_REQUESTED`, and an `update` fires on the [Orders WebSocket](/docs/api-reference/flash/websocket) — drop it from any open-orders list.

**Partial fills are kept.** Cancelling a partially filled order (for example, a TWAP mid-run) stops the remaining execution; slices that already settled onchain are final.

**An attached bracket pair is cancelled separately.** Cancelling an entry order does not cancel its attached bracket pair: once the entry has filled at all, the pair stays live protecting what the entry received, and you cancel it by its own `orderId`. Cancelling the entry before any fill means the pair never activates, and cancelling the pair leaves the entry working, unprotected. See [Bracket Orders](/docs/brackets#lifecycle).

**The token approval is untouched.** Cancelling removes the order, not the onchain approval or delegate, which stays in place for future orders. To remove Flash's spending authority entirely, revoke the approval onchain — see [Cancellation](/docs/non-custodial#cancellation).

**Cancels are idempotent.** Cancelling an already-cancelled order returns `200`, not an error, so retrying a cancel after a timeout is safe.

## Which orders can be cancelled

Orders in `ORDER_STATUS_PENDING`, `ORDER_STATUS_ACCEPTED`, or `ORDER_STATUS_PARTIALLY_FILLED` can be cancelled. Orders in a terminal status (`ORDER_STATUS_FILLED`, `ORDER_STATUS_REJECTED`, `ORDER_STATUS_TERMINATED`) return `422` — except already-cancelled orders, which return `200` as above. See [Order statuses](/docs/order-statuses).

A cancel can race a fill. If the order fills before the cancel lands, the cancel returns `422` with `order already filled` — treat that as the order having executed, not as a failure to retry.

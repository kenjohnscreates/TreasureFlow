> ## Documentation Index
> Fetch the complete documentation index at: https://flash.definitive.fi/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Orders

> Stream open orders in real time, for one funder or every funder in your org: a snapshot on subscribe, then live updates as orders change and new ones are placed.

The Orders WebSocket streams open orders in real time. Subscribe and you receive a snapshot of the current open orders, then an `update` whenever an order changes or a new one is placed. Scope the subscription to a single funder, or omit `funderAddress` to stream every funder in your org over one connection. Use it instead of polling [`GET /orders`](/docs/api-reference/flash/list-orders) or [`GET /orders/{orderId}`](/docs/api-reference/flash/get-order) when you need live order state.

**Endpoint:** `wss://flash.definitive.fi/v1/ws`

Connection handling (authentication, multiplexing, heartbeats, reconnecting, connection limits, and connection-level errors) is covered in [Connection](/docs/api-reference/flash/websocket-connection). This page documents the `orders` channel.

## Working with the orders channel

* `funderAddress` is optional. Omit it and one connection streams every funder in your org; pass it to filter the stream to that funder.
* A connection holds one scope. To switch between funders, or between one funder and all of them, `unsubscribe` first or open a new connection.
* Every order frame carries `funderAddress`, so you can route updates to the right funder when streaming all of them.
* Also subscribe to [`heartbeats`](/docs/api-reference/flash/websocket-connection#heartbeats) so you can tell a healthy-but-quiet connection from a dead one when order updates are sparse.
* Every subscribe returns a fresh snapshot, so re-subscribing after a reconnect fully reseeds your state.
* If the stream is unavailable (`STREAMING_UNAVAILABLE`), fall back to polling [`GET /orders`](/docs/api-reference/flash/list-orders).

## Orders channel

### Subscribe

Stream every funder in your org:

```json theme={null}
{ "channel": "orders", "type": "subscribe", "apiKey": "dpka_…" }
```

Or scope the stream to a single funder:

```json theme={null}
{ "channel": "orders", "type": "subscribe", "funderAddress": "0x…", "apiKey": "dpka_…" }
```

The server confirms with an `ack` listing your active channels:

```json theme={null}
{ "channel": "subscriptions", "type": "ack", "subscriptions": ["orders"] }
```

### Snapshot

Once, right after you subscribe, you receive the current open orders in your subscription's scope:

```json theme={null}
{ "channel": "orders", "type": "snapshot", "orders": [ /* FlashOrderUpdate[] */ ] }
```

### Update

When an order changes, or a new order is placed, you receive an `update` carrying just that order:

```json theme={null}
{ "channel": "orders", "type": "update", "orders": [ /* FlashOrderUpdate */ ] }
```

### Applying updates

* Seed your local state from the `snapshot`, keyed by `orderId`.
* Each `update` is the order's full current state. Replace your stored copy by `orderId`, or add it if you have not seen the order yet (a newly placed order arrives this way).
* An `update` also fires when an order reaches a terminal status. Treat any status other than `ORDER_STATUS_PENDING`, `ORDER_STATUS_ACCEPTED`, or `ORDER_STATUS_PARTIALLY_FILLED` as terminal, and drop it from an open-orders list.

### Order fields

`snapshot` and `update` carry the same `FlashOrderUpdate` shape:

| Field                | Type                                                                     | Notes                                                                                                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orderId`            | `string`                                                                 | Stable key. Merge and dedupe on this.                                                                                                                                                                                                                                                                      |
| `orderType`          | `market`, `limit`, `twap`, `stop`, `stop-loss`, `take-profit`, `bracket` | `bracket` rows are the exit pair minted by an [attached bracket](/docs/brackets).                                                                                                                                                                                                                               |
| `side`               | `buy` or `sell`                                                          |                                                                                                                                                                                                                                                                                                            |
| `status`             | `string`                                                                 | Active: `ORDER_STATUS_PENDING`, `ORDER_STATUS_ACCEPTED`, `ORDER_STATUS_PARTIALLY_FILLED`. Any other value is terminal (for example `ORDER_STATUS_FILLED`, `ORDER_STATUS_CANCELLED`, `ORDER_STATUS_REJECTED`, `ORDER_STATUS_TERMINATED`); drop it from an open list. See [Order statuses](/docs/order-statuses). |
| `closeReason`        | `string` or `null`                                                       | For example `REASON_USER_REQUESTED` or `REASON_FULLY_FILLED`. `null` while active.                                                                                                                                                                                                                         |
| `funderAddress`      | `string`                                                                 | The funder wallet that placed the order. Key on this to route updates when you subscribe without a `funderAddress`.                                                                                                                                                                                        |
| `targetAsset`        | `{ id, name, address, ticker, chain }`                                   | The traded asset.                                                                                                                                                                                                                                                                                          |
| `contraAsset`        | `{ id, name, address, ticker, chain }`                                   | The counter asset, spent on buys and received on sells.                                                                                                                                                                                                                                                    |
| `qty`                | `string` (decimal)                                                       | Amount being spent, in the asset's normalized units.                                                                                                                                                                                                                                                       |
| `filled`             | `{ targetAmount, contraAmount }` or `null`                               | `null` means nothing filled yet.                                                                                                                                                                                                                                                                           |
| `limitNotionalPrice` | `string` or `null`                                                       | USD limit price for the target asset. `null` when the order was priced with `limitCrossPrice`.                                                                                                                                                                                                             |
| `limitCrossPrice`    | `string` or `null`                                                       | Pair-rate limit price (target / contra). `null` when the order was priced with `limitNotionalPrice`. At most one of the two is non-null.                                                                                                                                                                   |
| `pendingUpdate`      | `boolean`                                                                | `true` while an [order update](/docs/updating-orders) is in flight; cleared on the next frame whether the update is applied or rejected. `false` on the connect-time snapshot.                                                                                                                                  |
| `trigger`            | `{ notionalPrice \| crossPrice, triggerType }` or `null`                 | Carries whichever basis the trigger was placed in — `notionalPrice` (USD) or `crossPrice` (pair rate, target / contra), never both. `triggerType` is `upper` or `lower`.                                                                                                                                   |
| `attachedBracket`    | `{ status, bracketOrderId }` or absent                                   | Present on an entry placed with an [attached bracket](/docs/brackets). `status` is `pending_activation`, `active`, or `never_activated`; `bracketOrderId` is `null` until the pair activates. The leg configuration is not on the stream — fetch the entry over REST for it.                                    |
| `sourceEntryOrderId` | `string` or absent                                                       | Present on `bracket` rows: the entry order that minted this pair.                                                                                                                                                                                                                                          |
| `twapBucketCount`    | `number` or `null`                                                       | TWAP total buckets. `0` or `null` means auto.                                                                                                                                                                                                                                                              |
| `completedFillCount` | `number` or `null`                                                       | TWAP executions completed. `null` on the snapshot, populated on updates. Clamp with `min(completedFillCount, twapBucketCount)`.                                                                                                                                                                            |
| `placedAt`           | `string` (ISO 8601)                                                      |                                                                                                                                                                                                                                                                                                            |
| `closedAt`           | `string` (ISO 8601) or `null`                                            |                                                                                                                                                                                                                                                                                                            |

Looking for a field that is not listed here? Fetch the full order from [`GET /orders/{orderId}`](/docs/api-reference/flash/get-order).

## Unsubscribing

Stop the channel with an `unsubscribe` message. The server re-acks your remaining channels.

```json theme={null}
{ "channel": "orders", "type": "unsubscribe" }
```

## Example integration

A framework-agnostic reference in about 40 lines:

```ts theme={null}
const WS_URL = "wss://flash.definitive.fi/v1/ws";
const API_KEY = "dpka_…";

const orders = new Map(); // orderId -> FlashOrderUpdate
const OPEN = new Set([
  "ORDER_STATUS_PENDING",
  "ORDER_STATUS_ACCEPTED",
  "ORDER_STATUS_PARTIALLY_FILLED",
]);

let attempts = 0; // grows on each failed reconnect, resets on a good connection

function connect() {
  const ws = new WebSocket(WS_URL);
  let stop = false; // set on a terminal error so we don't reconnect

  ws.onopen = () => {
    attempts = 0;
    // add funderAddress to scope the stream to one funder
    ws.send(JSON.stringify({ channel: "orders", type: "subscribe", apiKey: API_KEY }));
    ws.send(JSON.stringify({ channel: "heartbeats", type: "subscribe", apiKey: API_KEY })); // keeps the socket alive
  };

  ws.onmessage = (e) => {
    const f = JSON.parse(e.data);
    if (f.type === "snapshot") {
      orders.clear();
      for (const o of f.orders) orders.set(o.orderId, o);
      render(orders);
    } else if (f.type === "update") {
      for (const o of f.orders) {
        if (OPEN.has(o.status)) orders.set(o.orderId, o); // replace by orderId
        else orders.delete(o.orderId); // drop terminal orders
      }
      render(orders);
    } else if (f.type === "error") {
      console.warn("[flash-ws]", f.code, f.message);
      if (f.code === "UNAUTHORIZED") { stop = true; ws.close(); } // bad key: fix it, don't retry
      // other errors leave the socket open; fall back to GET /orders if the stream stays down
    }
    // heartbeat and ack frames need no action
  };

  ws.onclose = () => {
    if (stop) return;
    const backoff = Math.min(30_000, 1_000 * 2 ** attempts++);
    setTimeout(connect, backoff / 2 + Math.random() * (backoff / 2)); // equal jitter; re-subscribes on reopen
  };
}
```

## Errors

Errors arrive as a frame you can act on:

```json theme={null}
{ "type": "error", "code": "UNAUTHORIZED", "message": "apiKey does not match this connection" }
```

| Code                    | What it means                                                                     | What to do                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `INVALID_REQUEST`       | `funderAddress` was present but not a non-empty string                            | Omit `funderAddress` to stream every funder, or send a valid address.                      |
| `FUNDER_LOCKED`         | Tried to change the subscription's scope on a connection already streaming orders | `unsubscribe` from `orders` and re-subscribe with the new scope, or open a new connection. |
| `STREAMING_UNAVAILABLE` | The stream is temporarily unavailable                                             | Fall back to [`GET /orders`](/docs/api-reference/flash/list-orders).                            |

Transient errors (`SUBSCRIBE_FAILED`, `SNAPSHOT_FAILED`, `STREAM_ERROR`) mean the server hit a temporary issue; reconnect and re-subscribe. Connection-level codes like `UNAUTHORIZED` and `CONNECTION_LIMIT` are covered in [Connection](/docs/api-reference/flash/websocket-connection#errors).

<CardGroup cols={2}>
  <Card title="Order statuses" icon="list-check" href="/docs/order-statuses">
    The order statuses the stream emits, and which are terminal.
  </Card>

  <Card title="List orders (REST)" icon="rotate" href="/docs/api-reference/flash/list-orders">
    Poll open orders when the stream is unavailable.
  </Card>
</CardGroup>

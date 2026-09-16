> ## Documentation Index
> Fetch the complete documentation index at: https://flash.definitive.fi/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Order Statuses

> The order statuses returned by Flash, which ones are cancellable, how orders transition between them, and the reason codes for cancelled or rejected orders.

Flash defines eight order statuses. They appear in the responses of the Cancel Order, Get Order Details, and List Orders endpoints.

<Note>
  Order status changes also stream live over the [Orders WebSocket](/docs/api-reference/flash/websocket). When you track open orders from the stream, drop an order once its status becomes terminal (`ORDER_STATUS_FILLED`, `ORDER_STATUS_CANCELLED`, or `ORDER_STATUS_REJECTED`).
</Note>

## Available statuses

| Status                          | Description                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `ORDER_STATUS_UNSPECIFIED`      | Default/unspecified status                                                                                                              |
| `ORDER_STATUS_PENDING`          | Order is pending and waiting to be processed                                                                                            |
| `ORDER_STATUS_ACCEPTED`         | Order has been accepted and is being processed                                                                                          |
| `ORDER_STATUS_PARTIALLY_FILLED` | Order has been partially filled. A resting state for slice-based orders like TWAP: some slices have filled while the rest keep working. |
| `ORDER_STATUS_FILLED`           | Order has been completely filled                                                                                                        |
| `ORDER_STATUS_CANCELLED`        | Order has been cancelled                                                                                                                |
| `ORDER_STATUS_REJECTED`         | Order was rejected                                                                                                                      |
| `ORDER_STATUS_TERMINATED`       | Order has been terminated                                                                                                               |

<Note>
  An attached bracket pair has its own pre-activation lifecycle — `pending_activation`, `active`, `never_activated` — reported through the `attachedBracket` object on its entry order. Once active, the pair is an ordinary order and moves through the statuses above. See [Bracket Orders](/docs/brackets#lifecycle).
</Note>

## Cancellable statuses

Three statuses permit cancellation: `ORDER_STATUS_PENDING`, `ORDER_STATUS_ACCEPTED`, and `ORDER_STATUS_PARTIALLY_FILLED`.

## Non-cancellable statuses

Four statuses prevent cancellation: `ORDER_STATUS_FILLED`, `ORDER_STATUS_CANCELLED`, `ORDER_STATUS_REJECTED`, and `ORDER_STATUS_TERMINATED`.

## Cancellation reasons

When an order ends in `ORDER_STATUS_CANCELLED` or `ORDER_STATUS_REJECTED`, the `closeReason` field on the order response carries a reason code explaining why. Below are a few common reasons you can act on. This list is not exhaustive and can grow.

| Reason                                | Meaning                                                                                                                                                    | What to do                                                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `REASON_INSUFFICIENT_ASSET_BALANCE`   | Available balance was not enough to fulfill the order.                                                                                                     | Ensure sufficient balance before placing the order.                                                                         |
| `REASON_MAXIMUM_SLIPPAGE_EXCEEDED`    | The trade would have exceeded your maximum slippage.                                                                                                       | Retry with a higher maximum slippage.                                                                                       |
| `REASON_EXECUTION_COST_EXCEEDS_LIMIT` | Execution costs (gas and fees) exceeded 30% of the order value.                                                                                            | Increase the order size so execution costs are a smaller share of the total.                                                |
| `REASON_ORDER_REJECTED_AT_VENUE`      | The order could not be placed due to network congestion.                                                                                                   | Retry the order.                                                                                                            |
| `REASON_ORDER_TRIGGERED_ON_ENTRY`     | A stop-loss or take-profit order whose trigger price was already crossed at placement. There is no resting behavior to perform, so the order is cancelled. | Check the current market price before placing a triggered order and ensure your trigger price has not already been crossed. |

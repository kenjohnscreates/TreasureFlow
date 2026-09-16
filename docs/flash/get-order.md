> ## Documentation Index
> Fetch the complete documentation index at: https://flash.definitive.fi/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Get order detail

> Fetch a single Flash order with its execution fills.



## OpenAPI

````yaml https://flash.definitive.fi/v1/openapi.json get /orders/{orderId}
openapi: 3.1.0
info:
  title: Definitive Flash API
  version: 2.0.0
  description: Flash swap API for decentralized token trading.
servers:
  - url: https://flash.definitive.fi/v1
security: []
paths:
  /orders/{orderId}:
    get:
      tags:
        - Flash
      summary: Get order detail
      description: Fetch a single Flash order with its execution fills.
      parameters:
        - schema:
            type: string
            format: uuid
            description: Flash order ID.
          required: true
          name: orderId
          in: path
        - schema:
            type: string
            minLength: 1
            description: Funder wallet address that placed the order.
          required: true
          name: funderAddress
          in: query
      responses:
        '200':
          description: Order detail returned successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/FlashGetOrderResponse'
        '400':
          description: Invalid request parameters
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '401':
          description: Authentication failed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '403':
          description: Permission denied
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: Resource not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '422':
          description: Resource state prevents the requested operation
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '429':
          description: Rate limit exceeded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: Internal server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '503':
          description: Service temporarily unavailable
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '504':
          description: Gateway timeout
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
      security:
        - ApiKeyAuth: []
components:
  schemas:
    FlashGetOrderResponse:
      type: object
      properties:
        order:
          $ref: '#/components/schemas/FlashOrder'
        fills:
          type: array
          items:
            $ref: '#/components/schemas/FlashFill'
      required:
        - order
        - fills
    ErrorResponse:
      type: object
      properties:
        error:
          type: object
          properties:
            code:
              type: string
            message:
              type: string
            details:
              nullable: true
          required:
            - code
            - message
      required:
        - error
    FlashOrder:
      type: object
      properties:
        orderId:
          type: string
        orderType:
          $ref: '#/components/schemas/OrderType'
        side:
          $ref: '#/components/schemas/OrderSide'
        status:
          $ref: '#/components/schemas/FlashOrderStatus'
        closeReason:
          type: string
          nullable: true
          description: >-
            Reason the order was closed (e.g. `REASON_USER_REQUESTED`,
            `REASON_FULLY_FILLED`); null while the order is still active.
        funderAddress:
          type: string
        targetAsset:
          $ref: '#/components/schemas/FlashAssetRef'
        contraAsset:
          $ref: '#/components/schemas/FlashAssetRef'
        qty:
          type: string
        filled:
          $ref: '#/components/schemas/FlashOrderFilled'
        limitNotionalPrice:
          type: string
          nullable: true
        limitCrossPrice:
          type: string
          nullable: true
        trigger:
          allOf:
            - $ref: '#/components/schemas/PriceTrigger'
            - nullable: true
        brackets:
          type: array
          nullable: true
          items:
            $ref: '#/components/schemas/PriceTrigger'
        attachedBracket:
          $ref: '#/components/schemas/AttachedBracketRead'
        sourceEntryOrderId:
          type: string
          description: >-
            On a protective order created by an attached pair: the entry order
            it was attached to.
        maxPriceImpact:
          type: string
          nullable: true
        twapBucketCount:
          type: integer
          nullable: true
        placedAt:
          type: string
          format: date-time
        acceptedAt:
          type: string
          nullable: true
          format: date-time
        closedAt:
          type: string
          nullable: true
          format: date-time
        expiresAt:
          type: string
          nullable: true
          format: date-time
          description: >-
            When the order expires. Null for good-til-cancelled orders (no
            `expireTime` was set) and for market orders.
          example: '2026-05-12T00:00:00Z'
      required:
        - orderId
        - orderType
        - side
        - status
        - closeReason
        - funderAddress
        - targetAsset
        - contraAsset
        - qty
        - filled
        - limitNotionalPrice
        - limitCrossPrice
        - trigger
        - brackets
        - maxPriceImpact
        - twapBucketCount
        - placedAt
        - acceptedAt
        - closedAt
        - expiresAt
    FlashFill:
      type: object
      properties:
        status:
          $ref: '#/components/schemas/FlashChainStatus'
        notional:
          type: string
        venues:
          type: array
          items:
            type: string
        filledAt:
          type: string
          format: date-time
        rootOrderId:
          type: string
        orderId:
          type: string
          description: >-
            Order id this fill belongs to. For TWAP orders, this is the child
            slice that produced the fill; for all other order types it equals
            `rootOrderId`.
        parentOrderId:
          type: string
        transactionId:
          type: string
        fillPrice:
          type: string
        feeAmount:
          type: string
          description: >-
            Total fee for this fill, denominated in `feeTicker`: Definitive's
            platform fee + network fee + your integrator fee.
        feeTicker:
          type: string
        tradeFeeAmount:
          type: string
          description: >-
            Definitive's platform fee for this fill, denominated in `feeTicker`.
            Does not include your integrator fee.
        networkFeeAmount:
          type: string
        integratorFeeAmount:
          type: string
          description: >-
            Your integrator fee for this fill, denominated in `feeTicker`. "0"
            when no integrator fee was charged.
        feeNotional:
          type: string
          description: >-
            Total fee for this fill in USD — `feeAmount` converted at the
            `feeTicker` rate: Definitive's platform fee + network fee + your
            integrator fee.
        tradeFeeNotional:
          type: string
        networkFeeNotional:
          type: string
        integratorFeeNotional:
          type: string
          description: Your integrator fee for this fill, in USD.
        contraAmount:
          type: string
        targetAmount:
          type: string
      required:
        - status
        - notional
        - venues
        - filledAt
        - rootOrderId
        - orderId
        - parentOrderId
        - transactionId
        - fillPrice
        - feeAmount
        - feeTicker
        - tradeFeeAmount
        - networkFeeAmount
        - integratorFeeAmount
        - feeNotional
        - tradeFeeNotional
        - networkFeeNotional
        - integratorFeeNotional
        - contraAmount
        - targetAmount
    OrderType:
      type: string
      enum:
        - market
        - limit
        - twap
        - stop
        - stop-loss
        - take-profit
        - bracket
    OrderSide:
      type: string
      enum:
        - buy
        - sell
    FlashOrderStatus:
      type: string
      enum:
        - ORDER_STATUS_UNSPECIFIED
        - ORDER_STATUS_PENDING
        - ORDER_STATUS_ACCEPTED
        - ORDER_STATUS_PARTIALLY_FILLED
        - ORDER_STATUS_FILLED
        - ORDER_STATUS_CANCELLED
        - ORDER_STATUS_REJECTED
        - ORDER_STATUS_TERMINATED
    FlashAssetRef:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        address:
          type: string
        ticker:
          type: string
        chain:
          $ref: '#/components/schemas/FlashAssetChainRef'
      required:
        - id
        - name
        - address
        - ticker
        - chain
    FlashOrderFilled:
      type: object
      nullable: true
      properties:
        targetAmount:
          type: string
          nullable: true
        contraAmount:
          type: string
          nullable: true
        averagePrice:
          type: string
          nullable: true
        averageNotionalPrice:
          type: string
          nullable: true
      required:
        - targetAmount
        - contraAmount
        - averagePrice
        - averageNotionalPrice
    PriceTrigger:
      type: object
      properties:
        notionalPrice:
          type: string
          description: USD-price trigger on the traded (`targetAsset`) asset.
          example: '1800'
        crossPrice:
          type: string
          description: >-
            Pair-rate trigger — price of `targetAsset` denominated in
            `contraAsset`. Mutually exclusive with `notionalPrice`.
          example: '1800'
        triggerType:
          type: string
          enum:
            - upper
            - lower
          description: >-
            "lower": fires when market drops to/below the price. "upper": rises
            to/above.
      required:
        - triggerType
    AttachedBracketRead:
      type: object
      properties:
        status:
          type: string
          enum:
            - pending_activation
            - never_activated
            - active
          description: >-
            pending_activation: becomes a live order on the entry's first fill.
            never_activated: the entry closed unfilled. active: the protective
            order exists — read it by `bracketOrderId`.
        bracketOrderId:
          type: string
          nullable: true
          description: The protective order's own id; set once status is active.
        takeProfit:
          $ref: '#/components/schemas/AttachedBracketReadLeg'
        stopLoss:
          allOf:
            - $ref: '#/components/schemas/AttachedBracketReadLeg'
            - description: >-
                The stop-loss leg as submitted. Null on stream frames — the full
                configuration rides GET.
        signedMaxFromAmount:
          type: string
          nullable: true
          description: >-
            The maximum amount of the received asset the signature authorizes
            selling.
      required:
        - status
        - bracketOrderId
        - takeProfit
        - stopLoss
        - signedMaxFromAmount
      description: >-
        The attached take-profit / stop-loss pair. Present only on orders
        submitted with an `attachedBracket` block.
    FlashChainStatus:
      type: string
      enum:
        - CHAIN_STATUS_UNSPECIFIED
        - CHAIN_STATUS_PROCESSED
        - CHAIN_STATUS_REORGED
        - CHAIN_STATUS_FINALIZED
      description: On-chain status of the fill.
    FlashAssetChainRef:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        namespace:
          type: string
      required:
        - id
        - name
        - namespace
    AttachedBracketReadLeg:
      type: object
      nullable: true
      properties:
        notionalPrice:
          type: string
        crossPrice:
          type: string
        limitPrice:
          type: string
          description: >-
            When set, this leg exits as a limit order at this price instead of
            at market.
      description: >-
        The take-profit leg as submitted. Null on stream frames — the full
        configuration rides GET.
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: x-definitive-api-key
      description: Your Definitive API key.
      x-default: dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b

````
> ## Documentation Index
> Fetch the complete documentation index at: https://flash.definitive.fi/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Submit an order

> Submit a flash order for MEV-protected execution.

**Signing requirement.** The funder wallet must sign data returned by `POST /quote` before this call:

- **EVM chains** — sign the `evm.orderTypedData` payload (EIP-712); pass the 0x-prefixed hex signature as `userSignature`. Echo the typed data back as `evmOrderTypedData`. If the quote returned `evm.permitTypedData`, sign that too, echo it back as `evmPermitTypedData`, and pass the signature as `evmPermitSignature`.
- **SVM** (`solana`) — produce a 64-byte Ed25519 signature over `svm.orderMessage`; pass the base58 signature as `userSignature`. Also echo `svm.nonce` as `svmNonce` and `svm.deadline` as `svmDeadline` from the quote response. If `svm.sponsoredDelegateTx` is non-null, sign and echo it back as `svmSponsoredDelegateTx` — Definitive covers the network fee.

**Attached brackets.** If the quote carried `attachedBracket`, sign its chain block with the funder wallet — on EVM sign `attachedBracket.evm.orderTypedData` (EIP-712) and echo `salt`; on Solana produce a 64-byte Ed25519 signature over `attachedBracket.svm.orderMessage` and echo `attachedBracket.svm.nonce` as `svmNonce` — and submit the block with the same legs plus `userSignature`, `deadline`, and `signedMaxFromAmount` echoed from the quote (on EVM, also the permit echo pair when the quote returned `attachedBracket.evm.permitTypedData`; on Solana, execute `attachedBracket.svm.delegateIx` first unless it rode the sponsored transaction). The pair becomes a live order on the entry's first fill and sells what the entry received when a leg triggers; the entry stops filling at that point. The response carries the entry's `orderId` alone — the protective order gets its own id once it activates.

Pass `quoteId` from the prior quote to lock pricing.
For cross-chain market orders, also pass `recipientAddress` and echo a non-null `bridgeQuoteId` from the quote response.



## OpenAPI

````yaml https://flash.definitive.fi/v1/openapi.json post /order
openapi: 3.1.0
info:
  title: Definitive Flash API
  version: 2.0.0
  description: Flash swap API for decentralized token trading.
servers:
  - url: https://flash.definitive.fi/v1
security: []
paths:
  /order:
    post:
      tags:
        - Flash
      summary: Submit an order
      description: >-
        Submit a flash order for MEV-protected execution.


        **Signing requirement.** The funder wallet must sign data returned by
        `POST /quote` before this call:


        - **EVM chains** — sign the `evm.orderTypedData` payload (EIP-712); pass
        the 0x-prefixed hex signature as `userSignature`. Echo the typed data
        back as `evmOrderTypedData`. If the quote returned
        `evm.permitTypedData`, sign that too, echo it back as
        `evmPermitTypedData`, and pass the signature as `evmPermitSignature`.

        - **SVM** (`solana`) — produce a 64-byte Ed25519 signature over
        `svm.orderMessage`; pass the base58 signature as `userSignature`. Also
        echo `svm.nonce` as `svmNonce` and `svm.deadline` as `svmDeadline` from
        the quote response. If `svm.sponsoredDelegateTx` is non-null, sign and
        echo it back as `svmSponsoredDelegateTx` — Definitive covers the network
        fee.


        **Attached brackets.** If the quote carried `attachedBracket`, sign its
        chain block with the funder wallet — on EVM sign
        `attachedBracket.evm.orderTypedData` (EIP-712) and echo `salt`; on
        Solana produce a 64-byte Ed25519 signature over
        `attachedBracket.svm.orderMessage` and echo `attachedBracket.svm.nonce`
        as `svmNonce` — and submit the block with the same legs plus
        `userSignature`, `deadline`, and `signedMaxFromAmount` echoed from the
        quote (on EVM, also the permit echo pair when the quote returned
        `attachedBracket.evm.permitTypedData`; on Solana, execute
        `attachedBracket.svm.delegateIx` first unless it rode the sponsored
        transaction). The pair becomes a live order on the entry's first fill
        and sells what the entry received when a leg triggers; the entry stops
        filling at that point. The response carries the entry's `orderId` alone
        — the protective order gets its own id once it activates.


        Pass `quoteId` from the prior quote to lock pricing.

        For cross-chain market orders, also pass `recipientAddress` and echo a
        non-null `bridgeQuoteId` from the quote response.
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SubmitOrderRequest'
      responses:
        '201':
          description: Order submitted successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SubmitOrderResponse'
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
    SubmitOrderRequest:
      type: object
      properties:
        targetChain:
          $ref: '#/components/schemas/Chain'
        contraChain:
          allOf:
            - $ref: '#/components/schemas/Chain'
            - description: >-
                Chain of the contra (counter) asset. May differ from
                `targetChain` for a cross-chain market order.
        targetAsset:
          type: string
          minLength: 1
          description: Address of the target (traded) asset.
          example: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
        contraAsset:
          type: string
          minLength: 1
          description: >-
            Address of the contra (counter) asset — spent on buys, received on
            sells.
          example: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
        side:
          allOf:
            - $ref: '#/components/schemas/OrderSide'
            - description: direction of the order
              example: buy
        qty:
          type: string
          description: >-
            Amount of the asset being spent (sold), as a decimal string in the
            asset's normalized units. For `buy` orders this is in `contraAsset`
            units; for `sell` orders this is in `targetAsset` units.
          example: '1.5'
        orderType:
          allOf:
            - $ref: '#/components/schemas/OrderType'
            - description: Order type. Cross-chain orders support `market` only.
              example: market
        quickTrade:
          type: boolean
          description: >-
            Execution mode for sniping newly launched tokens (exclusive to
            same-chain market swaps; not supported cross-chain). Reach out to
            the Definitive team to find out whether QuickTrade is a good fit for
            your use case.
        maxSlippage:
          type: string
          description: >-
            Slippage tolerance as a decimal (e.g. 0.05 = 5%). When omitted, our
            engine sets a slippage at order admission.
        maxPriceImpact:
          type: string
          default: '0.05'
          description: >-
            Maximum price impact as a decimal (e.g. 0.05 = 5%). Defaults to
            0.05.
        limitNotionalPrice:
          type: string
          description: >-
            USD limit price for the traded (`targetAsset`) asset. Required for
            `limit` orders unless `limitCrossPrice` is set; optional for `twap`,
            `stop`, `stop-loss`, and `take-profit` (trigger orders are promoted
            to the corresponding LIMIT variant).
          example: '4000'
        limitCrossPrice:
          type: string
          description: >-
            Pair-rate limit price — how many `contraAsset` units one
            `targetAsset` unit is worth. Frame is the same on `buy` and `sell`.
            Mutually exclusive with `limitNotionalPrice`; either satisfies the
            limit-price requirement.
          example: '4000'
        funderAddress:
          type: string
          minLength: 1
          example: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
        recipientAddress:
          type: string
          minLength: 1
          description: >-
            Address that receives funds on the destination chain. Required when
            `targetChain` and `contraChain` differ.
        quoteId:
          type: string
          minLength: 1
          description: >-
            QuoteResponse.quoteId. For marketable orders, passing this value in
            tries executing the cached quote from before instead of requoting
            again. For non-market orders, this field is unnecessary.
        bridgeQuoteId:
          type: string
          minLength: 1
          description: >-
            QuoteResponse.bridgeQuoteId. Cross-chain only; binds submission to
            the cached bridge quote when present.
        flashIntegratorFeeBps:
          type: string
          example: '10'
        erc8021AttributionCode:
          type: string
          pattern: ^[a-zA-Z0-9_.-]{1,32}$
          description: >-
            Optional. The integrator's ERC-8021 builder code as registered on
            base.dev (e.g. `acme`). Plain value, not key:value — the code is the
            lookup key into Base's on-chain Code Registry. Applies to EVM
            settlement transactions only; silently ignored for SVM (Solana)
            orders. Appended to the settlement transaction calldata alongside
            Definitive's own builder code as a comma-separated ERC-8021 suffix.
            An unregistered/typo'd code never fails the order — indexers just
            can't resolve it to a payout address.
          example: acme
        userSignature:
          type: string
          minLength: 1
          description: >-
            Funder wallet signature over the order payload. Accepts 0x-prefixed
            hex (EVM convention) or base58 (Solana convention). EVM: EIP-712
            signature over `evm.orderTypedData`; SVM: 64-byte Ed25519 signature
            over `svm.orderMessage`.
          example: 0x...
        evmOrderTypedData:
          type: string
          description: Echo of `QuoteResponse.evm.orderTypedData`. EVM-only.
        evmPermitTypedData:
          type: string
          description: Echo of `QuoteResponse.evm.permitTypedData`. EVM-only.
        evmPermitSignature:
          type: string
          description: >-
            Permit2 signature over `evm.permitTypedData`. EVM-only; accepts
            0x-prefixed hex.
        svmNonce:
          type: string
          description: Echo of `QuoteResponse.svm.nonce`. SVM-only.
        svmDeadline:
          type: string
          description: >-
            Unix-seconds expiry, echo of `QuoteResponse.svm.deadline`. SVM-only
            (the EVM deadline is encoded inside `evm.orderTypedData`).
        svmSponsoredDelegateTx:
          type: string
          description: >-
            Base64 echo of `QuoteResponse.svm.sponsoredDelegateTx` after signing
            with the funder wallet. SVM-only and required when the quote
            returned a non-null `svm.sponsoredDelegateTx`; omit otherwise.
        twapBucketCount:
          type: integer
          minimum: 2
          maximum: 2560
          description: TWAP only. Must equal the value used at quote time.
        startTime:
          type: string
          format: date-time
          description: >-
            TWAP only. Scheduled execution start; must equal the value used at
            quote time.
          example: '2026-05-12T00:00:00Z'
        triggers:
          type: array
          items:
            $ref: '#/components/schemas/PriceTrigger'
          maxItems: 2
          description: >-
            Price triggers. Each entry requires exactly one of `notionalPrice`
            or `crossPrice`. Must echo the values used at quote time for trigger
            orders.
        attachedBracket:
          type: object
          properties:
            takeProfit:
              $ref: '#/components/schemas/AttachedBracketLeg'
            stopLoss:
              allOf:
                - $ref: '#/components/schemas/AttachedBracketLeg'
                - description: >-
                    Fires when the received asset's price drops to or below the
                    trigger.
            userSignature:
              type: string
              minLength: 1
              description: >-
                Signature over the attached pair's signing payload: on EVM an
                EIP-712 signature over `attachedBracket.evm.orderTypedData`
                (0x-prefixed hex); on Solana an Ed25519 signature over
                `attachedBracket.svm.orderMessage` (base58 or hex).
            salt:
              type: string
              minLength: 1
              description: >-
                EVM only — echo of the quote's `attachedBracket.salt`. Required
                on EVM; omit on Solana.
            svmNonce:
              type: string
              minLength: 1
              description: >-
                Solana only — echo of the quote's `attachedBracket.svm.nonce`.
                Required on Solana; omit on EVM.
            deadline:
              type: string
              minLength: 1
              description: Echo of the quote's `attachedBracket.deadline`.
            signedMaxFromAmount:
              type: string
              minLength: 1
              description: >-
                Echo of the quote's `attachedBracket.signedMaxFromAmount` — the
                value baked into the signed typed data.
            evmPermitSignature:
              type: string
              description: >-
                Permit2 signature over the quote's
                `attachedBracket.evm.permitTypedData`. Required when that field
                was non-null; provide together with `evmPermitTypedData`.
            evmPermitTypedData:
              type: string
              description: >-
                Echo of the quote's `attachedBracket.evm.permitTypedData`.
                Provide together with `evmPermitSignature`.
          required:
            - takeProfit
            - stopLoss
            - userSignature
            - deadline
            - signedMaxFromAmount
          description: >-
            The attached take-profit / stop-loss pair: the legs as quoted plus
            the signature material from the quote's `attachedBracket` block.
      required:
        - targetChain
        - contraChain
        - targetAsset
        - contraAsset
        - side
        - qty
        - orderType
        - funderAddress
        - userSignature
    SubmitOrderResponse:
      type: object
      properties:
        orderId:
          type: string
          example: ord_xyz789
        attachedBracket:
          type: object
          properties:
            status:
              type: string
              description: >-
                The attached pair becomes a live order on the entry's first
                fill; until then it is pending activation.
              example: pending_activation
          required:
            - status
          description: Present only when the order carried `attachedBracket`.
      required:
        - orderId
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
    Chain:
      type: string
      enum:
        - arbitrum
        - avalanche
        - base
        - bsc
        - ethereum
        - optimism
        - polygon
        - solana
        - hyperevm
        - plasma
        - monad
        - robinhood
        - ink
      description: >-
        Chain of the target (traded) asset. May differ from `contraChain` for a
        cross-chain market order.
      example: ethereum
    OrderSide:
      type: string
      enum:
        - buy
        - sell
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
    AttachedBracketLeg:
      type: object
      properties:
        notionalPrice:
          type: string
          description: >-
            USD-price trigger on the asset the order receives (the `to` leg).
            Each leg requires exactly one of `notionalPrice` or `crossPrice`.
          example: '1800'
        crossPrice:
          type: string
          description: >-
            Pair-rate trigger — price of the received asset denominated in the
            spent asset. Mutually exclusive with `notionalPrice`.
        limitPrice:
          type: string
          description: >-
            Optional limit price for the exit placed when this leg fires. Omit
            to exit at market. Same denomination as the leg's trigger price.
      description: Fires when the received asset's price rises to or above the trigger.
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: x-definitive-api-key
      description: Your Definitive API key.
      x-default: dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b

````
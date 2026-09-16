> ## Documentation Index
> Fetch the complete documentation index at: https://flash.definitive.fi/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Get a quote

> Request a quote for a Flash swap. Returns pricing, fee breakdown, asset amounts, market quality indicators, and source-chain signing actions. Cross-chain market orders are supported by setting `targetChain` and `contraChain` to different values and providing `recipientAddress`. Same-chain quotes for market, limit, and twap orders may attach a take-profit / stop-loss pair via `attachedBracket` — the response then carries a second signing payload and any funding actions for the received asset under `attachedBracket`.



## OpenAPI

````yaml https://flash.definitive.fi/v1/openapi.json post /quote
openapi: 3.1.0
info:
  title: Definitive Flash API
  version: 2.0.0
  description: Flash swap API for decentralized token trading.
servers:
  - url: https://flash.definitive.fi/v1
security: []
paths:
  /quote:
    post:
      tags:
        - Flash
      summary: Get a quote
      description: >-
        Request a quote for a Flash swap. Returns pricing, fee breakdown, asset
        amounts, market quality indicators, and source-chain signing actions.
        Cross-chain market orders are supported by setting `targetChain` and
        `contraChain` to different values and providing `recipientAddress`.
        Same-chain quotes for market, limit, and twap orders may attach a
        take-profit / stop-loss pair via `attachedBracket` — the response then
        carries a second signing payload and any funding actions for the
        received asset under `attachedBracket`.
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/QuoteRequest'
            example:
              targetChain: base
              contraChain: base
              targetAsset: '0x4200000000000000000000000000000000000006'
              contraAsset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
              side: buy
              qty: '100'
              orderType: market
              funderAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
              maxSlippage: '0.01'
      responses:
        '200':
          description: Quote generated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/QuoteResponse'
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
    QuoteRequest:
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
          description: >-
            Wallet that funds the spent asset on the source chain. The source is
            `contraChain` for buys and `targetChain` for sells.
        recipientAddress:
          type: string
          description: >-
            Address that receives funds on the destination chain. Required when
            `targetChain` and `contraChain` differ.
        evmUsePermit2:
          type: boolean
          description: >-
            EVM only. When true, forces the Permit2 signing flow instead of the
            Flash settlement contract flow. When false or omitted, the server
            picks the flow from the funder's on-chain state — typically the
            Flash settlement contract flow. Reach out to the Definitive team to
            discuss whether to populate this flag.
        forceMinimalAllowance:
          type: boolean
          description: >-
            When true, newly needed ERC-20 approvals or Permit2 permits to
            FlashAllowance and Solana SPL delegations use the cumulative amount
            required for this quote and outstanding orders at quote acquisition
            (concurrent quotes do not reserve allowance). Sufficient existing
            authorization, including unlimited amounts, is reused. ERC-20
            approval to Permit2 remains unlimited. Defaults to false. Cannot be
            combined with attachedBracket.
        svmUseNativeSOL:
          type: boolean
          description: >-
            Quote-only Solana native-SOL intent. When true, a spent
            So11111111111111111111111111111111111111112 asset is treated as
            native SOL and the quote returns instructions to wrap the full spend
            amount into wSOL before signing/submitting. When false or omitted,
            So11111111111111111111111111111111111111112 is treated as an
            ordinary wSOL SPL token balance.
        flashIntegratorFeeBps:
          type: string
          description: Integrator fee in basis points (100 = 1%). Maximum 1000 (10%).
          example: '100'
        expireTime:
          type: string
          format: date-time
          description: >-
            ISO-8601 expiry. Optional for LIMIT and trigger orders (omit for
            good-til-cancelled).
          example: '2026-05-12T00:00:00Z'
        startTime:
          type: string
          format: date-time
          description: >-
            TWAP only. ISO-8601 scheduled execution start. durationSeconds is
            measured from this time.
          example: '2026-05-12T00:00:00Z'
        durationSeconds:
          type: integer
          minimum: 300
          description: TWAP only. Required for TWAP; minimum 300 (5 minutes).
          example: 1800
        twapBucketCount:
          type: integer
          minimum: 2
          maximum: 2560
          description: >-
            TWAP only. Number of equal-time buckets. Omit to let the server
            auto-derive.
          example: 12
        triggers:
          type: array
          items:
            $ref: '#/components/schemas/PriceTrigger'
          maxItems: 2
          description: >-
            Price triggers. Each entry requires exactly one of `notionalPrice`
            (USD) or `crossPrice` (pair rate). Required for `stop` / `stop-loss`
            / `take-profit` (length 1) and `bracket` (length 2, opposite
            triggerTypes).
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
          required:
            - takeProfit
            - stopLoss
          description: >-
            Attach a take-profit / stop-loss pair to the order. The pair
            protects what the order receives: when a leg's trigger is reached it
            sells the received asset (at market, or at the leg's `limitPrice`),
            and the order stops filling. Supported for market, limit, and twap
            orders on same-chain quotes; requires `funderAddress`. The response
            then carries a second signing payload under `attachedBracket`.
      required:
        - targetChain
        - contraChain
        - targetAsset
        - contraAsset
        - side
        - qty
        - orderType
    QuoteResponse:
      type: object
      properties:
        quoteId:
          type: string
          example: q_abc123
        bridgeQuoteId:
          type: string
          nullable: true
          description: >-
            Cross-chain bridge quote identifier. When non-null, pass it as
            `bridgeQuoteId` on `POST /order`.
        orderType:
          $ref: '#/components/schemas/OrderType'
        side:
          $ref: '#/components/schemas/OrderSide'
        targetAsset:
          type: string
          example: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
        contraAsset:
          type: string
          example: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
        from:
          $ref: '#/components/schemas/QuoteLeg'
        to:
          allOf:
            - $ref: '#/components/schemas/QuoteLeg'
            - description: >-
                The received (net, post-fee) leg. `asset` is `target` on buys
                and `contra` on sells.
        fees:
          $ref: '#/components/schemas/QuoteFees'
        estimatedPriceImpact:
          type: string
          nullable: true
          description: >-
            Estimated price impact as a decimal (e.g. 0.0042 = 0.42%). Null when
            the quote produced no estimate. Can exceed the request's
            `maxPriceImpact`, which applies at fill time.
          example: '0.0042'
        recommendedSlippage:
          type: string
          nullable: true
          description: >-
            Recommended slippage tolerance based on the quote, as a decimal
            (e.g. 0.01 = 1%). Set on market-order quotes (including QuickTrade);
            null for limit, trigger, and TWAP quotes.
          example: '0.01'
        wrap:
          $ref: '#/components/schemas/QuoteWrapAction'
        evm:
          $ref: '#/components/schemas/QuoteEvmActions'
        svm:
          $ref: '#/components/schemas/QuoteSvmActions'
        attachedBracket:
          $ref: '#/components/schemas/QuoteAttachedBracketSigning'
        setupTxs:
          type: array
          nullable: true
          items:
            type: string
          description: >-
            Unsigned pre-trade setup transactions (account creation, native
            wrap, allowance), fully assembled server-side. Sign each with the
            funder wallet and submit via `POST /setup-transaction` in order,
            waiting for a `confirmed` status before the next. Solana quotes
            carry one base64 transaction bundling every step; EVM quotes carry
            one or two 0x-hex transactions at consecutive nonces. Null when no
            setup is needed.
      required:
        - quoteId
        - orderType
        - side
        - targetAsset
        - contraAsset
        - from
        - to
        - fees
        - estimatedPriceImpact
        - wrap
        - evm
        - svm
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
    QuoteLeg:
      type: object
      properties:
        asset:
          type: string
          enum:
            - target
            - contra
        amount:
          type: string
        notional:
          type: string
      required:
        - asset
        - amount
        - notional
      description: The spent leg. `asset` is `contra` on buys and `target` on sells.
    QuoteFees:
      type: object
      properties:
        estimatedFeeNotional:
          type: string
          description: >-
            Total fee in USD notional: Definitive's fee + Integrator fee
            (configurable by the integrator) + Gas cost.
          example: '1.50'
      required:
        - estimatedFeeNotional
    QuoteWrapAction:
      type: object
      nullable: true
      properties:
        nativeAsset:
          type: string
          description: >-
            Native asset address from the request. On Solana this equals
            `wrappedAsset`; the SOL mint is both raw SOL and wrapped SOL.
          example: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
        wrappedAsset:
          type: string
          description: >-
            Wrapped-native token the quote was priced against. Approvals,
            signatures, and submit requests use this asset.
          example: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
        evmTx:
          type: object
          nullable: true
          properties:
            to:
              type: string
            data:
              type: string
            value:
              type: string
          required:
            - to
            - data
            - value
          description: >-
            EVM only. Transaction the funder sends before signing/submitting: a
            `deposit()` call on the wrapped-native contract with `value`
            attached in base units.
        svmInstructions:
          type: array
          nullable: true
          items:
            $ref: '#/components/schemas/SvmInstruction'
          description: >-
            Solana only. Instructions the funder sends before signing/submitting
            for native-SOL quotes. They wrap the full spend amount into the
            funder's wSOL ATA. Includes create ATA idempotent only when the ATA
            is missing, then transfers the spend amount and syncs native. Null
            unless the quote used native-SOL intent.
      required:
        - nativeAsset
        - wrappedAsset
        - evmTx
        - svmInstructions
      description: >-
        Set when the quote request spends the chain's native gas asset and a
        pre-trade wrap is needed. On EVM, the spent side is quoted as the
        wrapped-native token and `wrap.evmTx` must be sent before submit. On
        Solana, quotes with `svmUseNativeSOL=true` include
        `wrap.svmInstructions` that wrap the full spend amount into wSOL before
        signing/submitting. Null otherwise.
    QuoteEvmActions:
      type: object
      nullable: true
      properties:
        approveTx:
          type: object
          nullable: true
          properties:
            to:
              type: string
            data:
              type: string
          required:
            - to
            - data
          description: >-
            ERC-20 approve calldata for the user to send before submit. Spender
            is the Permit2 contract (Permit2 flow) or the
            DefinitiveFlashAllowance contract (approval flow). Null when the
            relevant allowance is already sufficient.
        permitTypedData:
          type: string
          nullable: true
          description: >-
            EIP-712 typed data for the Permit2 approval — the user signs it and
            echoes the value back as `evmPermitTypedData` at submit.
        orderTypedData:
          type: string
          nullable: true
          description: >-
            EIP-712 typed data for the Flash order — the user signs it and
            echoes the value back as `evmOrderTypedData` at submit.
      required:
        - approveTx
        - permitTypedData
        - orderTypedData
      description: >-
        EVM funding and signing actions. Present when the spent (source) asset
        is on an EVM chain; null when it is on SVM.
    QuoteSvmActions:
      type: object
      nullable: true
      properties:
        ataSetupIxs:
          type: array
          nullable: true
          items:
            $ref: '#/components/schemas/SvmInstruction'
          description: >-
            Idempotent create-associated-token-account instructions for the
            funder's input and/or output token accounts when they don't yet
            exist on-chain (funder in the payer slot). Execute them first —
            before `wrap`, `delegateIx` / `sponsoredDelegateTx`, and submit —
            since the swap requires both accounts to exist. Null when both
            accounts already exist.
        delegateIx:
          allOf:
            - $ref: '#/components/schemas/SvmInstruction'
            - nullable: true
              description: >-
                Solana instruction the user wraps in a transaction and signs to
                grant delegate authority. Null when no delegation is needed, or
                when `sponsoredDelegateTx` is offered (use that instead).
        sponsoredDelegateTx:
          type: string
          nullable: true
          description: >-
            Base64-encoded Solana VersionedTransaction. Sponsor-paid alternative
            to `delegateIx`: sign with your funder wallet and echo back as
            `svmSponsoredDelegateTx` at submit (Definitive covers the network
            fee and broadcasts). Mutually exclusive with `delegateIx` — when
            this is non-null, `delegateIx` is null. Null when sponsorship is not
            offered.
        orderMessage:
          type: string
          nullable: true
          description: UTF-8 string the user must sign.
        nonce:
          type: string
          nullable: true
          description: >-
            Flash order nonce — pass back as `svmNonce` at submit so the program
            can rebuild the signed message.
        deadline:
          type: string
          nullable: true
          description: >-
            Unix-seconds expiry — pass back as `svmDeadline` at submit so the
            program can rebuild the signed message.
      required:
        - ataSetupIxs
        - delegateIx
        - sponsoredDelegateTx
        - orderMessage
        - nonce
        - deadline
      description: >-
        SVM funding and signing actions. Present when the spent (source) asset
        is on Solana; null when it is on EVM.
    QuoteAttachedBracketSigning:
      type: object
      properties:
        evm:
          type: object
          nullable: true
          properties:
            approveTx:
              type: object
              nullable: true
              properties:
                to:
                  type: string
                data:
                  type: string
              required:
                - to
                - data
              description: >-
                ERC-20 approve calldata for the received asset — send before
                submit. Null when the allowance is already sufficient.
            permitTypedData:
              type: string
              nullable: true
              description: >-
                EIP-712 typed data for the received asset's Permit2 approval —
                sign it and echo it back as `attachedBracket.evmPermitTypedData`
                at submit, with the signature as
                `attachedBracket.evmPermitSignature`. Null when not needed.
            orderTypedData:
              type: string
              description: >-
                EIP-712 typed data for the attached pair — sign it and pass the
                signature as `attachedBracket.userSignature` at submit.
          required:
            - approveTx
            - permitTypedData
            - orderTypedData
          description: >-
            EVM signing actions for the attached pair. Present on EVM quotes;
            null on Solana.
        svm:
          type: object
          nullable: true
          properties:
            orderMessage:
              type: string
              nullable: true
              description: >-
                UTF-8 string to Ed25519-sign for the attached pair — pass the
                signature as `attachedBracket.userSignature` at submit.
            nonce:
              type: string
              description: >-
                The attached pair's own flash order nonce — always distinct from
                the entry's. Echo back as `attachedBracket.svmNonce` at submit.
            delegateIx:
              allOf:
                - $ref: '#/components/schemas/SvmInstruction'
                - nullable: true
                  description: >-
                    Delegate-authority instruction for the RECEIVED asset's
                    token account (the attached pair sells it back). One-time
                    per token per wallet; execute after any `svm.ataSetupIxs`
                    from the entry block. When sponsorship applies it rides the
                    entry-level `svm.sponsoredDelegateTx` as one combined
                    transaction instead, and this is null.
          required:
            - orderMessage
            - nonce
            - delegateIx
          description: >-
            Solana signing actions for the attached pair. Present on Solana
            quotes; null on EVM.
        salt:
          type: string
          nullable: true
          description: >-
            EVM only — echo back as `attachedBracket.salt` at submit. Null on
            Solana.
        deadline:
          type: string
          description: >-
            Unix-seconds expiry baked into the signed payload. Echo back as
            `attachedBracket.deadline` at submit.
        signedMaxFromAmount:
          type: string
          description: >-
            The maximum amount of the received asset the signature authorizes
            selling.
      required:
        - evm
        - svm
        - salt
        - deadline
        - signedMaxFromAmount
      description: >-
        Signing payload and funding actions for the attached take-profit /
        stop-loss pair. Present only when the request carried `attachedBracket`.
    SvmInstruction:
      type: object
      properties:
        programId:
          type: string
        accounts:
          type: array
          items:
            $ref: '#/components/schemas/SvmAccountMeta'
        data:
          type: string
          description: base58-encoded instruction data
      required:
        - programId
        - accounts
        - data
    SvmAccountMeta:
      type: object
      properties:
        pubkey:
          type: string
        isSigner:
          type: boolean
        isWritable:
          type: boolean
      required:
        - pubkey
        - isSigner
        - isWritable
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: x-definitive-api-key
      description: Your Definitive API key.
      x-default: dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b

````
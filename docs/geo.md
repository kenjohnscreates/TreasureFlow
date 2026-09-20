# Geo notes (demo laptop)

First-party runbook for Runtime NYC. Not a Coinbase eligibility matrix. Coinbase does not publish a full country list.

Live product and judge click path: [README.md](../README.md).

This product talks about trailing fee yield only. No forward APY.

## Coinbase B20 tokenized stocks

Eligible non-US persons only. US persons are out (Reg S).

Source: [Tokenized stocks on Base](https://docs.base.org/base-chain/specs/reference/b20/tokenized-stocks-on-base). Local mirror `docs/oracles/b20-tokenized-stocks.md` states: "Coinbase tokenized stocks are only available to persons in eligible jurisdictions outside of the U.S."

Coinbase has no public full country list. Also exclude OFAC: Cuba, Iran, North Korea, Syria, and Crimea / Donetsk / Luhansk regions of Ukraine.

## Onchain vs frontend

Onchain secondary hold and transfer is largely permissionless, except sanctioned addresses and B20 `isAuthorized` policy checks. KYC is mint and redeem by Authorized Participants (APs), not ordinary secondary transfers. Same Base doc, Compliance section.

Frontends (Coinbase tokenize, and often Aerodrome / Uniswap UIs) geo-block the US. Use a VPN to a clearly non-US exit. Prefer UK or Netherlands (also OK: DE, UAE). Not US. Not OFAC. Not a US-exit VPN.

## Bankr

Bankr publishes no public country list. Sanctioned regions are blocked. A VPN that egresses through a blocked range can fail even if you are physically in an allowed country.

Source: [Security and account access](https://docs.bankr.bot/docs/faq/security-and-access.md). Local `docs/bankr/access.md` is the Club/access-tier page, not this FAQ.

This branch uses the Bankr embedded wallet as company treasury (signer for sweep, pay, Slipstream, Flash). No product geo-gates in code. VPN exit UK or NL before B3 stock LP.

## Aerodrome

Aerodrome contracts are not a geo product. The stock UI may still block the US. The agent encodes Slipstream from the treasury, so the demo tx does not depend on their frontend.

## Demo laptop checklist

1. VPN exit UK or NL (not US, not OFAC, not a US-exit VPN).
2. Confirm the Aerodrome stocks page loads.
3. Confirm a tiny NVDAc transfer works.
4. Only then record the run.

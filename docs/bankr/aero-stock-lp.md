<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!--
      SEO VALUES: keep in sync with scripts/inject-meta.mjs META_DEFAULTS.
      That injector rewrites these tags by EXACT string match at build time and
      at request time — a tag edited here without updating META_DEFAULTS stops
      being replaced and every page silently serves the default again.
    -->
    <title>aero-stock-lp by bankrbot — @skills</title>

    <meta name="description" content="LP tokenized stocks onchain — range-LP Coinbase tokenized equities (NVDA, AAPL, GOOGL, META) and AERO/USDC on Aerodrome Slipstream (Base) for trading-fee +" />
    <meta name="robots" content="index, follow" />
    <meta name="keywords" content="agent skills, @skills, claude code skills, coding agent skills, AI agent marketplace, agent workflows, skill marketplace" />
    <meta name="author" content="SylphAI Inc." />

    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="aero-stock-lp by bankrbot — @skills" />
    <meta property="og:description" content="LP tokenized stocks onchain — range-LP Coinbase tokenized equities (NVDA, AAPL, GOOGL, META) and AERO/USDC on Aerodrome Slipstream (Base) for trading-fee +" />
    <meta property="og:image" content="https://atskills.one/atskills-social-card.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="@skills" />
    <meta property="og:url" content="https://atskills.one/bankrbot/aero-stock-lp" />

    <!-- Canonical (static default; SEO.tsx updates per-route in-place) -->
    <link rel="canonical" href="https://atskills.one/bankrbot/aero-stock-lp" />

    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />

    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@adalagent" />
    <meta name="twitter:title" content="aero-stock-lp by bankrbot — @skills" />
    <meta name="twitter:description" content="LP tokenized stocks onchain — range-LP Coinbase tokenized equities (NVDA, AAPL, GOOGL, META) and AERO/USDC on Aerodrome Slipstream (Base) for trading-fee +" />
    <meta name="twitter:image" content="https://atskills.one/atskills-social-card.png" />
    <!-- Font Optimization: preconnect + preload critical fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preload" href="https://fonts.googleapis.com/css2?family=Poppins:wght@300&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"></noscript>

    <!-- Tracky first-party tracking. Static in index.html (not react-helmet-async
         or an injected script) so it is present in the initial HTML response for
         every route, including prerendered/static pages served straight from dist/. -->
    <script src="https://www.useinflect.ai/inflect-tracking.js" data-tracking-key="inf_D-PVkMxiOxUwQNEPvfqQ3EL7iAZ2AnpK" data-inflect-install-version="2026-08-12.1"></script>
    <img src="https://www.useinflect.ai/api/bot-traffic/pixel?tk=inf_D-PVkMxiOxUwQNEPvfqQ3EL7iAZ2AnpK&iv=2026-08-12.1" alt="" width="1" height="1" style="display:none;" referrerpolicy="unsafe-url" />
    <script type="module" crossorigin src="/assets/index-UV4OkR8o.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/vendor-react-BD5ODk5G.js">
    <link rel="modulepreload" crossorigin href="/assets/vendor-markdown-pfrjY0k6.js">
    <link rel="modulepreload" crossorigin href="/assets/vendor-auth-BLq8Jm7X.js">
    <link rel="modulepreload" crossorigin href="/assets/vendor-analytics-CIaM0XVA.js">
    <link rel="modulepreload" crossorigin href="/assets/vendor-ui-B8g3kN7X.js">
    <link rel="stylesheet" crossorigin href="/assets/index-xY3oWbvA.css">
      <link rel="alternate" type="text/markdown" href="https://atskills.one/bankrbot/aero-stock-lp.md" />
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"aero-stock-lp","description":"LP tokenized stocks onchain — range-LP Coinbase tokenized equities (NVDA, AAPL, GOOGL, META) and AERO/USDC on Aerodrome Slipstream (Base) for trading-fee +","url":"https://atskills.one/bankrbot/aero-stock-lp","author":{"@type":"Organization","name":"bankrbot"},"isPartOf":{"@type":"WebSite","name":"@skills","url":"https://atskills.one"},"applicationCategory":"DeveloperApplication","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"operatingSystem":"Any"}</script>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"@skills","item":"https://atskills.one"},{"@type":"ListItem","position":2,"name":"bankrbot","item":"https://atskills.one/bankrbot"},{"@type":"ListItem","position":3,"name":"aero-stock-lp","item":"https://atskills.one/bankrbot/aero-stock-lp"}]}</script>
  </head>

  <body style="margin:0;background:#050505;color:#fff;">
    <div id="root" style="min-height:100vh;background:#050505;"><main data-ssr-fallback style="max-width:720px;margin:0 auto;padding:96px 24px;font-family:system-ui,sans-serif;"><p style="color:#888;font-size:14px;">Agent skill · <a href="/bankrbot" style="color:#888;">bankrbot</a></p><h1 style="font-weight:500;">aero-stock-lp</h1><p style="color:#bbb;line-height:1.6;">LP tokenized stocks onchain — range-LP Coinbase tokenized equities (NVDA, AAPL, GOOGL, META) and AERO/USDC on Aerodrome Slipstream (Base) for trading-fee + AERO emission yield. Use when the user wants to LP stocks or Aerodrome pools on Base, open/recenter/exit a Slipstream position, check pool status, NAV, or yields, get a portfolio overview (&quot;how are my LP positions doing?&quot;) with P&amp;L and projected APR, run a manage pass, or set up scheduled/price-triggered LP automations in the Bankr console. Auto-routes every position to the higher-yielding side — staked (AERO emissions) vs unstaked (trading fees) — at entry and re-checks on every manage pass. Bundled node scripts do the chain reads, gate checks, and calldata; writes go via the Bankr arbitrary-transaction flow. NOT for perps, spot trading, or Uniswap.</p><h2 style="font-size:16px;font-weight:500;color:#ddd;">What it needs</h2><p style="color:#bbb;line-height:1.6;">About 13k tokens when loaded.</p><h2 style="font-size:16px;font-weight:500;color:#ddd;">What this skill does</h2><p style="color:#bbb;line-height:1.6;">aero-stock-lp — LP onchain equities on Aerodrome (Base) — v2 Concentrated-liquidity market making on Aerodrome Slipstream (Base, chain 8453). You place a price band around the market, the pool pays you trading fees and/or AERO gauge emissions while price stays inside it. Every rule in here was proven (or paid for) with real money. Division of labor. The bundled scripts/ (plain node ≥ 18, zero dependencies) own everything deterministic: chain reads (batched via Multicall3), entry gates (fail closed via exit codes), band/tick math, calldata construction, valuation, and P&amp;L. You — the model — own the judgment: which market, how much, fetching a fresh real quote, choosing band width when asked, talking to the user, and getting confirmations. Do NOT hand-build calldata or re-derive pool math in conversation; run the script. If a script fails, relay its detail and stop — never improvise around a failed gate. Operating model. The user's funds stay in their own Bankr wallet. You never hold keys, and neither do the scripts — they emit unsigned {to, data, value, chainId} objects. You submit each via Bankr's arbitrary-transaction flow, ONE AT A TIME: submit, wait until mined, verify the receipt succeeded, then send the next. The sequence IS your atomicity. Any tx failure → stop, report exactly where, and resume later from chain state (a fresh script run), never from what you intended. Talking to the user. Short answers, plain language, lead with the outcome. Rules: Routine reports are a few lines; the scripts' report fields are written to be relayed nearly verbatim. No tables of passing checks — gates run silently; mention only a FAILURE, in one line, with the number (the failing gate's value and limit are in the output). Prices, never ticks. &quot;$300 – $322&quot;, not &quot;-11700 to -10990&quot;. No contract internals, selectors, or protocol jargon unless asked. Set the time expectation FIRST. …</p><h2 style="font-size:16px;font-weight:500;color:#ddd;">How to use it</h2><p style="color:#bbb;">Reference it in AdaL, Claude Code, Cursor or any coding agent — nothing to install:</p><pre style="background:#111;padding:12px 16px;border-radius:8px;overflow-x:auto;"><code>@skills bankrbot/aero-stock-lp</code></pre><p><a href="https://github.com/bankrbot/openclaw-skills/tree/HEAD/aero-stock-lp" rel="noopener" style="color:#888;">View the source on GitHub</a></p><p><a href="/" style="color:#f6a;">Browse the @skills marketplace</a></p></main></div>
  </body>
</html>

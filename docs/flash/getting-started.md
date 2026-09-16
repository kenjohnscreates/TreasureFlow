> ## Documentation Index
> Fetch the complete documentation index at: https://flash.definitive.fi/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Become an Integrator

> Create a Flash API key and make your first request.

# Become an Integrator

<Note>
  This walkthrough is for **integrators** running their own Flash-enabled API key (your org appears as the integrator on every order, supports per-integrator fees, etc.).

  If you only want to **trade**, skip the signup flow — call the API directly with the prefilled Definitive integrator key `dpka_513a2bd7_57a2_46d2_927b_2a3857fe271b` in the Quote/Order playgrounds under the **Docs** tab.
</Note>

Follow these steps to get a Flash-enabled Definitive integrator API key.

<Steps>
  <Step title="Create a Definitive account using an Email">
    Even if you already have a Definitive account, create a new account at [app.definitive.fi](https://app.definitive.fi) using an email address (or using a Google or Apple account associated with an email). This ensures you have an account designated for your API usage and that we can contact you via email if there are any issues.

    <Frame caption="Sign-in page at app.definitive.fi.">
      <img src="https://mintcdn.com/definitivefinanace/mztWzsKUaFN1XFBz/images/onboarding-step1.png?fit=max&auto=format&n=mztWzsKUaFN1XFBz&q=85&s=7ed558dc2e23f56ed72f70419b21d4f6" alt="Definitive sign-in page." style={{ width:"54%" }} width="754" height="1036" data-path="images/onboarding-step1.png" />
    </Frame>
  </Step>

  <Step title="Log in and go to your Integrator Dashboard">
    Access the Flash Integrator Dashboard by logging into your Definitive account [<u>on desktop/web</u>](https://app.definitive.fi). In the top navigation bar, click on "More", then select "Flash".

    <Frame>
      <img src="https://mintcdn.com/definitivefinanace/ZUTE7UPYEmVUXEZB/images/Screenshot-2026-07-16-at-3.19.11-PM.png?fit=max&auto=format&n=ZUTE7UPYEmVUXEZB&q=85&s=ca34e2ed5432334a3a3781a6b7fadb06" alt="Screenshot 2026 07 16 At 3 19 11 PM" width="2992" height="1250" data-path="images/Screenshot-2026-07-16-at-3.19.11-PM.png" />
    </Frame>
  </Step>

  <Step title="Generate and Copy your Flash API Key">
    In the middle of your Flash Dashboard, click on "Create Flash Key".  Use your Flash Dashboard to manage your API keys and monitor your Flash trading activity.

    <Frame>
      <img src="https://mintcdn.com/definitivefinanace/ZUTE7UPYEmVUXEZB/images/Screenshot-2026-07-16-at-3.19.22-PM.png?fit=max&auto=format&n=ZUTE7UPYEmVUXEZB&q=85&s=a0043ce51c1776e1cfbe8b8d4d2e55f2" alt="Screenshot 2026 07 16 At 3 19 22 PM" width="1030" height="398" data-path="images/Screenshot-2026-07-16-at-3.19.22-PM.png" />
    </Frame>
  </Step>

  <Step title="View & Manage User Trade Orders">
    Integrators are able to view and manage  users's trade orders from the UI as well.  Click the "Definitive" logo in the top left of the top nav to navigate back to the trading terminal view:Und

    <img src="https://mintcdn.com/definitivefinanace/L9khiKXxF-SKa7yG/Terminal-home-nav.png?fit=max&auto=format&n=L9khiKXxF-SKa7yG&q=85&s=17575d3b78fd9711c34c1a70a87f7813" alt="Terminal Home Nav" title="Terminal Home Nav" style={{ width:"77%" }} width="1238" height="114" data-path="Terminal-home-nav.png" />

    Then, under the trading chart, click "Orders" to see all user orders:

    <img src="https://mintcdn.com/definitivefinanace/L9khiKXxF-SKa7yG/images/Screenshot-2026-08-26-at-1.10.05-PM.png?fit=max&auto=format&n=L9khiKXxF-SKa7yG&q=85&s=6c8ae221c25c6a836d1ef2cf522d4f99" alt="Screenshot 2026 08 26 At 1 10 05 PM" title="Screenshot 2026 08 26 At 1 10 05 PM" style={{ width:"75%" }} width="1420" height="468" data-path="images/Screenshot-2026-08-26-at-1.10.05-PM.png" />

    Open Orders can be canceled by click on the 3 dots icon to the left of any open order: Note that only users with Admin permissions in your integrator account are able to cancel orders. The email used to open your Definitive Integrator account is the Admin user.

    <img src="https://mintcdn.com/definitivefinanace/L9khiKXxF-SKa7yG/images/Screenshot-2026-08-26-at-1.18.45-PM.png?fit=max&auto=format&n=L9khiKXxF-SKa7yG&q=85&s=01ca6ba9d6ea3e6fa8c1be5123525f21" alt="Screenshot 2026 08 26 At 1 18 45 PM" title="Screenshot 2026 08 26 At 1 18 45 PM" style={{ width:"60%" }} width="841" height="334" data-path="images/Screenshot-2026-08-26-at-1.18.45-PM.png" />
  </Step>
</Steps>

## Make your first request

<Note>
  Use the newly generated API key in place of the default Definitive one when quoting and submitting the order.
</Note>

<CardGroup cols={2}>
  <Card title="Quote" icon="arrow-right-arrow-left" href="/docs/api-reference/flash/quote">
    Request real-time pricing and typed-data payload for a swap.
  </Card>

  <Card title="Order" icon="paper-plane" href="/docs/api-reference/flash/order">
    Submit a signed quote for MEV-protected execution.
  </Card>
</CardGroup>

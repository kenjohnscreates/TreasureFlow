> ## Documentation Index
> Fetch the complete documentation index at: https://www.dynamic.xyz/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# SDK and API Keys

> This page hosts the keys that you'll need to setup the SDK, validate the JWT, and generate tokens for API usage.

To access this page, navigate to the
[developer](https://app.dynamic.xyz/dashboard/developer/api) page in your
dashboard.

#### Environment ID

The environment ID is the key used for our platform to identify your SDK and
associate the users to your project environment. Each project has 2 keys, one
for Sandbox and one for Live. Whenever you want to setup a new instance of the
SDK, you simply need to copy the Environment ID and copy it into the settings
prop in the SDK.

```ts TypeScript theme={"system"}
import {
  DynamicContextProvider,
  DynamicWidget,
} from "@dynamic-labs/sdk-react-core";

const App = () => (
  <DynamicContextProvider
    settings={{
      environmentId: "Enter your Environment ID here",
    }}
  >
    <DynamicWidget />
  </DynamicContextProvider>
);

export default App;
```

#### Public Key

The public key is what you can use to validate the JWT is authentic on your
backend. We recommend that you follow
[Verifying the JWT](/docs/overview/authentication/tokens#verifying-the-jwt) to properly validate your
users and ensure that users are using authenticated JWT's.

#### API token permissions

API tokens in Dynamic are scoped to specific resources and actions, ensuring that each token only has the minimum permissions necessary for its intended use case. This follows the principle of least privilege, enhancing security by limiting access to only what's required.

For a complete reference of all available permission scopes and their associated endpoints, see the [API Token Permissions](/docs/overview/developer-dashboard/api-token-permissions) page.

#### Using the API token

Use the token generated through dashboard to programmatically access Dynamic's
API by adding it to the `Authentication` header of your HTTP request.

Example:

```bash curl theme={"system"}
curl \
--location 'https://app.dynamic.xyz/api/v0/environments/<<sandboxEnvironmentId>>' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer ADD_YOUR_DYN_TOKEN_HERE'
```

## Standard errors

* `400` - Bad Request. The form of the request is invalid. Please check that
  the path parameters, query parameters, or the request's body contains the
  correct and expected information defined in our docs.
* `401`- Unauthorized. The endpoint that is being accessed requires an
  `Authorization` header.
* `403` - Forbidden. The token authorized for the HTTP call does not have
  access to the resource defined by the endpoint (eg. the specific environment,
  allowlist, user, etc.)
* `404` - Not found. The path of the requested resource could not be found.
  Please check that the URL path is correct or that the ID provided is correct.

import { createDynamicClient } from "@dynamic-labs-sdk/client";
import { addEvmExtension } from "@dynamic-labs-sdk/evm";

export const environmentId = import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID ?? "";
export const dynamicEnabled = environmentId.length > 0;

export const dynamicClient = dynamicEnabled
  ? createDynamicClient({
      environmentId,
      metadata: {
        name: "TreasureFlow",
        universalLink: window.location.origin,
      },
    })
  : null;

if (dynamicClient) addEvmExtension(dynamicClient);

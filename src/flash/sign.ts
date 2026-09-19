import { type Hex, hashTypedData } from "viem";
import { signTypedData } from "../bankr/signTyped.ts";
import type { KernelDomain } from "./kernel.ts";
import { kernelHashTypedData, wrapKernel7702Signature } from "./kernel.ts";
import { assertTypedDataJson, typedDataForWallet } from "./parse.ts";

export async function signFlashPayload(args: {
  apiKey: string;
  typedDataJson: string;
  kernel?: KernelDomain | undefined;
}): Promise<{ signature: Hex; echo: string }> {
  const walletTd = typedDataForWallet(assertTypedDataJson(args.typedDataJson));
  const echo = args.typedDataJson;
  if (!args.kernel) {
    return {
      echo,
      signature: await signTypedData({
        apiKey: args.apiKey,
        typedDataJson: args.typedDataJson,
      }),
    };
  }
  const hash = hashTypedData(walletTd as never);
  const inner = await signTypedData({
    apiKey: args.apiKey,
    typedDataJson: JSON.stringify(kernelHashTypedData({ hash, domain: args.kernel })),
  });
  return { echo, signature: wrapKernel7702Signature(inner) };
}

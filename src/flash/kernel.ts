import { type Address, type Hex, concat, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { publicRpc } from "../aerodrome/quote.ts";

const EIP712_DOMAIN_ABI = [
  {
    type: "function",
    name: "eip712Domain",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "fields", type: "bytes1" },
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
      { name: "salt", type: "bytes32" },
      { name: "extensions", type: "uint256[]" },
    ],
  },
] as const;

export type KernelDomain = {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
};

export function isEip7702Code(code: Hex | undefined): boolean {
  return Boolean(code && code.startsWith("0xef0100") && (code.length - 2) / 2 === 23);
}

export function wrapKernel7702Signature(signature: Hex): Hex {
  return concat(["0x00", signature]);
}

export function kernelHashTypedData(args: {
  hash: Hex;
  domain: KernelDomain;
}): Record<string, unknown> {
  return {
    domain: {
      name: args.domain.name,
      version: args.domain.version,
      chainId: args.domain.chainId,
      verifyingContract: args.domain.verifyingContract,
    },
    types: { Kernel: [{ name: "hash", type: "bytes32" }] },
    primaryType: "Kernel",
    message: { hash: args.hash },
  };
}

export async function readAccountCode(
  address: Address,
  rpcUrl = "",
): Promise<Hex | undefined> {
  const client = createPublicClient({
    chain: base,
    transport: http(publicRpc(rpcUrl)),
  });
  return client.getCode({ address });
}

export async function readKernelDomain(
  address: Address,
  rpcUrl = "",
): Promise<KernelDomain> {
  const client = createPublicClient({
    chain: base,
    transport: http(publicRpc(rpcUrl)),
  });
  const domain = await client.readContract({
    address,
    abi: EIP712_DOMAIN_ABI,
    functionName: "eip712Domain",
  });
  return {
    name: domain[1],
    version: domain[2],
    chainId: Number(domain[3]),
    verifyingContract: domain[4],
  };
}

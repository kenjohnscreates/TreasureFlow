import { type Address, isHex } from "viem";
import { BASE } from "../config/constants.ts";
import { AppError } from "../errors.ts";
import { bankrPost } from "./http.ts";
import { isRecord } from "./parse.ts";

export async function transferUsdc(args: {
  apiKey: string;
  recipient: Address;
  amountHuman: string;
}): Promise<`0x${string}`> {
  const body = await bankrPost("/wallet/transfer", args.apiKey, {
    tokenAddress: BASE.usdc,
    recipientAddress: args.recipient,
    amount: args.amountHuman,
    isNativeToken: false,
    chain: "base",
  });
  if (!isRecord(body) || body.success !== true || typeof body.txHash !== "string") {
    throw new AppError("bankr_transfer", "Bankr transfer did not return a tx hash");
  }
  if (!isHex(body.txHash) || body.txHash.length !== 66) {
    throw new AppError("bankr_transfer", "Bankr transfer hash is invalid");
  }
  return body.txHash;
}

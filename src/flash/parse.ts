import { isHex } from "viem";
import { AppError } from "../errors.ts";
import { isRecord } from "../bankr/parse.ts";

export type FlashApproveTx = {
  to: string;
  data: `0x${string}`;
};

export type ParsedFlashQuote = {
  quoteId: string;
  orderTypedData: string;
  approveTx?: FlashApproveTx;
  permitTypedData?: string;
};

export function parseFlashQuote(body: unknown): ParsedFlashQuote {
  if (!isRecord(body) || typeof body.quoteId !== "string" || !body.quoteId) {
    throw new AppError("flash_quote", "Flash quote did not return quoteId");
  }
  const evm = isRecord(body.evm) ? body.evm : undefined;
  if (!evm || typeof evm.orderTypedData !== "string" || !evm.orderTypedData) {
    throw new AppError("flash_quote", "Flash quote is missing orderTypedData");
  }
  const parsed: ParsedFlashQuote = {
    quoteId: body.quoteId,
    orderTypedData: evm.orderTypedData,
  };
  if (isRecord(evm.approveTx)) {
    const to = evm.approveTx.to;
    const data = evm.approveTx.data;
    if (typeof to !== "string" || typeof data !== "string") {
      throw new AppError("flash_quote", "Flash approveTx is missing to/data");
    }
    if (!isHex(data) || data.startsWith("0x0x")) {
      throw new AppError("flash_quote", "Flash approveTx data is invalid");
    }
    parsed.approveTx = { to, data: data as `0x${string}` };
  }
  if (typeof evm.permitTypedData === "string" && evm.permitTypedData) {
    parsed.permitTypedData = evm.permitTypedData;
  }
  return parsed;
}

export function parseFlashOrderId(body: unknown): string {
  if (!isRecord(body) || typeof body.orderId !== "string" || !body.orderId) {
    throw new AppError("flash_order", "Flash order did not return orderId");
  }
  return body.orderId;
}

export function parseFlashOrderStatus(body: unknown): string {
  if (!isRecord(body))
    throw new AppError("flash_order", "Flash get order was not an object");
  if (typeof body.status === "string" && body.status) return body.status;
  if (isRecord(body.order) && typeof body.order.status === "string")
    return body.order.status;
  return "unknown";
}

export function assertTypedDataJson(raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new AppError("flash_quote", "Flash typed data is not JSON");
  }
  if (!isRecord(parsed) || !isRecord(parsed.domain) || !isRecord(parsed.types)) {
    throw new AppError("flash_quote", "Flash typed data is missing domain/types");
  }
  if (typeof parsed.primaryType !== "string" || !isRecord(parsed.message)) {
    throw new AppError("flash_quote", "Flash typed data is missing primaryType/message");
  }
  return parsed;
}

export function typedDataForWallet(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const types = isRecord(raw.types) ? { ...raw.types } : {};
  delete types.EIP712Domain;
  const domain = isRecord(raw.domain) ? { ...raw.domain } : {};
  if (typeof domain.chainId === "string" && /^\d+$/.test(domain.chainId)) {
    domain.chainId = Number(domain.chainId);
  }
  return { ...raw, types, domain };
}

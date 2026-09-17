import { bankrGet } from "./http.ts";

export async function getWalletMe(apiKey: string): Promise<unknown> {
  return bankrGet("/wallet/me", apiKey);
}

export async function getWalletPortfolio(apiKey: string): Promise<unknown> {
  return bankrGet("/wallet/portfolio?chains=base&showLowValueTokens=true", apiKey);
}

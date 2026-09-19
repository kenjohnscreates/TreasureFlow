import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { type Address, getAddress, isAddress, isHex, recoverMessageAddress } from "viem";
import { challengeFilePath } from "../config/runtimeFiles.ts";

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type Challenge = {
  nonce: string;
  message: string;
  atMs: number;
};

function challengeMessage(nonce: string): string {
  return `TreasureFlow pay ${nonce}`;
}

export async function issueChallenge(
  filePath = challengeFilePath(),
  nowMs = Date.now(),
): Promise<{ nonce: string; message: string }> {
  const nonce = randomBytes(16).toString("hex");
  const message = challengeMessage(nonce);
  const body: Challenge = { nonce, message, atMs: nowMs };
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(body)}\n`);
  return { nonce, message };
}

async function readChallenge(filePath = challengeFilePath()): Promise<Challenge | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<Challenge>;
    if (
      typeof parsed.nonce !== "string" ||
      typeof parsed.message !== "string" ||
      typeof parsed.atMs !== "number"
    ) {
      return null;
    }
    return { nonce: parsed.nonce, message: parsed.message, atMs: parsed.atMs };
  } catch {
    return null;
  }
}

export function founderOk(address: string | undefined, founder: Address | null): boolean {
  if (!address || !founder || !isAddress(address)) return false;
  return getAddress(address) === getAddress(founder);
}

export type FounderGate =
  | { ok: true }
  | { ok: false; status: 401; error: "unauthorized"; message: string };

export async function assertFounderSubmit(args: {
  founderAddress: Address | null;
  nonceHeader: string | undefined;
  sigHeader: string | undefined;
  filePath?: string;
  nowMs?: number;
}): Promise<FounderGate> {
  const unauthorized = (message: string): FounderGate => ({
    ok: false,
    status: 401,
    error: "unauthorized",
    message,
  });
  if (!args.founderAddress) return unauthorized("founder signature required");
  const stored = await readChallenge(args.filePath);
  const nowMs = args.nowMs ?? Date.now();
  if (!stored || nowMs - stored.atMs > CHALLENGE_TTL_MS) {
    return unauthorized("founder signature required");
  }
  if (!args.nonceHeader || args.nonceHeader !== stored.nonce) {
    return unauthorized("founder signature required");
  }
  if (!args.sigHeader || !isHex(args.sigHeader)) {
    return unauthorized("founder signature required");
  }
  try {
    const recovered = await recoverMessageAddress({
      message: stored.message,
      signature: args.sigHeader,
    });
    if (getAddress(recovered) !== getAddress(args.founderAddress)) {
      return unauthorized("founder signature required");
    }
  } catch {
    return unauthorized("founder signature required");
  }
  try {
    await unlink(args.filePath ?? challengeFilePath());
  } catch {
    /* replay window already closed by address check */
  }
  return { ok: true };
}

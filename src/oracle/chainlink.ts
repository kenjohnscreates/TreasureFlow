import { type Address, createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { publicRpc } from "../aerodrome/quote.ts";
import { AppError } from "../errors.ts";
import { btcSpotFromAnswer } from "../flash/ladder.ts";

export const CHAINLINK_ABI = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

/** Base cbBTC/USD heartbeat is 1200s. Fail closed at 2x. */
export const ORACLE_MAX_AGE_S = 2400;
const SPOT_MIN = 1_000;
const SPOT_MAX = 1_000_000;

export async function readSpotUsd(feed: Address, rpcUrl = ""): Promise<number> {
  const client = createPublicClient({
    chain: base,
    transport: http(publicRpc(rpcUrl)),
  });
  const [round, decimals] = await Promise.all([
    client.readContract({
      address: feed,
      abi: CHAINLINK_ABI,
      functionName: "latestRoundData",
    }),
    client.readContract({ address: feed, abi: CHAINLINK_ABI, functionName: "decimals" }),
  ]);
  const answer = round[1];
  const updatedAt = round[3];
  if (answer <= 0n)
    throw new AppError("oracle_stale", "Chainlink answer is not positive");
  const ageS = Date.now() / 1000 - Number(updatedAt);
  if (ageS > ORACLE_MAX_AGE_S)
    throw new AppError("oracle_stale", "Chainlink answer is stale");
  const spot = btcSpotFromAnswer(answer, decimals);
  if (spot < SPOT_MIN || spot > SPOT_MAX) {
    throw new AppError("oracle_range", "Chainlink spot is outside the expected range");
  }
  return spot;
}

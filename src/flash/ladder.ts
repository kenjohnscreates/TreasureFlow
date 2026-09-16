export type LadderRung = {
  pctBelowSpot: number;
  limitPriceUsd: number;
  sizeUsdc: bigint;
};

export function btcSpotFromAnswer(answer: bigint, decimals: number): number {
  return Number(answer) / 10 ** decimals;
}

export function buildLimitLadder(args: {
  spotUsd: number;
  reserveUsdc: bigint;
  pcts?: number[];
}): LadderRung[] {
  const pcts = args.pcts ?? [2, 4, 6];
  const n = BigInt(pcts.length);
  if (n === 0n || args.reserveUsdc === 0n || args.spotUsd <= 0) return [];
  const slice = args.reserveUsdc / n;
  return pcts.map((pct) => ({
    pctBelowSpot: pct,
    limitPriceUsd: args.spotUsd * (1 - pct / 100),
    sizeUsdc: slice,
  }));
}

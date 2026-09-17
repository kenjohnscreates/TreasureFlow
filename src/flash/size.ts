import { surplusAboveBuffer } from "../policy/math.ts";

export type LimitsPlan = {
  action: "place" | "noop";
  reason: string;
  surplusUsdc: bigint;
  reserveUsdc: bigint;
};

function minUsdc(...values: bigint[]): bigint {
  return values.reduce((left, right) => (left < right ? left : right));
}

export function sizeLiveLimits(args: {
  usdcFree: bigint;
  bufferUsdc: bigint;
  hardStopUsdc: bigint;
  perCallCapUsdc: bigint;
  dailyLeftUsdc: bigint;
}): LimitsPlan {
  const surplus = surplusAboveBuffer(args.usdcFree, args.bufferUsdc);
  const reserve = minUsdc(
    surplus,
    args.hardStopUsdc,
    args.perCallCapUsdc,
    args.dailyLeftUsdc,
  );
  if (reserve <= 0n) {
    return {
      action: "noop",
      reason: "no surplus above buffer after caps",
      surplusUsdc: surplus,
      reserveUsdc: 0n,
    };
  }
  if (reserve / 3n === 0n) {
    return {
      action: "noop",
      reason: "reserve too small to split into three rungs",
      surplusUsdc: surplus,
      reserveUsdc: 0n,
    };
  }
  return {
    action: "place",
    reason: "place cbBTC limit ladder from surplus",
    surplusUsdc: surplus,
    reserveUsdc: reserve,
  };
}

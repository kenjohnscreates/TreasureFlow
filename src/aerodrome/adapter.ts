import { AppError } from "../errors.ts";
import type { SweepPlan } from "../sweep/plan.ts";

export async function addLiquidity(_plan: SweepPlan): Promise<`0x${string}`> {
  throw new AppError(
    "aerodrome_unwired",
    "addLiquidity needs Dynamic wallet + BASE_RPC_URL",
  );
}

export async function removeLiquidity(_usdcOut: bigint): Promise<`0x${string}`> {
  throw new AppError(
    "aerodrome_unwired",
    "removeLiquidity needs Dynamic wallet + BASE_RPC_URL",
  );
}

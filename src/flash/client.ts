import { AppError } from "../errors.ts";
import type { LadderRung } from "./ladder.ts";

export async function placeLimitLadder(_rungs: LadderRung[]): Promise<string[]> {
  throw new AppError(
    "flash_unwired",
    "Flash orders need FLASH_API_KEY and a live wallet",
  );
}

export async function cancelOpenOrders(_ids: string[]): Promise<void> {
  throw new AppError(
    "flash_unwired",
    "Flash cancel needs FLASH_API_KEY and a live wallet",
  );
}

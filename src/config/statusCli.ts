import { loadConfig } from "./load.ts";
import { missingLater, missingNow } from "./status.ts";
import { log } from "../log.ts";

const config = loadConfig();
log("env_status", {
  needNow: missingNow(config).join(",") || "complete",
  later: missingLater(config).join(",") || "complete",
  dryRun: config.dryRun,
  paused: config.paused,
});

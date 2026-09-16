import { loadConfig } from "../config/load.ts";
import { log } from "../log.ts";
import { AppError } from "../errors.ts";
import { shouldRunNightly } from "./cron.ts";
import { runSweepCli } from "./cli.ts";

export async function runCron(): Promise<void> {
  const config = loadConfig();
  const now = new Date();
  const due = shouldRunNightly(now, config.cronTz);
  log("cron_tick", { due, tz: config.cronTz, iso: now.toISOString() });
  if (!due) return;
  if (config.paused) throw new AppError("paused", "Kill switch is on. Cron skipped.");
  await runSweepCli();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCron().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

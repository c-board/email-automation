import { formatConfigError, loadSchedulerEnv } from "./config/env.js";
import { runInboxPass } from "./jobs/run-inbox-pass.js";
import { LogEvent } from "./logging/events.js";
import { createLogger } from "./logging/logger.js";
import { errorText } from "./logging/sanitize.js";
import { startSchedules } from "./scheduler/start-schedules.js";

async function main(): Promise<void> {
  const env = loadSchedulerEnv();
  const logger = await createLogger(env);
  logger.info(
    {
      event: LogEvent.appStarted,
      dryRun: env.dryRun,
      timezone: env.timezone,
      inboxProcessingCron: env.inboxProcessingCron,
    },
    "Application started",
  );

  startSchedules(env, logger, {
    runInbox: async function () {
      await runInboxPass(env, logger);
    },
  });
}

main().catch(function (error: unknown) {
  console.error(formatConfigError(error) || errorText(error));
  process.exitCode = 1;
});

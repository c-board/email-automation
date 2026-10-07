import { formatConfigError, loadSchedulerEnv } from "./config/env.js";
import { runInboxJob } from "./jobs/run-inbox.js";
import { runSummaryJob } from "./jobs/run-summary.js";
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
      summaryCron: env.summaryCron,
    },
    "Application started",
  );

  startSchedules(env, logger, {
    runInbox: async function () {
      await runInboxJob(env, logger);
    },
    runSummary: async function () {
      await runSummaryJob(env, logger);
    },
  });
}

main().catch(function (error: unknown) {
  console.error(formatConfigError(error) || errorText(error));
  process.exitCode = 1;
});

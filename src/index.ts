import { formatConfigError, loadEnv } from "./config/env.js";
import { LogEvent } from "./logging/events.js";
import { createLogger } from "./logging/logger.js";
import { errorText } from "./logging/sanitize.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = await createLogger(env);
  logger.info(
    {
      event: LogEvent.appStarted,
      dryRun: env.dryRun,
      timezone: env.timezone,
    },
    "Application started",
  );
}

main().catch(function (error: unknown) {
  console.error(formatConfigError(error) || errorText(error));
  process.exitCode = 1;
});

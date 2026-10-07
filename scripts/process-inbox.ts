import { formatConfigError, loadEnv } from "../src/config/env.js";
import { runInboxJob } from "../src/jobs/run-inbox.js";
import { createLogger } from "../src/logging/logger.js";
import { errorText } from "../src/logging/sanitize.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = await createLogger(env);
  const result = await runInboxJob(env, logger);

  if (result.discovered > result.skipped && result.classified === 0 && result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(function (error: unknown) {
  console.error(formatConfigError(error));
  if (!(error instanceof Error)) {
    console.error(errorText(error));
  }
  process.exitCode = 1;
});

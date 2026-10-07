import { formatConfigError, loadSummaryEnv } from "../src/config/env.js";
import { runSummaryJob } from "../src/jobs/run-summary.js";
import { createLogger } from "../src/logging/logger.js";
import { errorText } from "../src/logging/sanitize.js";

async function main(): Promise<void> {
  const env = loadSummaryEnv();
  const logger = await createLogger(env);
  const result = await runSummaryJob(env, logger);

  if (result.status === "failed") {
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

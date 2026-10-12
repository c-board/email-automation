import { formatConfigError, loadSchedulerEnv } from "../src/config/env.js";
import { runInboxPass } from "../src/jobs/run-inbox-pass.js";
import { createLogger } from "../src/logging/logger.js";
import { errorText } from "../src/logging/sanitize.js";

async function main(): Promise<void> {
  const env = loadSchedulerEnv();
  const logger = await createLogger(env);
  const { inboxResult, summaryResult } = await runInboxPass(env, logger);

  const inboxFailed =
    inboxResult === null ||
    (inboxResult.discovered > inboxResult.skipped &&
      inboxResult.classified === 0 &&
      inboxResult.failed > 0);
  if (inboxFailed || summaryResult.status === "failed") {
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

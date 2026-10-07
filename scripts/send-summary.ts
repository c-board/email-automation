import { formatConfigError, loadSummaryEnv } from "../src/config/env.js";
import { createDatabase } from "../src/database/database.js";
import { createSqliteWorkflowStore } from "../src/database/workflow-store.js";
import { createLogger } from "../src/logging/logger.js";
import { errorText } from "../src/logging/sanitize.js";
import { createFastmailMailer } from "../src/summary/fastmail.js";
import { sendDailySummary } from "../src/summary/send-daily-summary.js";

async function main(): Promise<void> {
  const env = loadSummaryEnv();
  const logger = await createLogger(env);
  const database = createDatabase(env.databaseUrl);
  const store = createSqliteWorkflowStore(database);
  const mailer = env.dryRun
    ? null
    : createFastmailMailer({
        host: env.fastmailSmtpHost,
        port: env.fastmailSmtpPort,
        username: env.fastmailUsername,
        password: env.fastmailPassword,
      });

  const result = await sendDailySummary({
    store,
    mailer,
    dryRun: env.dryRun,
    recipient: env.summaryRecipient,
    fromAddress: env.fastmailUsername,
    timeZone: env.timezone,
    now: new Date(),
    logger,
    print: function (text: string) {
      console.log(text);
    },
  });

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

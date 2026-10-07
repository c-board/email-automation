import { formatConfigError, loadSummaryEnv } from "../src/config/env.js";
import { createDatabase } from "../src/database/database.js";
import { createSqliteWorkflowStore } from "../src/database/workflow-store.js";
import { createOAuthClient } from "../src/gmail/gmail.auth.js";
import { createGmailReadClient } from "../src/gmail/gmail.client.js";
import { parseGmailMessage } from "../src/gmail/gmail.reader.js";
import { createLogger } from "../src/logging/logger.js";
import { errorText } from "../src/logging/sanitize.js";
import { createFastmailMailer } from "../src/summary/fastmail.js";
import { sendDailySummary, type ConfirmationSource } from "../src/summary/send-daily-summary.js";

async function main(): Promise<void> {
  const env = loadSummaryEnv();
  const logger = await createLogger(env);
  const database = createDatabase(env.databaseUrl);
  const store = createSqliteWorkflowStore(database);
  const gmail = createGmailReadClient(
    createOAuthClient({
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
      refreshToken: env.googleRefreshToken,
    }),
  );
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
    protectedCompanies: env.protectedCompanies,
    readConfirmation: async function (gmailMessageId: string): Promise<ConfirmationSource> {
      const message = await gmail.getMessage(gmailMessageId);
      const parsed = parseGmailMessage(message, env.maxEmailBodyChars);
      return {
        from: parsed.from,
        subject: parsed.subject,
        body: parsed.body,
      };
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

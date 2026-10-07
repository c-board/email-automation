import type { SummaryEnv } from "../config/env.js";
import { createDatabase } from "../database/database.js";
import { createSqliteWorkflowStore } from "../database/workflow-store.js";
import { createOAuthClient } from "../gmail/gmail.auth.js";
import { createGmailMutationClient, createGmailReadClient } from "../gmail/gmail.client.js";
import { parseGmailMessage } from "../gmail/gmail.reader.js";
import type { Logger } from "../logging/logger.js";
import { createFastmailMailer } from "../summary/fastmail.js";
import {
  sendDailySummary,
  type ConfirmationSource,
  type SendDailySummaryResult,
} from "../summary/send-daily-summary.js";

export async function runSummaryJob(env: SummaryEnv, logger: Logger): Promise<SendDailySummaryResult> {
  const database = createDatabase(env.databaseUrl);
  const store = createSqliteWorkflowStore(database);
  const auth = createOAuthClient({
    clientId: env.googleClientId,
    clientSecret: env.googleClientSecret,
    refreshToken: env.googleRefreshToken,
  });
  const gmail = createGmailReadClient(auth);
  const mailer = env.dryRun
    ? null
    : createFastmailMailer({
        host: env.fastmailSmtpHost,
        port: env.fastmailSmtpPort,
        username: env.fastmailUsername,
        password: env.fastmailPassword,
      });

  return sendDailySummary({
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
    gmail: createGmailMutationClient(auth),
  });
}

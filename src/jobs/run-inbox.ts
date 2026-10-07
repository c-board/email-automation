import { classifyEmail } from "../ai/email-classifier.js";
import { createOpenAiClient } from "../ai/openai.client.js";
import type { Env } from "../config/env.js";
import { createDatabase } from "../database/database.js";
import { createSqliteWorkflowStore } from "../database/workflow-store.js";
import { createOAuthClient } from "../gmail/gmail.auth.js";
import { createGmailMutationClient, createGmailReadClient } from "../gmail/gmail.client.js";
import { parseGmailMessage } from "../gmail/gmail.reader.js";
import { listRecentInboxMessageIds } from "../gmail/gmail.search.js";
import { LogEvent } from "../logging/events.js";
import type { Logger } from "../logging/logger.js";
import { processInbox, type InboxProcessingResult } from "../processing/email.processor.js";
import type { EmailMessage } from "../types/email.types.js";

export async function runInboxJob(env: Env, logger: Logger): Promise<InboxProcessingResult> {
  const auth = createOAuthClient({
    clientId: env.googleClientId,
    clientSecret: env.googleClientSecret,
    refreshToken: env.googleRefreshToken,
  });
  const gmail = createGmailReadClient(auth);
  const openai = createOpenAiClient(env.openAiApiKey);
  const database = createDatabase(env.databaseUrl);
  const processedMessages = createSqliteWorkflowStore(database);

  const result = await processInbox({
    listMessageIds: function () {
      return listRecentInboxMessageIds(gmail, env.gmailFetchLimit);
    },
    readMessage: async function (id: string): Promise<EmailMessage> {
      const message = await gmail.getMessage(id);
      return parseGmailMessage(message, env.maxEmailBodyChars);
    },
    classify: function (email) {
      return classifyEmail(openai, env.openAiModel, email, logger);
    },
    processedMessages,
    logger,
    thresholds: {
      autoActionConfidence: env.autoActionConfidence,
      reviewConfidence: env.reviewConfidence,
    },
    protectedCompanies: env.protectedCompanies,
    dryRun: env.dryRun,
    gmail: createGmailMutationClient(auth),
  });

  logger.info(
    {
      event: LogEvent.inboxProcessed,
      discovered: result.discovered,
      skipped: result.skipped,
      classified: result.classified,
      failed: result.failed,
      dryRun: env.dryRun,
    },
    "Inbox processing finished",
  );

  return result;
}

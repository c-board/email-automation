import { createOAuthClient } from "../src/gmail/gmail.auth.js";
import { createGmailReadClient } from "../src/gmail/gmail.client.js";
import { parseGmailMessage } from "../src/gmail/gmail.reader.js";
import { listRecentInboxMessageIds } from "../src/gmail/gmail.search.js";
import { classifyEmail } from "../src/ai/email-classifier.js";
import { createOpenAiClient } from "../src/ai/openai.client.js";
import { formatConfigError, loadEnv } from "../src/config/env.js";
import { createLogger } from "../src/logging/logger.js";
import { LogEvent } from "../src/logging/events.js";
import { errorText } from "../src/logging/sanitize.js";
import { processInbox } from "../src/processing/email.processor.js";
import { createInMemoryProcessedMessageLookup } from "../src/processing/processed-message-lookup.js";
import type { EmailMessage } from "../src/types/email.types.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = await createLogger(env);
  const auth = createOAuthClient({
    clientId: env.googleClientId,
    clientSecret: env.googleClientSecret,
    refreshToken: env.googleRefreshToken,
  });
  const gmail = createGmailReadClient(auth);
  const openai = createOpenAiClient(env.openAiApiKey);
  const processedMessages = createInMemoryProcessedMessageLookup();

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

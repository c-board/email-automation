import { classifyEmail } from "../src/ai/email-classifier.js";
import { createOpenAiClient } from "../src/ai/openai.client.js";
import { formatConfigError, loadEnv } from "../src/config/env.js";
import { createLogger } from "../src/logging/logger.js";
import { errorText } from "../src/logging/sanitize.js";
import { emailFixtures } from "../tests/fixtures/emails.js";
import type { EmailMessage } from "../src/types/email.types.js";

function toEmailMessage(fixture: (typeof emailFixtures)[number]): EmailMessage {
  return {
    gmailMessageId: fixture.id,
    gmailThreadId: null,
    from: fixture.from,
    subject: fixture.subject,
    body: fixture.body,
    receivedAt: fixture.receivedAt,
    bodyTruncated: false,
  };
}

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = await createLogger(env);
  const client = createOpenAiClient(env.openAiApiKey);
  const failures: string[] = [];

  for (const fixture of emailFixtures) {
    const result = await classifyEmail(client, env.openAiModel, toEmailMessage(fixture), logger);
    if (!result.ok) {
      failures.push(`${fixture.id}: ${result.errorMessage}`);
      console.log(`${fixture.id}  expected=${fixture.expectedClassification}  error=${result.errorMessage}`);
      continue;
    }

    const actual = result.classification.classification;
    const matched = actual === fixture.expectedClassification;
    console.log(
      `${fixture.id}  expected=${fixture.expectedClassification}  actual=${actual}  confidence=${result.classification.confidence}`,
    );
    if (!matched) {
      failures.push(`${fixture.id}: expected ${fixture.expectedClassification}, got ${actual}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} fixture(s) did not match.`);
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

import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { Logger } from "../logging/logger.js";
import { LogEvent } from "../logging/events.js";
import { errorText } from "../logging/sanitize.js";
import type { ClassifierEmailInput, EmailMessage } from "../types/email.types.js";
import { CLASSIFIER_SYSTEM_PROMPT } from "./classifier.prompt.js";
import { emailClassificationModelSchema, emailClassificationSchema, type EmailClassification } from "./classifier.schema.js";

const TRUNCATION_NOTE =
  "\n\n[The remainder of this email was omitted. If the missing text could change the meaning, return UNKNOWN.]";

export type ClassifierResult =
  | { ok: true; classification: EmailClassification }
  | { ok: false; errorMessage: string };

export function buildClassifierPayload(email: EmailMessage): ClassifierEmailInput {
  return {
    from: email.from,
    subject: email.subject,
    body: email.bodyTruncated ? `${email.body}${TRUNCATION_NOTE}` : email.body,
    receivedAt: email.receivedAt,
  };
}

export async function classifyEmail(
  client: OpenAI,
  model: string,
  email: EmailMessage,
  logger: Logger,
): Promise<ClassifierResult> {
  const payload = buildClassifierPayload(email);

  try {
    const response = await client.responses.parse({
      model,
      store: false,
      max_output_tokens: 2000,
      input: [
        { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(payload) },
      ],
      text: {
        format: zodTextFormat(emailClassificationModelSchema, "email_classification"),
      },
    });

    if (!response.output_parsed) {
      logger.error(
        { event: LogEvent.llmApiError, gmailMessageId: email.gmailMessageId },
        "LLM response was not parsed",
      );
      return { ok: false, errorMessage: "LLM response was not parsed" };
    }

    const validated = emailClassificationSchema.safeParse(response.output_parsed);
    if (!validated.success) {
      logger.error(
        { event: LogEvent.llmApiError, gmailMessageId: email.gmailMessageId },
        "LLM response failed validation",
      );
      return { ok: false, errorMessage: "LLM response failed validation" };
    }

    return { ok: true, classification: validated.data };
  } catch (error: unknown) {
    const errorMessage = errorText(error);
    logger.error(
      { event: LogEvent.llmApiError, gmailMessageId: email.gmailMessageId, errorMessage },
      "LLM API error",
    );
    return { ok: false, errorMessage };
  }
}

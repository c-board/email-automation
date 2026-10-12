import type { SchedulerEnv } from "../config/env.js";
import { LogEvent } from "../logging/events.js";
import type { Logger } from "../logging/logger.js";
import { errorText } from "../logging/sanitize.js";
import type { InboxProcessingResult } from "../processing/email.processor.js";
import type { SendDailySummaryResult } from "../summary/send-daily-summary.js";
import { runInboxJob } from "./run-inbox.js";
import { runSummaryJob } from "./run-summary.js";

export type InboxPassResult = {
  inboxResult: InboxProcessingResult | null;
  summaryResult: SendDailySummaryResult;
};

export async function runInboxPass(env: SchedulerEnv, logger: Logger): Promise<InboxPassResult> {
  let inboxResult: InboxProcessingResult | null = null;
  try {
    inboxResult = await runInboxJob(env, logger);
  } catch (error: unknown) {
    logger.error(
      {
        event: LogEvent.jobFailed,
        job: "inbox",
        errorMessage: errorText(error),
      },
      "Inbox job failed",
    );
  }

  const summaryResult = await runSummaryJob(env, logger);
  return { inboxResult, summaryResult };
}

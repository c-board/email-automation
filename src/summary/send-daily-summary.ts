import type { SummaryStore, SummaryRunRecord, UnsummarizedApplication } from "../database/workflow-store.js";
import {
  archiveEmail,
  GmailMutationDisabledError,
  ProtectedCompanyActionError,
} from "../gmail/gmail.actions.js";
import type { Logger } from "../logging/logger.js";
import { LogEvent } from "../logging/events.js";
import { errorText } from "../logging/sanitize.js";
import { formatSummary } from "./format-summary.js";
import type { SummaryMailer } from "./fastmail.js";

export type SendDailySummaryResult = {
  status: "empty" | "dry_run" | "sent" | "failed";
  applicationCount: number;
};

export type ConfirmationSource = {
  from: string;
  subject: string;
  body: string;
};

export type SendDailySummaryDeps = {
  store: SummaryStore;
  mailer: SummaryMailer | null;
  dryRun: boolean;
  recipient: string;
  fromAddress: string | null;
  timeZone: string;
  now: Date;
  logger: Logger;
  print: (text: string) => void;
  protectedCompanies: readonly string[];
  readConfirmation: (gmailMessageId: string) => Promise<ConfirmationSource>;
};

function summaryRun(input: {
  startedAt: string;
  completedAt: string;
  recipient: string;
  applicationCount: number;
  success: boolean;
}): SummaryRunRecord {
  return input;
}

async function archiveIncludedConfirmations(
  applications: readonly UnsummarizedApplication[],
  deps: SendDailySummaryDeps,
): Promise<void> {
  for (const application of applications) {
    let source: ConfirmationSource;
    try {
      source = await deps.readConfirmation(application.gmailMessageId);
    } catch (error: unknown) {
      deps.logger.error(
        {
          event: LogEvent.gmailApiError,
          gmailMessageId: application.gmailMessageId,
          errorMessage: errorText(error),
        },
        "Gmail API error",
      );
      continue;
    }

    try {
      await archiveEmail(
        {
          gmailMessageId: application.gmailMessageId,
          from: source.from,
          subject: source.subject,
          body: source.body,
          company: application.company,
        },
        deps.protectedCompanies,
        deps.dryRun,
        deps.logger,
      );
    } catch (error: unknown) {
      if (error instanceof ProtectedCompanyActionError) {
        continue;
      }
      if (error instanceof GmailMutationDisabledError) {
        deps.logger.warn(
          {
            gmailMessageId: application.gmailMessageId,
            errorMessage: error.message,
          },
          error.message,
        );
        continue;
      }
      throw error;
    }
  }
}

export async function sendDailySummary(deps: SendDailySummaryDeps): Promise<SendDailySummaryResult> {
  const startedAt = deps.now.toISOString();
  const applications = await deps.store.listUnsummarizedApplications();
  if (applications.length === 0) {
    return { status: "empty", applicationCount: 0 };
  }

  const email = formatSummary({
    applications,
    headerDate: deps.now,
    timeZone: deps.timeZone,
  });
  deps.print(email.body);
  deps.logger.info(
    {
      event: LogEvent.summaryGenerated,
      recipient: deps.recipient,
      applicationCount: applications.length,
      dryRun: deps.dryRun,
    },
    "Summary generated",
  );

  if (deps.dryRun) {
    await archiveIncludedConfirmations(applications, deps);
    deps.logger.info(
      {
        event: LogEvent.summaryDryRun,
        recipient: deps.recipient,
        applicationCount: applications.length,
      },
      "Summary would be sent",
    );
    return { status: "dry_run", applicationCount: applications.length };
  }

  if (deps.mailer === null || deps.fromAddress === null) {
    throw new Error("FASTMAIL_USERNAME and FASTMAIL_PASSWORD are required when DRY_RUN=false");
  }

  try {
    await deps.mailer.send({
      from: deps.fromAddress,
      to: deps.recipient,
      subject: email.subject,
      text: email.body,
    });
  } catch (error: unknown) {
    const completedAt = new Date().toISOString();
    await deps.store.recordSummaryRun(
      summaryRun({
        startedAt,
        completedAt,
        recipient: deps.recipient,
        applicationCount: applications.length,
        success: false,
      }),
    );
    deps.logger.error(
      {
        event: LogEvent.summaryFailed,
        recipient: deps.recipient,
        applicationCount: applications.length,
        errorMessage: errorText(error),
      },
      "Summary failed",
    );
    return { status: "failed", applicationCount: applications.length };
  }

  const completedAt = new Date().toISOString();
  try {
    await deps.store.completeSuccessfulSummary({
      applicationIds: applications.map(function (application) {
        return application.id;
      }),
      run: summaryRun({
        startedAt,
        completedAt,
        recipient: deps.recipient,
        applicationCount: applications.length,
        success: true,
      }),
    });
  } catch (error: unknown) {
    deps.logger.error(
      {
        event: LogEvent.summaryFailed,
        recipient: deps.recipient,
        applicationCount: applications.length,
        errorMessage: errorText(error),
      },
      "Summary failed",
    );
    return { status: "failed", applicationCount: applications.length };
  }
  await archiveIncludedConfirmations(applications, deps);
  deps.logger.info(
    {
      event: LogEvent.summarySent,
      recipient: deps.recipient,
      applicationCount: applications.length,
    },
    "Summary sent",
  );
  return { status: "sent", applicationCount: applications.length };
}

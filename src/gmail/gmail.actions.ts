import type { GmailMutationClient } from "./gmail.client.js";
import type { Logger } from "../logging/logger.js";
import { LogEvent } from "../logging/events.js";
import { isProtectedCompany } from "../safety/protected-companies.js";

export class ProtectedCompanyActionError extends Error {
  constructor(action: "archive" | "label") {
    super(
      action === "archive"
        ? "Blocked archive attempt for protected company"
        : "Blocked rejection label attempt for protected company",
    );
    this.name = "ProtectedCompanyActionError";
  }
}

export type GmailActionTarget = {
  gmailMessageId: string;
  from: string;
  subject: string;
  body: string;
  company: string | null;
};

function assertNotProtected(
  email: GmailActionTarget,
  protectedCompanies: readonly string[],
  action: "archive" | "label",
  logger?: Logger,
): void {
  if (
    !isProtectedCompany({
      protectedCompanies,
      from: email.from,
      subject: email.subject,
      body: email.body,
      company: email.company,
    })
  ) {
    return;
  }

  logger?.warn(
    {
      event: LogEvent.actionBlockedProtectedCompany,
      gmailMessageId: email.gmailMessageId,
    },
    action === "archive"
      ? "Blocked archive attempt for protected company"
      : "Blocked rejection label attempt for protected company",
  );
  throw new ProtectedCompanyActionError(action);
}

function logGmailAction(
  email: GmailActionTarget,
  logger: Logger | undefined,
  event: (typeof LogEvent)[keyof typeof LogEvent],
  dryRun: boolean,
  message: string,
): void {
  logger?.info(
    {
      event,
      gmailMessageId: email.gmailMessageId,
      subject: email.subject,
      dryRun,
    },
    message,
  );
}

export async function archiveEmail(
  email: GmailActionTarget,
  protectedCompanies: readonly string[],
  dryRun: boolean,
  logger: Logger | undefined,
  gmail: GmailMutationClient,
): Promise<void> {
  assertNotProtected(email, protectedCompanies, "archive", logger);
  if (dryRun) {
    logGmailAction(email, logger, LogEvent.emailArchived, true, "Email would be archived");
    return;
  }
  await gmail.archiveMessage(email.gmailMessageId);
  logGmailAction(email, logger, LogEvent.emailArchived, false, "Email archived");
}

export async function labelAsRejection(
  email: GmailActionTarget,
  protectedCompanies: readonly string[],
  dryRun: boolean,
  logger: Logger | undefined,
  gmail: GmailMutationClient,
): Promise<void> {
  assertNotProtected(email, protectedCompanies, "label", logger);
  if (dryRun) {
    logGmailAction(email, logger, LogEvent.rejectionLabeled, true, "Email would be labeled as a rejection");
    return;
  }
  await gmail.labelMessageAsRejection(email.gmailMessageId);
  logGmailAction(email, logger, LogEvent.rejectionLabeled, false, "Email labeled as a rejection");
}

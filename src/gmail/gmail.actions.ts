import { GMAIL_MUTATIONS_DISABLED_MESSAGE } from "../config/constants.js";
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

export class GmailMutationDisabledError extends Error {
  constructor() {
    super(GMAIL_MUTATIONS_DISABLED_MESSAGE);
    this.name = "GmailMutationDisabledError";
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

function refuseMutation(dryRun: boolean): void {
  void dryRun;
  throw new GmailMutationDisabledError();
}

export async function archiveEmail(
  email: GmailActionTarget,
  protectedCompanies: readonly string[],
  dryRun: boolean,
  logger?: Logger,
): Promise<void> {
  assertNotProtected(email, protectedCompanies, "archive", logger);
  refuseMutation(dryRun);
}

export async function labelAsRejection(
  email: GmailActionTarget,
  protectedCompanies: readonly string[],
  dryRun: boolean,
  logger?: Logger,
): Promise<void> {
  assertNotProtected(email, protectedCompanies, "label", logger);
  refuseMutation(dryRun);
}

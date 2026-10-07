import type { Logger } from "../logging/logger.js";
import { LogEvent } from "../logging/events.js";
import { errorText } from "../logging/sanitize.js";
import { isProtectedCompany } from "../safety/protected-companies.js";
import type { EmailMessage, InboxMessageRef } from "../types/email.types.js";
import type { Classification } from "../types/classification.types.js";
import type { ClassifierResult } from "../ai/email-classifier.js";
import type { ConfidenceThresholds } from "./confidence-gate.js";
import type { ProcessedMessageStore } from "../database/workflow-store.js";
import type { GmailMutationClient } from "../gmail/gmail.client.js";
import {
  archiveEmail,
  labelAsRejection,
  ProtectedCompanyActionError,
  type GmailActionTarget,
} from "../gmail/gmail.actions.js";
import { describeProposedAction, proposeAction, type ProposedAction } from "./proposed-action.js";

export type EmailProcessingOutcome = {
  gmailMessageId: string;
  subject: string;
  classification: Classification | null;
  effectiveClassification: Classification;
  confidence: number | null;
  company: string | null;
  position: string | null;
  reason: string;
  proposedAction: ProposedAction;
};

export type InboxProcessingResult = {
  discovered: number;
  skipped: number;
  classified: number;
  failed: number;
  outcomes: EmailProcessingOutcome[];
};

export type InboxProcessorDeps = {
  listMessageIds: () => Promise<InboxMessageRef[]>;
  readMessage: (id: string) => Promise<EmailMessage>;
  classify: (email: EmailMessage) => Promise<ClassifierResult>;
  processedMessages: ProcessedMessageStore;
  logger: Logger;
  thresholds: ConfidenceThresholds;
  protectedCompanies: readonly string[];
  dryRun: boolean;
  gmail: GmailMutationClient;
};

type ClassifiedEmail = {
  outcome: EmailProcessingOutcome;
  confidenceBlocked: boolean;
  protectedCompanyBlocked: boolean;
};

function classifyOutcome(email: EmailMessage, result: ClassifierResult, deps: InboxProcessorDeps): ClassifiedEmail {
  if (!result.ok) {
    const decision = proposeAction({
      classification: "UNKNOWN",
      confidence: 0,
      thresholds: deps.thresholds,
      protectedCompany: false,
      classificationValid: false,
    });
    return {
      confidenceBlocked: decision.confidenceBlocked,
      protectedCompanyBlocked: decision.protectedCompanyBlocked,
      outcome: {
        gmailMessageId: email.gmailMessageId,
        subject: email.subject,
        classification: null,
        effectiveClassification: decision.effectiveClassification,
        confidence: null,
        company: null,
        position: null,
        reason: result.errorMessage,
        proposedAction: decision.action,
      },
    };
  }

  const classification = result.classification;
  const decision = proposeAction({
    classification: classification.classification,
    confidence: classification.confidence,
    thresholds: deps.thresholds,
    protectedCompany: isProtectedCompany({
      protectedCompanies: deps.protectedCompanies,
      from: email.from,
      subject: email.subject,
      body: email.body,
      company: classification.company,
    }),
    classificationValid: true,
  });

  return {
    confidenceBlocked: decision.confidenceBlocked,
    protectedCompanyBlocked: decision.protectedCompanyBlocked,
    outcome: {
      gmailMessageId: email.gmailMessageId,
      subject: email.subject,
      classification: classification.classification,
      effectiveClassification: decision.effectiveClassification,
      confidence: classification.confidence,
      company: classification.company,
      position: classification.position,
      reason: classification.reason,
      proposedAction: decision.action,
    },
  };
}

function logOutcome(
  logger: Logger,
  email: EmailMessage,
  outcome: EmailProcessingOutcome,
  decisionFlags: { confidenceBlocked: boolean; protectedCompanyBlocked: boolean },
  dryRun: boolean,
): void {
  logger.info(
    {
      event: LogEvent.emailClassified,
      dryRun,
      gmailMessageId: email.gmailMessageId,
      subject: outcome.subject,
      classification: outcome.classification,
      effectiveClassification: outcome.effectiveClassification,
      confidence: outcome.confidence,
      company: outcome.company,
      position: outcome.position,
      reason: outcome.reason,
      proposedAction: describeProposedAction(outcome.proposedAction),
    },
    "Email classified",
  );

  if (decisionFlags.confidenceBlocked) {
    logger.info(
      {
        event: LogEvent.actionBlockedLowConfidence,
        gmailMessageId: email.gmailMessageId,
        confidence: outcome.confidence,
        classification: outcome.classification,
      },
      "Automatic action blocked because confidence was too low",
    );
  }

  if (decisionFlags.protectedCompanyBlocked) {
    logger.warn(
      {
        event: LogEvent.actionBlockedProtectedCompany,
        gmailMessageId: email.gmailMessageId,
        subject: email.subject,
      },
      "Protected-company action blocked",
    );
  }
}

async function applyRejectionAction(email: EmailMessage, company: string | null, deps: InboxProcessorDeps): Promise<void> {
  const target: GmailActionTarget = {
    gmailMessageId: email.gmailMessageId,
    from: email.from,
    subject: email.subject,
    body: email.body,
    company,
  };
  await labelAsRejection(target, deps.protectedCompanies, deps.dryRun, deps.logger, deps.gmail);
  await archiveEmail(target, deps.protectedCompanies, deps.dryRun, deps.logger, deps.gmail);
}

export async function processInbox(deps: InboxProcessorDeps): Promise<InboxProcessingResult> {
  let messageRefs: InboxMessageRef[];
  try {
    messageRefs = await deps.listMessageIds();
  } catch (error: unknown) {
    const errorMessage = errorText(error);
    deps.logger.error({ event: LogEvent.gmailApiError, errorMessage }, "Gmail API error");
    throw new Error(errorMessage);
  }

  const outcomes: EmailProcessingOutcome[] = [];
  let skipped = 0;
  let failed = 0;

  for (const ref of messageRefs) {
    if (await deps.processedMessages.hasBeenProcessed(ref.id)) {
      skipped += 1;
      deps.logger.info(
        { event: LogEvent.emailSkippedAlreadyProcessed, gmailMessageId: ref.id },
        "Email skipped because it was already processed",
      );
      continue;
    }

    let email: EmailMessage;
    try {
      email = await deps.readMessage(ref.id);
    } catch (error: unknown) {
      failed += 1;
      deps.logger.error(
        {
          event: LogEvent.gmailApiError,
          gmailMessageId: ref.id,
          errorMessage: errorText(error),
        },
        "Gmail API error",
      );
      continue;
    }

    deps.logger.info(
      {
        event: LogEvent.emailDiscovered,
        gmailMessageId: email.gmailMessageId,
        subject: email.subject,
        from: email.from,
      },
      "Email discovered",
    );

    const result = await deps.classify(email);
    const classified = classifyOutcome(email, result, deps);
    outcomes.push(classified.outcome);
    logOutcome(deps.logger, email, classified.outcome, classified, deps.dryRun);
    if (!result.ok) {
      failed += 1;
      continue;
    }

    if (classified.outcome.proposedAction.kind === "label_and_archive_rejection") {
      try {
        await applyRejectionAction(email, result.classification.company, deps);
      } catch (error: unknown) {
        if (!(error instanceof ProtectedCompanyActionError)) {
          failed += 1;
          deps.logger.error(
            {
              event: LogEvent.gmailApiError,
              gmailMessageId: email.gmailMessageId,
              errorMessage: errorText(error),
            },
            "Gmail API error",
          );
          continue;
        }
      }
    }

    const saved = await deps.processedMessages.saveProcessed({
      gmailMessageId: email.gmailMessageId,
      gmailThreadId: email.gmailThreadId,
      classification: result.classification.classification,
      confidence: result.classification.confidence,
      application:
        classified.outcome.proposedAction.kind === "include_in_summary"
          ? {
              company: result.classification.company,
              position: result.classification.position,
              applicationDate: result.classification.applicationDate,
            }
          : null,
    });

    if (saved.applicationStored) {
      deps.logger.info(
        {
          event: LogEvent.applicationStored,
          gmailMessageId: email.gmailMessageId,
          company: result.classification.company,
          position: result.classification.position,
          applicationDate: result.classification.applicationDate,
        },
        "Application stored",
      );
    }

    if (saved.duplicateApplication) {
      deps.logger.info(
        {
          event: LogEvent.applicationDuplicateSkipped,
          gmailMessageId: email.gmailMessageId,
          company: result.classification.company,
          position: result.classification.position,
          applicationDate: result.classification.applicationDate,
        },
        "Duplicate application skipped",
      );
    }
  }

  return {
    discovered: messageRefs.length,
    skipped,
    classified: outcomes.filter(function (outcome) {
      return outcome.classification !== null;
    }).length,
    failed,
    outcomes,
  };
}

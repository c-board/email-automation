export const LogEvent = {
  appStarted: "app.started",
  inboxProcessed: "inbox.processed",
  emailDiscovered: "email.discovered",
  emailClassified: "email.classified",
  emailSkippedAlreadyProcessed: "email.skipped_already_processed",
  actionBlockedLowConfidence: "action.blocked_low_confidence",
  actionBlockedProtectedCompany: "action.blocked_protected_company",
  gmailApiError: "gmail.api_error",
  llmApiError: "llm.api_error",
  applicationStored: "application.stored",
  applicationDuplicateSkipped: "application.duplicate_skipped",
} as const;

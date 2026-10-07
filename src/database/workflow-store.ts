import { eq } from "drizzle-orm";
import type { Classification } from "../types/classification.types.js";
import type { AppDatabase } from "./database.js";
import { applications, processedMessages } from "./schema.js";

export type ApplicationDraft = {
  company: string | null;
  position: string | null;
  applicationDate: string | null;
};

export type SaveProcessedInput = {
  gmailMessageId: string;
  gmailThreadId: string | null;
  classification: Classification;
  confidence: number;
  application: ApplicationDraft | null;
};

export type SaveProcessedResult = {
  applicationStored: boolean;
  duplicateApplication: boolean;
};

export type ProcessedMessageStore = {
  hasBeenProcessed: (gmailMessageId: string) => Promise<boolean>;
  saveProcessed: (input: SaveProcessedInput) => Promise<SaveProcessedResult>;
};

export function applicationDedupKey(application: ApplicationDraft): string | null {
  const company = application.company?.trim().toLowerCase() ?? "";
  const position = application.position?.trim().toLowerCase() ?? "";
  const applicationDate = application.applicationDate?.trim() ?? "";
  if (company.length === 0 || position.length === 0 || applicationDate.length === 0) {
    return null;
  }
  return `${company}|${position}|${applicationDate}`;
}

export function createSqliteWorkflowStore(database: AppDatabase): ProcessedMessageStore {
  async function hasBeenProcessed(gmailMessageId: string): Promise<boolean> {
    const existing = database
      .select({ id: processedMessages.id })
      .from(processedMessages)
      .where(eq(processedMessages.gmailMessageId, gmailMessageId))
      .get();
    return existing !== undefined;
  }

  async function saveProcessed(input: SaveProcessedInput): Promise<SaveProcessedResult> {
    const now = new Date().toISOString();
    return database.transaction(function (tx) {
      tx.insert(processedMessages)
        .values({
          gmailMessageId: input.gmailMessageId,
          gmailThreadId: input.gmailThreadId,
          classification: input.classification,
          confidence: input.confidence,
          processedAt: now,
        })
        .run();

      if (!input.application) {
        return { applicationStored: false, duplicateApplication: false };
      }

      const dedupKey = applicationDedupKey(input.application);
      if (dedupKey) {
        const duplicate = tx
          .select({ id: applications.id })
          .from(applications)
          .where(eq(applications.dedupKey, dedupKey))
          .get();
        if (duplicate) {
          return { applicationStored: false, duplicateApplication: true };
        }
      }

      tx.insert(applications)
        .values({
          gmailMessageId: input.gmailMessageId,
          company: input.application.company,
          position: input.application.position,
          applicationDate: input.application.applicationDate,
          summarized: false,
          createdAt: now,
          dedupKey,
        })
        .run();

      return { applicationStored: true, duplicateApplication: false };
    });
  }

  return { hasBeenProcessed, saveProcessed };
}

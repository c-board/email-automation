import { asc, eq, inArray } from "drizzle-orm";
import type { Classification } from "../types/classification.types.js";
import type { AppDatabase } from "./database.js";
import { applications, processedMessages, summaryRuns } from "./schema.js";

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

export type UnsummarizedApplication = {
  id: number;
  gmailMessageId: string;
  company: string | null;
  position: string | null;
  applicationDate: string | null;
};

export type SummaryRunRecord = {
  startedAt: string;
  completedAt: string;
  recipient: string;
  applicationCount: number;
  success: boolean;
};

export type SummaryStore = {
  listUnsummarizedApplications: () => Promise<UnsummarizedApplication[]>;
  completeSuccessfulSummary: (input: { applicationIds: number[]; run: SummaryRunRecord }) => Promise<void>;
  recordSummaryRun: (run: SummaryRunRecord) => Promise<void>;
};

export type WorkflowStore = ProcessedMessageStore & SummaryStore;

export function applicationDedupKey(application: ApplicationDraft): string | null {
  const company = application.company?.trim().toLowerCase() ?? "";
  const position = application.position?.trim().toLowerCase() ?? "";
  const applicationDate = application.applicationDate?.trim() ?? "";
  if (company.length === 0 || position.length === 0 || applicationDate.length === 0) {
    return null;
  }
  return `${company}|${position}|${applicationDate}`;
}

export function createSqliteWorkflowStore(database: AppDatabase): WorkflowStore {
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

  async function listUnsummarizedApplications(): Promise<UnsummarizedApplication[]> {
    return database
      .select({
        id: applications.id,
        gmailMessageId: applications.gmailMessageId,
        company: applications.company,
        position: applications.position,
        applicationDate: applications.applicationDate,
      })
      .from(applications)
      .where(eq(applications.summarized, false))
      .orderBy(asc(applications.createdAt), asc(applications.id))
      .all();
  }

  async function completeSuccessfulSummary(input: {
    applicationIds: number[];
    run: SummaryRunRecord;
  }): Promise<void> {
    database.transaction(function (tx) {
      if (input.applicationIds.length > 0) {
        tx.update(applications)
          .set({ summarized: true })
          .where(inArray(applications.id, input.applicationIds))
          .run();
      }
      tx.insert(summaryRuns)
        .values({
          startedAt: input.run.startedAt,
          completedAt: input.run.completedAt,
          recipient: input.run.recipient,
          applicationCount: input.run.applicationCount,
          success: input.run.success,
        })
        .run();
    });
  }

  async function recordSummaryRun(run: SummaryRunRecord): Promise<void> {
    database
      .insert(summaryRuns)
      .values({
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        recipient: run.recipient,
        applicationCount: run.applicationCount,
        success: run.success,
      })
      .run();
  }

  return {
    hasBeenProcessed,
    saveProcessed,
    listUnsummarizedApplications,
    completeSuccessfulSummary,
    recordSummaryRun,
  };
}

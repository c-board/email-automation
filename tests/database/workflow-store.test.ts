import { eq } from "drizzle-orm";
import pino from "pino";
import { describe, expect, it } from "vitest";
import type { EmailClassification } from "../../src/ai/classifier.schema.js";
import { createDatabase } from "../../src/database/database.js";
import { applications, processedMessages } from "../../src/database/schema.js";
import { createSqliteWorkflowStore } from "../../src/database/workflow-store.js";
import type { GmailMutationClient } from "../../src/gmail/gmail.client.js";
import { processInbox } from "../../src/processing/email.processor.js";
import type { EmailMessage } from "../../src/types/email.types.js";

const gmail: GmailMutationClient = {
  labelMessageAsRejection: async function () {
    throw new Error("dry run must not label");
  },
  archiveMessage: async function () {
    throw new Error("dry run must not archive");
  },
};

const thresholds = {
  autoActionConfidence: 0.95,
  reviewConfidence: 0.8,
};

function confirmation(overrides: Partial<EmailClassification> = {}): EmailClassification {
  return {
    classification: "APPLICATION_CONFIRMATION",
    confidence: 0.99,
    company: "Mux",
    position: "Senior Full Stack Engineer",
    applicationDate: "2026-10-06",
    reason: "The employer confirms receipt.",
    ...overrides,
  };
}

function message(id: string): EmailMessage {
  return {
    gmailMessageId: id,
    gmailThreadId: `thread-${id}`,
    from: "jobs@example.com",
    subject: "Application received",
    body: "We received your application.",
    receivedAt: "2026-10-06T15:00:00.000Z",
    bodyTruncated: false,
  };
}

function openStore() {
  const database = createDatabase(":memory:");
  return { database, store: createSqliteWorkflowStore(database) };
}

describe("sqlite workflow store", function () {
  it("reports a gmail id as processed after it is saved", async function () {
    const { store } = openStore();
    expect(await store.hasBeenProcessed("msg-1")).toBe(false);
    await store.saveProcessed({
      gmailMessageId: "msg-1",
      gmailThreadId: "thread-1",
      classification: "REJECTION",
      confidence: 0.99,
      application: null,
    });
    expect(await store.hasBeenProcessed("msg-1")).toBe(true);
  });

  it("keeps two confirmations when the position is missing", async function () {
    const { database, store } = openStore();
    const first = await store.saveProcessed({
      gmailMessageId: "grainger-1",
      gmailThreadId: null,
      classification: "APPLICATION_CONFIRMATION",
      confidence: 0.99,
      application: { company: "Grainger", position: null, applicationDate: "2026-10-06" },
    });
    const second = await store.saveProcessed({
      gmailMessageId: "grainger-2",
      gmailThreadId: null,
      classification: "APPLICATION_CONFIRMATION",
      confidence: 0.99,
      application: { company: "Grainger", position: null, applicationDate: "2026-10-06" },
    });

    expect(first.applicationStored).toBe(true);
    expect(second.applicationStored).toBe(true);
    expect(database.select().from(applications).all()).toHaveLength(2);
    expect(database.select().from(processedMessages).all()).toHaveLength(2);
  });

  it("stores one application when company, position, and date match", async function () {
    const { database, store } = openStore();
    const first = await store.saveProcessed({
      gmailMessageId: "mux-1",
      gmailThreadId: null,
      classification: "APPLICATION_CONFIRMATION",
      confidence: 0.99,
      application: {
        company: " Mux ",
        position: "Senior Full Stack Engineer",
        applicationDate: "2026-10-06",
      },
    });
    const second = await store.saveProcessed({
      gmailMessageId: "mux-2",
      gmailThreadId: null,
      classification: "APPLICATION_CONFIRMATION",
      confidence: 0.98,
      application: {
        company: "mux",
        position: " senior full stack engineer ",
        applicationDate: "2026-10-06",
      },
    });

    expect(first).toEqual({ applicationStored: true, duplicateApplication: false });
    expect(second).toEqual({ applicationStored: false, duplicateApplication: true });
    const rows = database.select().from(applications).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.summarized).toBe(false);
    expect(rows[0]?.company).toBe(" Mux ");
    expect(database.select().from(processedMessages).all()).toHaveLength(2);
    expect(await store.hasBeenProcessed("mux-2")).toBe(true);
  });

  it("does not store an application when the caller omits one", async function () {
    const { database, store } = openStore();
    const saved = await store.saveProcessed({
      gmailMessageId: "reject-1",
      gmailThreadId: null,
      classification: "REJECTION",
      confidence: 0.99,
      application: null,
    });
    expect(saved.applicationStored).toBe(false);
    expect(database.select().from(applications).all()).toHaveLength(0);
    expect(database.select().from(processedMessages).where(eq(processedMessages.gmailMessageId, "reject-1")).all()).toHaveLength(1);
  });
});

describe("processInbox persistence", function () {
  it("does not save a failed classification", async function () {
    const { store } = openStore();
    await processInbox({
      listMessageIds: async function () {
        return [{ id: "bad", threadId: null }];
      },
      readMessage: async function () {
        return message("bad");
      },
      classify: async function () {
        return { ok: false as const, errorMessage: "LLM response failed validation" };
      },
      processedMessages: store,
      logger: pino({ level: "silent" }),
      thresholds,
      protectedCompanies: ["Grainger"],
      dryRun: true,
      gmail,
    });
    expect(await store.hasBeenProcessed("bad")).toBe(false);
  });

  it("stores a confident confirmation and skips a rejection and a low-confidence confirmation", async function () {
    const { database, store } = openStore();
    await processInbox({
      listMessageIds: async function () {
        return [
          { id: "confirmed", threadId: "t1" },
          { id: "rejected", threadId: "t2" },
          { id: "unsure", threadId: "t3" },
        ];
      },
      readMessage: async function (id: string) {
        return message(id);
      },
      classify: async function (email: EmailMessage) {
        if (email.gmailMessageId === "rejected") {
          return { ok: true as const, classification: confirmation({ classification: "REJECTION", company: "Northwind" }) };
        }
        if (email.gmailMessageId === "unsure") {
          return { ok: true as const, classification: confirmation({ confidence: 0.94, company: "Pax8" }) };
        }
        return { ok: true as const, classification: confirmation({ company: "Grainger", position: null, applicationDate: null }) };
      },
      processedMessages: store,
      logger: pino({ level: "silent" }),
      thresholds,
      protectedCompanies: ["Grainger"],
      dryRun: true,
      gmail,
    });

    const rows = database.select().from(applications).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.gmailMessageId).toBe("confirmed");
    expect(rows[0]?.company).toBe("Grainger");
    expect(rows[0]?.position).toBeNull();
    expect(rows[0]?.summarized).toBe(false);
    expect(database.select().from(processedMessages).all()).toHaveLength(3);
  });
});

import pino from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailMessage } from "../../src/types/email.types.js";
import type { EmailClassification } from "../../src/ai/classifier.schema.js";
import { createInMemoryProcessedMessageLookup } from "../../src/processing/processed-message-lookup.js";
import { processInbox } from "../../src/processing/email.processor.js";
import { archiveEmail, GmailMutationDisabledError, labelAsRejection } from "../../src/gmail/gmail.actions.js";

vi.mock("../../src/gmail/gmail.actions.js", async function () {
  const actual = await vi.importActual<typeof import("../../src/gmail/gmail.actions.js")>(
    "../../src/gmail/gmail.actions.js",
  );
  return {
    ...actual,
    archiveEmail: vi.fn(),
    labelAsRejection: vi.fn(),
  };
});

const thresholds = {
  autoActionConfidence: 0.95,
  reviewConfidence: 0.8,
};

function email(id: string, subject: string): EmailMessage {
  return {
    gmailMessageId: id,
    gmailThreadId: `thread-${id}`,
    from: "jobs@example.com",
    subject,
    body: "We received your application.",
    receivedAt: "2026-10-06T15:00:00.000Z",
    bodyTruncated: false,
  };
}

function classification(overrides: Partial<EmailClassification> = {}): EmailClassification {
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

describe("processInbox", function () {
  beforeEach(function () {
    vi.mocked(archiveEmail).mockReset();
    vi.mocked(labelAsRejection).mockReset();
  });

  it("classifies each message and does not call Gmail actions", async function () {
    const classify = vi.fn(async function (message: EmailMessage) {
      return {
        ok: true as const,
        classification: classification({
          company: message.subject,
        }),
      };
    });

    const result = await processInbox({
      listMessageIds: async function () {
        return [
          { id: "a", threadId: "ta" },
          { id: "b", threadId: "tb" },
        ];
      },
      readMessage: async function (id: string) {
        return email(id, id === "a" ? "Mux" : "Blackboard");
      },
      classify,
      processedMessages: createInMemoryProcessedMessageLookup(),
      logger: pino({ level: "silent" }),
      thresholds,
      protectedCompanies: ["Grainger"],
      dryRun: true,
    });

    expect(classify).toHaveBeenCalledTimes(2);
    expect(result.classified).toBe(2);
    expect(result.outcomes.map(function (outcome) {
      return outcome.subject;
    })).toEqual(["Mux", "Blackboard"]);
    expect(result.outcomes[0]?.proposedAction).toEqual({
      kind: "include_in_summary",
      archive: "deferred_until_summary",
    });
    expect(archiveEmail).not.toHaveBeenCalled();
    expect(labelAsRejection).not.toHaveBeenCalled();
  });

  it("skips a gmail message id that was already processed in this run", async function () {
    const classify = vi.fn(async function () {
      return { ok: true as const, classification: classification() };
    });

    const result = await processInbox({
      listMessageIds: async function () {
        return [
          { id: "same", threadId: "t" },
          { id: "same", threadId: "t" },
        ];
      },
      readMessage: async function () {
        return email("same", "Mux");
      },
      classify,
      processedMessages: createInMemoryProcessedMessageLookup(),
      logger: pino({ level: "silent" }),
      thresholds,
      protectedCompanies: ["Grainger"],
      dryRun: true,
    });

    expect(classify).toHaveBeenCalledTimes(1);
    expect(result.skipped).toBe(1);
    expect(result.classified).toBe(1);
    expect(archiveEmail).not.toHaveBeenCalled();
    expect(labelAsRejection).not.toHaveBeenCalled();
  });

  it("takes no action when the model response is invalid", async function () {
    const processedMessages = createInMemoryProcessedMessageLookup();
    const result = await processInbox({
      listMessageIds: async function () {
        return [{ id: "bad", threadId: null }];
      },
      readMessage: async function () {
        return email("bad", "Unclear");
      },
      classify: async function () {
        return { ok: false as const, errorMessage: "LLM response failed validation" };
      },
      processedMessages,
      logger: pino({ level: "silent" }),
      thresholds,
      protectedCompanies: ["Grainger"],
      dryRun: false,
    });

    expect(result.failed).toBe(1);
    expect(result.classified).toBe(0);
    expect(result.outcomes[0]).toMatchObject({
      classification: null,
      effectiveClassification: "UNKNOWN",
      proposedAction: { kind: "none", reason: "Invalid model response" },
    });
    expect(archiveEmail).not.toHaveBeenCalled();
    expect(labelAsRejection).not.toHaveBeenCalled();
    expect(await processedMessages.hasBeenProcessed("bad")).toBe(false);
  });

  it("labels then archives an unprotected rejection", async function () {
    const processedMessages = createInMemoryProcessedMessageLookup();
    await processInbox({
      listMessageIds: async function () {
        return [{ id: "reject", threadId: "t" }];
      },
      readMessage: async function () {
        return email("reject", "Thanks for applying");
      },
      classify: async function () {
        return {
          ok: true as const,
          classification: classification({ classification: "REJECTION", company: "Northwind" }),
        };
      },
      processedMessages,
      logger: pino({ level: "silent" }),
      thresholds,
      protectedCompanies: ["Grainger"],
      dryRun: true,
    });

    expect(labelAsRejection).toHaveBeenCalledTimes(1);
    expect(archiveEmail).toHaveBeenCalledTimes(1);
    const labelOrder = vi.mocked(labelAsRejection).mock.invocationCallOrder[0];
    const archiveOrder = vi.mocked(archiveEmail).mock.invocationCallOrder[0];
    expect(labelOrder).toBeLessThan(archiveOrder ?? Number.POSITIVE_INFINITY);
    expect(await processedMessages.hasBeenProcessed("reject")).toBe(true);
  });

  it("keeps a rejection saved when Gmail mutations are disabled", async function () {
    vi.mocked(labelAsRejection).mockRejectedValue(new GmailMutationDisabledError());
    const processedMessages = createInMemoryProcessedMessageLookup();
    const result = await processInbox({
      listMessageIds: async function () {
        return [{ id: "reject", threadId: "t" }];
      },
      readMessage: async function () {
        return email("reject", "Thanks for applying");
      },
      classify: async function () {
        return {
          ok: true as const,
          classification: classification({ classification: "REJECTION", company: "Northwind" }),
        };
      },
      processedMessages,
      logger: pino({ level: "silent" }),
      thresholds,
      protectedCompanies: ["Grainger"],
      dryRun: false,
    });

    expect(result.failed).toBe(0);
    expect(result.classified).toBe(1);
    expect(archiveEmail).not.toHaveBeenCalled();
    expect(await processedMessages.hasBeenProcessed("reject")).toBe(true);
  });
});

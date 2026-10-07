import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { createDatabase, type AppDatabase } from "../../src/database/database.js";
import { applications, summaryRuns } from "../../src/database/schema.js";
import { createSqliteWorkflowStore, type SummaryStore } from "../../src/database/workflow-store.js";
import { LogEvent } from "../../src/logging/events.js";
import type { Logger } from "../../src/logging/logger.js";
import { SUMMARY_FIELD_NOT_SPECIFIED, formatSummary } from "../../src/summary/format-summary.js";
import type { SummaryMail, SummaryMailer } from "../../src/summary/fastmail.js";
import type { GmailMutationClient } from "../../src/gmail/gmail.client.js";
import { sendDailySummary, type ConfirmationSource } from "../../src/summary/send-daily-summary.js";

const headerNow = new Date("2026-10-07T04:00:00.000Z");

function openStore(): { database: AppDatabase; store: SummaryStore } {
  const database = createDatabase(":memory:");
  return { database, store: createSqliteWorkflowStore(database) };
}

function insertApplication(
  database: AppDatabase,
  input: {
    gmailMessageId: string;
    company: string | null;
    position: string | null;
    applicationDate: string | null;
    summarized: boolean;
    createdAt: string;
  },
): void {
  database.insert(applications).values(input).run();
}

const confirmationSource: ConfirmationSource = {
  from: "jobs@example.com",
  subject: "Application received",
  body: "We received your application.",
};

function recordingMailer(sent: SummaryMail[]): SummaryMailer {
  return {
    send: async function (mail: SummaryMail) {
      sent.push(mail);
    },
  };
}

function readConfirmation(): Promise<ConfirmationSource> {
  return Promise.resolve(confirmationSource);
}

function unreadConfirmation(): Promise<ConfirmationSource> {
  return Promise.reject(new Error("should not re-read a confirmation"));
}

function idleGmail(): GmailMutationClient {
  return {
    labelMessageAsRejection: async function () {
      throw new Error("summary must not label");
    },
    archiveMessage: async function () {
      throw new Error("summary must not archive");
    },
  };
}

function captureLogger(): { logger: Logger; records: Array<Record<string, unknown>> } {
  const records: Array<Record<string, unknown>> = [];
  const stream = new Writable({
    write: function (chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
      const text = typeof chunk === "string" ? chunk : chunk.toString();
      records.push(JSON.parse(text) as Record<string, unknown>);
      callback();
    },
  });
  return { logger: pino({ level: "info" }, stream), records };
}

describe("formatSummary", function () {
  it("uses the timezone for the header and does not shift a calendar date", function () {
    const email = formatSummary({
      applications: [
        {
          company: null,
          position: "  ",
          applicationDate: "2026-10-07",
        },
      ],
      headerDate: headerNow,
      timeZone: "America/Chicago",
    });

    expect(email.subject).toBe("Job Applications — October 6, 2026");
    expect(email.body).toBe(
      [
        "Job Applications — October 6, 2026",
        "",
        `1. Company: ${SUMMARY_FIELD_NOT_SPECIFIED}`,
        `   Position: ${SUMMARY_FIELD_NOT_SPECIFIED}`,
        "   Application received: October 7, 2026",
      ].join("\n"),
    );
  });
});

describe("sendDailySummary", function () {
  it("does nothing when every confirmation is already summarized", async function () {
    const { database, store } = openStore();
    const sent: SummaryMail[] = [];
    const printed: string[] = [];
    insertApplication(database, {
      gmailMessageId: "old",
      company: "Old Co",
      position: "Engineer",
      applicationDate: "2026-10-01",
      summarized: true,
      createdAt: "2026-10-01T12:00:00.000Z",
    });

    const result = await sendDailySummary({
      store,
      mailer: recordingMailer(sent),
      dryRun: false,
      recipient: "alex@example.com",
      fromAddress: "alex@fastmail.com",
      timeZone: "America/Chicago",
      now: headerNow,
      logger: pino({ level: "silent" }),
      print: function (text: string) {
        printed.push(text);
      },
      protectedCompanies: ["Grainger"],
      readConfirmation: unreadConfirmation,
      gmail: idleGmail(),
    });

    expect(result).toEqual({ status: "empty", applicationCount: 0 });
    expect(printed).toEqual([]);
    expect(sent).toEqual([]);
    expect(database.select().from(summaryRuns).all()).toEqual([]);
  });

  it("prints a dry run and leaves rows unsummarized", async function () {
    const { database, store } = openStore();
    const printed: string[] = [];
    insertApplication(database, {
      gmailMessageId: "grainger",
      company: "Grainger",
      position: null,
      applicationDate: "2026-10-06",
      summarized: false,
      createdAt: "2026-10-06T15:00:00.000Z",
    });
    insertApplication(database, {
      gmailMessageId: "mux",
      company: " Mux ",
      position: "Senior Full Stack Engineer",
      applicationDate: "2026-10-07",
      summarized: false,
      createdAt: "2026-10-06T16:00:00.000Z",
    });

    const captured = captureLogger();
    const result = await sendDailySummary({
      store,
      mailer: {
        send: async function () {
          throw new Error("dry run must not send");
        },
      },
      dryRun: true,
      recipient: "alex@example.com",
      fromAddress: null,
      timeZone: "America/Chicago",
      now: headerNow,
      logger: captured.logger,
      print: function (text: string) {
        printed.push(text);
      },
      protectedCompanies: ["Grainger"],
      readConfirmation,
      gmail: idleGmail(),
    });

    expect(result).toEqual({ status: "dry_run", applicationCount: 2 });
    expect(printed).toEqual([
      [
        "Job Applications — October 6, 2026",
        "",
        "1. Company: Grainger",
        `   Position: ${SUMMARY_FIELD_NOT_SPECIFIED}`,
        "   Application received: October 6, 2026",
        "",
        "2. Company: Mux",
        "   Position: Senior Full Stack Engineer",
        "   Application received: October 7, 2026",
      ].join("\n"),
    ]);
    expect(database.select().from(applications).all().every(function (row) {
      return row.summarized === false;
    })).toBe(true);
    expect(database.select().from(summaryRuns).all()).toEqual([]);
    const events = captured.records.map(function (record) {
      return record.event;
    });
    expect(events).toContain(LogEvent.actionBlockedProtectedCompany);
    expect(events).toContain(LogEvent.emailArchived);
    expect(events.filter(function (event) {
      return event === LogEvent.emailArchived;
    })).toHaveLength(1);
  });

  it("marks only the included rows after a successful send", async function () {
    const { database, store } = openStore();
    const sent: SummaryMail[] = [];
    insertApplication(database, {
      gmailMessageId: "old",
      company: "Old Co",
      position: "Engineer",
      applicationDate: "2026-10-01",
      summarized: true,
      createdAt: "2026-10-01T12:00:00.000Z",
    });
    insertApplication(database, {
      gmailMessageId: "grainger",
      company: "Grainger",
      position: null,
      applicationDate: "2026-10-06",
      summarized: false,
      createdAt: "2026-10-06T15:00:00.000Z",
    });

    const archived: string[] = [];
    const recordingGmail: GmailMutationClient = {
      labelMessageAsRejection: async function () {
        throw new Error("summary must not label");
      },
      archiveMessage: async function (gmailMessageId: string) {
        archived.push(gmailMessageId);
      },
    };
    const reads: string[] = [];
    const first = await sendDailySummary({
      store,
      mailer: recordingMailer(sent),
      dryRun: false,
      recipient: "alex@example.com",
      fromAddress: "alex@fastmail.com",
      timeZone: "America/Chicago",
      now: headerNow,
      logger: pino({ level: "silent" }),
      print: function () {
        return undefined;
      },
      protectedCompanies: ["Grainger"],
      readConfirmation: async function (gmailMessageId: string) {
        reads.push(gmailMessageId);
        return confirmationSource;
      },
      gmail: recordingGmail,
    });

    expect(first.status).toBe("sent");
    expect(sent).toHaveLength(1);
    expect(sent[0]?.subject).toBe("Job Applications — October 6, 2026");
    expect(sent[0]?.text).toContain("Company: Grainger");
    expect(sent[0]?.text).not.toContain("Old Co");
    expect(sent[0]?.from).toBe("alex@fastmail.com");
    expect(sent[0]?.to).toBe("alex@example.com");

    const afterFirst = database.select().from(applications).all();
    expect(afterFirst.find(function (row) {
      return row.gmailMessageId === "old";
    })?.summarized).toBe(true);
    expect(afterFirst.find(function (row) {
      return row.gmailMessageId === "grainger";
    })?.summarized).toBe(true);
    expect(database.select().from(summaryRuns).all()).toEqual([
      expect.objectContaining({
        recipient: "alex@example.com",
        applicationCount: 1,
        success: true,
      }),
    ]);

    insertApplication(database, {
      gmailMessageId: "mux",
      company: "Mux",
      position: "Senior Full Stack Engineer",
      applicationDate: "2026-10-07",
      summarized: false,
      createdAt: "2026-10-07T12:00:00.000Z",
    });

    expect(reads).toEqual(["grainger"]);
    const printed: string[] = [];
    const secondLogs = captureLogger();
    const second = await sendDailySummary({
      store,
      mailer: recordingMailer(sent),
      dryRun: false,
      recipient: "alex@example.com",
      fromAddress: "alex@fastmail.com",
      timeZone: "America/Chicago",
      now: headerNow,
      logger: secondLogs.logger,
      print: function (text: string) {
        printed.push(text);
      },
      protectedCompanies: ["Grainger"],
      readConfirmation: async function (gmailMessageId: string) {
        reads.push(gmailMessageId);
        return confirmationSource;
      },
      gmail: recordingGmail,
    });

    expect(second).toEqual({ status: "sent", applicationCount: 1 });
    expect(printed[0]).toContain("Company: Mux");
    expect(printed[0]).not.toContain("Grainger");
    expect(reads).toEqual(["grainger", "mux"]);
    expect(archived).toEqual(["mux"]);
    expect(database.select().from(summaryRuns).all()).toHaveLength(2);
  });

  it("records a failed send and leaves confirmations unsummarized", async function () {
    const { database, store } = openStore();
    insertApplication(database, {
      gmailMessageId: "grainger",
      company: "Grainger",
      position: null,
      applicationDate: "2026-10-06",
      summarized: false,
      createdAt: "2026-10-06T15:00:00.000Z",
    });

    const result = await sendDailySummary({
      store,
      mailer: {
        send: async function () {
          throw new Error("SMTP rejected the message");
        },
      },
      dryRun: false,
      recipient: "alex@example.com",
      fromAddress: "alex@fastmail.com",
      timeZone: "America/Chicago",
      now: headerNow,
      logger: pino({ level: "silent" }),
      print: function () {
        return undefined;
      },
      protectedCompanies: ["Grainger"],
      readConfirmation: unreadConfirmation,
      gmail: idleGmail(),
    });

    expect(result).toEqual({ status: "failed", applicationCount: 1 });
    expect(database.select().from(applications).all()[0]?.summarized).toBe(false);
    const runs = database.select().from(summaryRuns).all();
    expect(runs).toHaveLength(1);
    expect(runs[0]?.success).toBe(false);
    expect(runs[0]?.applicationCount).toBe(1);
    expect(runs[0]?.recipient).toBe("alex@example.com");
  });

  it("skips an archive decision when the confirmation cannot be re-read", async function () {
    const { database, store } = openStore();
    const captured = captureLogger();
    insertApplication(database, {
      gmailMessageId: "mux",
      company: "Mux",
      position: "Engineer",
      applicationDate: "2026-10-06",
      summarized: false,
      createdAt: "2026-10-06T15:00:00.000Z",
    });

    const result = await sendDailySummary({
      store,
      mailer: {
        send: async function () {
          throw new Error("dry run must not send");
        },
      },
      dryRun: true,
      recipient: "alex@example.com",
      fromAddress: null,
      timeZone: "America/Chicago",
      now: headerNow,
      logger: captured.logger,
      print: function () {
        return undefined;
      },
      protectedCompanies: ["Grainger"],
      readConfirmation: async function () {
        throw new Error("Gmail unavailable");
      },
      gmail: idleGmail(),
    });

    expect(result).toEqual({ status: "dry_run", applicationCount: 1 });
    expect(captured.records.some(function (record) {
      return record.event === LogEvent.gmailApiError;
    })).toBe(true);
    expect(captured.records.some(function (record) {
      return record.event === LogEvent.emailArchived;
    })).toBe(false);
    expect(database.select().from(applications).all()[0]?.summarized).toBe(false);
  });

  it("keeps a sent summary when one archive fails", async function () {
    const { database, store } = openStore();
    const captured = captureLogger();
    insertApplication(database, {
      gmailMessageId: "mux",
      company: "Mux",
      position: "Engineer",
      applicationDate: "2026-10-07",
      summarized: false,
      createdAt: "2026-10-07T12:00:00.000Z",
    });

    const result = await sendDailySummary({
      store,
      mailer: recordingMailer([]),
      dryRun: false,
      recipient: "alex@example.com",
      fromAddress: "alex@fastmail.com",
      timeZone: "America/Chicago",
      now: headerNow,
      logger: captured.logger,
      print: function () {
        return undefined;
      },
      protectedCompanies: ["Grainger"],
      readConfirmation,
      gmail: {
        labelMessageAsRejection: async function () {
          throw new Error("summary must not label");
        },
        archiveMessage: async function () {
          throw new Error("Gmail archive failed");
        },
      },
    });

    expect(result.status).toBe("sent");
    expect(database.select().from(applications).all()[0]?.summarized).toBe(true);
    expect(captured.records.some(function (record) {
      return record.event === LogEvent.gmailApiError;
    })).toBe(true);
  });
});

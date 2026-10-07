import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const processedMessages = sqliteTable("processed_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gmailMessageId: text("gmail_message_id").notNull().unique(),
  gmailThreadId: text("gmail_thread_id"),
  classification: text("classification").notNull(),
  confidence: real("confidence").notNull(),
  processedAt: text("processed_at").notNull(),
});

export const applications = sqliteTable(
  "applications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gmailMessageId: text("gmail_message_id").notNull().unique(),
    company: text("company"),
    position: text("position"),
    applicationDate: text("application_date"),
    summarized: integer("summarized", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    dedupKey: text("dedup_key"),
  },
  function (table) {
    return [uniqueIndex("applications_dedup_key_unique").on(table.dedupKey)];
  },
);

export const summaryRuns = sqliteTable("summary_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
  recipient: text("recipient").notNull(),
  applicationCount: integer("application_count").notNull(),
  success: integer("success", { mode: "boolean" }).notNull(),
});

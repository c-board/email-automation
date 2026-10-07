import { google } from "googleapis";
import { REJECTION_LABEL_NAME } from "../config/constants.js";
import type { InboxMessageRef } from "../types/email.types.js";
import type { GoogleAuthClient } from "./gmail.auth.js";
import type { gmail_v1 } from "googleapis";

export type GmailReadClient = {
  listInboxMessageIds: (limit: number) => Promise<InboxMessageRef[]>;
  getMessage: (id: string) => Promise<gmail_v1.Schema$Message>;
};

export function createGmailReadClient(auth: GoogleAuthClient): GmailReadClient {
  const gmail = google.gmail({ version: "v1", auth });

  async function listInboxMessageIds(limit: number): Promise<InboxMessageRef[]> {
    const response = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX"],
      maxResults: limit,
    });
    const messages = response.data.messages ?? [];
    const refs: InboxMessageRef[] = [];
    for (const message of messages) {
      if (!message.id) {
        continue;
      }
      refs.push({
        id: message.id,
        threadId: message.threadId ?? null,
      });
    }
    return refs;
  }

  async function getMessage(id: string): Promise<gmail_v1.Schema$Message> {
    const response = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full",
    });
    return response.data;
  }

  return { listInboxMessageIds, getMessage };
}

export type GmailMutationClient = {
  labelMessageAsRejection: (gmailMessageId: string) => Promise<void>;
  archiveMessage: (gmailMessageId: string) => Promise<void>;
};

export function createGmailMutationClient(auth: GoogleAuthClient): GmailMutationClient {
  const gmail = google.gmail({ version: "v1", auth });

  async function rejectionLabelId(): Promise<string> {
    const listed = await gmail.users.labels.list({ userId: "me" });
    const existing = (listed.data.labels ?? []).find(function (label) {
      return label.name === REJECTION_LABEL_NAME && typeof label.id === "string";
    });
    if (existing?.id) {
      return existing.id;
    }

    const created = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name: REJECTION_LABEL_NAME,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });
    if (!created.data.id) {
      throw new Error("Gmail did not return a rejection label id");
    }
    return created.data.id;
  }

  async function labelMessageAsRejection(gmailMessageId: string): Promise<void> {
    const labelId = await rejectionLabelId();
    await gmail.users.messages.modify({
      userId: "me",
      id: gmailMessageId,
      requestBody: {
        addLabelIds: [labelId],
      },
    });
  }

  async function archiveMessage(gmailMessageId: string): Promise<void> {
    await gmail.users.messages.modify({
      userId: "me",
      id: gmailMessageId,
      requestBody: {
        removeLabelIds: ["INBOX"],
      },
    });
  }

  return { labelMessageAsRejection, archiveMessage };
}

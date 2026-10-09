import { google } from "googleapis";
import { APPLICATION_CONFIRMATION_LABEL_NAME, REJECTION_LABEL_NAME } from "../config/constants.js";
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
  labelMessageAsConfirmation: (gmailMessageId: string) => Promise<void>;
  archiveMessage: (gmailMessageId: string) => Promise<void>;
};

export function createGmailMutationClient(auth: GoogleAuthClient): GmailMutationClient {
  const gmail = google.gmail({ version: "v1", auth });

  async function labelId(name: string): Promise<string> {
    const listed = await gmail.users.labels.list({ userId: "me" });
    const existing = (listed.data.labels ?? []).find(function (label) {
      return label.name === name && typeof label.id === "string";
    });
    if (existing?.id) {
      return existing.id;
    }

    const created = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });
    if (!created.data.id) {
      throw new Error(`Gmail did not return an id for label ${name}`);
    }
    return created.data.id;
  }

  async function addLabel(gmailMessageId: string, name: string): Promise<void> {
    const id = await labelId(name);
    await gmail.users.messages.modify({
      userId: "me",
      id: gmailMessageId,
      requestBody: {
        addLabelIds: [id],
      },
    });
  }

  async function labelMessageAsRejection(gmailMessageId: string): Promise<void> {
    await addLabel(gmailMessageId, REJECTION_LABEL_NAME);
  }

  async function labelMessageAsConfirmation(gmailMessageId: string): Promise<void> {
    await addLabel(gmailMessageId, APPLICATION_CONFIRMATION_LABEL_NAME);
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

  return { labelMessageAsRejection, labelMessageAsConfirmation, archiveMessage };
}

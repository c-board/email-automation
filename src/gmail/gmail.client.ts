import { google } from "googleapis";
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

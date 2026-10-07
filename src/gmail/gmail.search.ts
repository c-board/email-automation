import type { GmailReadClient } from "./gmail.client.js";
import type { InboxMessageRef } from "../types/email.types.js";

export async function listRecentInboxMessageIds(
  client: GmailReadClient,
  limit: number,
): Promise<InboxMessageRef[]> {
  return client.listInboxMessageIds(limit);
}

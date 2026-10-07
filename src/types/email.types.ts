export type InboxMessageRef = {
  id: string;
  threadId: string | null;
};

export type EmailMessage = {
  gmailMessageId: string;
  gmailThreadId: string | null;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
  bodyTruncated: boolean;
};

export type ClassifierEmailInput = {
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
};

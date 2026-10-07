import type { gmail_v1 } from "googleapis";
import type { EmailMessage } from "../types/email.types.js";

type CollectedBodies = {
  plain: string[];
  html: string[];
};

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function decodeQuotedPrintableWords(text: string): string {
  const withSpaces = text.replace(/_/g, " ");
  const bytes: number[] = [];
  for (let index = 0; index < withSpaces.length; index += 1) {
    const char = withSpaces[index];
    if (char === "=" && index + 2 < withSpaces.length) {
      const hex = withSpaces.slice(index + 1, index + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(Number.parseInt(hex, 16));
        index += 2;
        continue;
      }
    }
    if (char !== undefined) {
      const code = char.charCodeAt(0);
      if (code <= 0xff) {
        bytes.push(code);
      }
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

function decodeMimeWords(value: string): string {
  return value.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
    function (match: string, charset: string, encoding: string, text: string) {
      void charset;
      try {
        if (encoding.toUpperCase() === "B") {
          return Buffer.from(text, "base64").toString("utf8");
        }
        return decodeQuotedPrintableWords(text);
      } catch {
        return match;
      }
    },
  );
}

function headerValue(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  if (!headers) {
    return "";
  }
  const match = headers.find(function (header) {
    return header.name?.toLowerCase() === name.toLowerCase();
  });
  return decodeMimeWords(match?.value ?? "");
}

function collectBodies(part: gmail_v1.Schema$MessagePart | undefined, collected: CollectedBodies): void {
  if (!part) {
    return;
  }
  const filename = part.filename ?? "";
  const data = part.body?.data;
  const mimeType = part.mimeType ?? "";
  if (data && filename.length === 0) {
    if (mimeType === "text/plain") {
      collected.plain.push(decodeBase64Url(data));
    } else if (mimeType === "text/html") {
      collected.html.push(decodeBase64Url(data));
    }
  }
  for (const child of part.parts ?? []) {
    collectBodies(child, collected);
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function receivedAtFromMessage(message: gmail_v1.Schema$Message, dateHeader: string): string {
  if (message.internalDate) {
    const millis = Number(message.internalDate);
    if (Number.isFinite(millis)) {
      return new Date(millis).toISOString();
    }
  }
  if (dateHeader.length > 0) {
    const parsed = new Date(dateHeader);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return "";
}

export function parseGmailMessage(message: gmail_v1.Schema$Message, maxBodyChars: number): EmailMessage {
  if (!message.id) {
    throw new Error("Gmail message is missing an id");
  }

  const headers = message.payload?.headers ?? undefined;
  const from = headerValue(headers, "From");
  const subjectHeader = headerValue(headers, "Subject");
  const subject = subjectHeader.length > 0 ? subjectHeader : "(no subject)";
  const dateHeader = headerValue(headers, "Date");

  const collected: CollectedBodies = { plain: [], html: [] };
  collectBodies(message.payload ?? undefined, collected);
  const plain = collected.plain.join("\n").trim();
  const html = collected.html.join("\n").trim();
  let body = plain.length > 0 ? plain : stripHtml(html);
  if (body.length === 0) {
    body = (message.snippet ?? "").trim();
  }

  let bodyTruncated = false;
  if (body.length > maxBodyChars) {
    body = body.slice(0, maxBodyChars);
    bodyTruncated = true;
  }

  return {
    gmailMessageId: message.id,
    gmailThreadId: message.threadId ?? null,
    from,
    subject,
    body,
    receivedAt: receivedAtFromMessage(message, dateHeader),
    bodyTruncated,
  };
}

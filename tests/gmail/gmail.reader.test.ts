import type { gmail_v1 } from "googleapis";
import { describe, expect, it } from "vitest";
import { parseGmailMessage } from "../../src/gmail/gmail.reader.js";

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

describe("parseGmailMessage", function () {
  it("prefers plain text over html", function () {
    const message: gmail_v1.Schema$Message = {
      id: "msg-1",
      threadId: "thread-1",
      internalDate: "1760000000000",
      payload: {
        headers: [
          { name: "From", value: "jobs@example.com" },
          { name: "Subject", value: "Application received" },
        ],
        mimeType: "multipart/alternative",
        parts: [
          { mimeType: "text/plain", body: { data: encode("Plain confirmation") } },
          { mimeType: "text/html", body: { data: encode("<p>HTML confirmation</p>") } },
        ],
      },
    };

    const email = parseGmailMessage(message, 30_000);
    expect(email.body).toBe("Plain confirmation");
    expect(email.bodyTruncated).toBe(false);
    expect(email.subject).toBe("Application received");
    expect(email.from).toBe("jobs@example.com");
    expect(email.receivedAt).toBe(new Date(1760000000000).toISOString());
  });

  it("strips html when that is the only body", function () {
    const message: gmail_v1.Schema$Message = {
      id: "msg-2",
      payload: {
        mimeType: "text/html",
        body: { data: encode("<p>Hello&nbsp;<b>there</b></p>") },
        headers: [{ name: "Subject", value: "Hello" }],
      },
    };

    const email = parseGmailMessage(message, 30_000);
    expect(email.body).toContain("Hello");
    expect(email.body).toContain("there");
    expect(email.body).not.toContain("<b>");
  });

  it("marks the body truncated at the configured limit", function () {
    const message: gmail_v1.Schema$Message = {
      id: "msg-3",
      payload: {
        mimeType: "text/plain",
        body: { data: encode("abcdef") },
      },
    };

    const email = parseGmailMessage(message, 3);
    expect(email.body).toBe("abc");
    expect(email.bodyTruncated).toBe(true);
  });

  it("throws when the message id is missing", function () {
    expect(function () {
      parseGmailMessage({ snippet: "hello" }, 100);
    }).toThrow(/missing an id/);
  });
});

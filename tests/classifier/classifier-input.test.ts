import { describe, expect, it } from "vitest";
import { buildClassifierPayload } from "../../src/ai/email-classifier.js";
import type { EmailMessage } from "../../src/types/email.types.js";

const email: EmailMessage = {
  gmailMessageId: "msg-1",
  gmailThreadId: "thread-1",
  from: "jobs@example.com",
  subject: "Application received",
  body: "We received your application.",
  receivedAt: "2026-10-06T15:00:00.000Z",
  bodyTruncated: false,
};

describe("buildClassifierPayload", function () {
  it("sends only the fields needed to understand one email", function () {
    const payload = buildClassifierPayload(email);
    expect(Object.keys(payload).sort()).toEqual(["body", "from", "receivedAt", "subject"]);
    expect(payload).toEqual({
      from: email.from,
      subject: email.subject,
      body: email.body,
      receivedAt: email.receivedAt,
    });
  });

  it("tells the model when the body was truncated", function () {
    const payload = buildClassifierPayload({ ...email, bodyTruncated: true });
    expect(payload.body.startsWith(email.body)).toBe(true);
    expect(payload.body).toContain("return UNKNOWN");
  });
});

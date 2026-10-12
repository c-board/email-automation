import { afterEach, describe, expect, it, vi } from "vitest";
import { createResendMailer } from "../../src/summary/resend.js";

const mail = {
  from: "jobs@example.com",
  to: "alex@example.com",
  subject: "Job Applications",
  text: "Horizon3",
};

describe("createResendMailer", function () {
  afterEach(function () {
    vi.unstubAllGlobals();
  });

  it("posts the summary to Resend", async function () {
    const fetchMock = vi.fn(async function () {
      return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await createResendMailer({ apiKey: "re_test" }).send(mail);

    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer re_test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mail.from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
      }),
    });
  });

  it("throws when Resend rejects the message", async function () {
    vi.stubGlobal("fetch", async function () {
      return new Response("no", { status: 403 });
    });

    await expect(createResendMailer({ apiKey: "re_test" }).send(mail)).rejects.toThrow(/403/);
  });
});

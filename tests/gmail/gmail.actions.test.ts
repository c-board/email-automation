import { describe, expect, it, vi } from "vitest";
import {
  archiveEmail,
  labelAsConfirmation,
  labelAsRejection,
  ProtectedCompanyActionError,
} from "../../src/gmail/gmail.actions.js";
import type { GmailActionTarget } from "../../src/gmail/gmail.actions.js";
import type { GmailMutationClient } from "../../src/gmail/gmail.client.js";

const grainger: GmailActionTarget = {
  gmailMessageId: "g-1",
  from: "careers@grainger.com",
  subject: "Application received",
  body: "We received your application.",
  company: "Grainger",
};

const other: GmailActionTarget = {
  gmailMessageId: "m-1",
  from: "jobs@mux.com",
  subject: "Application received",
  body: "We received your application.",
  company: "Mux",
};

function mutationClient(): GmailMutationClient & {
  labelMessageAsRejection: ReturnType<typeof vi.fn>;
  labelMessageAsConfirmation: ReturnType<typeof vi.fn>;
  archiveMessage: ReturnType<typeof vi.fn>;
} {
  return {
    labelMessageAsRejection: vi.fn(async function () {
      return undefined;
    }),
    labelMessageAsConfirmation: vi.fn(async function () {
      return undefined;
    }),
    archiveMessage: vi.fn(async function () {
      return undefined;
    }),
  };
}

describe("gmail actions", function () {
  it("blocks archive for a protected company and still applies labels", async function () {
    const gmail = mutationClient();
    await expect(archiveEmail(grainger, ["Grainger"], false, undefined, gmail)).rejects.toBeInstanceOf(
      ProtectedCompanyActionError,
    );
    await expect(labelAsRejection(grainger, false, undefined, gmail)).resolves.toBeUndefined();
    await expect(labelAsConfirmation(grainger, false, undefined, gmail)).resolves.toBeUndefined();
    expect(gmail.labelMessageAsRejection).toHaveBeenCalledWith("g-1");
    expect(gmail.labelMessageAsConfirmation).toHaveBeenCalledWith("g-1");
    expect(gmail.archiveMessage).not.toHaveBeenCalled();
  });

  it("logs a dry run and does not call Gmail", async function () {
    const gmail = mutationClient();
    await expect(archiveEmail(other, ["Grainger"], true, undefined, gmail)).resolves.toBeUndefined();
    await expect(labelAsRejection(other, true, undefined, gmail)).resolves.toBeUndefined();
    await expect(labelAsConfirmation(grainger, true, undefined, gmail)).resolves.toBeUndefined();
    await expect(archiveEmail(grainger, ["Grainger"], true, undefined, gmail)).rejects.toBeInstanceOf(
      ProtectedCompanyActionError,
    );
    expect(gmail.labelMessageAsRejection).not.toHaveBeenCalled();
    expect(gmail.labelMessageAsConfirmation).not.toHaveBeenCalled();
    expect(gmail.archiveMessage).not.toHaveBeenCalled();
  });

  it("labels and then archives an unprotected message when dry run is off", async function () {
    const gmail = mutationClient();
    await labelAsRejection(other, false, undefined, gmail);
    await archiveEmail(other, ["Grainger"], false, undefined, gmail);
    expect(gmail.labelMessageAsRejection).toHaveBeenCalledTimes(1);
    expect(gmail.labelMessageAsRejection).toHaveBeenCalledWith("m-1");
    expect(gmail.archiveMessage).toHaveBeenCalledTimes(1);
    expect(gmail.archiveMessage).toHaveBeenCalledWith("m-1");
    const labelOrder = gmail.labelMessageAsRejection.mock.invocationCallOrder[0];
    const archiveOrder = gmail.archiveMessage.mock.invocationCallOrder[0];
    expect(labelOrder).toBeLessThan(archiveOrder ?? Number.POSITIVE_INFINITY);
  });
});

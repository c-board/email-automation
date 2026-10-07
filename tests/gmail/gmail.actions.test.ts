import { describe, expect, it, vi } from "vitest";

const modify = vi.hoisted(function () {
  return vi.fn();
});
const trash = vi.hoisted(function () {
  return vi.fn();
});
const createLabel = vi.hoisted(function () {
  return vi.fn();
});

vi.mock("googleapis", function () {
  return {
    google: {
      gmail: function () {
        return {
          users: {
            messages: {
              modify,
              trash,
              batchModify: modify,
            },
            labels: {
              create: createLabel,
            },
          },
        };
      },
      auth: {
        OAuth2: vi.fn(),
      },
    },
  };
});

import {
  archiveEmail,
  GmailMutationDisabledError,
  labelAsRejection,
  ProtectedCompanyActionError,
} from "../../src/gmail/gmail.actions.js";
import type { GmailActionTarget } from "../../src/gmail/gmail.actions.js";

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

describe("gmail actions", function () {
  it("blocks a protected company before any Gmail write", async function () {
    await expect(archiveEmail(grainger, ["Grainger"], false)).rejects.toBeInstanceOf(ProtectedCompanyActionError);
    await expect(labelAsRejection(grainger, ["Grainger"], false)).rejects.toBeInstanceOf(ProtectedCompanyActionError);
    expect(modify).not.toHaveBeenCalled();
    expect(trash).not.toHaveBeenCalled();
    expect(createLabel).not.toHaveBeenCalled();
  });

  it("refuses mutations even when dry run is disabled", async function () {
    await expect(archiveEmail(other, ["Grainger"], false)).rejects.toBeInstanceOf(GmailMutationDisabledError);
    await expect(labelAsRejection(other, ["Grainger"], false)).rejects.toBeInstanceOf(GmailMutationDisabledError);
    expect(modify).not.toHaveBeenCalled();
    expect(trash).not.toHaveBeenCalled();
    expect(createLabel).not.toHaveBeenCalled();
  });
});

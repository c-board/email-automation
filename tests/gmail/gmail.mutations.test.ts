import { describe, expect, it, vi } from "vitest";
import type { GoogleAuthClient } from "../../src/gmail/gmail.auth.js";
import { createGmailMutationClient } from "../../src/gmail/gmail.client.js";

const listLabels = vi.hoisted(function () {
  return vi.fn();
});
const createLabel = vi.hoisted(function () {
  return vi.fn();
});
const modify = vi.hoisted(function () {
  return vi.fn();
});
const trash = vi.hoisted(function () {
  return vi.fn();
});
const deleteMessage = vi.hoisted(function () {
  return vi.fn();
});

vi.mock("googleapis", function () {
  return {
    google: {
      gmail: function () {
        return {
          users: {
            labels: {
              list: listLabels,
              create: createLabel,
            },
            messages: {
              modify,
              trash,
              delete: deleteMessage,
            },
          },
        };
      },
    },
  };
});

const auth = {} as GoogleAuthClient;

describe("gmail mutation client", function () {
  it("adds an existing rejection label and then removes INBOX", async function () {
    listLabels.mockResolvedValue({
      data: { labels: [{ id: "Label_9", name: "Job Rejections" }] },
    });
    createLabel.mockResolvedValue({ data: { id: "Label_new" } });
    modify.mockResolvedValue({ data: {} });
    const gmail = createGmailMutationClient(auth);

    await gmail.labelMessageAsRejection("m-1");
    await gmail.archiveMessage("m-1");

    expect(createLabel).not.toHaveBeenCalled();
    expect(modify).toHaveBeenNthCalledWith(1, {
      userId: "me",
      id: "m-1",
      requestBody: { addLabelIds: ["Label_9"] },
    });
    expect(modify).toHaveBeenNthCalledWith(2, {
      userId: "me",
      id: "m-1",
      requestBody: { removeLabelIds: ["INBOX"] },
    });
    expect(trash).not.toHaveBeenCalled();
    expect(deleteMessage).not.toHaveBeenCalled();
  });

  it("creates the rejection label when it does not exist", async function () {
    listLabels.mockResolvedValue({ data: { labels: [] } });
    createLabel.mockResolvedValue({ data: { id: "Label_1" } });
    modify.mockResolvedValue({ data: {} });
    const gmail = createGmailMutationClient(auth);

    await gmail.labelMessageAsRejection("m-2");

    expect(createLabel).toHaveBeenCalledWith({
      userId: "me",
      requestBody: {
        name: "Job Rejections",
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });
    expect(modify).toHaveBeenCalledWith({
      userId: "me",
      id: "m-2",
      requestBody: { addLabelIds: ["Label_1"] },
    });
    expect(trash).not.toHaveBeenCalled();
    expect(deleteMessage).not.toHaveBeenCalled();
  });
});

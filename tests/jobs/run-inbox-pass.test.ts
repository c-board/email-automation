import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SchedulerEnv } from "../../src/config/env.js";
import { runInboxPass } from "../../src/jobs/run-inbox-pass.js";
import pino from "pino";

const runInboxJob = vi.hoisted(function () {
  return vi.fn();
});
const runSummaryJob = vi.hoisted(function () {
  return vi.fn();
});

vi.mock("../../src/jobs/run-inbox.js", function () {
  return { runInboxJob };
});

vi.mock("../../src/jobs/run-summary.js", function () {
  return { runSummaryJob };
});

const env = {} as SchedulerEnv;
const logger = pino({ level: "silent" });

describe("runInboxPass", function () {
  beforeEach(function () {
    runInboxJob.mockReset();
    runSummaryJob.mockReset();
    runSummaryJob.mockResolvedValue({ status: "empty", applicationCount: 0 });
  });

  it("sends the summary after the inbox job", async function () {
    const order: string[] = [];
    runInboxJob.mockImplementation(async function () {
      order.push("inbox");
      return { discovered: 1, skipped: 0, classified: 1, failed: 0, outcomes: [] };
    });
    runSummaryJob.mockImplementation(async function () {
      order.push("summary");
      return { status: "sent", applicationCount: 1 };
    });

    const result = await runInboxPass(env, logger);
    expect(order).toEqual(["inbox", "summary"]);
    expect(result.summaryResult.status).toBe("sent");
  });

  it("still sends the summary when the inbox job throws", async function () {
    runInboxJob.mockRejectedValue(new Error("Gmail list failed"));
    runSummaryJob.mockResolvedValue({ status: "sent", applicationCount: 1 });

    const result = await runInboxPass(env, logger);
    expect(result.inboxResult).toBeNull();
    expect(runSummaryJob).toHaveBeenCalledTimes(1);
    expect(result.summaryResult.status).toBe("sent");
  });
});

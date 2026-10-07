import { getTasks, type ScheduledTask } from "node-cron";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { startSchedules } from "../../src/scheduler/start-schedules.js";

const logger = pino({ level: "silent" });

function findTask(name: string): ScheduledTask {
  const matches = [...getTasks().values()].filter(function (task) {
    return task.name === name && task.getStatus() !== "destroyed";
  });
  const task = matches[matches.length - 1];
  if (task === undefined) {
    throw new Error(`Missing scheduled task ${name}`);
  }
  return task;
}

describe("startSchedules", function () {
  it("does not run jobs at startup", async function () {
    const calls: string[] = [];
    const schedules = startSchedules(
      {
        timezone: "America/Chicago",
        inboxProcessingCron: "0 0 1 1 *",
        summaryCron: "0 0 2 1 *",
      },
      logger,
      {
        runInbox: async function () {
          calls.push("inbox");
        },
        runSummary: async function () {
          calls.push("summary");
        },
      },
    );

    await new Promise(function (resolve) {
      setTimeout(resolve, 50);
    });
    expect(calls).toEqual([]);
    await schedules.stop();
  });

  it("waits for the other job instead of overlapping", async function () {
    const order: string[] = [];
    let releaseInbox: () => void = function () {};
    const schedules = startSchedules(
      {
        timezone: "America/Chicago",
        inboxProcessingCron: "0 0 1 1 *",
        summaryCron: "0 0 2 1 *",
      },
      logger,
      {
        runInbox: async function () {
          order.push("inbox-start");
          await new Promise<void>(function (resolve) {
            releaseInbox = resolve;
          });
          order.push("inbox-end");
        },
        runSummary: async function () {
          order.push("summary");
        },
      },
    );

    const inboxRun = findTask("inbox").execute();
    await expect.poll(function () {
      return order;
    }).toEqual(["inbox-start"]);

    const summaryRun = findTask("summary").execute();
    await new Promise(function (resolve) {
      setTimeout(resolve, 20);
    });
    expect(order).toEqual(["inbox-start"]);

    releaseInbox();
    await inboxRun;
    await summaryRun;
    expect(order).toEqual(["inbox-start", "inbox-end", "summary"]);
    await schedules.stop();
  });

  it("logs a job error and keeps the schedule", async function () {
    const events: string[] = [];
    const schedules = startSchedules(
      {
        timezone: "America/Chicago",
        inboxProcessingCron: "0 0 1 1 *",
        summaryCron: "0 0 2 1 *",
      },
      {
        ...logger,
        error: function () {
          events.push("error");
        },
      },
      {
        runInbox: async function () {
          throw new Error("inbox failed");
        },
        runSummary: async function () {
          events.push("summary");
        },
      },
    );

    await findTask("inbox").execute();
    await findTask("summary").execute();
    expect(events).toEqual(["error", "summary"]);
    expect(findTask("inbox").getStatus()).not.toBe("destroyed");
    await schedules.stop();
  });
});

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
  it("registers only the inbox cron and does not run it at startup", async function () {
    const calls: string[] = [];
    const schedules = startSchedules(
      {
        timezone: "America/Chicago",
        inboxProcessingCron: "0 0 1 1 *",
      },
      logger,
      {
        runInbox: async function () {
          calls.push("inbox");
        },
      },
    );

    await new Promise(function (resolve) {
      setTimeout(resolve, 50);
    });
    expect(calls).toEqual([]);
    const active = [...getTasks().values()].filter(function (task) {
      return task.getStatus() !== "destroyed";
    });
    expect(active.map(function (task) {
      return task.name;
    })).toEqual(["inbox"]);
    await schedules.stop();
  });

  it("logs a job error and keeps the schedule", async function () {
    const events: string[] = [];
    const schedules = startSchedules(
      {
        timezone: "America/Chicago",
        inboxProcessingCron: "0 0 1 1 *",
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
      },
    );

    await findTask("inbox").execute();
    expect(events).toEqual(["error"]);
    expect(findTask("inbox").getStatus()).not.toBe("destroyed");
    await schedules.stop();
  });
});

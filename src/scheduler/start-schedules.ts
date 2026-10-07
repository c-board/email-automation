import { schedule, type ScheduledTask } from "node-cron";
import type { SchedulerEnv } from "../config/env.js";
import { LogEvent } from "../logging/events.js";
import type { Logger } from "../logging/logger.js";
import { errorText } from "../logging/sanitize.js";
import { createJobLock } from "./job-lock.js";

export type ScheduledJobs = {
  runInbox: () => Promise<void>;
  runSummary: () => Promise<void>;
};

export type ScheduleHandle = {
  stop: () => Promise<void>;
};

export function startSchedules(
  env: Pick<SchedulerEnv, "inboxProcessingCron" | "summaryCron" | "timezone">,
  logger: Logger,
  jobs: ScheduledJobs,
): ScheduleHandle {
  const lock = createJobLock();

  async function runJob(name: "inbox" | "summary", job: () => Promise<void>): Promise<void> {
    await lock.runExclusive(async function () {
      try {
        await job();
      } catch (error: unknown) {
        logger.error(
          {
            event: LogEvent.jobFailed,
            job: name,
            errorMessage: errorText(error),
          },
          "Scheduled job failed",
        );
      }
    });
  }

  const inbox = schedule(
    env.inboxProcessingCron,
    function () {
      return runJob("inbox", jobs.runInbox);
    },
    {
      name: "inbox",
      timezone: env.timezone,
      noOverlap: true,
    },
  );
  const summary = schedule(
    env.summaryCron,
    function () {
      return runJob("summary", jobs.runSummary);
    },
    {
      name: "summary",
      timezone: env.timezone,
      noOverlap: true,
    },
  );

  return {
    stop: async function () {
      await stopTask(inbox);
      await stopTask(summary);
    },
  };
}

async function stopTask(task: ScheduledTask): Promise<void> {
  await Promise.resolve(task.stop());
  await Promise.resolve(task.destroy());
}

import { schedule, type ScheduledTask } from "node-cron";
import type { SchedulerEnv } from "../config/env.js";
import { LogEvent } from "../logging/events.js";
import type { Logger } from "../logging/logger.js";
import { errorText } from "../logging/sanitize.js";
import { createJobLock } from "./job-lock.js";

export type ScheduledJobs = {
  runInbox: () => Promise<void>;
};

export type ScheduleHandle = {
  stop: () => Promise<void>;
};

export function startSchedules(
  env: Pick<SchedulerEnv, "inboxProcessingCron" | "timezone">,
  logger: Logger,
  jobs: ScheduledJobs,
): ScheduleHandle {
  const lock = createJobLock();

  async function runJob(job: () => Promise<void>): Promise<void> {
    await lock.runExclusive(async function () {
      try {
        await job();
      } catch (error: unknown) {
        logger.error(
          {
            event: LogEvent.jobFailed,
            job: "inbox",
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
      return runJob(jobs.runInbox);
    },
    {
      name: "inbox",
      timezone: env.timezone,
      noOverlap: true,
    },
  );

  return {
    stop: async function () {
      await stopTask(inbox);
    },
  };
}

async function stopTask(task: ScheduledTask): Promise<void> {
  await Promise.resolve(task.stop());
  await Promise.resolve(task.destroy());
}

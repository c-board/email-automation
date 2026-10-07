import { describe, expect, it } from "vitest";
import { createJobLock } from "../../src/scheduler/job-lock.js";

describe("createJobLock", function () {
  it("runs the waiting job after the active job finishes", async function () {
    const lock = createJobLock();
    const order: string[] = [];
    let releaseFirst: () => void = function () {};

    const first = lock.runExclusive(async function () {
      order.push("first-start");
      await new Promise<void>(function (resolve) {
        releaseFirst = resolve;
      });
      order.push("first-end");
    });
    const second = lock.runExclusive(async function () {
      order.push("second");
    });

    await expect.poll(function () {
      return order;
    }).toEqual(["first-start"]);

    releaseFirst();
    await first;
    await second;
    expect(order).toEqual(["first-start", "first-end", "second"]);
  });

  it("releases the lock when a job throws", async function () {
    const lock = createJobLock();
    const order: string[] = [];

    await expect(
      lock.runExclusive(async function () {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    await lock.runExclusive(async function () {
      order.push("second");
    });
    expect(order).toEqual(["second"]);
  });
});

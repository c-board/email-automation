export type JobLock = {
  runExclusive: <T>(job: () => Promise<T>) => Promise<T>;
};

export function createJobLock(): JobLock {
  let tail: Promise<void> = Promise.resolve();

  async function runExclusive<T>(job: () => Promise<T>): Promise<T> {
    const previous = tail;
    let release: () => void = function () {};
    tail = new Promise(function (resolve) {
      release = resolve;
    });
    await previous;
    try {
      return await job();
    } finally {
      release();
    }
  }

  return { runExclusive };
}

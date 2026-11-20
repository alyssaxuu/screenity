// A free take's video-ready goes out only after its last chunk is written. The
// IDB editor opened at Stop reads the store once, so it waits for that report
// first: a final put that is slow or retried would otherwise be missed and the
// editor would open a shorter take. Past the cap it reads what is there.
export const TAKE_SETTLE_WAIT_MS = 10_000;

const settled = new Map();
const waiters = new Map();

export const noteTakeWritesSettled = (attemptId) => {
  if (!attemptId) return;
  settled.set(attemptId, Date.now());
  // Bounded: one entry per take, and only the last few can still be waited on.
  if (settled.size > 20) settled.delete(settled.keys().next().value);
  const list = waiters.get(attemptId);
  if (!list) return;
  waiters.delete(attemptId);
  for (const wake of list) wake(true);
};

export const waitForTakeWritesSettled = (
  attemptId,
  timeoutMs = TAKE_SETTLE_WAIT_MS,
) => {
  if (!attemptId) return Promise.resolve(false);
  if (settled.has(attemptId)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const wake = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      const list = waiters.get(attemptId);
      if (list) {
        const rest = list.filter((w) => w !== wake);
        if (rest.length) waiters.set(attemptId, rest);
        else waiters.delete(attemptId);
      }
      resolve(ok);
    };
    const timer = setTimeout(() => wake(false), timeoutMs);
    waiters.set(attemptId, [...(waiters.get(attemptId) || []), wake]);
  });
};

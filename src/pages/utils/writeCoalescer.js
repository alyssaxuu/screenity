// Rate-limits a storage write that is requested far more often than its data
// is read. Every chrome.storage.local write is delivered to the onChanged
// listeners of every open tab, so progress-only writes are worth batching.
//
// request() runs the write now if none ran in the last minIntervalMs, else once
// at the end of that window. noteWrite() records a write made elsewhere that
// already carried the same state, so a pending one is dropped. Pure, so
// tests/unit can drive it with fake timers.
export const createWriteCoalescer = ({
  minIntervalMs,
  run,
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
}) => {
  let lastRunAt = null;
  let timer = null;
  let pending = false;

  const clear = () => {
    if (timer === null) return;
    clearTimer(timer);
    timer = null;
  };

  const fire = () => {
    timer = null;
    if (!pending) return;
    pending = false;
    lastRunAt = now();
    run();
  };

  return {
    request() {
      pending = true;
      if (timer !== null) return;
      const wait = lastRunAt === null ? 0 : lastRunAt + minIntervalMs - now();
      if (wait <= 0) fire();
      else timer = setTimer(fire, wait);
    },
    noteWrite() {
      lastRunAt = now();
      pending = false;
      clear();
    },
    flush() {
      clear();
      fire();
    },
    cancel() {
      pending = false;
      clear();
    },
    isPending: () => pending,
  };
};

// Perf-timeline marks around a capture acquisition, so a slow start shows which
// stream was being waited on. No first-frame mark on purpose: reading a frame
// would put a reader on the capture stream during start.
export const timedAcquire = async (kind, fn, { mark, now = () => Date.now() } = {}) => {
  const t0 = now();
  try {
    mark?.("CloudRecorder.acquire.start", { kind });
  } catch {}
  try {
    const result = await fn();
    try {
      mark?.("CloudRecorder.acquire.resolved", { kind, ms: now() - t0 });
    } catch {}
    return result;
  } catch (err) {
    try {
      mark?.("CloudRecorder.acquire.failed", {
        kind,
        ms: now() - t0,
        err: String(err?.name || "error").slice(0, 40),
      });
    } catch {}
    throw err;
  }
};

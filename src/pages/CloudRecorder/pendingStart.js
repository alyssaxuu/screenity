// A start that arrives before capture and uploaders are ready waits here. The
// background re-check reads silence as a dead recorder, so the wait marks what
// it waits on often enough to stay fresh (stale at 10s).
export const PENDING_START_POLL_MS = 200;
// Elapsed time, not a poll count: a hidden document's timers fire about once a
// second, so 75 polls there would outlast the background's 25s cap.
export const PENDING_START_MAX_MS = 15000;
const MARK_EVERY_MS = 1000;

export function pendingStartStep({ elapsedMs, sinceMarkMs, hasStreams, uploadersReady }) {
  if (hasStreams && uploadersReady) return { action: "start" };
  if (elapsedMs >= PENDING_START_MAX_MS) return { action: "fail" };
  const shouldMark = sinceMarkMs == null || sinceMarkMs >= MARK_EVERY_MS;
  return {
    action: "wait",
    mark: shouldMark
      ? hasStreams
        ? "awaiting-uploaders"
        : "awaiting-capture"
      : null,
  };
}

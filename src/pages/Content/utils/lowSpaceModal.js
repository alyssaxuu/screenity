// The "not enough space" modal. Below this much space left, a logged-out
// recording is refused.
export const LOW_SPACE_BYTES = 524288000;

// The background answers "available-memory" with { data } (the estimate) or
// { error }, so the numbers live one level down. A failed estimate never blocks.
export const isLowOnSpace = (reply) => {
  const quota = Number(reply?.data?.quota);
  if (!Number.isFinite(quota) || quota <= 0) return false;
  const usage = Number(reply?.data?.usage) || 0;
  return quota - usage < LOW_SPACE_BYTES;
};

// What the modal offers: Restore when a take can be recovered. Clearing space
// is not offered: it would wipe the active IDB slot without the retention or
// held-take checks, and never touches the OPFS file most takes live in.
export const lowSpaceRestore = (checkRestoreResponse) =>
  checkRestoreResponse?.restore
    ? { labelKey: "restoreRecording", messageType: "restore-recording" }
    : null;

// Start-fail re-check keeps polling while the recorder reports stage progress,
// so a slow-but-live start isn't torn down. The caps bound a wedged start.
export const RECHECK_INTERVAL_MS = 2500;
// Generous: the encoder probe can run several seconds on a flaky encoder, and
// killing a live start is the worse bug.
export const PROGRESS_STALE_MS = 10000;
export const START_PROGRESS_CAP_MS = 25000;
// Longest a watch can run: the cap, rounded up to the next re-check.
export const START_WATCH_MAX_MS = START_PROGRESS_CAP_MS + 2 * RECHECK_INTERVAL_MS;

// Only the cloud recorder answers a start it takes. Any other reply, or none,
// says nothing about whether the start is moving. A recorder in its own tab is
// left alone: its missing reply always read as success, and the fail path
// cannot reach that tab to stop it.
export const isWatchedStart = (reply) =>
  reply?.ok === true &&
  reply?.accepted === true &&
  (reply?.host === "iframe" || reply?.host === "offscreen");

export function judgeStartRecheck(snap, startDispatchedAt, now) {
  if (snap?.recording) return { verdict: "recording" };
  // The error path, a cancel, a stop, or a closed tab/document already ended
  // this start; nothing is left to tear down.
  const errorAt = snap?.lastRecordingError?.ts;
  if (typeof errorAt === "number" && errorAt >= startDispatchedAt) {
    return { verdict: "ended", by: "error" };
  }
  // A take that began and was stopped inside one check window left no stamp.
  const endedAt = Math.max(
    Number(snap?.lastStartEndedAt) || 0,
    Number(snap?.recordingStoppedAt) || 0,
  );
  if (endedAt && endedAt >= startDispatchedAt) {
    return { verdict: "ended", by: "ended" };
  }
  const progress = snap?.recorderStartProgress || null;
  const isThisStart = Boolean(progress?.ts) && progress.ts >= startDispatchedAt;
  const isFresh = isThisStart && now - progress.ts < PROGRESS_STALE_MS;
  const withinCap = now - startDispatchedAt < START_PROGRESS_CAP_MS;
  if (isFresh && withinCap) return { verdict: "wait" };
  // No writer at all reads the same as a stalled one, so keep them apart.
  const stage = isThisStart
    ? String(progress.stage || "unknown").slice(0, 40)
    : "none";
  const stalledMs = isThisStart ? now - progress.ts : null;
  const trackEnd = snap?.lastTrackEndEvent || null;
  if (trackEnd?.ts && trackEnd.ts >= startDispatchedAt) {
    return { verdict: "stream-ended", stage, stalledMs, trackEnd };
  }
  return { verdict: "fail", stage, stalledMs };
}

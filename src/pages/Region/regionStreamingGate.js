// Gate for the region streaming-data dedup. `applyStreamingData` dedupes on a
// `streamingDataHandled` bool that can get stuck true after a start fails
// without routing through stop/dismiss/timeout, dropping the next recording's
// data. A real duplicate is always mid-session, so "handled" while fully idle is
// a stale leftover to reset, not a dupe.
export const isStaleStreamingHandled = (s) => {
  if (!s) return false;
  if (!s.streamingDataHandled) return false;
  return (
    !s.deferredTimerActive &&
    !s.regionMode &&
    !s.hasRecorder &&
    !s.recording &&
    !s.finishing
  );
};

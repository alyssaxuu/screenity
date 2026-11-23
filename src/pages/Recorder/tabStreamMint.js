// Tab-capture stream id mint: one in flight at a time, plus a fallback for
// when the pushed `loaded` message (isTab/tabID) never reached this document.

// A second concurrent mint can fail with "active stream", so a late `loaded`
// and the streaming-data fallback must share one mint. `mint` runs at most
// once at a time; `isDone` says the id is already held.
export const createMintGuard = (mint, isDone = () => false) => {
  let inFlight = null;
  return {
    run(id) {
      if (inFlight) return inFlight;
      if (isDone()) return Promise.resolve();
      inFlight = Promise.resolve()
        .then(() => mint(id))
        .finally(() => {
          inFlight = null;
        });
      return inFlight;
    },
    isInFlight: () => inFlight !== null,
  };
};

// Decide what a tab-capture take does when streaming-data arrives. The
// background stores tabCaptureTabId for offscreen tab/region takes so the
// recorder does not depend on `loaded` winning the cold-start race.
export const resolveTabCaptureFallback = ({
  isTab,
  tabPreferred,
  hasStreamId,
  minting,
  tabCaptureTabId,
}) => {
  const tabId = tabCaptureTabId ?? null;
  if (tabPreferred || tabId == null) {
    return { isTab: Boolean(isTab), tabId: null, shouldMint: false };
  }
  return {
    isTab: true,
    tabId,
    shouldMint: !hasStreamId && !minting,
  };
};

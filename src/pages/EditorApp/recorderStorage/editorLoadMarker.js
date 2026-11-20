// A reloaded editor tab gets no message from the service worker, so it
// remembers in sessionStorage what it loaded and loads that again.

export const EDITOR_LOAD_MARKER_KEY = "screenityEditorLoad";

export const buildMarker = ({
  slot,
  firstTimestamp,
  chunkCount,
  byteSize,
  viewer,
}) => ({
  backend: "idb",
  slot: slot || null,
  firstTimestamp: firstTimestamp ?? null,
  chunkCount: chunkCount ?? 0,
  byteSize: byteSize ?? null,
  viewer: Boolean(viewer),
});

export const parseMarker = (raw) => {
  if (!raw) return null;
  try {
    const m = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!m || m.backend !== "idb" || !m.slot) return null;
    return buildMarker(m);
  } catch {
    return null;
  }
};

// Same slot, first chunk, chunk count and size: the recording the marker was
// written for. WebCodecs takes share timestamp 0, so a newer take in the slot
// is told apart by its counts. A marker without byteSize skips that check.
export const matches = (marker, readResult) =>
  Boolean(
    marker &&
      readResult &&
      marker.slot === readResult.slot &&
      marker.firstTimestamp === (readResult.firstTimestamp ?? null) &&
      marker.chunkCount === readResult.chunkCount &&
      (marker.byteSize == null || marker.byteSize === readResult.byteSize),
  );

export const readMarker = () => {
  try {
    return parseMarker(sessionStorage.getItem(EDITOR_LOAD_MARKER_KEY));
  } catch {
    return null;
  }
};

export const writeMarker = (marker) => {
  try {
    sessionStorage.setItem(EDITOR_LOAD_MARKER_KEY, JSON.stringify(marker));
  } catch {}
};

// Only a read that returned this marker's chunks justifies protecting the tab.
// An empty slot would otherwise register an entry that shields nothing.
export const shouldRegisterAfterSelfLoad = (readResult, marker) =>
  Boolean(readResult && readResult.chunkCount > 0 && matches(marker, readResult));

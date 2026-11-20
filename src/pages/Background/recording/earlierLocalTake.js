// A free take's editor normally opens at its Stop. A take that finalizes with no Stop through
// the SW (session cleared behind it, a shutdown flush) gets it from its video-ready. If the
// next Start click lands first, that video-ready reads as an earlier take's and session work
// is skipped, but the take still needs its editor: once its frame closes nothing else holds its bytes.

export const LOCAL_EDITOR_ATTEMPTS_KEY = "localEditorAttempts";
const KEEP_ATTEMPTS = 10;
// Same cut as the stop path: longer IDB recordings open in viewer mode.
export const VIEWER_MIN_DURATION_MS = 7 * 60 * 1000;
const IDB_SLOTS = new Set(["chunks", "chunks_b"]);

export const withEditorAttempt = (list, attemptId) => {
  const prev = Array.isArray(list) ? list.filter((a) => a !== attemptId) : [];
  return attemptId ? [...prev, attemptId].slice(-KEEP_ATTEMPTS) : prev;
};

// What to open for an earlier take's video-ready, or null to open nothing: not a
// free take (no localTake), its Stop already opened an editor, or its bytes
// cannot be named. An IDB take with no slot is skipped, since an editor without
// one reads the active pointer, which is the next take's.
export const earlierLocalTakeEditor = ({
  localTake,
  attemptId,
  takeSlot = null,
  editorAttempts = [],
}) => {
  if (!attemptId || !localTake || typeof localTake !== "object") return null;
  if ((editorAttempts || []).includes(attemptId)) return null;
  const durationMs = Number(localTake.durationMs) || 0;
  if (localTake.backend === "opfs") {
    if (!localTake.fileName) return null;
    return {
      backend: "opfs",
      fileName: localTake.fileName,
      slot: null,
      recordingId: localTake.recordingId || null,
      durationMs,
      viewer: false,
    };
  }
  if (localTake.backend !== "idb") return null;
  // The frame's stamp wins over the slot it reported, as on the stop path.
  const slot = IDB_SLOTS.has(takeSlot)
    ? takeSlot
    : IDB_SLOTS.has(localTake.slot)
      ? localTake.slot
      : null;
  if (!slot) return null;
  return {
    backend: "idb",
    fileName: null,
    slot,
    // An IDB recording id can be a leftover from an older take, and the registry
    // replaces an entry with the same id, so the tab is its identity.
    recordingId: null,
    durationMs,
    viewer: durationMs > VIEWER_MIN_DURATION_MS,
  };
};

// picks OPFS or localforage IDB for chunk storage. OPFS by default,
// IDB fallback when OPFS APIs are missing or the probe write fails.
// track is "screen" | "audio" | "camera"; the prefix is what the rest
// of the codebase already uses, so OpfsKvStore.iterate() returns keys
// in the same shape as localforage did.
import localforage from "localforage";
import { OpfsKvStore, isOpfsSupported } from "./opfsKvStore";

export const TRACK_KEY_PREFIX = {
  screen: "chunk_",
  audio: "audio_chunk_",
  camera: "camera_chunk_",
};

export const TRACK_IDB_INSTANCE = {
  screen: "chunks",
  audio: "audioChunks",
  camera: "cameraChunks",
};

const opfsDiag = (event, data = {}) => {
  try {
    chrome.runtime.sendMessage({
      type: "diag-forward",
      event: `opfs-cloud-${event}`,
      data,
    });
  } catch {}
};

const idbInstance = (track) =>
  localforage.createInstance({ name: TRACK_IDB_INSTANCE[track] });

// Probe writes a tiny 1-byte chunk under "__probe" then removes it. Detects
// quota / API-disabled / cross-origin-isolation issues before any real
// chunk is written.
const probeOpfs = async (store) => {
  const probeBlob = new Blob([new Uint8Array([1])], {
    type: "application/octet-stream",
  });
  await store.setItem("__probe", { chunk: probeBlob });
  await store.removeItem("__probe");
};

export const chooseChunksStore = async ({
  sessionId,
  track,
  preferOpfs = true,
}) => {
  const prefix = TRACK_KEY_PREFIX[track];
  if (!prefix) throw new Error(`chooseChunksStore: unknown track ${track}`);

  if (preferOpfs && sessionId && isOpfsSupported()) {
    const startedAt = Date.now();
    const store = new OpfsKvStore({ sessionId, track, prefix });
    try {
      await probeOpfs(store);
      opfsDiag("probe-ok", {
        sessionId,
        track,
        durationMs: Date.now() - startedAt,
      });
      return { store, backend: "opfs", initMs: Date.now() - startedAt };
    } catch (err) {
      opfsDiag("probe-failed", {
        sessionId,
        track,
        error: String(err?.message || err),
        errorName: err?.name || "Error",
      });
      // Probe may have created the track dir before failing; reap it so we
      // don't leave empty dirs behind when we fall back to IDB.
      store.destroyTrackDir().catch(() => {});
    }
  }

  return { store: idbInstance(track), backend: "idb", initMs: 0 };
};

// reconstructs a store for a recording that's already on disk (resume/
// restore). backend is fixed by what was written, not by current pref.
export const openExistingChunksStore = ({ sessionId, track, backend }) => {
  const prefix = TRACK_KEY_PREFIX[track];
  if (!prefix) throw new Error(`openExistingChunksStore: unknown track ${track}`);

  if (backend === "opfs") {
    if (!sessionId) {
      throw new Error("openExistingChunksStore: opfs backend requires sessionId");
    }
    return {
      store: new OpfsKvStore({ sessionId, track, prefix }),
      backend: "opfs",
    };
  }
  return { store: idbInstance(track), backend: "idb" };
};

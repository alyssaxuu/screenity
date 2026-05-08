import localforage from "localforage";
import BunnyTusUploader from "../CloudRecorder/bunnyTusUploader";
import { openExistingChunksStore } from "../CloudRecorder/recorderStorage/chooseChunksStore";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

const JOURNAL_KEY_PREFIX = "uploadJournal-";

const trackName = (trackType) =>
  trackType === "camera" ? "camera" : "screen";

// Pulls per-journal storage backend from the persisted recorder session.
// Journals written before the OPFS migration default to IDB. The uploader
// itself doesn't carry backend state, so this routes through chrome.storage.
const resolveBackendForJournal = async (journal) => {
  const sessionId = journal?.sessionId || null;
  const trackKey = trackName(journal?.trackType || "screen");

  // Try the per-session snapshot first (it survives even after a newer
  // session has overwritten the latest `recorderSession`).
  if (sessionId) {
    const sessionStateKey = `cloudRecorderSession:${sessionId}`;
    try {
      const snap = await chrome.storage.local.get([sessionStateKey]);
      const session = snap?.[sessionStateKey];
      if (session?.storageBackends) {
        return {
          backend: session.storageBackends[trackKey] || "idb",
          opfsSessionId: session.opfsSessionId || sessionId,
        };
      }
    } catch {}
  }

  // Fallback: latest recorderSession may match if we're resuming the only
  // outstanding session.
  try {
    const snap = await chrome.storage.local.get(["recorderSession"]);
    const session = snap?.recorderSession;
    if (
      session?.storageBackends &&
      (session.id === sessionId || !sessionId)
    ) {
      return {
        backend: session.storageBackends[trackKey] || "idb",
        opfsSessionId: session.opfsSessionId || sessionId,
      };
    }
  } catch {}

  return { backend: "idb", opfsSessionId: sessionId };
};

const chunkKeyPrefixForTrack = (trackType) =>
  trackType === "camera" ? "camera_chunk_" : "chunk_";

const loadChunksSorted = async (store, prefix = "chunk_") => {
  const items = [];
  await store.iterate((value, key) => {
    if (!key || !key.startsWith(prefix)) return;
    if (!value || !value.chunk) return;
    items.push({
      index:
        typeof value.index === "number"
          ? value.index
          : parseInt(key.replace(prefix, ""), 10) || 0,
      chunk: value.chunk,
      timestamp: value.timestamp || 0,
    });
  });
  items.sort((a, b) => a.index - b.index);
  return items;
};

// Tus PATCH writes at the offset header without content validation, so
// re-sending chunks already received corrupts the file silently.
const skipAlreadyUploadedChunks = (chunks, alreadyUploadedBytes) => {
  if (!alreadyUploadedBytes || alreadyUploadedBytes <= 0) return chunks;
  let cumulative = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunkSize = chunks[i].chunk?.size || 0;
    const chunkEnd = cumulative + chunkSize;
    if (chunkEnd <= alreadyUploadedBytes) {
      cumulative = chunkEnd;
      continue;
    }
    // Boundary chunk straddles serverOffset; slice the uploaded prefix.
    const sliceOffset = alreadyUploadedBytes - cumulative;
    const remaining = chunks.slice(i);
    if (sliceOffset > 0 && typeof remaining[0]?.chunk?.slice === "function") {
      remaining[0] = {
        ...remaining[0],
        chunk: remaining[0].chunk.slice(sliceOffset),
      };
    }
    return remaining;
  }
  return [];
};

const bumpResumeAttempts = async (journal) => {
  const key = `${JOURNAL_KEY_PREFIX}${journal.mediaId}`;
  try {
    const existing = await chrome.storage.local.get([key]);
    const current = existing?.[key] || journal;
    const updated = {
      ...current,
      resumeAttempts: (current.resumeAttempts || 0) + 1,
      lastResumeAttemptAt: Date.now(),
    };
    await chrome.storage.local.set({ [key]: updated });
  } catch {}
};

const emit = (type, payload) => {
  try {
    chrome.runtime
      .sendMessage({
        type: "offscreen-diag",
        source: type,
        payload,
      })
      .catch(() => {});
  } catch {}
};

export const resumeOneJournal = async (journal) => {
  const trackType = journal.trackType || journal.type || "screen";
  const mediaId = journal.mediaId;
  const projectId = journal.projectId;
  const sceneId = journal.sceneId;

  if (!mediaId || !projectId) {
    return { ok: false, error: "journal-missing-ids" };
  }

  emit("upload_resume_started", {
    mediaId,
    projectId,
    sceneId,
    trackType,
    offset: journal.offset,
    totalBytes: journal.totalBytes,
    resumeAttempts: journal.resumeAttempts || 0,
  });

  const { backend, opfsSessionId } = await resolveBackendForJournal(journal);
  const { store } = openExistingChunksStore({
    sessionId: opfsSessionId,
    track: trackName(trackType),
    backend,
  });
  const chunks = await loadChunksSorted(
    store,
    chunkKeyPrefixForTrack(trackType),
  );

  if (!chunks.length) {
    // Orphan journal: chunks cleared or never written. GC.
    emit("upload_resume_chunks_missing", { mediaId, trackType });
    try {
      await chrome.storage.local.remove([
        `${JOURNAL_KEY_PREFIX}${mediaId}`,
      ]);
    } catch {}
    return { ok: false, error: "chunks-missing" };
  }

  const uploader = new BunnyTusUploader({ trackType });

  try {
    await uploader.initialize(projectId, {
      title: journal.title || `Recording ${mediaId}`,
      type: trackType,
      width: journal.width || null,
      height: journal.height || null,
      sceneId: sceneId || null,
      sessionId: journal.sessionId || null,
      reuse: { videoId: journal.videoId, mediaId },
    });
  } catch (err) {
    console.warn("[resumeJournal] initialize failed:", err);
    await bumpResumeAttempts(journal);
    emit("upload_resume_failed", {
      mediaId,
      phase: "initialize",
      error: err?.message || String(err),
    });
    return { ok: false, error: `initialize: ${err?.message || err}` };
  }

  // uploader.offset = bytes Bunny has. Finalize-only if full, else replay
  // the gap (bail on sparse local chunks).
  const serverOffset = uploader.offset || 0;
  const journalTotalBytes = journal.totalBytes || 0;
  const serverHasEverything =
    journalTotalBytes > 0 && serverOffset >= journalTotalBytes;

  let remainingChunks = [];
  if (serverHasEverything) {
    emit("upload_resume_finalize_only", {
      mediaId,
      trackType,
      serverOffset,
      journalTotalBytes,
    });
  } else {
    const isContiguous = chunks.every((c, i) => c.index === i);
    if (!isContiguous) {
      emit("upload_resume_sparse_chunks", {
        mediaId,
        trackType,
        firstIndex: chunks[0]?.index,
        lastIndex: chunks[chunks.length - 1]?.index,
        count: chunks.length,
        serverOffset,
        journalTotalBytes,
      });
      try {
        await chrome.storage.local.remove([
          `${JOURNAL_KEY_PREFIX}${mediaId}`,
        ]);
      } catch {}
      return { ok: false, error: "sparse-chunks" };
    }

    remainingChunks = skipAlreadyUploadedChunks(chunks, serverOffset);
    emit("upload_resume_chunks_skipped", {
      mediaId,
      serverOffset,
      totalChunks: chunks.length,
      remainingChunks: remainingChunks.length,
    });
  }

  try {
    for (const { chunk } of remainingChunks) {
      if (uploader.status === "aborted" || uploader.status === "error") break;
      await uploader.write(chunk);
    }
    await uploader.finalize();
    emit("upload_resume_completed", {
      mediaId,
      projectId,
      sceneId,
      trackType,
      finalizedBytes: uploader.totalBytes,
    });
    return { ok: true };
  } catch (err) {
    console.warn("[resumeJournal] upload/finalize failed:", err);
    await bumpResumeAttempts(journal);
    emit("upload_resume_failed", {
      mediaId,
      phase: "upload",
      error: err?.message || String(err),
      resumeAttempts: (journal.resumeAttempts || 0) + 1,
    });
    return { ok: false, error: `upload: ${err?.message || err}` };
  }
};

export const resumeAllJournals = async (journals) => {
  const results = [];
  for (const journal of journals) {
    try {
      const r = await resumeOneJournal(journal);
      results.push({ mediaId: journal.mediaId, ...r });
    } catch (err) {
      results.push({
        mediaId: journal.mediaId,
        ok: false,
        error: err?.message || String(err),
      });
    }
  }
  return results;
};

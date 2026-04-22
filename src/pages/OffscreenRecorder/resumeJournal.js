import localforage from "localforage";
import BunnyTusUploader from "../CloudRecorder/bunnyTusUploader";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

const JOURNAL_KEY_PREFIX = "uploadJournal-";

const chunkStoreForTrack = (trackType) => {
  if (trackType === "camera") {
    return localforage.createInstance({ name: "cameraChunks" });
  }
  return localforage.createInstance({ name: "chunks" });
};

const loadChunksSorted = async (store) => {
  const items = [];
  await store.iterate((value, key) => {
    if (!key || !key.startsWith("chunk_")) return;
    if (!value || !value.chunk) return;
    items.push({
      index:
        typeof value.index === "number"
          ? value.index
          : parseInt(key.replace("chunk_", ""), 10) || 0,
      chunk: value.chunk,
      timestamp: value.timestamp || 0,
    });
  });
  items.sort((a, b) => a.index - b.index);
  return items;
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

  const store = chunkStoreForTrack(trackType);
  const chunks = await loadChunksSorted(store);

  if (!chunks.length) {
    // Orphan journal - chunks cleared or never written. GC.
    emit("upload_resume_chunks_missing", { mediaId, trackType });
    try {
      await chrome.storage.local.remove([
        `${JOURNAL_KEY_PREFIX}${mediaId}`,
      ]);
    } catch {}
    return { ok: false, error: "chunks-missing" };
  }

  // Sparse chunks (purge ran mid-recording) would corrupt the replay - abandon and let server state stand.
  const isContiguous = chunks.every((c, i) => c.index === i);
  if (!isContiguous) {
    emit("upload_resume_sparse_chunks", {
      mediaId,
      trackType,
      firstIndex: chunks[0]?.index,
      lastIndex: chunks[chunks.length - 1]?.index,
      count: chunks.length,
    });
    try {
      await chrome.storage.local.remove([
        `${JOURNAL_KEY_PREFIX}${mediaId}`,
      ]);
    } catch {}
    return { ok: false, error: "sparse-chunks" };
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

  try {
    for (const { chunk } of chunks) {
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

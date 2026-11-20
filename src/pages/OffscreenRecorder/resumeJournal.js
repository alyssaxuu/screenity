import localforage from "localforage";
import BunnyTusUploader from "../CloudRecorder/bunnyTusUploader";
import { getClientSessionId } from "../CloudRecorder/clientSessionId";
import { TRACK_KEY_PREFIX } from "../CloudRecorder/recorderStorage/chooseChunksStore";
import { openExistingChunksStore } from "../CloudRecorder/recorderStorage/chooseChunksStore";
import { destroySessionDir } from "../CloudRecorder/recorderStorage/opfsKvStore";
import { setPendingMicRecovery } from "../CloudRecorder/micRecovery";
import {
  AWAITING_MAX_AGE_MS,
  MAX_CONFIRM_CHECKS,
  confirmDelayMs,
  confirmTrack,
} from "../CloudRecorder/confirmTrack";
import {
  heldIdbTracks,
  idbStoreOwner,
  storeHoldsTake,
} from "../CloudRecorder/localCopyGate";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

const API_BASE = process.env.SCREENITY_API_BASE_URL;
const JOURNAL_KEY_PREFIX = "uploadJournal-";
const SESSION_KEY_PREFIX = "cloudRecorderSession:";
const PURGE_MARKS_PREFIX = "chunkPurgeMarks:";
const ATTEMPTS_KEY = "uploadResumeAttempts";
const MIC_MARKER_KEY = "pendingMicRecovery";
const LOCAL_PLAYBACK_OFFER_KEY = "cloudLocalScreenPlaybackOffer";
// No bytes landing for this long means a wedged uploader. Its drain loop never
// returns on an error the heartbeat missed.
const STALL_LIMIT_MS = 5 * 60 * 1000;
const STALL_CHECK_MS = 10 * 1000;
const LOCK_REFRESH_MS = 60 * 1000;
// Offset errors that mean the upload itself is broken, not the connection.
const BROKEN_UPLOAD_CODES = new Set([
  "invalid-server-offset",
  "server-offset-not-advancing",
  "server-offset-regressed",
]);
export { confirmTrack };
const RECOVERABLE_SESSION_STATUSES = new Set([
  "awaiting-confirm",
  "recording",
  "hidden",
  "unload",
  "stopping",
  "finalize-failed",
  "upload-stalled",
  "stale-cleared",
  "crashed",
]);

// Audio must map to its own store. Flattening it to "screen" would resume a
// mic journal out of the screen chunks and upload the wrong track's bytes.
const trackName = (trackType) =>
  trackType === "camera" || trackType === "audio" ? trackType : "screen";

// Pulls per-journal storage backend from the persisted recorder session.
// Journals written before the OPFS migration default to IDB. The uploader
// itself doesn't carry backend state, so this routes through chrome.storage.
const resolveBackendForJournal = async (journal) => {
  const sessionId = journal?.sessionId || null;
  const trackKey = trackName(journal?.trackType || "screen");

  // Try the per-session snapshot first (it survives even after a newer
  // session has overwritten the latest `recorderSession`).
  if (sessionId) {
    const sessionStateKey = `${SESSION_KEY_PREFIX}${sessionId}`;
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

  // Defaulting to IDB would find no chunks (recordings prefer OPFS wherever it
  // works) and drop the journal as if there were none to resume.
  if (sessionId) {
    try {
      const { store } = openExistingChunksStore({
        sessionId,
        track: trackKey,
        backend: "opfs",
      });
      if ((await store.length()) > 0) {
        return { backend: "opfs", opfsSessionId: sessionId };
      }
    } catch {}
  }

  return { backend: "idb", opfsSessionId: sessionId };
};

const chunkKeyPrefixForTrack = (trackType) =>
  TRACK_KEY_PREFIX[trackType] || "chunk_";

const loadChunksSorted = async (store, prefix = "chunk_") => {
  const items = [];
  await store.iterate((value, key) => {
    if (!key || !key.startsWith(prefix)) return;
    // A failed write leaves an empty file. Counting it as a chunk would make
    // the tail look unbroken and shift every chunk after it in the upload.
    if (!value || !value.chunk || !value.chunk.size) return;
    items.push({
      index:
        typeof value.index === "number"
          ? value.index
          : parseInt(key.replace(prefix, ""), 10) || 0,
      chunk: value.chunk,
      timestamp: value.timestamp || 0,
      ...(typeof value.sessionId === "string"
        ? { sessionId: value.sessionId }
        : {}),
    });
  });
  items.sort((a, b) => a.index - b.index);
  return items;
};

// A store that cannot be read throws: an unreadable copy is not an empty one.
const summarizeChunks = async (store, prefix) =>
  (await loadChunksSorted(store, prefix)).map((c) => ({
    index: c.index,
    size: c.chunk?.size || 0,
    ...(c.sessionId ? { sessionId: c.sessionId } : {}),
  }));

// Chunks at or below the purge mark were confirmed and deleted mid-recording,
// so what is left must run unbroken from just past it, starting at its byte.
const planLocalBytes = (chunks, mark) => {
  const base = mark ? Number(mark.endByte) || 0 : 0;
  const firstIndex = mark ? mark.index + 1 : 0;
  const tail = chunks.filter((c) => c.index >= firstIndex);
  const unbroken = tail.every((c, i) => c.index === firstIndex + i);
  const tailBytes = tail.reduce((n, c) => n + (c.chunk?.size || 0), 0);
  return { base, tail, unbroken, end: base + tailBytes };
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

// Offline, signed out or a struggling server says nothing about the take, so
// none of it counts toward the attempt cap. A 403 is the server refusing this
// take for good, so it is held instead (see TERMINAL_STATUSES).
const isTransient = (err) => {
  if (err?.transient === true) return true;
  if (globalThis.navigator?.onLine === false) return true;
  const status = Number(err?.status) || 0;
  if ([401, 408, 429].includes(status) || status >= 500) return true;
  if (["TypeError", "AbortError", "TimeoutError"].includes(err?.name)) return true;
  return /failed to fetch|network|not authenticated|missing user token|verify server offset/i.test(
    String(err?.message || err || "")
  );
};

const bumpAttempts = async (mediaId) => {
  if (!mediaId) return;
  try {
    const { [ATTEMPTS_KEY]: map } = await chrome.storage.local.get([ATTEMPTS_KEY]);
    const next = { ...(map || {}), [mediaId]: ((map || {})[mediaId] || 0) + 1 };
    await chrome.storage.local.set({ [ATTEMPTS_KEY]: next });
  } catch {}
};

const clearAttempts = async (mediaId) => {
  try {
    const { [ATTEMPTS_KEY]: map } = await chrome.storage.local.get([ATTEMPTS_KEY]);
    if (!map || !(mediaId in map)) return;
    const next = { ...map };
    delete next[mediaId];
    await chrome.storage.local.set({ [ATTEMPTS_KEY]: next });
  } catch {}
};

// initialize() only prunes a journal once it's stale past 24h. Restoring it
// here keeps a failed attempt from leaving nothing for settle to find, which
// would delete a take that can still land.
const restoreJournal = async (journal) => {
  const key = `${JOURNAL_KEY_PREFIX}${journal.mediaId}`;
  try {
    const { [key]: current } = await chrome.storage.local.get([key]);
    if (!current) await chrome.storage.local.set({ [key]: journal });
  } catch {}
};

const removeJournal = async (mediaId) => {
  try {
    await chrome.storage.local.remove([`${JOURNAL_KEY_PREFIX}${mediaId}`]);
  } catch {}
};

// A tus-auth 404 tombstones the journal, and a plain tombstone stops holding
// the copy after 24h, so a pass that does not place the take restores the
// journal it started from. A held one stays held but learns the new media.
const putBackJournal = async (journal) => {
  const key = `${JOURNAL_KEY_PREFIX}${journal.mediaId}`;
  try {
    const { [key]: stored } = await chrome.storage.local.get([key]);
    if (stored?.holdUntilRecovered === true) {
      await chrome.storage.local.set({
        [key]: {
          ...stored,
          freshMediaId: journal.freshMediaId || null,
          freshVideoId: journal.freshVideoId || null,
        },
      });
      return;
    }
    await chrome.storage.local.set({ [key]: journal });
  } catch {}
};

// Settle reads the take's media ids from here. Fresh media has an id the
// snapshot never saw.
const noteRecoveredMedia = async (sessionId, track, mediaId) => {
  if (!sessionId || !mediaId) return;
  const key = `${SESSION_KEY_PREFIX}${sessionId}`;
  try {
    const { [key]: session } = await chrome.storage.local.get([key]);
    if (!session) return;
    await chrome.storage.local.set({
      [key]: {
        ...session,
        recoveredMediaIds: { ...(session.recoveredMediaIds || {}), [track]: mediaId },
      },
    });
  } catch {}
};

// From here the fresh media's journal is what keeps the copy on disk. It is
// written before the old one goes, so settle never finds the take with
// neither, and no later pass resumes the old one into a third media.
const adoptFreshMedia = async (old, uploader, carry = null) => {
  const key = `${JOURNAL_KEY_PREFIX}${uploader.mediaId}`;
  let fresh = null;
  try {
    fresh = (await chrome.storage.local.get([key]))?.[key] || null;
    if (!fresh) {
      fresh = {
        ...(carry || {}),
        mediaId: uploader.mediaId,
        videoId: uploader.videoId || null,
        projectId: old.projectId,
        sceneId: old.sceneId || null,
        trackType: old.trackType || old.type || "screen",
        type: old.type || old.trackType || "screen",
        sessionId: old.sessionId || null,
        title: old.title || null,
        width: old.width || null,
        height: old.height || null,
        uploadUrl: uploader.uploadUrl || null,
        offset: 0,
        totalBytes: 0,
        status: "uploading",
        updatedAt: Date.now(),
      };
      await chrome.storage.local.set({ [key]: fresh });
    }
  } catch {
    return old;
  }
  await removeJournal(old.mediaId);
  await clearAttempts(old.mediaId);
  return fresh;
};

// tus-auth looks media up by owner, so its 404 cannot tell a reaped video from
// another account, or speak for the project. This route does: 404 deleted,
// 200 with trashed in Trash, 403 when this sign-in does not own it.
const checkProject = async (projectId) => {
  let res;
  try {
    const { screenityToken } = await chrome.storage.local.get(["screenityToken"]);
    res = await fetch(
      `${API_BASE}/videos/${encodeURIComponent(projectId)}/access/`,
      {
        headers: screenityToken
          ? { Authorization: `Bearer ${screenityToken}` }
          : {},
        cache: "no-store",
      }
    );
  } catch (err) {
    return { error: err };
  }
  // 400 is an id that cannot name a project.
  if (res.status === 404 || res.status === 400) return { state: "deleted" };
  if (res.status === 403) return { state: "forbidden" };
  const body = res.ok ? await res.json().catch(() => null) : null;
  if (!body) {
    const err = new Error(`project check answered ${res.status}`);
    err.status = res.status;
    return { error: err };
  }
  // Trash is the only case the route answers canAccess: false.
  if (body.trashed === true || body.canAccess === false) {
    return { state: "trashed" };
  }
  return { state: "exists" };
};

// New media starts at byte 0, so only a copy that starts there and holds every
// byte the take wrote can become it.
const localCopyGap = async (journal, plan, mark, track) => {
  if (mark || plan.base > 0) return "local-purged";
  let durable = 0;
  if (journal.sessionId) {
    const key = `${SESSION_KEY_PREFIX}${journal.sessionId}`;
    try {
      const { [key]: session } = await chrome.storage.local.get([key]);
      durable = Number(session?.tracks?.[track]?.durableChunkCount) || 0;
    } catch {}
  }
  if (plan.tail.length < durable) return "local-incomplete";
  const took = Math.max(
    Number(journal.totalBytes) || 0,
    Number(journal.offset) || 0
  );
  if (plan.end < took) return "local-incomplete";
  return null;
};

// The server will not take this upload, and retrying will not change that.
const TERMINAL_STATUSES = new Set([403, 404]);

// A tombstone with holdUntilRecovered keeps the take's local copy on disk with
// no expiry: settle, the journal sweep and the orphan dir sweep all read it. A
// later pass keeps the first invalidatedAt.
export const holdJournalUntilRecovered = async (journal, reason) => {
  const key = `${JOURNAL_KEY_PREFIX}${journal.mediaId}`;
  try {
    const { [key]: stored } = await chrome.storage.local.get([key]);
    const base = stored || journal;
    const prior = [base, journal].find(
      (j) => j.status === "invalidated" && Number(j.invalidatedAt) > 0,
    );
    await chrome.storage.local.set({
      [key]: {
        ...base,
        status: "invalidated",
        uploadUrl: null,
        // A 403 is retried later, and only this upload can take the rest of
        // the take at the right offset.
        heldUploadUrl:
          journal.uploadUrl || base.uploadUrl || base.heldUploadUrl || null,
        invalidatedAt: prior ? prior.invalidatedAt : Date.now(),
        invalidatedReason: reason,
        holdUntilRecovered: true,
      },
    });
  } catch {}
};

const watchForStall = (uploader) => {
  let lastOffset = uploader.offset;
  let lastProgressAt = Date.now();
  let timer = null;
  const stalled = new Promise((resolve) => {
    timer = setInterval(() => {
      if (uploader.offset !== lastOffset) {
        lastOffset = uploader.offset;
        lastProgressAt = Date.now();
      } else if (Date.now() - lastProgressAt > STALL_LIMIT_MS) {
        resolve("stalled");
      }
    }, STALL_CHECK_MS);
  });
  return { stalled, stop: () => clearInterval(timer) };
};

// No recorder to forward through here, so this posts directly; env is left
// out since the server fills it in from the request headers.
const postTelemetry = async (type, fields = {}) => {
  if (!API_BASE) return;
  try {
    const { screenityToken } = await chrome.storage.local.get([
      "screenityToken",
    ]);
    const version = chrome?.runtime?.getManifest?.()?.version || null;
    const mediaId = fields.mediaId || null;
    const body = {
      recordingId: mediaId || fields.recordingSessionId || null,
      recordingSessionId: fields.recordingSessionId || null,
      projectId: fields.projectId || null,
      sceneId: fields.sceneId || null,
      mediaId,
      bunnyVideoId: fields.bunnyVideoId || null,
      source: "extension",
      extVersion: version,
      event: {
        type,
        t: Date.now(),
        trackType: fields.trackType || null,
        offsetBytes: typeof fields.offset === "number" ? fields.offset : null,
        fileSize:
          typeof fields.totalBytes === "number"
            ? fields.totalBytes
            : typeof fields.finalizedBytes === "number"
            ? fields.finalizedBytes
            : null,
        errMsg: fields.errMsg || null,
        // The proof event of a confirmed local copy. Left out when absent: the
        // server reads a null number as zero.
        ...(Number.isFinite(fields.bunnyStatus) ? { bunnyStatus: fields.bunnyStatus } : {}),
        ...(Number.isFinite(fields.confirmMs) ? { confirmMs: fields.confirmMs } : {}),
        ...(Number.isFinite(fields.checks) ? { checks: fields.checks } : {}),
      },
    };
    await fetch(`${API_BASE}/log/upload-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-screenity-source": "extension",
        ...(version ? { "x-screenity-ext-version": version } : {}),
        ...(screenityToken ? { Authorization: `Bearer ${screenityToken}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify(body),
    });
  } catch {}
};

const emit = (type, payload = {}) => {
  try {
    chrome.runtime
      .sendMessage({
        type: "offscreen-diag",
        source: type,
        payload,
      })
      .catch(() => {});
  } catch {}
  const errMsg =
    payload.errMsg ||
    [payload.phase, payload.error].filter(Boolean).join(": ") ||
    null;
  void postTelemetry(type, { ...payload, errMsg });
};

const makeUploader = (trackType) =>
  new BunnyTusUploader({
    trackType,
    clientSessionId: getClientSessionId(),
    onTelemetry: (event, body) => {
      if (event !== "upload_progress") void postTelemetry(event, body);
    },
  });

export const resumeOneJournal = async (journal, { latestSessionId = null } = {}) => {
  const trackType = journal.trackType || journal.type || "screen";
  const track = trackName(trackType);
  const mediaId = journal.mediaId;
  const projectId = journal.projectId;
  const sceneId = journal.sceneId;
  const ctx = {
    mediaId,
    projectId,
    sceneId,
    trackType,
    recordingSessionId: journal.sessionId || null,
  };

  if (!mediaId || !projectId) {
    return { ok: false, error: "journal-missing-ids" };
  }

  // Fresh media replaces this journal as the outcome's home.
  let active = journal;
  const drop = async (reason) => {
    emit("upload_resume_dropped", { ...ctx, errMsg: reason });
    await removeJournal(active.mediaId);
    await clearAttempts(active.mediaId);
    return { ok: false, dropped: true, error: reason };
  };
  // Resume cannot place these bytes, but they may be the only copy, so they
  // stay on disk until the user recovers or discards them.
  const hold = async (reason) => {
    await holdJournalUntilRecovered(active, reason);
    await clearAttempts(active.mediaId);
    emit("upload_resume_failed", { ...ctx, phase: "held", error: reason });
    return {
      ok: false,
      held: true,
      transient: false,
      error: reason,
      mediaId: active.mediaId,
    };
  };

  if (journal.holdUntilRecovered === true) {
    return { ok: false, held: true, transient: false, error: journal.invalidatedReason || "held" };
  }

  // A pass cut off between starting the new media's upload and adopting it
  // leaves both journals. The new media's journal carries the take from here.
  if (journal.freshMediaId) {
    const key = `${JOURNAL_KEY_PREFIX}${journal.freshMediaId}`;
    let freshJournal = null;
    try {
      freshJournal = (await chrome.storage.local.get([key]))?.[key] || null;
    } catch {}
    if (freshJournal) {
      await noteRecoveredMedia(journal.sessionId, track, journal.freshMediaId);
      await removeJournal(mediaId);
      await clearAttempts(mediaId);
      emit("upload_resume_fresh_media", {
        ...ctx,
        mediaId: journal.freshMediaId,
        errMsg: `handed over from ${mediaId}`,
      });
      return {
        ok: false,
        handedOff: true,
        transient: false,
        mediaId: journal.freshMediaId,
      };
    }
  }

  emit("upload_resume_started", {
    ...ctx,
    offset: journal.offset,
    totalBytes: journal.totalBytes,
  });

  const { backend, opfsSessionId } = await resolveBackendForJournal(journal);
  const { store } = openExistingChunksStore({
    sessionId: opfsSessionId,
    track,
    backend,
  });
  let chunks = await loadChunksSorted(store, chunkKeyPrefixForTrack(trackType));
  const marksKey = journal.sessionId
    ? `${PURGE_MARKS_PREFIX}${journal.sessionId}`
    : null;
  const marks = marksKey
    ? (await chrome.storage.local.get([marksKey]))?.[marksKey]
    : null;
  // IDB is one store for every take and each chunk names its writer. Another
  // take's bytes are never sent as this one's media; an overwritten take is
  // dropped, as on master.
  if (backend !== "opfs" && chunks.length) {
    const all = (await chrome.storage.local.get(null)) || {};
    const tagged =
      all[`${SESSION_KEY_PREFIX}${journal.sessionId}`]?.chunksTagged === true;
    const ours = storeHoldsTake(chunks, {
      sessionId: journal.sessionId || null,
      latestSessionId,
      mark: marks?.[track] || null,
      tagged,
    });
    if (!ours) {
      if (journal.sessionId && journal.sessionId !== latestSessionId) {
        return drop("idb-not-latest");
      }
      // Part of the store is still this take's, mixed with chunks another take
      // or the local Recorder left. No server has them, so all of it stays.
      // Chunks up to the purge mark are already on the server.
      const mark = marks?.[track] || null;
      const firstIndex = mark ? Number(mark.index) + 1 : 0;
      const own = (c) =>
        c.index >= firstIndex &&
        (c.sessionId ? c.sessionId === journal.sessionId : !tagged);
      if (journal.sessionId && chunks.some(own)) {
        return hold("idb-store-mixed");
      }
      chunks = [];
    }
  }

  const plan = planLocalBytes(chunks, marks?.[track] || null);
  // A host whose finalize failed clears its chunks, while Bunny may still hold
  // every byte. Only the server can say whether that take can still close.
  const noLocalBytes = !plan.tail.length && plan.base === 0;

  // With no mark to place a gap, the bytes after it would land at the wrong
  // offset, which Bunny accepts and plays back as garbage.
  if (!plan.unbroken) return hold("gap-without-mark");

  // A held take's timed retries are capped. The uploader rewrites the journal
  // on every persist, so the count rides along or a re-hold restarts it at 0.
  const journalCarry =
    Number(journal.holdRetries) > 0
      ? { holdRetries: Number(journal.holdRetries) }
      : null;
  const initOpts = {
    journalCarry,
    title: journal.title || `Recording ${mediaId}`,
    type: trackType,
    width: journal.width || null,
    height: journal.height || null,
    sceneId: sceneId || null,
    sessionId: journal.sessionId || null,
  };

  let uploader = makeUploader(trackType);
  let reaped = false;
  let freshMedia = false;

  const fail = async (phase, err) => {
    console.warn(`[resumeJournal] ${phase} failed:`, err);
    const status = Number(err?.status) || 0;
    if (TERMINAL_STATUSES.has(status)) {
      return plan.tail.length
        ? hold(`server-${status}`)
        : drop(`server-${status}-without-local-bytes`);
    }
    const onOriginal = active.mediaId === mediaId;
    if (reaped && onOriginal) await putBackJournal(active);
    else await restoreJournal(active);
    const transient = isTransient(err);
    // A transient failure retries forever. The new media this take may have
    // is reused on every pass, so retrying never makes a second one.
    if (!transient) await bumpAttempts(active.mediaId);
    emit("upload_resume_failed", {
      ...ctx,
      mediaId: uploader.mediaId || mediaId,
      phase,
      error: `${transient ? "transient " : ""}${err?.message || String(err)}`,
    });
    return { ok: false, transient, error: `${phase}: ${err?.message || err}` };
  };

  try {
    await uploader.initialize(projectId, {
      ...initOpts,
      reuse: {
        videoId: journal.videoId,
        mediaId,
        uploadUrl: journal.uploadUrl || null,
      },
    });
  } catch (err) {
    // With nothing on disk a 404 has nothing to hold or send.
    if (Number(err?.status) !== 404 || !plan.tail.length) {
      return fail("initialize", err);
    }
    // The server reaps media no byte reached ~7h after the start, so a take
    // resumed next day finds its video gone. A whole copy goes up as new media
    // in the same project, never one deleted or in Trash; a partial copy is held.
    reaped = true;
    const gap = await localCopyGap(journal, plan, marks?.[track] || null, track);
    if (gap) return hold(`server-404-${gap}`);
    const project = await checkProject(projectId);
    if (project.error) return fail("project-check", project.error);
    // Another account is signed in. A new sign-in retries it, as any 403.
    if (project.state === "forbidden") return hold("server-403");
    if (project.state !== "exists") {
      return hold(`server-404-project-${project.state}`);
    }
    let continued = false;
    if (active.freshMediaId && active.freshVideoId) {
      // An earlier pass created new media for this take but could not start
      // its upload. Going on with it keeps the take to one new media.
      uploader = makeUploader(trackType);
      try {
        await uploader.initialize(projectId, {
          ...initOpts,
          deferJournal: true,
          reuse: {
            videoId: active.freshVideoId,
            mediaId: active.freshMediaId,
            uploadUrl: null,
          },
        });
        continued = true;
      } catch (freshErr) {
        const status = Number(freshErr?.status) || 0;
        if (status === 403) return hold("server-403");
        if (status !== 404) return fail("initialize-fresh", freshErr);
        // That media is gone as well, so the next one replaces it.
        active = { ...active, freshMediaId: null, freshVideoId: null };
        await putBackJournal(active);
      }
    }
    if (!continued) {
      uploader = makeUploader(trackType);
      try {
        await uploader.initialize(projectId, {
          ...initOpts,
          fresh: true,
          deferJournal: true,
          // Remembered before the upload starts, so a retry, or a pass after
          // the doc closed mid-start, reuses this media instead of a new one.
          onMediaCreated: async ({ videoId, mediaId: createdId }) => {
            active = { ...active, freshMediaId: createdId, freshVideoId: videoId };
            await putBackJournal(active);
          },
        });
      } catch (freshErr) {
        const status = Number(freshErr?.status) || 0;
        if (status === 403) return hold("server-403");
        // The project went after the check, or a finished copy of this take is
        // already there (409).
        if ([404, 409, 410].includes(status)) return hold(`fresh-media-${status}`);
        return fail("initialize-fresh", freshErr);
      }
    }
    active = await adoptFreshMedia(active, uploader, journalCarry);
    freshMedia = true;
    ctx.mediaId = uploader.mediaId;
    await noteRecoveredMedia(journal.sessionId, track, uploader.mediaId);
    emit("upload_resume_fresh_media", {
      ...ctx,
      errMsg: `replaces ${mediaId}`,
    });
  }
  // Every pass renews the hold, keeping a retrying take safe from the server's reaper.
  uploader.saveUploadMeta?.();

  const serverOffset = uploader.offset || 0;
  if (noLocalBytes) {
    const serverComplete =
      journal.totalBytes > 0 && serverOffset >= journal.totalBytes;
    if (!serverComplete) return drop("chunks-missing");
  }
  if (serverOffset < plan.base) {
    // A HEAD with its offset header stripped reads as 0, which proves nothing.
    if (serverOffset === 0) {
      return fail("initialize", new Error("server offset read as 0 below purge mark"));
    }
    // Everything below the mark was on the server before it left disk, so the
    // server lost bytes. The tail on disk is still the user's.
    return hold("server-behind-purge");
  }
  const remaining = skipAlreadyUploadedChunks(plan.tail, serverOffset - plan.base);
  const expectedEnd = Math.max(plan.end, serverOffset);

  const watch = watchForStall(uploader);
  let outcome;
  try {
    outcome = await Promise.race([
      (async () => {
        for (const { chunk } of remaining) {
          await uploader.write(chunk);
        }
        // Nothing more comes for this take: the drain may retry a failed track.
        uploader.markEndOfStream();
        // write() only queues chunks and surfaces failures later, so the
        // server's own offset is checked instead of trusting it resolved.
        await uploader.waitForPendingUploads();
        const landed = await uploader.getServerOffset();
        if (landed === null || landed < expectedEnd) {
          return new Error(`server has ${landed} of ${expectedEnd}`);
        }
        return "landed";
      })(),
      watch.stalled,
    ]);
  } catch (err) {
    outcome = err;
  } finally {
    watch.stop();
  }
  if (outcome === "stalled") {
    const stall = new Error("no bytes landed for 5 minutes");
    // The uploader retries dropped connections forever, so a stall is usually
    // a dead link. Only its offset errors say the upload itself is broken.
    stall.transient = !BROKEN_UPLOAD_CODES.has(uploader.lastErrorCode);
    return fail("upload", stall);
  }
  if (outcome !== "landed") {
    // Finalizing now would declare a short file Bunny can't take back.
    return fail("upload", outcome);
  }

  try {
    await uploader.finalize();
  } catch (err) {
    return fail("finalize", err);
  }

  await clearAttempts(active.mediaId);
  emit("upload_resume_completed", {
    ...ctx,
    mediaId: uploader.mediaId,
    finalizedBytes: expectedEnd,
  });
  return { ok: true, mediaId: uploader.mediaId, freshMedia };
};

// A plain tombstone this old, with nothing replacing it, stops being a resume
// in flight. Its bytes are then held on the snapshot instead of cleared.
const INVALIDATED_HOLD_MS = 24 * 60 * 60 * 1000;
// A pass that could not reach Bunny or read a store counts toward the cap, so a take that
// never gets through ends as an "unconfirmed" hold, not a forever retry. awaiting-confirm keeps
// its own schedule: a counted: false answer is not a check and repeats the step.
const countFailedPass = async (
  snapKey,
  session,
  { counted = true, reason = "unconfirmed", whileHeld = false } = {}
) => {
  if (session.holdUntilRecovered === true && !whileHeld) return null;
  const isAwaiting = session.status === "awaiting-confirm";
  const done = Number(session.confirmChecks || 0);
  const checks = counted ? done + 1 : done;
  if (counted && checks >= MAX_CONFIRM_CHECKS) {
    const { confirmChecks, ...rest } = session;
    await chrome.storage.local.set({
      [snapKey]: {
        ...rest,
        holdUntilRecovered: true,
        heldReason: reason,
        heldAt: Date.now(),
      },
    });
    return null;
  }
  await chrome.storage.local.set({
    [snapKey]: {
      ...session,
      confirmChecks: checks,
      ...(isAwaiting ? { nextConfirmAt: Date.now() + confirmDelayMs(checks) } : {}),
    },
  });
  return isAwaiting
    ? { sessionId: session.id, awaiting: true }
    : { sessionId: session.id, retry: true };
};
const MIC_MAX_ATTEMPTS = 3;
const MIC_RECHECK_MS = 5 * 60 * 1000;

// Local bytes go only on positive evidence: discarded, released as header-only, or every
// track with bytes has a receipt covering them and Bunny shows it finished. No journal is
// not evidence (a crash before the first write looks the same). Else held or left for resume.
// A separated mic was never on TUS and still has to attach. Returns the settled take,
// { sessionId, retry: true } while waiting on Bunny, or null.
const settleSession = async (sessionId, all) => {
  const snapKey = `${SESSION_KEY_PREFIX}${sessionId}`;
  const session = all[snapKey];
  if (!session || !RECOVERABLE_SESSION_STATUSES.has(session.status)) return null;
  // A hold waits for the user. Only an unconfirmed one is looked at again, since
  // Bunny finishing is what clears it.
  const wasUnconfirmed =
    session.holdUntilRecovered === true && session.heldReason === "unconfirmed";
  if (session.holdUntilRecovered === true && !wasUnconfirmed) return null;
  const isAwaiting = session.status === "awaiting-confirm";
  const discarded =
    (all.discardedRecordingSessionIds || []).includes(sessionId) ||
    Number(session.discardedAt || 0) > 0;
  // A take waiting on Bunny is looked at when its step is due, and at once
  // when the user threw it away.
  if (
    isAwaiting &&
    !wasUnconfirmed &&
    !discarded &&
    Number(session.nextConfirmAt || 0) > Date.now()
  ) {
    return null;
  }

  const trackOfJournal = (j) => trackName(j?.trackType || j?.type || "screen");
  const sessionJournals = () =>
    Object.entries(all).filter(
      ([key, j]) => key.startsWith(JOURNAL_KEY_PREFIX) && j?.sessionId === sessionId
    );
  const dropJournals = async (keys) => {
    if (!keys.length) return;
    for (const k of keys) delete all[k];
    await chrome.storage.local.remove(keys).catch(() => {});
  };

  // A tombstone the next media of the same track replaced (a take whose upload
  // was invalidated mid-recording, then finalized as fresh media) is history.
  const receiptTracks = new Set(
    sessionJournals()
      .filter(([, j]) => j.status === "completed")
      .map(([, j]) => trackOfJournal(j))
  );
  await dropJournals(
    sessionJournals()
      .filter(
        ([, j]) =>
          j.status === "invalidated" &&
          j.holdUntilRecovered !== true &&
          receiptTracks.has(trackOfJournal(j))
      )
      .map(([k]) => k)
  );

  // Aged plain tombstones are judged below, with the bytes. Everything else
  // that is not a receipt is a resume still owning its take.
  const isAgedTombstone = (j) =>
    j.status === "invalidated" &&
    j.holdUntilRecovered !== true &&
    Number(j.invalidatedAt || 0) > 0 &&
    Date.now() - Number(j.invalidatedAt) > INVALIDATED_HOLD_MS;
  const pending = sessionJournals().some(
    ([, j]) => j.status !== "completed" && !isAgedTombstone(j)
  );
  if (pending) return null;

  const tracks = session.tracks || {};
  const uploaderMeta = tracks.screen?.uploader || tracks.camera?.uploader || null;
  const projectId = uploaderMeta?.projectId || session.projectId || null;
  const sceneId = uploaderMeta?.sceneId || null;
  const mediaFor = (t) =>
    session.recoveredMediaIds?.[t] || tracks[t]?.uploader?.mediaId || null;
  const backends = session.storageBackends || {
    screen: "idb",
    camera: "idb",
    audio: "idb",
  };
  const opfsSessionId = session.opfsSessionId || sessionId;
  const storeFor = (t) =>
    openExistingChunksStore({
      sessionId: opfsSessionId,
      track: t,
      backend: backends[t] || "idb",
    }).store;
  // IDB is one store for every take, so it is only this take's to clear while
  // nothing newer has written to it.
  // video-ready clears the recorder pointer on finish, so fully tagged chunks
  // prove ownership instead; holdsOthers below still refuses a shared store.
  const isLatestSession =
    all.recorderSession?.id === sessionId || session.chunksTagged === true;
  const liveRecording = Boolean(all.recording || all.pendingRecording);
  const mayClear = (t) =>
    (backends[t] || "idb") === "opfs" || (isLatestSession && !liveRecording);
  // IDB is shared with whatever records next, and several awaits sit between
  // the snapshot above and the clear, so re-read right next to the write.
  const mayClearNow = async (t) => {
    if (!mayClear(t)) return false;
    if ((backends[t] || "idb") === "opfs") return true;
    const now = await chrome.storage.local.get([
      "recorderSession",
      "recording",
      "pendingRecording",
    ]);
    return (
      (now.recorderSession?.id === sessionId || session.chunksTagged === true) &&
      !now.recording &&
      !now.pendingRecording
    );
  };

  // A track the take never used keeps its default backend, so reading it would
  // open a store that has nothing to do with this take.
  const used = (t) => {
    const meta = tracks[t];
    if (!meta || meta.hasDurableLocalChunks !== false) return true;
    // Only a current recorder (tagged chunks) says false for a track that never
    // wrote. Released builds flip it after a failed write that followed chunks
    // which landed, so there false proves nothing.
    if (session.chunksTagged !== true || Number(meta.durableChunkCount) > 0) return true;
    if (meta.uploader || meta.hasUploader === true) return true;
    if (sessionJournals().some(([, j]) => trackOfJournal(j) === t)) return true;
    return (backends[t] || "idb") === "opfs";
  };
  const usedTracks = ["screen", "camera", "audio"].filter(used);

  // A discard, or a header-only release, is the proof: nothing below reads a
  // store to decide.
  const header = session.releaseProof === "header-only";
  const proven = discarded || header;

  const localCounts = {};
  for (const t of usedTracks) {
    localCounts[t] = mayClear(t) ? await storeFor(t).length().catch(() => 0) : 0;
  }
  const hadLocalBytes = Object.values(localCounts).some((n) => n > 0);

  const marks = all[`${PURGE_MARKS_PREFIX}${sessionId}`] || {};
  // The bytes of each track that are this take's own: its OPFS dir, or the IDB
  // chunks written by this take. { end } is where the local copy stops.
  const ownBytes = {};
  let unreadable = false;
  if (!proven) {
    for (const t of usedTracks) {
      let entries = [];
      try {
        entries = await summarizeChunks(storeFor(t), TRACK_KEY_PREFIX[t]);
      } catch (err) {
        // Never read an unreadable store as empty: that would clear the take.
        console.warn("[resumeJournal] store unreadable, take left:", err);
        unreadable = true;
        continue;
      }
      const mark = marks[t] || null;
      const firstIndex = mark ? Number(mark.index) + 1 : 0;
      const tail = entries.filter((c) => c.index >= firstIndex);
      if (!tail.length) continue;
      if ((backends[t] || "idb") !== "opfs") {
        const owned = storeHoldsTake(entries, {
          sessionId,
          latestSessionId: all.recorderSession?.id || null,
          mark,
          tagged: session.chunksTagged === true,
        });
        if (!owned) continue;
      }
      ownBytes[t] = {
        end: (mark ? Number(mark.endByte) || 0 : 0) + tail.reduce((n, c) => n + c.size, 0),
      };
    }
  }

  const heldUpdate = async (reason, extra = {}) => {
    const { confirmChecks, ...rest } = session;
    await chrome.storage.local.set({
      [snapKey]: {
        ...rest,
        ...extra,
        holdUntilRecovered: true,
        heldReason: reason,
        heldAt: wasUnconfirmed ? session.heldAt || Date.now() : Date.now(),
      },
    });
    return null;
  };

  let hold = null;
  let waiting = false;
  let transient = false;
  let bunnyStatus = null;
  const agedByTrack = new Map(
    sessionJournals()
      .filter(([, j]) => isAgedTombstone(j))
      .map(([, j]) => [trackOfJournal(j), j])
  );
  const judge = async (t) => {
    const receipts = sessionJournals()
      .map(([, j]) => j)
      .filter((j) => j.status === "completed" && trackOfJournal(j) === t)
      .sort((a, b) => Number(b.finalizedBytes || 0) - Number(a.finalizedBytes || 0));
    const receipt = receipts[0] || null;
    if (!receipt) {
      const tomb = agedByTrack.get(t);
      hold = hold || (tomb ? `invalidated-${tomb.invalidatedReason || "unknown"}` : "no-journal");
      return;
    }
    // Ask about every receipt, not just the largest: a smaller one may be the
    // media the scene names. Only the largest answers for local length.
    for (const r of receipts) {
      const ownEnd =
        r === receipt
          ? ownBytes[t].end
          : Math.min(ownBytes[t].end, Number(r.finalizedBytes) || 0);
      const verdict = await confirmTrack({ receipt: r, ownEnd });
      if (verdict.state === "short") hold = hold || "finalized-short";
      // Nothing to ask Bunny about, so it can never be confirmed from here.
      else if (verdict.state === "no-video") hold = hold || "unconfirmed";
      else if (verdict.state === "rejected") hold = hold || "server-rejected";
      else if (verdict.state === "unfinished") waiting = true;
      else if (verdict.state === "transient") transient = true;
      else if (verdict.bunnyStatus != null) bunnyStatus = verdict.bunnyStatus;
    }
  };
  if (!proven) {
    // A mic with its own uploader (a journal, or the snapshot names one) is judged like any
    // track. Audio muxed into the screen or camera file has none and follows it.
    const audioHasUploader =
      session.tracks?.audio?.hasUploader === true ||
      sessionJournals().some(([, j]) => trackOfJournal(j) === "audio");
    for (const t of ["screen", "camera", "audio"]) {
      if (!ownBytes[t]) continue;
      if (t === "audio" && !audioHasUploader) {
        if (session.separatedAudio === true) continue;
        if (!ownBytes.screen && !ownBytes.camera) hold = hold || "no-journal";
        continue;
      }
      await judge(t);
    }
  }

  if (hold) return heldUpdate(hold);
  // Pending, unreachable and unreadable passes all count, so a take that never confirms ends as
  // a hold. awaiting-confirm counts only "not ready" answers and repeats a silent one. An
  // unreadable store gets its own reason: it is no server answer and must never read as a take
  // Bunny has.
  if (unreadable) return countFailedPass(snapKey, session, { reason: "store-unreadable" });
  if (waiting) return countFailedPass(snapKey, session);
  if (transient) return countFailedPass(snapKey, session, { counted: !isAwaiting });

  // A mic debt outlives the settle: the take stays recoverable until the mic
  // attaches, or runs out of attempts and is held.
  const debts = Object.values(all[MIC_MARKER_KEY] || {}).filter(
    (d) => d?.sessionId === opfsSessionId
  );
  // A mic the take attached before it finished has nothing left to send.
  const separatedMic =
    session.separatedAudio === true &&
    Boolean(ownBytes.audio) &&
    !discarded &&
    session.micAttached !== true;
  if (separatedMic) {
    if (debts.some((d) => Number(d.attempts || 0) >= MIC_MAX_ATTEMPTS)) {
      return heldUpdate("mic-unattached");
    }
    if (!debts.length && session.micQueuedAt) return heldUpdate("mic-unattached");
  }
  let micHeld = debts.length > 0;
  if (!micHeld && separatedMic && projectId && sceneId) {
    // The scan checks the scene first, so a mic the stop path already attached
    // before being cut off is cleared there rather than sent twice.
    await setPendingMicRecovery({
      projectId,
      sceneId,
      duration: null,
      mimeType: session.trackContainers?.audio || "audio/webm",
      sessionId: opfsSessionId,
      backend: backends.audio || "idb",
      targetMediaId: mediaFor("screen") || mediaFor("camera"),
      awaitScene: true,
    });
    micHeld = true;
  }

  // An open editor may still be playing this take from disk. Read fresh: one
  // may have opened while the passes above were running.
  const freshOffer = await chrome.storage.local.get([LOCAL_PLAYBACK_OFFER_KEY]);
  const offer = freshOffer[LOCAL_PLAYBACK_OFFER_KEY];
  const offerHolds =
    offer?.recordingSessionId === sessionId &&
    Number(offer.expiresAt || 0) > Date.now();

  // Another take's unreleased copy may sit in a shared IDB store this take
  // also used. Read fresh: a refused or crashed start may have written since.
  const current = (await chrome.storage.local.get(null)) || {};
  const heldElsewhere = heldIdbTracks(
    current,
    {
      excludeSessionId: sessionId,
      recoverableStatuses: RECOVERABLE_SESSION_STATUSES,
    }
  );
  const ownedElsewhere = async (t) => {
    if ((backends[t] || "idb") === "opfs") return false;
    if (!heldElsewhere.some((h) => h.track === t)) return false;
    const entries = await summarizeChunks(storeFor(t), TRACK_KEY_PREFIX[t]);
    return Boolean(
      idbStoreOwner(entries, t, heldElsewhere, {
        latestSessionId: current.recorderSession?.id || null,
      })
    );
  };

  // A shared IDB store is cleared only when every chunk left in it is this
  // take's. Anything else was written by another take or the local Recorder.
  const holdsOthers = async (t) => {
    if ((backends[t] || "idb") === "opfs") return false;
    const entries = await summarizeChunks(storeFor(t), TRACK_KEY_PREFIX[t]);
    if (!entries.length) return false;
    return !storeHoldsTake(entries, {
      sessionId,
      latestSessionId: current.recorderSession?.id || null,
      tagged: session.chunksTagged === true,
    });
  };

  for (const t of usedTracks) {
    if (t === "audio" && micHeld) continue;
    if (t === "screen" && offerHolds) continue;
    if (!(await mayClearNow(t))) continue;
    try {
      if (await ownedElsewhere(t)) continue;
      if (await holdsOthers(t)) continue;
    } catch (err) {
      // Bytes that cannot be read are never cleared. A discard on OPFS, which
      // is this take's alone, still goes; anything else is looked at again.
      console.warn("[resumeJournal] store unreadable, not cleared:", err);
      if (!proven || (backends[t] || "idb") !== "opfs") {
        if (proven) continue;
        return countFailedPass(snapKey, session, { reason: "store-unreadable" });
      }
    }
    await storeFor(t).clear().catch(() => {});
  }
  if (!micHeld && !offerHolds) {
    // A snapshot naming the folder keeps the orphan reaper off it, so a folder
    // left behind is only removed by this pass: try again on the next one.
    const destroyed = await destroySessionDir(opfsSessionId).catch((err) => ({
      removed: false,
      error: String(err?.message || err),
    }));
    if (destroyed?.removed === false) {
      emit("opfs-destroy-failed", { sessionId, opfsSessionId, error: destroyed.error || null });
      // An unconfirmed hold counts too, or it would come back here forever.
      return countFailedPass(snapKey, session, {
        reason: "opfs-destroy-failed",
        whileHeld: true,
      });
    }
  }

  // What proved the take has done its job: its receipts and tombstones go.
  await dropJournals(sessionJournals().map(([k]) => k));

  // A take that finished normally ends as what it finished as. Anything that
  // had to be recovered ends as one.
  const outcome =
    discarded ||
    !(mediaFor("screen") || mediaFor("camera") || mediaFor("audio"))
      ? "recovery-discarded"
      : isAwaiting
      ? session.awaitingOutcome === "failed"
        ? "failed"
        : "completed"
      : "recovered";
  const now = Date.now();
  // Re-read: a take may have started while the stores were being cleared.
  const fresh = await chrome.storage.local.get([
    "recorderSession",
    "recording",
    "pendingRecording",
    "sceneId",
  ]);
  const {
    holdUntilRecovered: _h,
    heldReason: _r,
    heldAt: _a,
    confirmChecks: _c,
    nextConfirmAt: _n,
    ...settledSession
  } = session;
  // The mic is the one thing left on disk, so the take stays recoverable and
  // the next pass finds it attached, or holds it when it never will be.
  const status = micHeld ? session.status : outcome;
  const updates = {
    [snapKey]: {
      ...settledSession,
      status,
      ...(micHeld
        ? {
            micQueuedAt: session.micQueuedAt || now,
            // Still waiting for the mic: look again later, the video is confirmed.
            ...(isAwaiting
              ? {
                  nextConfirmAt: now + MIC_RECHECK_MS,
                  confirmChecks: Number(session.confirmChecks || 0),
                }
              : {}),
          }
        : isAwaiting
        ? { confirmedAt: now }
        : { recoveredAt: now }),
    },
  };
  if (
    !micHeld &&
    fresh.recorderSession?.id === sessionId &&
    !fresh.recording &&
    !fresh.pendingRecording
  ) {
    updates.recorderSession = {
      ...fresh.recorderSession,
      status: outcome,
      recoveredAt: now,
    };
  }
  if (sceneId && fresh.sceneId === sceneId) updates.sceneIdStatus = "completed";
  await chrome.storage.local.set(updates);
  if (!micHeld) {
    await chrome.storage.local
      .remove([`${PURGE_MARKS_PREFIX}${sessionId}`])
      .catch(() => {});
  }

  // Older builds left snapshots with nothing on disk. Settling them is cleanup,
  // not a recovery, so it isn't reported.
  if (isAwaiting) {
    // The proof that a local copy went only after the server confirmed it.
    if (hadLocalBytes && !discarded && !micHeld) {
      emit("upload_local_confirmed", {
        mediaId: mediaFor("screen") || mediaFor("camera") || mediaFor("audio"),
        projectId,
        sceneId,
        recordingSessionId: sessionId,
        bunnyStatus,
        confirmMs: Math.max(0, now - Number(session.awaitingSince || now)),
        checks: Number(session.confirmChecks || 0) + 1,
      });
    }
  } else if (hadLocalBytes && !session.micQueuedAt) {
    emit("upload_recovery_completed", {
      mediaId: mediaFor("screen") || mediaFor("camera") || mediaFor("audio"),
      projectId,
      sceneId,
      recordingSessionId: sessionId,
      errMsg: [outcome, micHeld ? "mic-pending" : null].filter(Boolean).join(" "),
    });
  }
  return { sessionId, projectId, sceneId, micHeld, outcome };
};

// A journal that names its take's new media goes first, so it can hand over to
// that media's journal before the latter runs. After that, oldest take first,
// so parked takes finish in the order they were recorded.
export const orderJournalsForResume = (journals = []) =>
  journals
    .map((journal, i) => ({ journal, i }))
    .sort((a, b) => {
      const fresh =
        Number(Boolean(b.journal?.freshMediaId)) -
        Number(Boolean(a.journal?.freshMediaId));
      if (fresh) return fresh;
      const ca = Number(a.journal?.createdAt) || Infinity;
      const cb = Number(b.journal?.createdAt) || Infinity;
      if (ca !== cb) return ca < cb ? -1 : 1;
      return a.i - b.i;
    })
    .map((e) => e.journal);

export const resumeAllJournals = async (journals, sessionIds = []) => {
  const { recorderSession } = await chrome.storage.local.get(["recorderSession"]);
  const latestSessionId = recorderSession?.id || null;
  // A long upload outlives the lock TTL, and an expired lock lets the next
  // trigger start a second pass.
  const lockTimer = setInterval(() => {
    chrome.storage.local.set({ resumeLockAt: Date.now() }).catch(() => {});
  }, LOCK_REFRESH_MS);

  try {
    const results = [];
    const ordered = orderJournalsForResume(journals);
    for (const journal of ordered) {
      const base = {
        mediaId: journal.mediaId,
        sessionId: journal.sessionId || null,
        trackType: journal.trackType || journal.type || "screen",
      };
      try {
        const r = await resumeOneJournal(journal, { latestSessionId });
        results.push({ ...base, ...r });
      } catch (err) {
        results.push({
          ...base,
          ok: false,
          error: err?.message || String(err),
        });
      }
    }

    const all = (await chrome.storage.local.get(null)) || {};
    const ids = new Set([
      ...sessionIds,
      ...journals.map((j) => j.sessionId).filter(Boolean),
    ]);
    const recovered = [];
    let retry = false;
    for (const sessionId of ids) {
      try {
        const settled = await settleSession(sessionId, all);
        if (settled?.retry) retry = true;
        else if (settled?.awaiting) continue;
        else if (settled) recovered.push(settled);
      } catch (err) {
        // Failed part way: nothing says the take is safe to clear, so try again.
        console.warn("[resumeJournal] settling session failed:", err);
        const snap = all[`${SESSION_KEY_PREFIX}${sessionId}`];
        if (snap && RECOVERABLE_SESSION_STATUSES.has(snap.status)) {
          const counted = await countFailedPass(
            `${SESSION_KEY_PREFIX}${sessionId}`,
            snap
          ).catch(() => ({ retry: true }));
          if (counted?.retry) retry = true;
        }
      }
    }
    return { results, recovered, retry };
  } finally {
    clearInterval(lockTimer);
  }
};

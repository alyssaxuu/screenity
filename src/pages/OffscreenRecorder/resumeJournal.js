import localforage from "localforage";
import BunnyTusUploader from "../CloudRecorder/bunnyTusUploader";
import { getClientSessionId } from "../CloudRecorder/clientSessionId";
import { TRACK_KEY_PREFIX } from "../CloudRecorder/recorderStorage/chooseChunksStore";
import { openExistingChunksStore } from "../CloudRecorder/recorderStorage/chooseChunksStore";
import { destroySessionDir } from "../CloudRecorder/recorderStorage/opfsKvStore";
import { setPendingMicRecovery } from "../CloudRecorder/micRecovery";

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
const RECOVERABLE_SESSION_STATUSES = new Set([
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
// none of it counts toward the attempt cap.
const isTransient = (err) => {
  if (err?.transient === true) return true;
  if (globalThis.navigator?.onLine === false) return true;
  const status = Number(err?.status) || 0;
  if ([401, 403, 408, 429].includes(status) || status >= 500) return true;
  if (err?.name === "TypeError") return true;
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

// Settle reads the take's media ids from here. A replaced video has a new id
// the snapshot never saw.
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

  const drop = async (reason) => {
    emit("upload_resume_dropped", { ...ctx, errMsg: reason });
    await removeJournal(mediaId);
    await clearAttempts(mediaId);
    return { ok: false, dropped: true, error: reason };
  };

  emit("upload_resume_started", {
    ...ctx,
    offset: journal.offset,
    totalBytes: journal.totalBytes,
  });

  const { backend, opfsSessionId } = await resolveBackendForJournal(journal);
  // IDB is one store for every take. Once a newer take has written to it, the
  // chunks there are not this journal's.
  if (
    backend !== "opfs" &&
    journal.sessionId &&
    journal.sessionId !== latestSessionId
  ) {
    return drop("idb-not-latest");
  }

  const { store } = openExistingChunksStore({
    sessionId: opfsSessionId,
    track,
    backend,
  });
  const chunks = await loadChunksSorted(store, chunkKeyPrefixForTrack(trackType));
  const marksKey = journal.sessionId
    ? `${PURGE_MARKS_PREFIX}${journal.sessionId}`
    : null;
  const marks = marksKey
    ? (await chrome.storage.local.get([marksKey]))?.[marksKey]
    : null;
  const plan = planLocalBytes(chunks, marks?.[track] || null);
  // A host whose finalize failed clears its chunks, while Bunny may still hold
  // every byte. Only the server can say whether that take can still close.
  const noLocalBytes = !plan.tail.length && plan.base === 0;

  // With no mark to place a gap, the bytes after it would land at the wrong
  // offset, which Bunny accepts and plays back as garbage.
  if (!plan.unbroken) return drop("gap-without-mark");

  const initOpts = {
    title: journal.title || `Recording ${mediaId}`,
    type: trackType,
    width: journal.width || null,
    height: journal.height || null,
    sceneId: sceneId || null,
    sessionId: journal.sessionId || null,
  };

  let uploader = makeUploader(trackType);
  let freshMedia = false;

  const fail = async (phase, err) => {
    console.warn(`[resumeJournal] ${phase} failed:`, err);
    // The fresh media carries its own journal, so the replaced one must not
    // come back and mint a third.
    if (freshMedia) await removeJournal(mediaId);
    else await restoreJournal(journal);
    const transient = isTransient(err);
    if (!transient) await bumpAttempts(uploader.mediaId || mediaId);
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
    if (err?.status !== 404) return fail("initialize", err);
    // Purged bytes were confirmed and the server keeps any video holding bytes,
    // so a 404 here means those bytes are gone.
    if (plan.base > 0 || noLocalBytes) return drop("reaped-without-local-bytes");
    // tus-auth 404 with nothing purged: the server removed a video none of the
    // bytes reached, so the whole file goes up as new media in the same scene.
    uploader = makeUploader(trackType);
    try {
      await uploader.initialize(projectId, initOpts);
    } catch (freshErr) {
      return fail("initialize-fresh", freshErr);
    }
    freshMedia = true;
    await noteRecoveredMedia(journal.sessionId, track, uploader.mediaId);
    emit("upload_resume_fresh_media", {
      ...ctx,
      mediaId: uploader.mediaId,
      errMsg: `replaces ${mediaId}`,
    });
  }

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
    // Everything below the mark was on the server before it left disk.
    return drop("server-behind-purge");
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

  await clearAttempts(mediaId);
  emit("upload_resume_completed", {
    ...ctx,
    mediaId: uploader.mediaId,
    finalizedBytes: expectedEnd,
  });
  return { ok: true, mediaId: uploader.mediaId, freshMedia };
};

// How long an invalidated journal keeps holding the local bytes. Matches the
// uploader's own 24h journal staleness window.
const INVALIDATED_HOLD_MS = 24 * 60 * 60 * 1000;

// Every journal of the take has landed or been dropped, so the local copy goes.
// A separated mic is the exception: it was never on TUS and still has to attach.
const settleSession = async (sessionId, all) => {
  const snapKey = `${SESSION_KEY_PREFIX}${sessionId}`;
  const session = all[snapKey];
  if (!session || !RECOVERABLE_SESSION_STATUSES.has(session.status)) return null;
  // An invalidated journal is a tombstone: the resume never concluded, so the
  // local bytes stay. Past 24h it stops holding them, matching journal staleness.
  const pending = Object.entries(all).some(([key, journal]) => {
    if (!key.startsWith(JOURNAL_KEY_PREFIX)) return false;
    if (journal?.sessionId !== sessionId) return false;
    if (journal.status === "completed") return false;
    if (
      journal.status === "invalidated" &&
      Number(journal.invalidatedAt || 0) > 0 &&
      Date.now() - Number(journal.invalidatedAt) > INVALIDATED_HOLD_MS
    ) {
      return false;
    }
    return true;
  });
  if (pending) return null;

  const tracks = session.tracks || {};
  const uploaderMeta = tracks.screen?.uploader || tracks.camera?.uploader || null;
  const projectId = uploaderMeta?.projectId || session.projectId || null;
  const sceneId = uploaderMeta?.sceneId || null;
  const mediaFor = (t) =>
    session.recoveredMediaIds?.[t] || tracks[t]?.uploader?.mediaId || null;
  const discarded = (all.discardedRecordingSessionIds || []).includes(sessionId);
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
  const isLatestSession = all.recorderSession?.id === sessionId;
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
      now.recorderSession?.id === sessionId &&
      !now.recording &&
      !now.pendingRecording
    );
  };

  const localCounts = {};
  for (const t of ["screen", "camera", "audio"]) {
    localCounts[t] = mayClear(t) ? await storeFor(t).length().catch(() => 0) : 0;
  }
  const hadLocalBytes = Object.values(localCounts).some((n) => n > 0);

  const debts = Object.values(all[MIC_MARKER_KEY] || {});
  let micHeld = debts.some((d) => d?.sessionId === opfsSessionId);
  if (
    !micHeld &&
    !discarded &&
    session.separatedAudio === true &&
    backends.audio === "opfs" &&
    localCounts.audio > 0 &&
    projectId &&
    sceneId
  ) {
    // The scan checks the scene first, so a mic the stop path already attached
    // before being cut off is cleared there rather than sent twice.
    await setPendingMicRecovery({
      projectId,
      sceneId,
      duration: null,
      mimeType: session.trackContainers?.audio || "audio/webm",
      sessionId: opfsSessionId,
      backend: "opfs",
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

  for (const t of ["screen", "camera", "audio"]) {
    if (t === "audio" && micHeld) continue;
    if (t === "screen" && offerHolds) continue;
    if (!(await mayClearNow(t))) continue;
    await storeFor(t).clear().catch(() => {});
  }
  if (!micHeld && !offerHolds) {
    await destroySessionDir(opfsSessionId).catch(() => {});
  }

  const outcome =
    discarded ||
    !(mediaFor("screen") || mediaFor("camera") || mediaFor("audio"))
      ? "recovery-discarded"
      : "recovered";
  const now = Date.now();
  // Re-read: a take may have started while the stores were being cleared.
  const fresh = await chrome.storage.local.get([
    "recorderSession",
    "recording",
    "pendingRecording",
    "sceneId",
  ]);
  const updates = {
    [snapKey]: { ...session, status: outcome, recoveredAt: now },
  };
  if (
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
  await chrome.storage.local
    .remove([`${PURGE_MARKS_PREFIX}${sessionId}`])
    .catch(() => {});

  // Older builds left snapshots with nothing on disk. Settling them is cleanup,
  // not a recovery, so it isn't reported.
  if (hadLocalBytes) {
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
    for (const journal of journals) {
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
    for (const sessionId of ids) {
      try {
        const settled = await settleSession(sessionId, all);
        if (settled) recovered.push(settled);
      } catch (err) {
        console.warn("[resumeJournal] settling session failed:", err);
      }
    }
    return { results, recovered };
  } finally {
    clearInterval(lockTimer);
  }
};

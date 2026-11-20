// Retry for a separated mic upload that didn't land. The chunks stay durable
// in `audioChunks`, but that take's voice exists nowhere else, so a lost upload
// loses it. Runs from CloudRecorder after scene creation, and from the
// background on launch if the recorder tab died mid-upload.
import { openExistingChunksStore } from "./recorderStorage/chooseChunksStore";
import {
  uploadMicToStorage,
  attachSceneAudio,
  collectMicChunksFor,
  ownChunkTags,
} from "./uploadMicToStorage";
import { micUploadInFlightTtlMs } from "../utils/recordingLimit";
import { readMicUploadFlags } from "../utils/micUploadFlag";

const API_BASE = process.env.SCREENITY_API_BASE_URL;
const MARKER_KEY = "pendingMicRecovery";
export const MIC_AWAIT_SCENE_ALARM = "mic-recovery-await-scene";
// Same name as CONFIRM_ALARM in resumePendingUploads.js, kept literal so this
// module stays free of the background's imports.
const CONFIRM_ALARM = "confirm-awaiting-takes";
const CONFIRM_AFTER_MIC_MIN = 1;
// A flag left behind by a closed tab can't block the scan forever. The flag
// carries the stop path's budget; 5 min is for an older build's flag, which
// had a flat 120 s budget.
const INLINE_UPLOAD_FRESH_MS = 5 * 60 * 1000;
// Past a week the Bunny signature is useless and the marker is likelier a
// stale profile than a real debt.
const MAX_MARKER_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Each attempt re-POSTs the whole mic file, so failures we can't classify
// still have to stop costing bandwidth.
const MAX_ATTEMPTS = 3;

// Failures a retry can never fix: body too big, shape rejected, scene gone.
// Each retry re-POSTs hundreds of MB per worker wake and orphans a Storage
// object.
const isPermanent = (reason) => {
  const r = String(reason || "");
  if (r === "no-chunks") return true;
  if (r.startsWith("upload-unsupported-mime")) return true;
  if (r === "upload-too-large") return true;
  return /^(upload|attach)-http-(400|404|413|415|422)$/.test(r);
};

// Markers are keyed by sceneId, not one slot: in multi-mode the second take
// erased the first take's unpaid debt, the only pointer to that take's voice.
const MAX_MARKERS = 5;

const readMarkerMap = async () => {
  try {
    const r = await chrome.storage.local.get([MARKER_KEY]);
    const v = r?.[MARKER_KEY];
    if (!v || typeof v !== "object") return {};
    // Old single-object shape, from a build before the map.
    if (v.sceneId && !v[v.sceneId]) return { [v.sceneId]: v };
    return v;
  } catch {
    return {};
  }
};

export const setPendingMicRecovery = async (info) => {
  if (!info?.sceneId) return;
  try {
    const map = await readMarkerMap();
    map[info.sceneId] = { ...info, at: Date.now() };
    // Oldest first: overflow drops the least payable debt, not the newest.
    const keys = Object.keys(map).sort(
      (a, b) => (map[a].at || 0) - (map[b].at || 0)
    );
    while (keys.length > MAX_MARKERS) delete map[keys.shift()];
    await chrome.storage.local.set({ [MARKER_KEY]: map });
  } catch {}
};

// The marker stays keyed on the minted id (the in-flight guard and the stop
// path's clear use it); the scene's real id rides along as effectiveSceneId.
export const setPendingMicRecoveryScene = async (sceneId, effectiveSceneId) => {
  if (!sceneId || !effectiveSceneId) return;
  try {
    const map = await readMarkerMap();
    if (!map[sceneId]) return;
    map[sceneId] = { ...map[sceneId], effectiveSceneId };
    await chrome.storage.local.set({ [MARKER_KEY]: map });
  } catch {}
};

export const clearPendingMicRecovery = async (sceneId = null) => {
  try {
    if (!sceneId) {
      await chrome.storage.local.remove([MARKER_KEY]);
      return;
    }
    const map = await readMarkerMap();
    delete map[sceneId];
    if (Object.keys(map).length === 0) {
      await chrome.storage.local.remove([MARKER_KEY]);
    } else {
      await chrome.storage.local.set({ [MARKER_KEY]: map });
    }
  } catch {}
};

export const listPendingMicRecovery = async () => {
  const map = await readMarkerMap();
  return Object.values(map).sort((a, b) => (a.at || 0) - (b.at || 0));
};

// Any IDB mic debt still unpaid: its chunks sit in the shared store the next
// start would clear, however old the marker is.
export const hasPendingIdbMicDebt = async () =>
  (await listPendingMicRecovery()).some((m) => (m.backend || "idb") === "idb");

// Within this age a running upload may still pay the debt, so Start waits. Past it the take is
// held for the user: an unpaid marker is the only pointer to bytes that exist nowhere else.
const MIC_DEBT_REFUSE_MAX_AGE_MS = 60 * 60 * 1000;
// Mirrors RECOVERABLE_SESSION_STATUSES in localCopyGate.js (this module takes
// no imports): a held snapshot outside these is not offered by the held list.
const LISTED_SNAPSHOT_STATUSES = new Set([
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

// What Start does about unpaid IDB mic debts, decided before it clears the shared audio store:
//   "none"        no debt, clear as usual
//   "progressing" a young debt: refuse, an upload may still pay it
//   "held"        every old debt is a held take the user can Save or Discard
//   "marker-only" an old debt with no listable snapshot: refuse, clear nothing; the held page shows it as "mic-debt"
// Old debts with a listable snapshot are put on hold here, as settle does for an unattached mic.
export const classifyIdbMicDebt = async ({ now = Date.now() } = {}) => {
  const idb = (await listPendingMicRecovery()).filter(
    (m) => (m.backend || "idb") === "idb"
  );
  if (!idb.length) return "none";
  let young = false;
  let markerOnly = false;
  let held = false;
  let all = null;
  for (const m of idb) {
    if (!isMicSuspended(m) && now - (m.at || 0) < MIC_DEBT_REFUSE_MAX_AGE_MS) {
      young = true;
      continue;
    }
    try {
      all = all || (await chrome.storage.local.get(null)) || {};
    } catch {
      markerOnly = true;
      continue;
    }
    const key = m.sessionId
      ? Object.keys(all).find((k) => {
          if (!k.startsWith("cloudRecorderSession:")) return false;
          const snap = all[k];
          return snap?.opfsSessionId === m.sessionId || snap?.id === m.sessionId;
        })
      : null;
    const snap = key ? all[key] : null;
    const openJournal =
      snap &&
      Object.entries(all).some(
        ([k, j]) =>
          k.startsWith("uploadJournal-") &&
          j?.sessionId === snap.id &&
          j.status !== "completed"
      );
    if (
      !snap ||
      snap.discardedAt ||
      (!LISTED_SNAPSHOT_STATUSES.has(snap.status) && !openJournal)
    ) {
      markerOnly = true;
      continue;
    }
    if (snap.holdUntilRecovered !== true) {
      try {
        await chrome.storage.local.set({
          [key]: {
            ...snap,
            holdUntilRecovered: true,
            heldReason: "mic-unattached",
            heldAt: now,
          },
        });
      } catch {
        markerOnly = true;
        continue;
      }
    }
    held = true;
  }
  if (young) return "progressing";
  if (held) return "held";
  return markerOnly ? "marker-only" : "none";
};

export const hasAwaitSceneMarkers = async () =>
  (await listPendingMicRecovery()).some((m) => m.awaitScene);

export const readPendingMicRecovery = async () => {
  try {
    const all = await listPendingMicRecovery();
    return all[0] || null;
  } catch {
    return null;
  }
};

/**
 * Upload the mic chunks and point the scene at them. Idempotent.
 * `attached: false` still counts as ok: the debt is settled and the chunks can
 * go, so only transport failures retry.
 */
export const uploadAndAttachMic = async ({
  store,
  projectId,
  sceneId,
  duration,
  mimeType,
  token,
  // IDB only: the marker's session, so another take's chunks in the shared
  // store are never sent as this debt's voice.
  sessionId = null,
  // Every tag the marker's own chunks may carry (see ownChunkTags).
  sessionIds = null,
  // A media a failed attach left on Storage: attach it again, send nothing.
  reuseMediaId = null,
}) => {
  let foreign = false;
  let mediaId = reuseMediaId;
  if (!mediaId) {
    const found = await collectMicChunksFor(store, sessionIds || sessionId);
    foreign = found.foreign;
    if (!found.chunks.length) {
      return {
        ok: false,
        reason: foreign ? "store-owned-by-other" : "no-chunks",
        foreign,
      };
    }
    const uploaded = await uploadMicToStorage({
      chunks: found.chunks,
      mimeType,
      sceneId,
      projectId,
      duration,
      token,
    });
    if (!uploaded.ok) return { ok: false, reason: `upload-${uploaded.reason}`, foreign };
    mediaId = uploaded.mediaId;
  }

  const attached = await attachSceneAudio({
    projectId,
    sceneId,
    audioMediaId: mediaId,
    duration,
    token,
  });
  if (!attached.ok) {
    // Media is on Storage but unreferenced: the caller keeps its id so the
    // next pass attaches it instead of uploading a second copy.
    return {
      ok: false,
      reason: `attach-${attached.reason}`,
      mediaId,
      foreign,
    };
  }
  return { ok: true, mediaId, attached: attached.attached, foreign };
};

// The scene POST had no mic media to name as transcription source yet. Fire
// and forget: captions can be regenerated, the attached voice can't.
const queueTranscription = async ({
  projectId,
  sceneId,
  audioMediaId,
  targetMediaId,
  token,
}) => {
  if (!API_BASE || !token || !targetMediaId || !audioMediaId) return;
  try {
    await fetch(`${API_BASE}/transcription/queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
      body: JSON.stringify({
        output: `transcriptions/${audioMediaId}.json`,
        videoId: projectId,
        sceneId,
        inputMediaId: audioMediaId,
        targetMediaId,
        model: "tiny",
      }),
    });
  } catch {}
};

// Attempt count only. setPendingMicRecovery would restamp `at`, half the
// pass key, so a burnt attempt would read as a new debt.
const bumpAttempts = async (marker) => {
  try {
    const map = await readMarkerMap();
    if (!map[marker.sceneId]) return;
    map[marker.sceneId] = {
      ...map[marker.sceneId],
      attempts: (marker.attempts || 0) + 1,
    };
    await chrome.storage.local.set({ [MARKER_KEY]: map });
  } catch {}
};

// Whether a failed pass got an answer from the server about this mic. Only an
// answer burns an attempt; a thrown fetch, 408, 429, 5xx or an offline machine
// says nothing about the mic and must not run the cap down.
const SERVER_ANSWERS = new Set([
  "no-chunks",
  "upload-no-media-id",
  "upload-empty-blob",
  "upload-too-large",
  "attach-already-set",
  "attach-scene-missing",
  "attach-not-separated-audio",
]);
const wasAnswered = (reason) => {
  const r = String(reason || "");
  if (SERVER_ANSWERS.has(r) || r.startsWith("upload-unsupported-mime")) return true;
  const m = /^(?:upload|attach)-http-(\d+)$/.exec(r);
  if (!m) return false;
  const status = Number(m[1]);
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
};

// The server answered but is failing (5xx), or a media sits on Storage that no scene points at.
// Not the mic's fault, so no attempt is burned, but each pass re-sends up to 300 MB: back off
// exponentially to a cap, where the marker stays (held page lists it) and the scan sends nothing.
export const MIC_SERVER_FAIL_CAP = 8;
const SERVER_BACKOFF_BASE_MS = 5 * 60 * 1000;
const SERVER_BACKOFF_MAX_MS = 6 * 60 * 60 * 1000;
export const micBackoffMs = (fails) =>
  Math.min(SERVER_BACKOFF_MAX_MS, SERVER_BACKOFF_BASE_MS * 2 ** Math.max(0, fails - 1));
export const isMicSuspended = (m) => (m?.serverFails || 0) >= MIC_SERVER_FAIL_CAP;
const isServerFailure = (reason) => /^(?:upload|attach)-http-5\d\d$/.test(String(reason || ""));

const recordServerFailure = async (marker, result) => {
  try {
    const map = await readMarkerMap();
    if (!map[marker.sceneId]) return;
    const fails = (map[marker.sceneId].serverFails || 0) + 1;
    map[marker.sceneId] = {
      ...map[marker.sceneId],
      attempts: marker.attempts || 0,
      serverFails: fails,
      nextTryAt: Date.now() + micBackoffMs(fails),
      ...(result?.mediaId ? { uploadedMediaId: result.mediaId } : {}),
    };
    await chrome.storage.local.set({ [MARKER_KEY]: map });
  } catch {}
};

const restoreAttempts = async (marker, result = null) => {
  try {
    const map = await readMarkerMap();
    if (!map[marker.sceneId]) return;
    map[marker.sceneId] = {
      ...map[marker.sceneId],
      attempts: marker.attempts || 0,
      ...(result?.mediaId ? { uploadedMediaId: result.mediaId } : {}),
    };
    await chrome.storage.local.set({ [MARKER_KEY]: map });
  } catch {}
};

// An answered refusal of a reused media: it is gone or not attachable, so the
// next pass uploads afresh.
const dropUploadedMedia = async (marker) => {
  try {
    const map = await readMarkerMap();
    if (!map[marker.sceneId]?.uploadedMediaId) return;
    const { uploadedMediaId, ...rest } = map[marker.sceneId];
    map[marker.sceneId] = rest;
    await chrome.storage.local.set({ [MARKER_KEY]: map });
  } catch {}
};

// Every scene of the project, or null when the server could not be asked.
export const fetchScenes = async ({ projectId }, token) => {
  if (!API_BASE || !token || !projectId) return null;
  try {
    // Uncached, or a "not yet" answer sticks for a minute.
    const res = await fetch(`${API_BASE}/videos/${projectId}/?refresh=true`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    return body?.video?.data?.scenes || null;
  } catch {
    return null;
  }
};

const fetchScene = async ({ projectId, sceneId }, token) => {
  if (!sceneId) return null;
  const scenes = await fetchScenes({ projectId }, token);
  return scenes?.[sceneId] || null;
};

// Keyed on the marker: one pass at a time per debt. Later passes run again.
const _inFlight = new Set();

const recoverOne = async (marker, opts) => {
  const key = `${marker.sceneId}:${marker.at}`;
  // Guards a concurrent pass only: a later alarm or launch pass retries,
  // bounded by MAX_ATTEMPTS.
  if (_inFlight.has(key)) return { ran: false, reason: "already-ran" };
  _inFlight.add(key);
  try {
    return await recoverOneInner(marker, opts);
  } finally {
    _inFlight.delete(key);
  }
};

const recoverOneInner = async (marker, { logger, token }) => {
  const key = `${marker.sceneId}:${marker.at}`;
  const targetSceneId = marker.effectiveSceneId || marker.sceneId;
  if (Date.now() - (marker.at || 0) > MAX_MARKER_AGE_MS) {
    await clearPendingMicRecovery(marker.sceneId);
    return { ran: false, reason: "stale-marker" };
  }

  // Audio goes to OPFS wherever it's supported, so opening IDB blindly finds
  // an empty store and reads it as nothing to recover.
  if (!marker.backend || (marker.backend === "opfs" && !marker.sessionId)) {
    await clearPendingMicRecovery(marker.sceneId);
    return { ran: false, reason: "marker-missing-backend" };
  }

  if ((marker.attempts || 0) >= MAX_ATTEMPTS) {
    await clearPendingMicRecovery(marker.sceneId);
    logger.warn?.("[micRecovery] giving up after repeated failures", { key });
    return { ran: false, reason: "attempts-exhausted" };
  }

  let store;
  try {
    ({ store } = openExistingChunksStore({
      sessionId: marker.sessionId,
      track: "audio",
      backend: marker.backend,
    }));
  } catch {
    return { ran: false, reason: "store-open-failed" };
  }

  // Crash recovery writes this marker before the scene exists, and attaching to
  // a missing scene reads as settled and clears the voice.
  if (marker.awaitScene) {
    const scene = await fetchScene(
      { projectId: marker.projectId, sceneId: targetSceneId },
      token
    );
    if (!scene) return { ran: false, reason: "scene-not-ready" };
    // The stop path attached it and was only cut off before cleaning up.
    // Sending it again would orphan a second copy on Storage.
    if (scene.audioSourceMediaId) {
      await clearPendingMicRecovery(marker.sceneId);
      const live = await chrome.storage.local.get(["recording", "pendingRecording"]);
      if (!live.recording && !live.pendingRecording) {
        await store.clear().catch(() => {});
      }
      return { ran: false, reason: "already-attached" };
    }
  }

  // Counted before the attempt, so a crash mid-upload still burns one.
  await bumpAttempts(marker);

  const result = await uploadAndAttachMic({
    store,
    projectId: marker.projectId,
    sceneId: targetSceneId,
    duration: marker.duration,
    mimeType: marker.mimeType || "audio/webm",
    token,
    sessionId: marker.backend === "idb" ? marker.sessionId || null : null,
    sessionIds:
      marker.backend === "idb"
        ? ownChunkTags(marker, (await chrome.storage.local.get(null)) || {})
        : null,
    reuseMediaId: marker.uploadedMediaId || null,
  });

  if (result.ok) {
    await clearPendingMicRecovery(marker.sceneId);
    await queueTranscription({
      projectId: marker.projectId,
      sceneId: targetSceneId,
      audioMediaId: result.mediaId,
      targetMediaId: marker.targetMediaId,
      token,
    });
    // Re-checked even on the start path: the upload can outlast the start's
    // 15 s budget, and on IDB this is the same shared store the take that
    // started since is writing its only copy of the voice into.
    const live = await chrome.storage.local.get(["recording", "pendingRecording"]);
    if (!live.recording && !live.pendingRecording && !result.foreign) {
      await store.clear().catch(() => {});
    }
    await nudgeConfirmAfterMic(marker.sessionId);
    logger.info?.("[micRecovery] recovered separated mic", {
      sceneId: marker.sceneId,
      attached: result.attached,
    });
    return { ran: true, ok: true, attached: result.attached };
  }

  if (isPermanent(result.reason)) await clearPendingMicRecovery(marker.sceneId);
  // The bump before the attempt stays only for a crash; a failure with no
  // answer from the server gives it back.
  else if (isServerFailure(result.reason)) await recordServerFailure(marker, result);
  else if (!wasAnswered(result.reason)) await restoreAttempts(marker, result);
  else if (marker.uploadedMediaId && String(result.reason).startsWith("attach-")) {
    await dropUploadedMedia(marker);
  }
  // Reason inline; in the object it arrives collapsed.
  logger.warn?.(`[micRecovery] recovery pass failed: ${result.reason}`, {
    sceneId: marker.sceneId,
    backend: marker.backend,
    ...result,
  });
  return { ran: true, ok: false, reason: result.reason };
};

// The mic is on the scene, so the take's confirm check need not wait for its 1/2/5 min slot.
// Nothing is cleared here: settle needs the same proof as ever.
const nudgeConfirmAfterMic = async (sessionId) => {
  if (!sessionId) return;
  try {
    const all = (await chrome.storage.local.get(null)) || {};
    const updates = {};
    for (const [key, snap] of Object.entries(all)) {
      if (!key.startsWith("cloudRecorderSession:")) continue;
      if (snap?.opfsSessionId !== sessionId) continue;
      updates[key] = { ...snap, micAttached: true, nextConfirmAt: Date.now() };
    }
    if (!Object.keys(updates).length) return;
    await chrome.storage.local.set(updates);
    await chrome.alarms?.create?.(CONFIRM_ALARM, {
      delayInMinutes: CONFIRM_AFTER_MIC_MIN,
    });
  } catch {}
};

/**
 * Pass over every unpaid debt, oldest first. Runs at BG launch and again before
 * the start path clears the shared audio store. Serial, since each attempt
 * POSTs a whole mic file.
 */
export const runMicRecoveryScan = async ({
  logger = console,
  // Set by the start path, which is about to clear the shared IDB store the
  // debt lives in. Elsewhere the guard stands: uploading during a live take
  // would clear that take's only durable copy of the voice.
  ignoreLiveRecording = false,
  backend = null,
} = {}) => {
  // Called at MV3 worker top level, so it re-runs on every wake, constantly
  // during a recording; uploading then clearing would take the live take's
  // durable backup with it. Only a pass that reaches the chunks burns the
  // one-shot, so the early returns below must not block a later wake.
  const all = await listPendingMicRecovery();
  // The stop path writes its marker before its own inline upload, so scanning
  // that marker then would send the same mic twice.
  const inFlightScenes = new Set(
    Object.values(await readMicUploadFlags())
      .filter(
        (flag) =>
          flag?.sceneId &&
          Date.now() - (flag.at || 0) <
            micUploadInFlightTtlMs(flag, INLINE_UPLOAD_FRESH_MS)
      )
      .map((flag) => flag.sceneId)
  );
  const markers = (
    backend ? all.filter((m) => (m.backend || "idb") === backend) : all
  )
    .filter((m) => !inFlightScenes.has(m.sceneId))
    // Backing off after server failures, or suspended at the cap: the marker
    // stays for the user, nothing is sent for it.
    .filter((m) => !isMicSuspended(m) && !(m.nextTryAt > Date.now()));
  if (!markers.length) return { ran: false, reason: "no-marker" };

  if (!ignoreLiveRecording) {
    const { recording, pendingRecording } = await chrome.storage.local.get([
      "recording",
      "pendingRecording",
    ]);
    if (recording || pendingRecording) {
      return { ran: false, reason: "recording-in-progress" };
    }
  }

  const { screenityToken } = await chrome.storage.local.get(["screenityToken"]);
  if (!screenityToken) return { ran: false, reason: "no-token" };

  const results = [];
  for (const marker of markers) {
    results.push(
      await recoverOne(marker, {
        logger,
        token: screenityToken,
      })
    );
  }

  const ran = results.filter((r) => r.ran);
  if (!ran.length) return { ran: false, reason: results[0]?.reason, results };
  return {
    ran: true,
    ok: ran.every((r) => r.ok),
    reason: ran.find((r) => !r.ok)?.reason,
    results,
  };
};

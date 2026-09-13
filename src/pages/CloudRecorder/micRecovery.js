// Retry for a separated mic upload that didn't land. The chunks stay durable
// in `audioChunks`, but that take's voice exists nowhere else, so a lost upload
// loses it. Runs from CloudRecorder after scene creation, and from the
// background on launch if the recorder tab died mid-upload.
import { openExistingChunksStore } from "./recorderStorage/chooseChunksStore";
import {
  uploadMicToStorage,
  attachSceneAudio,
  collectMicChunks,
} from "./uploadMicToStorage";

const API_BASE = process.env.SCREENITY_API_BASE_URL;
const MARKER_KEY = "pendingMicRecovery";
export const MIC_AWAIT_SCENE_ALARM = "mic-recovery-await-scene";
// Longer than the stop path's 120s inline budget plus margin, so a flag left
// behind by a closed tab can't block the scan forever.
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
}) => {
  const chunks = await collectMicChunks(store);
  if (!chunks.length) return { ok: false, reason: "no-chunks" };

  const uploaded = await uploadMicToStorage({
    chunks,
    mimeType,
    sceneId,
    projectId,
    duration,
    token,
  });
  if (!uploaded.ok) return { ok: false, reason: `upload-${uploaded.reason}` };

  const attached = await attachSceneAudio({
    projectId,
    sceneId,
    audioMediaId: uploaded.mediaId,
    duration,
    token,
  });
  if (!attached.ok) {
    // Media is on Storage but unreferenced. Retrying costs a duplicate, not
    // the voice.
    return {
      ok: false,
      reason: `attach-${attached.reason}`,
      mediaId: uploaded.mediaId,
    };
  }
  return { ok: true, mediaId: uploaded.mediaId, attached: attached.attached };
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
        lang: "en",
        model: "tiny",
      }),
    });
  } catch {}
};

// Attempt count only. setPendingMicRecovery would restamp `at`, half the
// one-shot key, so a burnt attempt would read as a new debt.
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

const fetchScene = async ({ projectId, sceneId }, token) => {
  if (!API_BASE || !token || !projectId || !sceneId) return null;
  try {
    // Uncached, or a "not yet" answer sticks for a minute.
    const res = await fetch(`${API_BASE}/videos/${projectId}/?refresh=true`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    return body?.video?.data?.scenes?.[sceneId] || null;
  } catch {
    return null;
  }
};

// Keyed on the marker, not a bare "ever": a worker outlives several recordings
// and a new debt deserves a fresh attempt.
const _attempted = new Set();

const recoverOne = async (marker, { logger, token, ignoreLiveRecording }) => {
  const key = `${marker.sceneId}:${marker.at}`;
  if (_attempted.has(key)) return { ran: false, reason: "already-ran" };

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
    const scene = await fetchScene(marker, token);
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

  _attempted.add(key);
  // Counted before the attempt, so a crash mid-upload still burns one.
  await bumpAttempts(marker);

  const result = await uploadAndAttachMic({
    store,
    projectId: marker.projectId,
    sceneId: marker.sceneId,
    duration: marker.duration,
    mimeType: marker.mimeType || "audio/webm",
    token,
  });

  if (result.ok) {
    await clearPendingMicRecovery(marker.sceneId);
    await queueTranscription({
      projectId: marker.projectId,
      sceneId: marker.sceneId,
      audioMediaId: result.mediaId,
      targetMediaId: marker.targetMediaId,
      token,
    });
    // Re-checked: the guard above ran before an upload that can take minutes,
    // and on IDB this is the same shared store a take started since is writing
    // its only copy of the voice into.
    const live = ignoreLiveRecording
      ? {}
      : await chrome.storage.local.get(["recording", "pendingRecording"]);
    if (!live.recording && !live.pendingRecording) {
      await store.clear().catch(() => {});
    }
    logger.info?.("[micRecovery] recovered separated mic", {
      sceneId: marker.sceneId,
      attached: result.attached,
    });
    return { ran: true, ok: true, attached: result.attached };
  }

  if (isPermanent(result.reason)) await clearPendingMicRecovery(marker.sceneId);
  // Reason inline; in the object it arrives collapsed.
  logger.warn?.(`[micRecovery] recovery pass failed: ${result.reason}`, {
    sceneId: marker.sceneId,
    backend: marker.backend,
    ...result,
  });
  return { ran: true, ok: false, reason: result.reason };
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
  const { micUploadInFlight } = await chrome.storage.local.get([
    "micUploadInFlight",
  ]);
  const inFlightScene =
    micUploadInFlight &&
    Date.now() - (micUploadInFlight.at || 0) < INLINE_UPLOAD_FRESH_MS
      ? micUploadInFlight.sceneId
      : null;
  const markers = (
    backend ? all.filter((m) => (m.backend || "idb") === backend) : all
  ).filter((m) => !inFlightScene || m.sceneId !== inFlightScene);
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
        ignoreLiveRecording,
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

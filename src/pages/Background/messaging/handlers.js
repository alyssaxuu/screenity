import JSZip from "jszip";
import { registerMessage } from "../../../messaging/messageRouter";
import { appendUploadTelemetryEventSerialized } from "../utils/serializedTelemetryStore";
import { perfMark, perfSpan } from "../../utils/perfMarks";
import {
  focusTab,
  createTab,
  resetActiveTab,
  resetActiveTabRestart,
  setSurface,
} from "../tabManagement";

import { startAfterCountdown, startRecording } from "../recording/startRecording";
import { noteCountdownStarted } from "../recording/countdownFallback";
import {
  handleStopRecordingTab,
  clearInMemoryEditorLock,
} from "../recording/stopRecording";
import { chunksStore } from "../recording/chunkHandler";
import { openExistingChunksStore } from "../../CloudRecorder/recorderStorage/chooseChunksStore";
import { destroySessionDir } from "../../CloudRecorder/recorderStorage/opfsKvStore";
import { handleSaveToDrive } from "../drive/handleSaveToDrive";
import { addAlarmListener } from "../alarms/addAlarmListener";
import { cancelRecording, handleDismiss } from "../recording/cancelRecording";
import { handleDismissRecordingTab } from "../recording/discardRecording";
import { sendMessageRecord } from "../recording/sendMessageRecord";
import { acquireStreamForOffscreen } from "../offscreen/acquireStream";
import { registerProxyStorageHandlers } from "../offscreen/proxyStorageHandlers";
import { ensureRemuxOffscreen } from "../offscreen/ensureRemuxOffscreen";
import { forceProcessing } from "../recording/forceProcessing";
import {
  restartActiveTab,
  getCurrentTab,
  sendMessageTab,
  parseEditorTargetUrl,
  resolveEditorTabForTarget,
  getValidatedEditorTab,
  setEditorTabReference,
} from "../tabManagement";
import {
  handleRestart,
} from "../recording/restartRecording";
import { checkRecording } from "../recording/checkRecording";
import {
  isPinned,
  getPlatformInfo,
  resizeWindow,
  checkAvailableMemory,
} from "../utils/browserHelpers";
import { requestDownload, downloadIndexedDB } from "../utils/downloadHelpers";
import { restoreRecording, checkRestore } from "../recording/restoreRecording";
import {
  checkCloudRestore,
  restoreCloudRecording,
} from "../recording/restoreCloudRecording";
import {
  CLOUD_LOCAL_PLAYBACK_KEY,
  CLOUD_LOCAL_PLAYBACK_EVENT_KEY,
  CLOUD_LOCAL_PLAYBACK_ALARM,
} from "../recording/cloudLocalPlaybackConstants";
import { FIRST_CHUNK_WATCHDOG_ALARM, RECORDER_KEEPALIVE_ALARM } from "../alarms/alarmConstants";
import { desktopCapture } from "../recording/desktopCapture";
import {
  videoReady,
  handleGetStreamingData,
  handleRecordingError,
  handleRecordingComplete,
  handleOnGetPermissions,
  handlePip,
  checkCapturePermissions,
} from "../recording/recordingHelpers";
import { clearAllRecordings } from "../recording/chunkHandler";
import { setMicActiveTab } from "../tabManagement/tabHelpers";
import { handleSignOutDrive } from "../drive/handleSignOutDrive";
import { loginWithWebsite } from "../auth/loginWithWebsite";
import {
  getDiagnosticLog,
  getErrorSnapshot,
  getStorageFlags,
  diagEvent,
} from "../../utils/diagnosticLog";
import { supportContextQuery } from "../../utils/buildSupportContext";

const API_BASE = process.env.SCREENITY_API_BASE_URL;
const APP_BASE = process.env.SCREENITY_APP_BASE;

// Flip a project to isPublic:true after recording finishes. v2 removed
// the publish system, so isPublic is the only access gate; without
// this PATCH the share URL we copy to clipboard would 404 for viewers.
// Fire-and-forget; clipboard/toast UX is identical on success or failure.
const markProjectPublic = async (projectId) => {
  if (!projectId || !API_BASE) return;
  try {
    const { screenityToken } = await chrome.storage.local.get("screenityToken");
    if (!screenityToken) return;
    await fetch(`${API_BASE}/videos/${projectId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${screenityToken}`,
      },
      body: JSON.stringify({ isPublic: true }),
    });
  } catch (err) {
    console.warn("markProjectPublic failed:", err?.message || err);
  }
};
const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";
const DEBUG_POSTSTOP = false;
// Gate for the start-flow / stop-flow / offscreen-diag console mirrors.
// Off in prod by default; set globalThis.SCREENITY_DEBUG_RECORDER for support.
const DEBUG_FLOW =
  process.env.NODE_ENV !== "production" ||
  (typeof globalThis !== "undefined" && !!globalThis.SCREENITY_DEBUG_RECORDER);
const DAY_MS = 86400000;

// Gating for the editor review prompt: only ask established users right after
// a smooth recording, stay quiet otherwise.
const REVIEW_GATE = {
  minInstallDays: 7, // installed at least this long (never reset by updates)
  minSuccessfulRecordingsNew: 2, // fresh installs: a small track record
  minSuccessfulRecordingsExisting: 1, // backfilled/existing users: one clean one
  recentFailureWindowDays: 7, // backstop; failure keys also reset each attempt
  reshowCooldownDays: [1, 7], // escalating gap (days) after the 1st, 2nd reveal
  maxShows: 3, // stop asking after this many un-acted reveals
  snoozeDays: 120, // "maybe later" pushes it out this far
};

// Whether the user is eligible for the review prompt (the editor adds a final
// "used the result" gate). Any uncertain signal returns false; the failure keys
// below reset each attempt, so only the most recent recording counts.
const shouldShowReviewPrompt = async () => {
  try {
    const s = await chrome.storage.local.get([
      "reviewPromptState",
      "extensionInstalledAt",
      "successfulRecordingCount",
      "startFlowTrace",
      "lastRecordingError",
      "editorRecordingError",
      "lastChunkSendFailure",
      "cloudRecorderDegradedMode",
      "lastRecordingSalvaged",
    ]);
    const state = s.reviewPromptState || {};
    const now = Date.now();

    // Already reviewed, opted out, or routed to feedback: never ask again.
    if (state.done) return false;
    // Snoozed after a "maybe later".
    if (state.snoozedUntil && now < state.snoozedUntil) return false;
    // Stop asking after maxShows un-acted reveals, widening the gap each time
    // (24h, then 7d), so a user who ignores it isn't asked repeatedly.
    const shownCount = state.shownCount || 0;
    if (shownCount >= REVIEW_GATE.maxShows) return false;
    if (state.lastShownAt) {
      const cooldownDays =
        REVIEW_GATE.reshowCooldownDays[
          Math.min(shownCount, REVIEW_GATE.reshowCooldownDays.length) - 1
        ] || 0;
      if (now - state.lastShownAt < cooldownDays * DAY_MS) return false;
    }

    // Established install. Existing users were backfilled to 0 so they pass
    // immediately; updates never reset this.
    const installedAt =
      typeof s.extensionInstalledAt === "number" ? s.extensionInstalledAt : now;
    const isExisting = installedAt === 0;
    if (now - installedAt < REVIEW_GATE.minInstallDays * DAY_MS) return false;

    // Track record. Install age already proves an existing user isn't a
    // newcomer, so they only need one clean recording; fresh installs need a
    // couple.
    const minRecordings = isExisting
      ? REVIEW_GATE.minSuccessfulRecordingsExisting
      : REVIEW_GATE.minSuccessfulRecordingsNew;
    if ((s.successfulRecordingCount || 0) < minRecordings) return false;

    // The last recording must not have explicitly failed. Region/other types
    // leave outcome "in-progress" (only tab/desktop set "ok"), so block on known
    // FAILURE outcomes rather than requiring "ok".
    const FAILURE_OUTCOMES = ["error", "stuck", "cancelled"];
    if (s.startFlowTrace && FAILURE_OUTCOMES.includes(s.startFlowTrace.outcome))
      return false;

    // No hard failure or degraded-output marker on the most recent recording.
    // (cloudRecorderDegradedMode stamps `.at`, the error keys stamp `.ts`.)
    const win = REVIEW_GATE.recentFailureWindowDays * DAY_MS;
    const recent = (e) => {
      if (!e) return false;
      const ts = typeof e.ts === "number" ? e.ts : e.at;
      return typeof ts === "number" && now - ts < win;
    };
    if (
      recent(s.lastRecordingError) ||
      recent(s.editorRecordingError) ||
      recent(s.lastChunkSendFailure) ||
      recent(s.cloudRecorderDegradedMode) ||
      recent(s.lastRecordingSalvaged)
    )
      return false;

    return true;
  } catch {
    return false;
  }
};

const STOP_RECORDING_TAB_DEBOUNCE_MS = 1200;
const CLOUD_LOCAL_PLAYBACK_MAX_BYTES = 250 * 1024 * 1024;
const CLOUD_LOCAL_PLAYBACK_MAX_CHUNKS = 4000;
const CLOUD_LOCAL_PLAYBACK_MIN_TTL_MS = 60 * 1000;
const CLOUD_LOCAL_PLAYBACK_MAX_TTL_MS = 24 * 60 * 60 * 1000;
let stopRecordingTabInFlight = false;
let stopRecordingTabLastAt = 0;

const getEditorTargetUrl = ({ projectId, instantMode = false } = {}) => {
  if (!projectId) return null;
  if (instantMode) {
    return `${APP_BASE}/view/${projectId}?load=true`;
  }
  return `${APP_BASE}/editor/${projectId}/edit?load=true`;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeLocalPlaybackOffer = (offer = {}) => {
  const now = Date.now();
  const expiresAtRaw = Number(offer.expiresAt) || 0;
  const ttl =
    expiresAtRaw > now
      ? clamp(
          expiresAtRaw - now,
          CLOUD_LOCAL_PLAYBACK_MIN_TTL_MS,
          CLOUD_LOCAL_PLAYBACK_MAX_TTL_MS,
        )
      : CLOUD_LOCAL_PLAYBACK_MIN_TTL_MS;
  const expiresAt = now + ttl;
  const chunkCount = Math.max(
    0,
    Math.min(CLOUD_LOCAL_PLAYBACK_MAX_CHUNKS, Number(offer.chunkCount) || 0),
  );
  const estimatedBytes = Math.max(0, Number(offer.estimatedBytes) || 0);
  const createdAt = Number(offer.createdAt) || now;

  // storageBackend / opfsSessionId let the read-chunk + clear handlers route
  // to the same backend the writer used. Older offers without these fields
  // default to IDB to match pre-OPFS behaviour.
  const storageBackend =
    offer.storageBackend === "opfs" ? "opfs" : "idb";
  const opfsSessionId =
    storageBackend === "opfs" && offer.opfsSessionId
      ? String(offer.opfsSessionId)
      : null;
  // Container is the mimeType the editor's <video> should use. Defaults
  // to webm for back-compat; WebCodecs sessions overwrite to video/mp4.
  const container =
    offer.container === "video/mp4" ? "video/mp4" : "video/webm";
  const encoderKind =
    offer.encoderKind === "webcodecs" ? "webcodecs" : "mediarecorder";

  return {
    offerId: offer.offerId || crypto.randomUUID(),
    projectId: offer.projectId || null,
    sceneId: offer.sceneId || null,
    recordingSessionId: offer.recordingSessionId || null,
    trackType: "screen",
    source: offer.source || "indexeddb-screen-chunks",
    status: offer.status || "available",
    chunkCount,
    estimatedBytes,
    mediaId: offer.mediaId || null,
    bunnyVideoId: offer.bunnyVideoId || null,
    storageBackend,
    opfsSessionId,
    container,
    encoderKind,
    createdAt,
    expiresAt,
    updatedAt: now,
  };
};

const offerScreenStore = (offer) => {
  if (offer?.storageBackend === "opfs" && offer.opfsSessionId) {
    return openExistingChunksStore({
      sessionId: offer.opfsSessionId,
      track: "screen",
      backend: "opfs",
    }).store;
  }
  // Pre-migration default: cloud screen track was a localforage instance
  // sharing the regular Recorder's IDB DB / "chunks" store name. The
  // imported chunksStore matches that exactly.
  return chunksStore;
};

const isLocalPlaybackOfferExpired = (offer) =>
  !offer || Number(offer.expiresAt || 0) <= Date.now();

const scheduleLocalPlaybackAlarm = async (offer) => {
  if (!offer?.expiresAt || !chrome.alarms?.create) return;
  try {
    await chrome.alarms.clear(CLOUD_LOCAL_PLAYBACK_ALARM);
    await chrome.alarms.create(CLOUD_LOCAL_PLAYBACK_ALARM, {
      when: Number(offer.expiresAt),
    });
  } catch (err) {
    console.warn("[Screenity][BG] Failed to schedule local playback alarm", err);
  }
};

const getStoredLocalPlaybackOffer = async () => {
  const result = await chrome.storage.local.get([CLOUD_LOCAL_PLAYBACK_KEY]);
  return result?.[CLOUD_LOCAL_PLAYBACK_KEY] || null;
};

const clearStoredLocalPlaybackOffer = async ({
  reason = "unknown",
  clearChunks = true,
  onlyIfOfferId = null,
} = {}) => {
  const existing = await getStoredLocalPlaybackOffer();
  if (onlyIfOfferId && existing?.offerId && existing.offerId !== onlyIfOfferId) {
    return { ok: true, skipped: true, reason: "offer-id-mismatch" };
  }

  await chrome.storage.local.remove([CLOUD_LOCAL_PLAYBACK_KEY]);
  if (chrome.alarms?.clear) {
    await chrome.alarms.clear(CLOUD_LOCAL_PLAYBACK_ALARM).catch(() => {});
  }

  if (clearChunks) {
    const targetStore = offerScreenStore(existing);
    await targetStore.clear().catch((err) => {
      console.warn(
        "[Screenity][BG] Failed to clear screen chunks while clearing local playback offer",
        err,
      );
    });
    if (
      existing?.storageBackend === "opfs" &&
      existing?.opfsSessionId
    ) {
      await destroySessionDir(existing.opfsSessionId).catch(() => {});
    }
  }

  await chrome.storage.local.set({
    [CLOUD_LOCAL_PLAYBACK_EVENT_KEY]: {
      event: "offer-cleared",
      reason,
      clearedAt: Date.now(),
      clearedOfferId: existing?.offerId || null,
      clearChunks: Boolean(clearChunks),
    },
  });

  if (existing?.offerId) {
    console.info("[Screenity][BG] Cleared local screen playback offer", {
      reason,
      offerId: existing.offerId,
      clearChunks: Boolean(clearChunks),
    });
  }

  return { ok: true, clearedOfferId: existing?.offerId || null };
};

const getValidLocalPlaybackOffer = async ({
  offerId = null,
  projectId = null,
  sceneId = null,
} = {}) => {
  const offer = await getStoredLocalPlaybackOffer();
  if (!offer) return null;

  if (isLocalPlaybackOfferExpired(offer)) {
    await clearStoredLocalPlaybackOffer({
      reason: "offer-expired",
      clearChunks: true,
      onlyIfOfferId: offer.offerId || null,
    });
    return null;
  }

  if (offerId && offer.offerId !== offerId) return null;
  if (projectId && offer.projectId !== projectId) return null;
  if (sceneId && offer.sceneId && offer.sceneId !== sceneId) return null;
  if (offer.trackType !== "screen") return null;
  if (!offer.chunkCount || !offer.estimatedBytes) return null;

  return offer;
};

const logStopRecordingTabEvent = (message, sender) => {
  try {
    const reason = message?.reason || "unknown";
    const senderTabId = message?.tabId || sender?.tab?.id || null;
    const senderUrl = sender?.url || null;
    const stack = new Error().stack;
    console.warn("[Screenity][BG] stop-recording-tab received", {
      reason,
      senderTabId,
      senderUrl,
    });
    chrome.storage.local.set({
      lastStopRecordingEvent: {
        reason,
        senderTabId,
        senderUrl,
        stack,
        ts: Date.now(),
      },
    });
  } catch (err) {
    console.warn("[Screenity][BG] stop-recording-tab logging failed", err);
  }
};

const setTabAutoDiscardableSafe = async (message, sender) => {
  try {
    const tabId = sender?.tab?.id;
    const discardable = message?.discardable;

    if (!tabId || typeof discardable !== "boolean") return;

    await chrome.tabs.update(tabId, { autoDiscardable: discardable });
  } catch (err) {
    console.warn("Failed to set tab autoDiscardable:", err);
  }
};

const handleCreateVideoProject = async (message) => {
  try {
    const res = await fetch(`${API_BASE}/videos/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await chrome.storage.local
          .get("screenityToken")
          .then((r) => r.screenityToken)}`,
      },
      body: JSON.stringify({
        title: message.title || "Untitled Recording",
        data: message.data || {},
        instantMode: message.instantMode || false,
        recording: true,
        isPublic: message.instantMode ? true : false,
      }),
    });

    const result = await res.json();

    if (!res.ok || !result?.videoId) {
      return {
        success: false,
        error: result?.error || "Server error",
      };
    }

    return { success: true, videoId: result.videoId };
  } catch (err) {
    console.error("❌ Failed to create video:", err.message);
    return { success: false, error: err.message };
  }
};

const handleFetchVideos = async (message) => {
  try {
    const page = message.page || 0;
    const pageSize = message.pageSize || 12;
    const sort = message.sort || "newest";
    const filter = message.filter || "all";

    const token = await chrome.storage.local
      .get("screenityToken")
      .then((r) => r.screenityToken);

    const res = await fetch(
      `${API_BASE}/videos?page=${page}&pageSize=${pageSize}&sort=${sort}&filter=${filter}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      },
    );

    const result = await res.json();

    if (!res.ok || !result?.videos) {
      return {
        success: false,
        error: result?.error || "Failed to fetch videos",
      };
    }

    return { success: true, videos: result.videos };
  } catch (err) {
    console.error("❌ Failed to fetch videos:", err.message);
    return { success: false, error: err.message };
  }
};

const handleReopenPopupMulti = async () => {
  try {
    const tab = await getCurrentTab();
    if (!tab?.id) {
      console.warn("No active tab found for popup reopen");
      return;
    }

    await sendMessageTab(tab.id, {
      type: "reopen-popup-multi",
    });
  } catch (err) {
    console.warn("Failed to send popup reopen message:", err);
  }
};

const handleCheckStorageQuota = async (retried = false) => {
  try {
    const { screenityToken } = await chrome.storage.local.get("screenityToken");

    const res = await fetch(`${API_BASE}/storage/quota`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${screenityToken}`,
      },
      credentials: "include",
    });

    // 401: invalidate auth cache so loginWithWebsite refreshes the token
    if (res.status === 401 && !retried) {
      await chrome.storage.local.set({ lastAuthCheck: 0 });
      const refresh = await loginWithWebsite({ force: true });
      if (refresh.authenticated) {
        return handleCheckStorageQuota(true);
      }
      return { success: false, error: "Not authenticated" };
    }

    const result = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: result?.error || "Fetch failed",
      };
    }

    return { success: true, ...result };
  } catch (err) {
    console.error("❌ Error checking storage quota:", err);
    return { success: false, error: err.message };
  }
};

export const handleFinishMultiRecording = async () => {
  try {
    const { recordingToScene } = await chrome.storage.local.get([
      "recordingToScene",
    ]);

    if (!recordingToScene) {
      const { multiProjectId } = await chrome.storage.local.get([
        "multiProjectId",
      ]);

      if (!multiProjectId) {
        console.warn("No project ID found for finishing multi recording.");
        await chrome.storage.local.set({
          multiMode: false,
          multiSceneCount: 0,
          multiProjectId: null,
          multiLastSceneId: null,
        });
        return;
      }

      const url = `${process.env.SCREENITY_APP_BASE}/editor/${multiProjectId}/edit?share=true`;
      const publicUrl = `${process.env.SCREENITY_APP_BASE}/view/${multiProjectId}/`;

      markProjectPublic(multiProjectId);

      createTab(url, true).then(() => {
        if (publicUrl) {
          copyToClipboard(publicUrl);
          chrome.runtime.sendMessage({
            type: "show-toast",
            message: "Public video link copied to clipboard!",
          });
        }
      });
    } else {
      // existing-project multi recording: only reuse editorTab if it still matches
      const { projectId, instantMode } = await chrome.storage.local.get([
        "projectId",
        "instantMode",
      ]);
      const targetUrl = getEditorTargetUrl({
        projectId,
        instantMode: Boolean(instantMode),
      });
      const expectedKind = instantMode ? "view" : "editor";
      const resolved = await resolveEditorTabForTarget({
        targetUrl,
        expectedProjectId: projectId || null,
        expectedKind,
        reason: "finish-multi-recording",
      });
      const messageTab = resolved.tabId || (await getCurrentTab())?.id || null;

      if (messageTab) {
        await focusTab(messageTab, { reason: "finish-multi-recording:notify" });
        await sendMessageTab(messageTab, {
          type: "update-project-ready",
          share: false,
          newProject: false,
          projectId: projectId || null,
        }).catch((err) =>
          console.warn(
            "[Screenity][BG] Failed to send update-project-ready (finish-multi-recording)",
            err,
          ),
        );
      } else {
        console.warn(
          "[Screenity][BG] No tab available for update-project-ready (finish-multi-recording)",
          { projectId, instantMode: Boolean(instantMode) },
        );
      }

      chrome.storage.local.set({
        recordingProjectTitle: "",
        projectId: null,
        activeSceneId: null,
        recordingToScene: false,
        multiMode: false,
        multiSceneCount: 0,
        multiProjectId: null,
        multiLastSceneId: null,
        editorTab: null,
        editorTabMeta: null,
      });

      const tab = await getCurrentTab();
      if (tab?.id) {
        sendMessageTab(tab.id, {
          type: "clear-recordings",
        });
      }
    }

    // Safety net for the !recordingToScene branch, which doesn't clear
    // these inline. The else branch's bulk set already covers them, so
    // this is a harmless redundant write on that path.
    await chrome.storage.local.set({
      multiMode: false,
      multiSceneCount: 0,
      multiProjectId: null,
      multiLastSceneId: null,
    });
  } catch (err) {
    console.warn("Failed to finish multi recording", err);
    await chrome.storage.local.set({
      multiMode: false,
      multiSceneCount: 0,
      multiProjectId: null,
      multiLastSceneId: null,
    }).catch(() => {});
  }
};

let activeRecordingSession = null;
let recordingTabListener = null;
let desktopCaptureInFlight = false;
let lastDesktopCaptureAt = 0;

const clearRecordingSession = () => {
  activeRecordingSession = null;
  if (recordingTabListener) {
    chrome.tabs.onRemoved.removeListener(recordingTabListener);
    recordingTabListener = null;
  }
};

const clearRecordingSessionSafe = async (reason = "unknown", details = {}) => {
  const prev = activeRecordingSession;
  clearRecordingSession();
  // Remove the stored session (not just the in-memory var) when done, so a 2nd
  // recording on the same tab doesn't route to a stale one. Kept on interruption.
  const recordingIsDone =
    reason === "video-ready" ||
    reason === "non-recording-session-conflict" ||
    reason === "stale-conflict-recovered";
  try {
    await chrome.storage.local.set({
      ...(recordingIsDone
        ? { recorderSession: null, pendingRecording: false }
        : {}),
      lastRecordingSessionClear: {
        ts: Date.now(),
        reason,
        previousSessionId: prev?.id || null,
        previousRecorderTabId: prev?.recorderTabId || prev?.tabId || null,
        ...details,
      },
    });
  } catch {}
};

const registerRecordingTabListener = (ownerTabId) => {
  if (!ownerTabId) return;
  if (recordingTabListener) {
    chrome.tabs.onRemoved.removeListener(recordingTabListener);
    recordingTabListener = null;
  }
  recordingTabListener = (closedTabId) => {
    if (closedTabId === ownerTabId) {
      // chrome.runtime.sendMessage from the SW doesn't fire BG's own listeners,
      // so call the stop handler directly
      Promise.resolve(
        handleStopRecordingTab({
          reason: "recorder-owner-tab-closed",
          tabId: closedTabId,
        }),
      ).catch((err) => {
        console.error(
          "[Screenity][BG] handleStopRecordingTab failed in tab-removed",
          err,
        );
      });
      clearRecordingSessionSafe("owner-tab-removed", { closedTabId });
    }
  };
  chrome.tabs.onRemoved.addListener(recordingTabListener);
};

const isSessionRecording = (session) => session?.status === "recording";

const doesTabExist = async (tabId) => {
  if (!Number.isInteger(tabId)) return false;
  try {
    await chrome.tabs.get(tabId);
    return true;
  } catch {
    return false;
  }
};

const normalizeIncomingSession = (incoming = {}, sender) => {
  const ownerTabId = incoming.recorderTabId || sender?.tab?.id || null;
  const capturedTabId = incoming.capturedTabId || incoming.tabId || null;
  return {
    ...incoming,
    recorderTabId: ownerTabId,
    capturedTabId,
    tabId: capturedTabId,
  };
};

const isActiveSessionAlive = async (session) => {
  if (!session?.id) return false;
  const ownerTabId = session.recorderTabId || session.tabId || null;
  const ownerTabAlive = await doesTabExist(ownerTabId);
  const {
    recording,
    pendingRecording,
    restarting,
    recorderSession: storedSession,
  } = await chrome.storage.local.get([
    "recording",
    "pendingRecording",
    "restarting",
    "recorderSession",
  ]);
  const flagsActive = Boolean(recording || pendingRecording || restarting);
  const storedMatches =
    storedSession?.id === session.id && isSessionRecording(storedSession);
  return ownerTabAlive && (storedMatches || flagsActive);
};

const resolveActiveSessionConflict = async (incomingSession) => {
  if (!incomingSession?.id) {
    return { allow: true, staleRecovered: false };
  }

  if (!activeRecordingSession?.id) {
    const { recorderSession: storedSession } = await chrome.storage.local.get([
      "recorderSession",
    ]);
    if (storedSession?.id && isSessionRecording(storedSession)) {
      activeRecordingSession = {
        ...storedSession,
        recorderTabId: storedSession.recorderTabId || storedSession.tabId || null,
        capturedTabId:
          storedSession.capturedTabId || storedSession.tabId || null,
        tabId: storedSession.capturedTabId || storedSession.tabId || null,
      };
    }
  }

  if (!activeRecordingSession?.id) return { allow: true, staleRecovered: false };
  if (activeRecordingSession.id === incomingSession.id) {
    return { allow: true, staleRecovered: false };
  }

  if (!isSessionRecording(activeRecordingSession)) {
    await clearRecordingSessionSafe("non-recording-session-conflict");
    return { allow: true, staleRecovered: true };
  }

  const alive = await isActiveSessionAlive(activeRecordingSession);
  if (alive) {
    console.warn("[Screenity][BG] session_conflict_rejected", {
      activeId: activeRecordingSession.id,
      incomingId: incomingSession.id,
      activeRecorderTabId:
        activeRecordingSession.recorderTabId || activeRecordingSession.tabId,
    });
    return { allow: false, staleRecovered: false };
  }

  await clearRecordingSessionSafe("stale-conflict-recovered", {
    incomingId: incomingSession.id,
  });
  console.warn("[Screenity][BG] session_conflict_stale_recovered", {
    incomingId: incomingSession.id,
  });
  return { allow: true, staleRecovered: true };
};

export const copyToClipboard = (text) => {
  if (!text) return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length) return;
    const tabId = tabs[0].id;
    chrome.scripting.executeScript({
      target: { tabId },
      func: (content) => {
        navigator.clipboard.writeText(content).catch((err) => {
          console.warn(
            "❌ Failed to copy to clipboard in content script:",
            err,
          );
        });
      },
      args: [text],
    });
  });
};

export const setupHandlers = () => {
  registerProxyStorageHandlers();
  registerMessage("desktop-capture", async (message, sender) => {
    const now = Date.now();
    if (desktopCaptureInFlight || now - lastDesktopCaptureAt < 1200) {
      return { ok: true, deduped: true };
    }

    desktopCaptureInFlight = true;
    lastDesktopCaptureAt = now;

    try {
      await desktopCapture({
        ...message,
        ...(sender?.tab?.id != null ? { initiatingTabId: sender.tab.id } : {}),
      });
      return { ok: true };
    } finally {
      setTimeout(() => {
        desktopCaptureInFlight = false;
      }, 1000);
    }
  });
  registerMessage("start-recorder-keepalive-alarm", async () => {
    try {
      await chrome.alarms.create(RECORDER_KEEPALIVE_ALARM, {
        periodInMinutes: 0.5, // fires every 30s
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });
  registerMessage("stop-recorder-keepalive-alarm", async () => {
    try {
      await chrome.alarms.clear(RECORDER_KEEPALIVE_ALARM);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });
  // Offscreen doc pings this to keep the SW alive during recording; just
  // receiving it resets the idle timer, so the body is a no-op.
  registerMessage("sw-keepalive", () => ({ ok: true }));
  // CloudRecorder mirrors each step of its stop→finalize→close
  // sequence here so the timeline survives the tab's window.close().
  // Read the BG service worker console (chrome://extensions → service
  // worker → inspect) to see the full sequence end-to-end.
  registerMessage("stop-flow-tick", (message) => {
    if (!DEBUG_FLOW) return { ok: true };
    const t = message?.t ?? "?";
    const label = message?.label || "?";
    const extra = message?.extra || {};
    console.warn(`[stop-flow T+${t}ms] ${label}`, extra);
    return { ok: true };
  });

  // Mirror of start-flow events from the cloud recorder tab. Same
  // rationale as stop-flow-tick: visible in BG console even when the
  // recorder tab closed before the user could read it.
  registerMessage("start-flow-tick", (message) => {
    if (!DEBUG_FLOW) return { ok: true };
    const event = message?.event || "?";
    const data = message?.data || {};
    const ts = message?.ts ? new Date(message.ts).toISOString().slice(11, 23) : "??:??:??";
    console.warn(`[start-flow ${ts}] ${event}`, data);
    return { ok: true };
  });

  // Forward scene-create direct from BG; the editor-tab proxy added
  // ~3-6s of cold-start. Uses getPlatformInfo() as the SW heartbeat.
  // Falls back to editor-tab proxy on non-transient failure.
  registerMessage("forward-create-scene", async (message) => {
    const { projectId, payload } = message || {};
    if (!projectId || !payload) {
      return { ok: false, error: "missing-projectId-or-payload" };
    }
    if (!API_BASE) {
      return { ok: false, error: "no-api-base" };
    }

    const ping = () => {
      try {
        chrome.runtime.getPlatformInfo(() => void chrome.runtime.lastError);
      } catch {}
    };
    ping();
    const keepAlive = setInterval(ping, 10_000);

    try {
      const { screenityToken } = await chrome.storage.local.get([
        "screenityToken",
      ]);
      const headers = { "Content-Type": "application/json" };
      if (screenityToken) headers.Authorization = `Bearer ${screenityToken}`;
      // No keepalive:true (MV3 SW fetches with it can hang forever).
      // 3s abort then fall through to editor-tab proxy. Healthy is
      // <500ms, 1s was too tight and tripped on normal latency spikes.
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 3_000);
      let res;
      try {
        res = await fetch(`${API_BASE}/videos/${projectId}/scenes/`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(abortTimer);
      }
      const text = await res.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {}
      if (res.ok) {
        return { ok: true, status: res.status, body, text };
      }
      // Fall through to editor-tab proxy on non-2xx; same-origin
      // cookie auth is a different code path and may succeed where
      // bearer-auth doesn't (e.g. token rotation).
      console.warn(
        `[forward-create-scene] BG POST returned ${res.status}; falling back to editor-tab proxy`,
      );
    } catch (err) {
      console.warn(
        `[forward-create-scene] BG POST threw, falling back to editor-tab proxy:`,
        err?.message || err,
      );
    } finally {
      clearInterval(keepAlive);
    }

    // Editor-tab proxy fallback (the original path).
    let validated = await getValidatedEditorTab({
      expectedProjectId: projectId,
      expectedKind: "editor",
      reason: "forward-create-scene",
    });
    if (!validated.ok || !validated.tab?.id) {
      const targetUrl = `${process.env.SCREENITY_APP_BASE}/editor/${projectId}/edit?load=true`;
      try {
        const tab = await chrome.tabs.create({ url: targetUrl, active: false });
        if (tab?.id) {
          await setEditorTabReference({
            tabId: tab.id,
            tabUrl: targetUrl,
            source: "forward-create-scene:auto-open",
            expectedProjectId: projectId,
          });
          validated = { ok: true, tab: { id: tab.id }, reason: null };
        }
      } catch (err) {
        return {
          ok: false,
          error: `failed-to-open-editor-tab:${err?.message || err}`,
        };
      }
      if (!validated.tab?.id) {
        return { ok: false, error: "no-editor-tab" };
      }
    }
    const requestId =
      (typeof crypto !== "undefined" && crypto.randomUUID?.()) ||
      `scene-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const backoffsMs = [0, 200, 400, 800, 1200, 1600, 2000, 2400, 2800];
    let lastErr = null;
    for (const wait of backoffsMs) {
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try {
        const reply = await chrome.tabs.sendMessage(
          validated.tab.id,
          { type: "proxy-create-scene", projectId, requestId, payload },
          { frameId: 0 },
        );
        return reply || { ok: false, error: "no-reply-from-editor" };
      } catch (err) {
        lastErr = err?.message || String(err);
        if (!/Receiving end does not exist|Could not establish/i.test(lastErr)) {
          break;
        }
      }
    }
    return { ok: false, error: lastErr || "tabs-sendMessage-failed" };
  });

  // Bearer-auth fetch via SW so it survives caller teardown. Non-cloud-recorder
  // callers only; the cloud recorder uses the port-based path above.
  registerMessage("pro-api-fetch", async (message) => {
    // Heartbeat resets the SW idle timer for the duration of the fetch,
    // helpful when the originating tab tears down right after dispatch.
    const ping = () => {
      try {
        chrome.runtime.getPlatformInfo(() => void chrome.runtime.lastError);
      } catch {}
    };
    ping();
    const keepAlive = setInterval(ping, 10_000);
    try {
      const { path, method = "GET", body } = message || {};
      if (typeof path !== "string" || !path.startsWith("/")) {
        return { ok: false, error: "invalid-path" };
      }
      if (!API_BASE) return { ok: false, error: "no-api-base" };
      const { screenityToken } = await chrome.storage.local.get([
        "screenityToken",
      ]);
      const headers = { "Content-Type": "application/json" };
      if (screenityToken) headers.Authorization = `Bearer ${screenityToken}`;
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
        keepalive: true,
      });
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {}
      return { ok: res.ok, status: res.status, body: json, text };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    } finally {
      clearInterval(keepAlive);
    }
  });

  registerMessage("offscreen-diag", async (message) => {
    if (!DEBUG_FLOW) return { ok: true };
    let payloadStr;
    try {
      payloadStr = JSON.stringify(message.payload);
    } catch {
      payloadStr = String(message.payload);
    }
    console.warn("[Screenity][OffscreenDiag]", message.source, payloadStr);
    return { ok: true };
  });
  registerMessage("offscreen-ready", async () => {
    const { pendingOffscreenLoad } = await chrome.storage.local.get([
      "pendingOffscreenLoad",
    ]);
    if (!pendingOffscreenLoad) return { ok: true, delivered: false };
    await chrome.storage.local.set({ pendingOffscreenLoad: null });
    chrome.runtime.sendMessage(pendingOffscreenLoad).catch(() => {});
    return { ok: true, delivered: true };
  });
  // Offscreen recorder can't call chrome.scripting; SW proxies the viewport
  // probe so the recorder can size tab-capture constraints to the tab's
  // actual aspect ratio (avoiding the default 1920x1080 pillarbox).
  registerMessage("get-tab-viewport", async (message) => {
    const tabId = Number(message?.tabId);
    if (!Number.isFinite(tabId) || tabId < 0) {
      return { ok: false, error: "invalid-tab-id" };
    }
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({
          w: Math.round(window.innerWidth * (window.devicePixelRatio || 1)),
          h: Math.round(window.innerHeight * (window.devicePixelRatio || 1)),
        }),
      });
      const r = results?.[0]?.result;
      if (r && r.w > 0 && r.h > 0) {
        return { ok: true, width: r.w, height: r.h };
      }
      return { ok: false, error: "no-result" };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });

  registerMessage("offscreen-request-stream", async (message, sender) => {
    try {
      // anchor picker to user's tab, not the offscreen doc
      let initiatingTabId = message.initiatingTabId || null;
      if (!initiatingTabId) {
        const { recordingUiTabId } = await chrome.storage.local.get([
          "recordingUiTabId",
        ]);
        initiatingTabId = recordingUiTabId || null;
      }
      const result = await acquireStreamForOffscreen({
        mode: message.mode,
        sources: message.sources,
        initiatingTabId,
        targetTabId: message.targetTabId,
      });
      return { ok: true, ...result };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });
  registerMessage("handle-restart", (message, sender) =>
    handleRestart(message, sender),
  );
  registerMessage("handle-dismiss", (message) => handleDismiss(message));
  registerMessage("reset-active-tab", () => resetActiveTab(false));
  registerMessage("reset-active-tab-restart", (message) =>
    resetActiveTabRestart(message),
  );
  registerMessage("video-ready", async (message) => {
    perfMark("BG.handlers video-ready.received");
    await videoReady(message);
    await clearRecordingSessionSafe("video-ready");
    // video-ready fires for every recorder type once finalized and playable, so
    // count successful recordings here instead of the tab-only start-flow "ok"
    // branch (which missed region recordings). Best-effort.
    try {
      const { successfulRecordingCount } = await chrome.storage.local.get(
        "successfulRecordingCount",
      );
      const prev =
        typeof successfulRecordingCount === "number"
          ? successfulRecordingCount
          : 0;
      await chrome.storage.local.set({
        successfulRecordingCount: prev + 1,
        lastSuccessfulRecordingAt: Date.now(),
      });
    } catch {}
  });

  // download-path remux request from sandbox; falls back to in-sandbox BufferTarget on failure
  registerMessage("remux-request", async (message) => {
    if (
      !message?.requestId ||
      !message?.inputFileName ||
      !message?.outputFileName
    ) {
      return { ok: false, error: "invalid-remux-request-payload" };
    }
    try {
      await ensureRemuxOffscreen();
    } catch (err) {
      return {
        ok: false,
        error: String(err?.message || err || "ensure-offscreen-failed"),
      };
    }
    try {
      // deterministic timeout so a wedged offscreen can't hang the caller
      // forever. WebM is a full re-encode (minutes on large files), so it gets
      // a far longer ceiling than the packet-copy remux; the editor's
      // progress-reset stall guard catches a genuinely wedged conversion first.
      const isWebm = message.kind === "webm";
      const TIMEOUT_MS = isWebm ? 30 * 60_000 : 60_000;
      let timeoutId = null;
      try {
        const response = await Promise.race([
          chrome.runtime.sendMessage({
            type: isWebm ? "webm-start" : "remux-start",
            requestId: message.requestId,
            inputFileName: message.inputFileName,
            outputFileName: message.outputFileName,
          }),
          new Promise((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error("remux-offscreen-timeout")),
              TIMEOUT_MS,
            );
          }),
        ]);
        return response || { ok: false, error: "no-offscreen-response" };
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    } catch (err) {
      return {
        ok: false,
        error: String(err?.message || err || "forward-to-offscreen-failed"),
      };
    }
  });

  // pagehide from Region/Recorder.jsx; user navigated away from the recorded tab
  registerMessage("region-iframe-destroyed", async () => {
    const { recording, recorderSession, customRegion } =
      await chrome.storage.local.get([
        "recording",
        "recorderSession",
        "customRegion",
      ]);
    const isActivelyRecording =
      recording ||
      (recorderSession && recorderSession.status === "recording");
    if (!isActivelyRecording) return;
    // only customRegion hosts MediaRecorder in the iframe; plain tab capture lives
    // in the pinned recorder tab and must not be torn down by recorded-page navigation
    if (!customRegion) return;

    diagEvent("region-iframe-destroyed");
    clearInMemoryEditorLock();
    await chrome.storage.local.set({
      recording: false,
      customRegion: false,
      // recordingTab points to pinned recorder.html which didn't open the editor;
      // clear it so stopRecording() doesn't skip editor open

      recordingTab: null,
      postStopEditorOpening: false,
      postStopEditorOpened: false,
      recorderSession: recorderSession
        ? { ...recorderSession, status: "stopped" }
        : null,
    });

    // user navigated before any chunks persisted; toast instead of empty editor
    const chunkCount = await chunksStore.length().catch(() => 0);
    if (chunkCount === 0) {
      diagEvent("region-nav-no-chunks");
      const { activeTab, sandboxTab } = await chrome.storage.local.get([
        "activeTab",
        "sandboxTab",
      ]);
      if (activeTab) {
        sendMessageTab(activeTab, {
          type: "show-toast",
          message: chrome.i18n.getMessage("recordingTooShortToast"),
          timeout: 5000,
        }).catch(() => {});
      }
      // editor opened pre-unload would otherwise hang at "Preparing recording..."
      if (Number.isInteger(sandboxTab)) {
        try {
          await chrome.storage.local.set({
            editorRecordingError: {
              ts: Date.now(),
              sandboxTab,
              error: "stream-error",
              why: "Recording stopped before any data was captured",
              errorCode: "REC_REGION_NAV_NO_CHUNKS",
              source: "region-iframe-destroyed",
            },
          });
        } catch {}
      }
      return;
    }

    await videoReady();
  });

  registerMessage("start-recording", (message) => startRecording("start-recording-message"));
  registerMessage("countdown-finished", async (message) => {
    const { recording, restarting, pendingRecording } =
      await chrome.storage.local.get([
      "recording",
      "restarting",
      "pendingRecording",
    ]);
    const writeDecision = (reason, started, extra = {}) => {
      const decisionAt = Date.now();
      return chrome.storage.local.set({
        lastCountdownFinishedDecision: {
          ts: decisionAt,
          startedAt: started ? decisionAt : null,
          endedAt: message?.endedAt || null,
          acceptedCountdownFinishedAt: started,
          recording: Boolean(recording),
          restarting: Boolean(restarting),
          pendingRecording: Boolean(pendingRecording),
          started,
          reason,
          ...extra,
        },
      });
    };
    // restart leaves `recording: true` briefly from the previous session, so block
    // only when recording is active AND not restarting
    if (recording && !restarting) {
      diagEvent("countdown-finished", { skipped: true, reason: "already-recording" });
      await writeDecision("already-recording", false);
      return { ok: true, skipped: true };
    }
    // a delayed countdown-finished can fire long after stop; accepting it
    // starts a phantom recording that orphans the finished editor handoff.
    const endedAt = Number(message?.endedAt) || 0;
    const ageMs = endedAt > 0 ? Date.now() - endedAt : null;
    if (ageMs !== null && ageMs > 10000) {
      diagEvent("countdown-finished", {
        skipped: true,
        reason: "stale-dispatch",
        ageMs,
      });
      await writeDecision("stale-dispatch", false, { ageMs });
      return { ok: true, skipped: true };
    }
    diagEvent("countdown-finished", { skipped: false });
    const decisionAt = Date.now();
    // Don't block startAfterCountdown on the diagnostic write; the
    // Recorder doesn't read countdownFinishedAt until well after stream
    // setup (~hundreds of ms later), so fire-and-forget shaves a
    // storage IPC off the countdown→record critical path.
    chrome.storage.local.set({
      countdownFinishedAt: message?.endedAt || decisionAt,
      lastCountdownFinishedDecision: {
        ts: decisionAt,
        startedAt: decisionAt,
        endedAt: message?.endedAt || null,
        acceptedCountdownFinishedAt: true,
        recording: Boolean(recording),
        restarting: Boolean(restarting),
        pendingRecording: Boolean(pendingRecording),
        started: true,
      },
    });
    startAfterCountdown("countdown-finished");
    return { ok: true };
  });
  registerMessage("restarted", (message) => restartActiveTab(message));

  registerMessage(
    "get-streaming-data",
    async (message, sender) => await handleGetStreamingData(message, sender),
  );
  registerMessage("cancel-recording", (message) => cancelRecording(message));
  registerMessage("stop-recording-tab", (message, sender, sendResponse) => {
    perfMark("BG.handlers stop-recording-tab.received", {
      reason: message?.reason || null,
      senderTabId: sender?.tab?.id || null,
    });
    logStopRecordingTabEvent(message, sender);
    const now = Date.now();
    if (
      stopRecordingTabInFlight ||
      now - stopRecordingTabLastAt < STOP_RECORDING_TAB_DEBOUNCE_MS
    ) {
      if (DEBUG_POSTSTOP) {
        console.warn(
          "[Screenity][BG] Suppressed duplicate stop-recording-tab message",
          {
            inFlight: stopRecordingTabInFlight,
            deltaMs: now - stopRecordingTabLastAt,
            reason: message?.reason || null,
          },
        );
      }
      sendResponse({ ok: true, deduped: true });
      return true;
    }

    stopRecordingTabInFlight = true;
    stopRecordingTabLastAt = now;
    Promise.resolve(handleStopRecordingTab(message))
      .catch((err) => {
        console.error("Failed to handle stop-recording-tab", err);
      })
      .finally(() => {
        stopRecordingTabInFlight = false;
        stopRecordingTabLastAt = Date.now();
      });
    sendResponse({ ok: true });
    return true;
  });
  registerMessage("dismiss-recording-tab", (message) =>
    handleDismissRecordingTab(message),
  );
  registerMessage("pause-recording-tab", () => {
    diagEvent("pause");
    return sendMessageRecord({ type: "pause-recording-tab" });
  });
  registerMessage("resume-recording-tab", () => {
    diagEvent("resume");
    return sendMessageRecord({ type: "resume-recording-tab" });
  });
  registerMessage("retry-finalize", () => {
    return sendMessageRecord({ type: "retry-finalize" });
  });
  registerMessage("export-finalize-diagnostics", () => {
    return sendMessageRecord({ type: "export-finalize-diagnostics" });
  });
  registerMessage("set-mic-active-tab", (message) => setMicActiveTab(message));

  registerMessage("diag-countdown-started", () => {
    diagEvent("countdown-started");
    // countdown started means stream setup is done; extend the fallback window
    // so it doesn't fire during countdown (and start the recording too early)
    noteCountdownStarted();
  });
  registerMessage("diag-countdown-cancelled", () => diagEvent("countdown-cancelled"));
  registerMessage("diag-editor-ready", (message) =>
    diagEvent("editor-load-ready", { path: message?.path || null }),
  );
  // prefix allowlist so a compromised context can't spoof lifecycle events
  registerMessage("diag-forward", (message) => {
    const ev = typeof message?.event === "string" ? message.event : null;
    if (!ev) return;
    const allowedPrefixes = [
      "sandbox-",
      "sw-",
      "opfs-",
      "recorder-",
      // emit real failure breadcrumbs; were being silently dropped before.
      "cloudrecorder-",
      "camera-",
      "editor-",
      // AudioContext interrupt/resume from attachAudioContextWatchdog (page realm).
      "audiocontext-",
    ];
    if (!allowedPrefixes.some((p) => ev.startsWith(p))) return;
    diagEvent(ev, message?.data ?? null);
  });
  registerMessage("open-editor-recovery", async () => {
    const { editorRecoveryUrl } = await chrome.storage.local.get(["editorRecoveryUrl"]);
    if (!editorRecoveryUrl) return;
    chrome.storage.local.remove(["editorRecoveryUrl", "editorRecoveryAt"]);
    chrome.tabs.create({ url: editorRecoveryUrl, active: true });
  });
  registerMessage("recording-error", async (message) => {
    await handleRecordingError(message);
    await clearRecordingSessionSafe("recording-error", {
      error: message?.error || null,
    });
  });
  // camera bubble failed but recording is live; surface as toast, never tear down
  registerMessage("camera-bubble-unavailable", async (message) => {
    try {
      const { tabRecordedID, recordingUiTabId } = await chrome.storage.local.get([
        "tabRecordedID",
        "recordingUiTabId",
      ]);
      const target = tabRecordedID || recordingUiTabId;
      if (target) {
        sendMessageTab(target, {
          type: "show-toast",
          message:
            chrome.i18n.getMessage("cameraUnavailableToast") ||
            "Camera disconnected. Still recording your screen.",
          timeout: 6000,
        }).catch((err) => {
          diagEvent("warning", {
            note: "camera-unavailable-toast undelivered",
            err: String(err).slice(0, 80),
          });
        });
      }
    } catch {}
  });
  registerMessage("on-get-permissions", (message) =>
    handleOnGetPermissions(message),
  );
  registerMessage(
    "recording-complete",
    async (message, sender) => {
      perfMark("BG.handlers recording-complete.received");
      return await handleRecordingComplete(message, sender);
    },
  );
  registerMessage("check-recording", (message) => checkRecording(message));
  registerMessage("open-download-mp4", async () => {
    // cloud-enabled signed-in users skip local fast-MP4 recovery to stay on the pro flow
    if (CLOUD_FEATURES_ENABLED) {
      try {
        const { authenticated } = await loginWithWebsite({ force: true });
        if (authenticated) {
          const tab = await getCurrentTab();
          if (tab?.id) {
            await sendMessageTab(tab.id, {
              type: "show-toast",
              message:
                "Fast MP4 download is unavailable while signed in. Use the editor or download WEBM instead.",
            }).catch(() => {});
          }
          return;
        }
      } catch (err) {
        console.warn("Failed to check auth for open-download-mp4", err);
      }
    }

    const tab = await createTab("download.html", true);
    if (!tab?.id) return;
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (info.status === "complete" && tabId === tab.id) {
        chrome.tabs.onUpdated.removeListener(listener);
        sendMessageTab(tab.id, { type: "recover-indexed-db-mp4" });
      }
    });
  });

  registerMessage("review-screenity", () =>
    createTab(
      "https://chrome.google.com/webstore/detail/screenity-screen-recorder/kbbdabhdfibnancpjfhlkhafgdilcnji/reviews",
      true,
    ),
  );
  registerMessage("follow-twitter", () =>
    createTab("https://alyssax.substack.com/", true),
  );
  registerMessage("pricing", (message) => {
    const source =
      typeof message?.source === "string" && message.source
        ? message.source
        : "extension";
    return createTab(
      `https://screenity.io/?ref=${encodeURIComponent(source)}`,
      true,
    );
  });
  registerMessage("open-processing-info", () =>
    createTab(
      "https://help.screenity.io/editing-and-exporting/dJRFpGq56JFKC7k8zEvsqb/why-is-there-a-5-minute-limit-for-editing/ddy4e4TpbnrFJ8VoRT37tQ",
      true,
    ),
  );
  registerMessage("upgrade-info", () =>
    createTab(
      "https://help.screenity.io/getting-started/77KizPC8MHVGfpKpqdux9D/what-are-the-technical-requirements-for-using-screenity/6kdB6qru6naVD8ZLFvX3m9",
      true,
    ),
  );
  registerMessage("trim-info", () =>
    createTab(
      "https://help.screenity.io/editing-and-exporting/dJRFpGq56JFKC7k8zEvsqb/how-to-cut-trim-or-mute-parts-of-your-video/svNbM7YHYY717MuSWXrKXH",
      true,
    ),
  );
  registerMessage("join-waitlist", () =>
    createTab("https://tally.so/r/npojNV", true),
  );
  registerMessage("chrome-update-info", () =>
    createTab(
      "https://help.screenity.io/getting-started/77KizPC8MHVGfpKpqdux9D/what-are-the-technical-requirements-for-using-screenity/6kdB6qru6naVD8ZLFvX3m9",
      true,
    ),
  );
  registerMessage("set-surface", (message) => setSurface(message));
  registerMessage("pip-ended", () => handlePip(false));
  registerMessage("pip-started", () => handlePip(true));
  registerMessage("sign-out-drive", (message) => handleSignOutDrive(message));
  registerMessage("open-help", () =>
    createTab("https://help.screenity.io/", true),
  );
  registerMessage("memory-limit-help", () =>
    createTab(
      "https://help.screenity.io/troubleshooting/9Jy5RGjNrBB42hqUdREQ7W/what-does-%E2%80%9Cmemory-limit-reached%E2%80%9D-mean-when-recording/8WkwHbt3puuXunYqQnyPcb",
      true,
    ),
  );
  registerMessage("open-home", () =>
    createTab("https://screenity.io/", true),
  );
  registerMessage("report-bug", async (message) => {
    const qs = await supportContextQuery({
      includeRecordingState: true,
      source: "settings",
    });
    const zipParam = message?.zipBundled ? "&zipBundled=1" : "";
    createTab(`https://tally.so/r/3ElpXq?${qs}${zipParam}`, true);
  });
  registerMessage("report-error", async (message) => {
    const errorCode = message?.errorCode || null;
    const errorWhy = message?.errorWhy || null;
    const source = message?.source || "error-modal";

    let user = null;
    let isLoggedIn = false;
    if (CLOUD_FEATURES_ENABLED) {
      try {
        const auth = await loginWithWebsite({ force: true });
        if (auth.authenticated && auth.user) {
          user = auth.user;
          isLoggedIn = true;
        }
      } catch {}
    }

    const qs = await supportContextQuery({
      includeRecordingState: true,
      source,
      errorCode,
      errorWhy,
      user: isLoggedIn ? { name: user.name, email: user.email } : undefined,
    });

    const zipParam = message?.zipBundled ? "&zipBundled=1" : "";
    if (isLoggedIn) {
      createTab(`https://tally.so/r/310MNg?extension=true&${qs}`, true);
    } else {
      createTab(`https://tally.so/r/3ElpXq?feedbackType=Bug&${qs}${zipParam}`, true);
    }
  });
  registerMessage("clear-recordings", () => clearAllRecordings());
  registerMessage("force-processing", (message) => forceProcessing(message));
  registerMessage("focus-this-tab", (message, sender) =>
    focusTab(sender.tab.id),
  );
  registerMessage("indexed-db-download", (message) =>
    downloadIndexedDB(message),
  );
  registerMessage("get-platform-info", async () => {
    // Include the manifest version so contexts that ask BG for platform info
    // (e.g. the offscreen recorder telemetry runtime) get an authoritative
    // version even if their own getManifest read comes back empty.
    const info = (await getPlatformInfo()) || {};
    let extVersion = null;
    try {
      extVersion = chrome.runtime.getManifest().version || null;
    } catch {}
    return { ...info, extVersion };
  });
  registerMessage(
    "get-diagnostic-log",
    async (_message, _sender, sendResponse) => {
      const log = await getDiagnosticLog();
      const errors = await getErrorSnapshot();
      const flags = await getStorageFlags();
      sendResponse({ log, errors, flags });
      return true;
    },
  );
  registerMessage("submit-diagnostic-report", async (message) => {
    try {
      const appBase = process.env.SCREENITY_APP_BASE;
      if (!appBase) return;
      const { startFlowTrace, screenityToken, projectId, recorderSession } =
        await chrome.storage.local.get([
          "startFlowTrace",
          "screenityToken",
          "projectId",
          "recorderSession",
        ]);
      if (!startFlowTrace || !screenityToken) return;
      const trigger = message?.trigger || "manual";
      const isSuccess = trigger === "success-summary";
      const trace = startFlowTrace;
      const ua = navigator.userAgent || "";
      const payload = {
        attemptId: trace.attemptId,
        projectId: projectId || null,
        recordingSessionId: recorderSession?.id || null,
        extVersion: chrome.runtime.getManifest().version,
        trigger,
        env: {
          os: (await chrome.runtime.getPlatformInfo()).os || null,
          browser: (ua.match(/Chrome\/\d+/) || [""])[0] || null,
        },
        trace: isSuccess
          ? {
              recordingType: trace.recordingType,
              surface: trace.surface,
              isPro: trace.isPro,
              countdown: trace.countdown,
              outcome: trace.outcome,
              t: {
                startStreaming: trace.t?.startStreaming || null,
                recordingStarted: trace.t?.recordingStarted || null,
              },
              routing: null,
              error: null,
              errorCode: null,
              stuck: null,
            }
          : trace,
      };
      fetch(`${appBase}/api/log/diagnostic-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${screenityToken}`,
        },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch {
    }
  });
  registerMessage("restore-recording", (message) => restoreRecording(message));
  registerMessage("check-restore", async (message, sender, sendResponse) => {
    const response = await checkRestore();
    sendResponse(response);
    return true;
  });
  registerMessage(
    "check-cloud-restore",
    async (_message, _sender, sendResponse) => {
      const response = await checkCloudRestore();
      sendResponse(response);
      return true;
    },
  );
  registerMessage("restore-cloud-recording", () => restoreCloudRecording());
  registerMessage(
    "check-capture-permissions",
    async (message, sender, sendResponse) => {
      const { isLoggedIn, isSubscribed } = message;

      const response = await checkCapturePermissions({
        isLoggedIn,
        isSubscribed,
      });

      sendResponse(response);
      return true;
    },
  );
  registerMessage("is-pinned", async () => await isPinned());

  // prevent Chrome from discarding the CloudRecorder tab while recording
  registerMessage("set-tab-auto-discardable", (message, sender) =>
    setTabAutoDiscardableSafe(message, sender),
  );

  registerMessage(
    "save-to-drive",
    async (message) => await handleSaveToDrive(message, false),
  );
  registerMessage(
    "save-to-drive-fallback",
    async (message) => await handleSaveToDrive(message, true),
  );
  registerMessage("request-download", (message) =>
    requestDownload(message.base64, message.title),
  );
  registerMessage("resize-window", (message) =>
    resizeWindow(message.width, message.height),
  );
  registerMessage("available-memory", async () => {
    return await checkAvailableMemory();
  });
  registerMessage("extension-media-permissions", () =>
    createTab(
      `chrome://settings/content/siteDetails?site=chrome-extension://${chrome.runtime.id}`,
      true,
    ),
  );
  registerMessage("add-alarm-listener", (payload) => addAlarmListener(payload));
  registerMessage(
    "check-auth-status",
    async (message) => {
      if (!CLOUD_FEATURES_ENABLED) {
        return {
          authenticated: false,
          message: "Cloud features disabled",
        };
      }
      // Force a fresh web-login pickup by default, but let callers opt out.
      // The popup mount opts out so a fresh install doesn't silently revive
      // auth from a leftover website cookie (it would flash the paid welcome
      // screen at a returning user who should just see "Log in").
      return await loginWithWebsite({ force: message?.force !== false });
    },
  );
  registerMessage(
    "create-video-project",
    async (message, sender, sendResponse) => {
      if (!CLOUD_FEATURES_ENABLED) {
        sendResponse({ success: false, message: "Cloud features disabled" });
        return true;
      }
      const { authenticated, subscribed, user } = await loginWithWebsite({ force: true });

      if (!authenticated) {
        sendResponse({ success: false, message: "User not authenticated" });
        return true;
      }

      if (!subscribed) {
        sendResponse({ success: false, message: "Subscription inactive" });
        return true;
      }

      const response = await handleCreateVideoProject(message);
      sendResponse(response);

      return true;
    },
  );
  registerMessage("handle-login", async () => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled, cannot handle login");
      return;
    }
    await chrome.storage.local.set({ stayLoggedOut: false });
    // cancel deferred-logout token clear; otherwise drain listener clobbers fresh token
    await chrome.storage.local.remove(["logoutPendingTokenClear"]);

    const currentTab = await getCurrentTab();

    if (currentTab?.id) {
      await chrome.storage.local.set({ originalTabId: currentTab.id });
    }
    chrome.tabs.create({
      url: `${process.env.SCREENITY_APP_BASE}/login?extension=true`,
      active: true,
    });
  });
  registerMessage("handle-logout", async (message, sender, sendResponse) => {
    if (!CLOUD_FEATURES_ENABLED) {
      sendResponse({ success: false, message: "Cloud features disabled" });
      return true;
    }
    // keep screenityToken during active recording for bunnyTusUploader.refreshTusAuth;
    // removed by recording-end cleanup
    const { recording, pendingRecording } = await chrome.storage.local.get([
      "recording",
      "pendingRecording",
    ]);
    const recordingBusy = Boolean(recording || pendingRecording);
    const removeKeys = [
      "screenityUser",
      "lastAuthCheck",
      "isSubscribed",
      "isLoggedIn",
      "proSubscription",
    ];
    if (!recordingBusy) {
      removeKeys.push("screenityToken");
    }
    await chrome.storage.local.remove(removeKeys);

    // stayLoggedOut blocks auto-login until user explicitly clicks "Log in"
    await chrome.storage.local.set({
      isLoggedIn: false,
      wasLoggedIn: true,
      stayLoggedOut: true,
      isSubscribed: false,
      proSubscription: null,
      screenityUser: null,
      ...(recordingBusy ? { logoutPendingTokenClear: true } : {}),
    });

    if (recordingBusy) {
      // drain listener; don't await, sendResponse must fire immediately
      const drainListener = async (changes, area) => {
        if (area !== "local") return;
        if (
          !(changes.recording || changes.pendingRecording)
        )
          return;
        const snap = await chrome.storage.local.get([
          "recording",
          "pendingRecording",
          "logoutPendingTokenClear",
          "stayLoggedOut",
        ]);
        if (snap.recording || snap.pendingRecording) return;
        if (!snap.logoutPendingTokenClear) {
          // flag cleared by re-login
          chrome.storage.onChanged.removeListener(drainListener);
          return;
        }
        // gate on stayLoggedOut so a stray flag write can't silently log user out
        if (snap.stayLoggedOut !== true) {
          chrome.storage.onChanged.removeListener(drainListener);
          await chrome.storage.local.remove(["logoutPendingTokenClear"]);
          return;
        }
        chrome.storage.onChanged.removeListener(drainListener);
        await chrome.storage.local.remove([
          "screenityToken",
          "logoutPendingTokenClear",
        ]);
      };
      chrome.storage.onChanged.addListener(drainListener);
    }
    sendResponse({ success: true, deferredTokenClear: recordingBusy });
    return true;
  });

  registerMessage("click-event", async ({ payload }, sender) => {
    if (!CLOUD_FEATURES_ENABLED) return;
    const { x, y, surface, region, isTab } = payload;
    const senderWindowId = sender.tab?.windowId;

    sendMessageRecord({ type: "get-video-time" }, (response) => {
      const videoTime = response?.videoTime ?? null;

      const baseClick = { x, y, surface, region, timestamp: videoTime };

      if (region || isTab) {
        storeClick(baseClick);
        return;
      }

      if (surface === "monitor" && typeof senderWindowId === "number") {
        chrome.windows.get(senderWindowId, (win) => {
          if (!win || chrome.runtime.lastError) {
            console.warn("Failed to get window for click");
            return;
          }

          chrome.system.display.getInfo((displays) => {
            const monitor = displays.find(
              (d) =>
                win.left >= d.bounds.left &&
                win.left < d.bounds.left + d.bounds.width &&
                win.top >= d.bounds.top &&
                win.top < d.bounds.top + d.bounds.height,
            );

            if (!monitor) {
              console.warn("[click-event] No matching monitor found");
              return;
            }

            const screenX = win.left + x;
            const screenY = win.top + y;
            const adjX = screenX - monitor.bounds.left;
            const adjY = screenY - monitor.bounds.top;

            storeClick({ ...baseClick, x: adjX, y: adjY });
          });
        });
        return;
      }

      if (surface === "window" && typeof senderWindowId === "number") {
        chrome.windows.get(senderWindowId, (win) => {
          if (!win || chrome.runtime.lastError) {
            console.warn("Failed to get window for window click");
            return;
          }

          const screenX = win.left + x;
          const screenY = win.top + y;

          storeClick({ ...baseClick, x: screenX, y: screenY });
        });
        return;
      }

      storeClick(baseClick);
    });
  });

  // serialize to avoid read-modify-write race losing clicks; cap array for long recordings
  const CLICK_EVENTS_MAX = 5000;
  let _clickWriteQueue = Promise.resolve();
  function storeClick(click) {
    _clickWriteQueue = _clickWriteQueue
      .catch(() => {})
      .then(async () => {
        try {
          // 2s cap so a wedged storage call can't block subsequent click writes
          await Promise.race([
            (async () => {
              const { clickEvents = [] } = await chrome.storage.local.get({
                clickEvents: [],
              });
              const next = clickEvents.concat(click);
              if (next.length > CLICK_EVENTS_MAX) {
                next.splice(0, next.length - CLICK_EVENTS_MAX);
              }
              await chrome.storage.local.set({ clickEvents: next });
            })(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("click-write-timeout")), 2000),
            ),
          ]);
        } catch {
        }
      });
  }

  function getMonitorForWindow(message, sender, sendResponse) {
    chrome.system.display.getInfo((displays) => {
      chrome.windows.getCurrent((win) => {
        if (!win || chrome.runtime.lastError) {
          console.warn(
            "[get-monitor-for-window] No window found",
            chrome.runtime.lastError,
          );
          sendResponse({ error: "No window found" });
          return;
        }

        const monitor = displays.find(
          (d) =>
            win.left >= d.bounds.left &&
            win.left < d.bounds.left + d.bounds.width &&
            win.top >= d.bounds.top &&
            win.top < d.bounds.top + d.bounds.height,
        );

        if (!monitor) {
          console.warn("[get-monitor-for-window] No matching monitor");
          sendResponse({ error: "No matching monitor" });
        } else {
          chrome.storage.local.set(
            {
              displays,
              recordedMonitorId: monitor.id,
              monitorBounds: monitor.bounds,
            },
            () => {
              sendResponse({
                monitorId: monitor.id,
                monitorBounds: monitor.bounds,
                displays,
              });
            },
          );
        }
      });
    });

    return true;
  }

  registerMessage("get-monitor-for-window", getMonitorForWindow);

  registerMessage("fetch-videos", async (message, sender, sendResponse) => {
    if (!CLOUD_FEATURES_ENABLED) {
      sendResponse({ success: false, message: "Cloud features disabled" });
      return true;
    }
    const { authenticated, subscribed, user } = await loginWithWebsite({ force: true });

    if (!authenticated) {
      sendResponse({ success: false, message: "User not authenticated" });
      return true;
    }

    if (!subscribed) {
      sendResponse({ success: false, message: "Subscription inactive" });
      return true;
    }

    const response = await handleFetchVideos(message);
    sendResponse(response);

    return true;
  });
  registerMessage("reopen-popup-multi", async (message) => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }
    await handleReopenPopupMulti();
  });
  registerMessage(
    "check-storage-quota",
    async (message, sender, sendResponse) => {
      if (!CLOUD_FEATURES_ENABLED) {
        sendResponse({ success: false, error: "Cloud features disabled" });
        return true;
      }
      const authResult = await loginWithWebsite({ force: true });
      const { authenticated, subscribed } = authResult;

      if (!authenticated) {
        sendResponse({ success: false, error: "Not authenticated" });
        return true;
      }

      if (!subscribed) {
        sendResponse({ success: false, error: "Subscription inactive" });
        return true;
      }

      const response = await handleCheckStorageQuota();
      sendResponse(response);

      return true;
    },
  );
  registerMessage("time-warning", async (message) => {
    const tab = await getCurrentTab();
    if (tab?.id) {
      await sendMessageTab(tab.id, {
        type: "time-warning",
      }).catch((e) => console.warn("Failed to send time-warning to tab:", e));
    }
  });
  registerMessage("time-stopped", async (message) => {
    const tab = await getCurrentTab();
    if (tab?.id) {
      await sendMessageTab(tab.id, {
        type: "time-stopped",
      }).catch((e) => console.warn("Failed to send time-stopped to tab:", e));
    }
  });
  registerMessage("prepare-open-editor", async (message) => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }
    const targetUrl = message.url || null;
    const parsedTarget = parseEditorTargetUrl(targetUrl);
    const expectedProjectId = message.projectId || parsedTarget?.projectId || null;

    await chrome.storage.local.set({
      pendingEditorOpen: {
        url: targetUrl,
        publicUrl: message.publicUrl || null,
        projectId: expectedProjectId,
        instantMode: Boolean(message.instantMode),
        ts: Date.now(),
      },
    });

    console.info("[Screenity][BG] prepare-open-editor", {
      projectId: expectedProjectId,
      targetUrl,
      instantMode: Boolean(message.instantMode),
      hasPublicUrl: Boolean(message.publicUrl),
    });

    const expectedKind = message.instantMode ? "view" : "editor";
    const resolved = await resolveEditorTabForTarget({
      targetUrl,
      expectedProjectId: expectedProjectId,
      expectedKind,
      reason: "prepare-open-editor",
    });
    console.info("[Screenity][BG] prepare-open-editor resolved", {
      tabId: resolved.tabId || null,
      reused: Boolean(resolved.reused),
      opened: Boolean(resolved.opened),
      projectId: expectedProjectId,
    });
  });
  registerMessage("prepare-editor-existing", async (message) => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }
    let messageTab = null;
    let activeProjectId = null;

    if (message.multiMode) {
      messageTab = (await getCurrentTab())?.id || null;
      activeProjectId = (await chrome.storage.local.get(["projectId"]))
        .projectId;
    } else {
      const { projectId, instantMode } = await chrome.storage.local.get([
        "projectId",
        "instantMode",
      ]);
      activeProjectId = projectId;
      const targetUrl = getEditorTargetUrl({
        projectId,
        instantMode: Boolean(instantMode),
      });
      const resolved = await resolveEditorTabForTarget({
        targetUrl,
        expectedProjectId: projectId || null,
        expectedKind: instantMode ? "view" : "editor",
        reason: "prepare-editor-existing",
      });
      messageTab = resolved.tabId;
    }

    if (messageTab) {
      // Editor listeners (VideoEditorPage + EditorLayout) gate this
      // message on projectId matching the active project. Without
      // it they silently drop the event and the SceneLoader never
      // surfaces during the upload window.
      await sendMessageTab(messageTab, {
        type: "update-project-loading",
        multiMode: message.multiMode,
        projectId: activeProjectId || null,
      }).catch((err) =>
        console.warn(
          "[Screenity][BG] Failed to send update-project-loading",
          err,
        ),
      );
    } else {
      console.warn("❗ No valid messageTab found in prepare-editor-existing");
    }
  });
  registerMessage("preparing-recording", async () => {
    // getCurrentTab can return the pinned recorder tab; prefer stored activeTab
    const { activeTab } = await chrome.storage.local.get(["activeTab"]);
    const tabId = activeTab || (await getCurrentTab())?.id;
    if (tabId) {
      await sendMessageTab(tabId, {
        type: "preparing-recording",
      }).catch((e) =>
        console.warn("Failed to send preparing-recording to tab:", e),
      );
    }
  });
  registerMessage("editor-ready", async (message) => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }
    const { pendingEditorOpen } = await chrome.storage.local.get([
      "pendingEditorOpen",
    ]);

    let messageTab = null;
    const projectId = message.projectId || pendingEditorOpen?.projectId || null;
    const instantMode = Boolean(
      message.instantMode ?? pendingEditorOpen?.instantMode,
    );
    const targetUrl = getEditorTargetUrl({
      projectId,
      instantMode,
    });
    const editorUrl = message.editorUrl || pendingEditorOpen?.url || targetUrl;
    const expectedKind = instantMode ? "view" : "editor";
    const publicUrl = message.publicUrl || pendingEditorOpen?.publicUrl || null;
    const sceneId = message.sceneId || null;
    const localPlaybackOffer =
      (await getValidLocalPlaybackOffer({
        offerId: message?.localPlayback?.offerId || null,
        projectId: projectId || null,
        sceneId: sceneId || null,
      })) ||
      null;

    console.info("[Screenity][BG] editor-ready received", {
      newProject: Boolean(message.newProject),
      multiMode: Boolean(message.multiMode),
      projectId,
      hasSceneId: Boolean(sceneId),
      editorUrl,
      hasPendingOpen: Boolean(pendingEditorOpen),
      localPlaybackAvailable: Boolean(localPlaybackOffer?.offerId),
      localPlaybackOfferId: localPlaybackOffer?.offerId || null,
    });

    if (message.newProject) {
      const resolved = await resolveEditorTabForTarget({
        targetUrl: editorUrl,
        expectedProjectId: projectId,
        expectedKind,
        reason: "editor-ready:new-project",
      });
      messageTab = resolved.tabId;

      chrome.runtime.sendMessage({ type: "turn-off-pip" });

      // New-project recordings are user-facing public-shareable, so
      // flip isPublic before we hand the share URL to the clipboard.
      markProjectPublic(projectId);

      if (publicUrl) {
        copyToClipboard(publicUrl);
      }
    } else if (message.multiMode) {
      messageTab = (await getCurrentTab())?.id || null;
    } else {
      const resolved = await resolveEditorTabForTarget({
        targetUrl: editorUrl,
        expectedProjectId: projectId,
        expectedKind,
        reason: "editor-ready:existing-project",
      });
      messageTab = resolved.tabId;

      chrome.runtime.sendMessage({ type: "turn-off-pip" });
    }

    // non-newProject paths only; scene additions have null publicUrl, multiMode
    // new-project goes through handleFinishMultiRecording with its own clipboard
    if (publicUrl && !message.newProject) {
      copyToClipboard(publicUrl);
    }

    if (messageTab) {
      await sendMessageTab(messageTab, {
        type: "update-project-ready",
        share: Boolean(publicUrl),
        newProject: Boolean(message.newProject),
        sceneId: sceneId,
        projectId,
        localPlayback: localPlaybackOffer
          ? {
              available: true,
              offerId: localPlaybackOffer.offerId,
              trackType: "screen",
              chunkCount: localPlaybackOffer.chunkCount,
              estimatedBytes: localPlaybackOffer.estimatedBytes,
              expiresAt: localPlaybackOffer.expiresAt,
              source: localPlaybackOffer.source || "indexeddb-screen-chunks",
              mediaId: localPlaybackOffer.mediaId || null,
              bunnyVideoId: localPlaybackOffer.bunnyVideoId || null,
            }
          : {
              available: false,
              trackType: "screen",
            },
      }).catch((err) =>
        console.warn("[Screenity][BG] Failed to send update-project-ready", err),
      );
    } else {
      console.warn("❗ No valid messageTab found in editor-ready");
    }

    if (pendingEditorOpen) {
      await chrome.storage.local.remove(["pendingEditorOpen"]);
    }
  });
  registerMessage("cloud-local-playback-register", async (message) => {
    const normalizedOffer = normalizeLocalPlaybackOffer(message?.offer || {});
    if (!normalizedOffer.projectId || !normalizedOffer.sceneId) {
      return { ok: false, error: "missing-project-or-scene" };
    }
    if (!normalizedOffer.chunkCount || !normalizedOffer.estimatedBytes) {
      return { ok: false, error: "missing-local-screen-bytes" };
    }
    if (normalizedOffer.estimatedBytes > CLOUD_LOCAL_PLAYBACK_MAX_BYTES) {
      return {
        ok: false,
        error: "offer-too-large",
        maxBytes: CLOUD_LOCAL_PLAYBACK_MAX_BYTES,
      };
    }

    await chrome.storage.local.set({
      [CLOUD_LOCAL_PLAYBACK_KEY]: normalizedOffer,
      [CLOUD_LOCAL_PLAYBACK_EVENT_KEY]: {
        event: "offer-registered",
        at: Date.now(),
        offerId: normalizedOffer.offerId,
        projectId: normalizedOffer.projectId,
        sceneId: normalizedOffer.sceneId,
        chunkCount: normalizedOffer.chunkCount,
        estimatedBytes: normalizedOffer.estimatedBytes,
        expiresAt: normalizedOffer.expiresAt,
      },
    });
    await scheduleLocalPlaybackAlarm(normalizedOffer);

    console.info("[Screenity][BG] Registered local screen playback offer", {
      offerId: normalizedOffer.offerId,
      projectId: normalizedOffer.projectId,
      sceneId: normalizedOffer.sceneId,
      chunkCount: normalizedOffer.chunkCount,
      estimatedBytes: normalizedOffer.estimatedBytes,
      expiresAt: normalizedOffer.expiresAt,
    });

    return { ok: true, offer: normalizedOffer };
  });
  registerMessage("cloud-local-playback-clear", async (message) => {
    const result = await clearStoredLocalPlaybackOffer({
      reason: message?.reason || "explicit-clear",
      clearChunks: message?.clearChunks !== false,
      onlyIfOfferId: message?.offerId || null,
    });
    return result;
  });
  registerMessage("cloud-local-playback-get-offer", async (message) => {
    const offer = await getValidLocalPlaybackOffer({
      offerId: message?.offerId || null,
      projectId: message?.projectId || null,
      sceneId: message?.sceneId || null,
    });
    if (!offer) {
      return { ok: false, error: "offer-unavailable" };
    }
    return { ok: true, offer };
  });
  registerMessage("cloud-local-playback-read-chunk", async (message) => {
    const offer = await getValidLocalPlaybackOffer({
      offerId: message?.offerId || null,
      projectId: message?.projectId || null,
      sceneId: message?.sceneId || null,
    });
    if (!offer) {
      return { ok: false, error: "offer-unavailable" };
    }

    const index = Number(message?.index);
    if (!Number.isInteger(index) || index < 0 || index >= offer.chunkCount) {
      return { ok: false, error: "chunk-index-out-of-range", index };
    }

    const targetStore = offerScreenStore(offer);
    const item = await targetStore.getItem(`chunk_${index}`).catch(() => null);
    if (!item?.chunk) {
      return { ok: false, error: "chunk-missing", index };
    }

    // OPFS-stored Blobs come back with type "" (raw bytes); reconstruct
    // the mimeType from the offer's recorded container so the editor's
    // <video> element knows whether it's MP4 or WebM.
    const containerMime = offer.container || "video/webm";
    const blob =
      item.chunk instanceof Blob && item.chunk.type
        ? item.chunk
        : new Blob([item.chunk], { type: containerMime });
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        "",
      ),
    );

    return {
      ok: true,
      chunk: {
        index,
        size: blob.size,
        mimeType: blob.type || containerMime,
        base64,
      },
      offer: {
        offerId: offer.offerId,
        expiresAt: offer.expiresAt,
      },
    };
  });
  registerMessage("cloud-local-playback-mark-used", async (message) => {
    const offer = await getValidLocalPlaybackOffer({
      offerId: message?.offerId || null,
      projectId: message?.projectId || null,
      sceneId: message?.sceneId || null,
    });
    if (!offer) {
      return { ok: false, error: "offer-unavailable" };
    }
    const updated = {
      ...offer,
      status: "used",
      usedAt: Date.now(),
      usedBy: message?.usedBy || "editor",
      updatedAt: Date.now(),
    };
    await chrome.storage.local.set({
      [CLOUD_LOCAL_PLAYBACK_KEY]: updated,
      [CLOUD_LOCAL_PLAYBACK_EVENT_KEY]: {
        event: "offer-used",
        at: Date.now(),
        offerId: updated.offerId,
        projectId: updated.projectId,
        sceneId: updated.sceneId,
      },
    });
    console.info("[Screenity][BG] Local screen playback offer marked used", {
      offerId: updated.offerId,
      projectId: updated.projectId,
      sceneId: updated.sceneId,
    });
    return { ok: true, offer: updated };
  });
  registerMessage("cloud-local-playback-mark-fallback", async (message) => {
    const offer = await getValidLocalPlaybackOffer({
      offerId: message?.offerId || null,
      projectId: message?.projectId || null,
      sceneId: message?.sceneId || null,
    });
    if (!offer) {
      return { ok: false, error: "offer-unavailable" };
    }
    const updated = {
      ...offer,
      status: "fallback",
      fallbackReason: message?.reason || "unknown",
      fallbackAt: Date.now(),
      updatedAt: Date.now(),
    };
    await chrome.storage.local.set({
      [CLOUD_LOCAL_PLAYBACK_KEY]: updated,
      [CLOUD_LOCAL_PLAYBACK_EVENT_KEY]: {
        event: "offer-fallback",
        at: Date.now(),
        offerId: updated.offerId,
        reason: updated.fallbackReason,
      },
    });
    console.info("[Screenity][BG] Local screen playback offer fallback", {
      offerId: updated.offerId,
      reason: updated.fallbackReason,
    });
    return { ok: true, offer: updated };
  });
  registerMessage("finish-multi-recording", async () => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }
    await handleFinishMultiRecording();
  });
  registerMessage("handle-reactivate", async () => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }

    chrome.tabs.create({
      url: `${process.env.SCREENITY_APP_BASE}/reactivate`,
      active: true,
    });
  });
  registerMessage("handle-upgrade", async () => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }

    chrome.tabs.create({
      url: `${process.env.SCREENITY_APP_BASE}/upgrade`,
      active: true,
    });
  });
  registerMessage("open-account-settings", async () => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }
    const { authenticated } = await loginWithWebsite({ force: true });
    if (!authenticated) {
      console.warn("User not authenticated, cannot open account settings");
      return;
    }

    const url = `${process.env.SCREENITY_APP_BASE}/?settings=open`;
    createTab(url, true);
  });
  registerMessage("open-support", async () => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }
    const { authenticated, user } = await loginWithWebsite({ force: true });
    if (!authenticated || !user) {
      console.warn("User not authenticated, cannot open support");
      return;
    }

    const { name, email } = user;
    const qs = await supportContextQuery({
      includeRecordingState: true,
      source: "settings",
      user: { name, email },
    });
    const url = `https://tally.so/r/310MNg?extension=true&${qs}`;
    createTab(url, true);
  });
  registerMessage("check-banner-support", async (message, sendResponse) => {
    const { bannerSupport } = await chrome.storage.local.get(["bannerSupport"]);
    sendResponse({ bannerSupport: Boolean(bannerSupport) });
    return true;
  });
  registerMessage("hide-banner", async () => {
    await chrome.storage.local.set({ bannerSupport: false });
    chrome.runtime.sendMessage({ type: "hide-banner" });
  });
  registerMessage("check-review-prompt", async () => {
    // This router uses the handler's RETURN value as the response (it calls
    // handler(message, sender, sendResponse), so the 2nd arg is `sender`, not a
    // response callback). So return the object; do not call sendResponse.
    return { showReview: await shouldShowReviewPrompt() };
  });
  registerMessage("review-prompt-action", async (message) => {
    const action = message?.action;
    const { reviewPromptState } = await chrome.storage.local.get([
      "reviewPromptState",
    ]);
    const next = { ...(reviewPromptState || {}) };
    if (action === "shown") {
      next.lastShownAt = Date.now();
      next.shownCount = (next.shownCount || 0) + 1;
    } else if (action === "later") {
      // Thumbs-up but not now, so snooze for a long while.
      next.snoozedUntil = Date.now() + REVIEW_GATE.snoozeDays * DAY_MS;
    } else if (
      action === "reviewed" ||
      action === "dismiss" ||
      action === "feedback"
    ) {
      // Reviewed, opted out, or routed to feedback (unhappy): don't ask again.
      next.done = true;
    }
    await chrome.storage.local.set({ reviewPromptState: next });
  });
  // Thumbs-down opens the same feedback form as "Report a bug", tagged as
  // coming from the review prompt.
  registerMessage("review-feedback", async () => {
    const qs = await supportContextQuery({
      includeRecordingState: true,
      source: "review-prompt",
    });
    createTab(`https://tally.so/r/3ElpXq?${qs}`, true);
  });
  registerMessage("clear-recording-alarm", async () => {
    await chrome.alarms.clear("recording-alarm");
  });
  // extension pages can't message content scripts directly
  registerMessage("show-toast", async (message) => {
    try {
      const { activeTab } = await chrome.storage.local.get(["activeTab"]);
      if (activeTab) {
        sendMessageTab(activeTab, {
          type: "show-toast",
          message: message.message,
          timeout: message.timeout,
        }).catch(() => {});
      }
    } catch {}
  });
  // Offscreen recorder can't mount the styled "record computer audio" Warning,
  // so it relays here and we forward to the content script's Warning component.
  registerMessage("show-audio-warning", async (message) => {
    try {
      const { activeTab } = await chrome.storage.local.get(["activeTab"]);
      if (activeTab) {
        sendMessageTab(activeTab, {
          type: "show-audio-warning",
          variant: message.variant,
          timeout: message.timeout,
        }).catch(() => {});
      }
    } catch {}
  });
  registerMessage("finalize-failure", async (message) => {
    try {
      const { activeTab } = await chrome.storage.local.get(["activeTab"]);
      if (activeTab) {
        sendMessageTab(activeTab, {
          type: "finalize-failure",
          reason: message.reason,
        }).catch(() => {});
      }
    } catch {}
  });
  registerMessage("finalize-recovered", async () => {
    try {
      const { activeTab } = await chrome.storage.local.get(["activeTab"]);
      if (activeTab) {
        sendMessageTab(activeTab, { type: "finalize-recovered" }).catch(() => {});
      }
    } catch {}
  });
  registerMessage("get-tab-id", (message, sender, sendResponse) => {
    sendResponse({ tabId: sender?.tab?.id ?? null });
    return true;
  });
  registerMessage("refresh-auth", async () => {
    if (!CLOUD_FEATURES_ENABLED)
      return { success: false, message: "Cloud features disabled" };
    return await loginWithWebsite({ force: true });
  });
  registerMessage("sync-recording-state", async (message, sendResponse) => {
    const {
      recording,
      paused,
      recordingStartTime,
      pausedAt,
      totalPausedMs,
      pendingRecording,
    } = await chrome.storage.local.get([
      "recording",
      "paused",
      "recordingStartTime",
      "pausedAt",
      "totalPausedMs",
      "pendingRecording",
    ]);
    sendResponse({
      recording: Boolean(recording),
      paused: Boolean(paused),
      recordingStartTime: recordingStartTime || null,
      pausedAt: pausedAt || null,
      totalPausedMs: totalPausedMs || 0,
      pendingRecording: Boolean(pendingRecording),
    });
    return true;
  });
  registerMessage(
    "register-recording-session",
    async (message, sender, sendResponse) => {
      const incoming = normalizeIncomingSession(message.session || {}, sender);
      const resolution = await resolveActiveSessionConflict(incoming);
      if (!resolution.allow) {
        sendResponse({
          ok: false,
          error: "Another recording session is already active",
          activeRecordingSession,
        });
        return true;
      }

      activeRecordingSession = incoming;
      registerRecordingTabListener(incoming.recorderTabId);
      sendResponse({
        ok: true,
        session: activeRecordingSession,
        staleRecovered: resolution.staleRecovered,
      });
      return true;
    },
  );

  registerMessage(
    "clear-recording-session",
    async (message, sender, sendResponse) => {
      await clearRecordingSessionSafe(
        message?.reason || "clear-recording-session",
      );
      sendResponse({ ok: true });
      return true;
    },
  );

  registerMessage(
    "clear-recording-session-safe",
    async (message, sender, sendResponse) => {
      await clearRecordingSessionSafe(
        message?.reason || "clear-recording-session-safe",
        {
          sourceTabId: sender?.tab?.id || null,
        },
      );
      sendResponse({ ok: true });
      return true;
    },
  );

  registerMessage(
    "restore-recording-session",
    async (message, sender, sendResponse) => {
      const { recorderSession } = await chrome.storage.local.get([
        "recorderSession",
      ]);
      sendResponse({ recorderSession: recorderSession || null });
      return true;
    },
  );

  registerMessage("activate-recorder-tab", async (message, sender) => {
    const tabId = sender?.tab?.id;
    if (tabId) {
      try {
        await chrome.tabs.update(tabId, { active: true });
      } catch (err) {
        console.warn("[Screenity] activate-recorder-tab failed:", String(err));
      }
    }
  });

  registerMessage("start-first-chunk-watchdog", async () => {
    await chrome.alarms.clear(FIRST_CHUNK_WATCHDOG_ALARM).catch(() => {});
    await chrome.alarms.create(FIRST_CHUNK_WATCHDOG_ALARM, {
      delayInMinutes: 8 / 60,
    });
  });

  registerMessage("cancel-first-chunk-watchdog", async () => {
    await chrome.alarms.clear(FIRST_CHUNK_WATCHDOG_ALARM).catch(() => {});
  });

  // Zip in BG so jszip stays out of contentScript.bundle.js (~100KB).
  registerMessage("make-zip", async (message) => {
    try {
      const files = (message && message.files) || {};
      const filename =
        (message && typeof message.filename === "string"
          ? message.filename
          : null) || "screenity-bundle.zip";
      const zip = new JSZip();
      for (const [name, content] of Object.entries(files)) {
        if (typeof content === "string") {
          zip.file(name, content);
        } else if (content instanceof Uint8Array) {
          zip.file(name, content);
        } else if (content && typeof content === "object") {
          // Convenience: stringify plain objects so callers can pass
          // structured payloads directly.
          zip.file(name, JSON.stringify(content));
        }
      }
      // base64 because ArrayBuffer/Uint8Array structured-clone is
      // unreliable across MV3 SW → content (lands as empty {}).
      const base64 = await zip.generateAsync({ type: "base64" });
      return { ok: true, base64, filename };
    } catch (err) {
      console.warn("[make-zip] failed", err);
      return {
        ok: false,
        error: String((err && err.message) || err).slice(0, 200),
      };
    }
  });

  // Receive perf entries from page contexts at pagehide; routed via
  // BG so the storage IPC completes (a dying page racing storage.set
  // drops the last few marks). Cloud upload telemetry routes here too.
  registerMessage("cloud-telemetry-event", async (message) => {
    const event = message?.event;
    if (!event || typeof event !== "object") return { ok: false };
    const ok = await appendUploadTelemetryEventSerialized(event);
    return { ok };
  });

  registerMessage("perf-forward", async (message) => {
    try {
      const ctx = typeof message?.ctx === "string" ? message.ctx : "unknown";
      const entries = Array.isArray(message?.entries) ? message.entries : [];
      if (!entries.length) return;
      const key = `perfTimeline.${ctx}`;
      const r = await chrome.storage.local.get([key]);
      const cur = Array.isArray(r[key]) ? r[key] : [];
      for (const e of entries) cur.push(e);
      while (cur.length > 300) cur.shift();
      await chrome.storage.local.set({ [key]: cur });
    } catch {
      // Best-effort; perf data isn't user-facing functionality.
    }
  });
};

import { registerMessage } from "../../../messaging/messageRouter";
import {
  focusTab,
  createTab,
  resetActiveTab,
  resetActiveTabRestart,
  setSurface,
} from "../tabManagement";

import { startAfterCountdown, startRecording } from "../recording/startRecording";
import {
  handleStopRecordingTab,
  handleStopRecordingTabBackup,
} from "../recording/stopRecording";
import { sendChunks } from "../recording/sendChunks";
import { chunksStore } from "../recording/chunkHandler";
import { handleSaveToDrive } from "../drive/handleSaveToDrive";
import { addAlarmListener } from "../alarms/addAlarmListener";
import { cancelRecording, handleDismiss } from "../recording/cancelRecording";
import { handleDismissRecordingTab } from "../recording/discardRecording";
import { sendMessageRecord } from "../recording/sendMessageRecord";
import { startRecorderSession } from "../recording/openRecorderTab";
import { acquireStreamForOffscreen } from "../offscreen/acquireStream";
import { registerProxyStorageHandlers } from "../offscreen/proxyStorageHandlers";
import { forceProcessing } from "../recording/forceProcessing";
import {
  restartActiveTab,
  getCurrentTab,
  sendMessageTab,
  parseEditorTargetUrl,
  resolveEditorTabForTarget,
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
  writeFile,
  videoReady,
  handleGetStreamingData,
  handleRecordingError,
  handleRecordingComplete,
  handleOnGetPermissions,
  handlePip,
  checkCapturePermissions,
} from "../recording/recordingHelpers";
import { newChunk, clearAllRecordings } from "../recording/chunkHandler";
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
const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";
// Debug toggle for post-stop/chunk flow
const DEBUG_POSTSTOP = false;
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
    createdAt,
    expiresAt,
    updatedAt: now,
  };
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
    await chunksStore.clear().catch((err) => {
      console.warn(
        "[Screenity][BG] Failed to clear chunksStore while clearing local playback offer",
        err,
      );
    });
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

const ensureAudioOffscreen = async () => {
  if (!chrome.offscreen) return false;
  try {
    const contexts = await chrome.runtime.getContexts({});
    const hasAnyOffscreen = contexts.some(
      (context) => context.contextType === "OFFSCREEN_DOCUMENT",
    );
    // If an offscreen document already exists (e.g. the recorder), reuse it
    // — Chrome only allows one offscreen document per extension.
    if (hasAnyOffscreen) return true;
    await chrome.offscreen.createDocument({
      url: "audiooffscreen.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Play short UI beep sounds.",
    });
    return true;
  } catch (error) {
    console.warn("Failed to ensure audio offscreen document", error);
    return false;
  }
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

    // On 401, invalidate auth cache and retry once so loginWithWebsite()
    // in the outer handler can refresh the token on the next attempt.
    if (res.status === 401 && !retried) {
      await chrome.storage.local.set({ lastAuthCheck: 0 });
      const refresh = await loginWithWebsite();
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

const handleFinishMultiRecording = async () => {
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

      const res = await fetch(
        `${API_BASE}/videos/${multiProjectId}/auto-publish`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await chrome.storage.local
              .get("screenityToken")
              .then((r) => r.screenityToken)}`,
          },
        },
      );

      const url = `${process.env.SCREENITY_APP_BASE}/editor/${multiProjectId}/edit?share=true`;
      const publicUrl = `${process.env.SCREENITY_APP_BASE}/view/${multiProjectId}/`;

      if (!res.ok) {
        console.warn("Failed to auto-publish multi recording", res.status);
      }

      // Open the editor directly
      createTab(url, true, true).then(() => {
        if (publicUrl) {
          copyToClipboard(publicUrl);
          chrome.runtime.sendMessage({
            type: "show-toast",
            message: "Public video link copied to clipboard!",
          });
        }
      });
    } else {
      // Multi recording on existing project: only reuse editorTab if it still
      // matches this project and expected editor/view URL.
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

    // Reset multi-mode state
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
  try {
    await chrome.storage.local.set({
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
      chrome.runtime.sendMessage({
        type: "stop-recording-tab",
        reason: "recorder-owner-tab-closed",
        tabId: closedTabId,
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
    // Keep tabId for backward compatibility.
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

// Initialize message router and register all handlers
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
  registerMessage("backup-created", (message) =>
    startRecorderSession(message.request, message.tabId),
  );
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
  registerMessage("offscreen-diag", async (message) => {
    console.warn("[Screenity][OffscreenDiag]", message.source, message.payload);
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
  registerMessage("offscreen-request-stream", async (message, sender) => {
    try {
      // Fall back to recordingUiTabId so the picker anchors to the user's tab, not the offscreen doc.
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
  registerMessage("write-file", (message) => writeFile(message));
  registerMessage("handle-restart", (message, sender) =>
    handleRestart(message, sender),
  );
  registerMessage("handle-dismiss", (message) => handleDismiss(message));
  registerMessage("reset-active-tab", () => resetActiveTab(false));
  registerMessage("reset-active-tab-restart", (message) =>
    resetActiveTabRestart(message),
  );
  registerMessage("video-ready", async (message) => {
    await videoReady(message);
    await clearRecordingSessionSafe("video-ready");
  });

  // Fired by Region/Recorder.jsx pagehide — the iframe is being torn down
  // because the user navigated away from the recorded tab.
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
    // Only treat as a real region-recording teardown when the iframe was
    // actually hosting the MediaRecorder (customRegion flow). Plain
    // tab-area records in the pinned recorder tab, so navigation of the
    // recorded page must not tear it down.
    if (!customRegion) return;

    diagEvent("region-iframe-destroyed");
    await chrome.storage.local.set({
      recording: false,
      customRegion: false,
      // Clear recordingTab so stopRecording() doesn't think the editor was
      // already opened by the stop-recording-tab flow (recordingTab points
      // to the pinned recorder.html tab which didn't open any editor).
      recordingTab: null,
      postStopEditorOpening: false,
      postStopEditorOpened: false,
      recorderSession: recorderSession
        ? { ...recorderSession, status: "stopped" }
        : null,
    });

    // If no chunks were persisted (user navigated almost immediately),
    // show a toast instead of opening an empty editor.
    const chunkCount = await chunksStore.length().catch(() => 0);
    if (chunkCount === 0) {
      diagEvent("region-nav-no-chunks");
      const { activeTab } = await chrome.storage.local.get(["activeTab"]);
      if (activeTab) {
        sendMessageTab(activeTab, {
          type: "show-toast",
          message: chrome.i18n.getMessage("recordingTooShortToast"),
          timeout: 5000,
        }).catch(() => {});
      }
      return;
    }

    await videoReady();
  });

  registerMessage("start-recording", (message) => startRecording(message));
  registerMessage("countdown-finished", async (message) => {
    const { recording, restarting, pendingRecording } =
      await chrome.storage.local.get([
      "recording",
      "restarting",
      "pendingRecording",
    ]);
    // pendingRecording/restarting are expected transitional flags while countdown
    // runs. During restart, `recording` may still be true briefly from the
    // previous session, so only block when recording is active AND not restarting.
    if (recording && !restarting) {
      diagEvent("countdown-finished", { skipped: true, reason: "already-recording" });
      const decisionAt = Date.now();
      await chrome.storage.local.set({
        lastCountdownFinishedDecision: {
          ts: decisionAt,
          startedAt: null,
          endedAt: message?.endedAt || null,
          acceptedCountdownFinishedAt: false,
          recording: Boolean(recording),
          restarting: Boolean(restarting),
          pendingRecording: Boolean(pendingRecording),
          started: false,
          reason: "already-recording",
        },
      });
      return { ok: true, skipped: true };
    }
    diagEvent("countdown-finished", { skipped: false });
    const decisionAt = Date.now();
    await chrome.storage.local.set({
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
    startAfterCountdown();
    return { ok: true };
  });
  registerMessage("restarted", (message) => restartActiveTab(message));
  const sendChunksToSandbox = async (sender) => {
    if (DEBUG_POSTSTOP)
      console.debug("[Screenity][BG] sendChunksToSandbox invoked", {
        senderTab: sender?.tab?.id,
      });

    const { sandboxTab } = await chrome.storage.local.get(["sandboxTab"]);
    // Prefer stored sandboxTab but fall back to the caller tab if available
    const targetTab = sandboxTab || sender?.tab?.id || null;
    if (!targetTab) {
      if (DEBUG_POSTSTOP)
        console.warn("[Screenity][BG] no targetTab for sendChunksToSandbox");
      throw new Error("no-sandbox-tab");
    }

    const pingReady = async () => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: "ping", _targetTabId: targetTab },
          (response) => {
            resolve(response?.status === "ready");
          },
        );
      });
    };

    const maxPingAttempts = 10;
    let pingOk = false;
    for (let attempt = 1; attempt <= maxPingAttempts; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      pingOk = await pingReady();
      if (DEBUG_POSTSTOP)
        console.debug("[Screenity][BG] ping attempt", { attempt, pingOk });
      if (pingOk) break;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 200));
    }

    if (!pingOk) {
      if (DEBUG_POSTSTOP)
        console.warn(
          "[Screenity][BG] sandbox not ready after pings, proceeding anyway",
          { targetTab },
        );
      // Proceed even if ping failed — runtime message ports can be unreliable
      // during page load; we'll attempt to send chunks regardless.
    }

    const maxAttempts = 6;
    const delayMs = 250;
    let chunkCount = 0;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      chunkCount = 0;
      await chunksStore.iterate(() => {
        chunkCount += 1;
      });
      if (DEBUG_POSTSTOP)
        console.debug("[Screenity][BG] checking chunks in IndexedDB", {
          attempt,
          chunkCount,
        });
      if (chunkCount > 0) break;
      await new Promise((r) => setTimeout(r, delayMs));
    }

    let result = null;
    const maxDeliveryAttempts = 6;
    for (
      let deliveryAttempt = 1;
      deliveryAttempt <= maxDeliveryAttempts;
      deliveryAttempt += 1
    ) {
      if (DEBUG_POSTSTOP)
        console.debug("[Screenity][BG] calling sendChunks() to deliver", {
          targetTab,
          chunkCount,
          deliveryAttempt,
        });
      // eslint-disable-next-line no-await-in-loop
      result = await sendChunks(false, {
        tabId: targetTab,
        frameId: sender?.frameId,
      });
      if (result?.status === "ok") {
        if (DEBUG_POSTSTOP)
          console.debug("[Screenity][BG] sendChunks() completed", result);
        return { status: "ok", chunkCount: result.chunkCount };
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (DEBUG_POSTSTOP)
      console.warn("[Screenity][BG] sendChunks() did not find chunks", {
        targetTab,
        result,
      });
    return { status: "empty", chunkCount: 0 };
  };

  registerMessage("send-chunks-to-sandbox", (message, sender) =>
    sendChunksToSandbox(sender),
  );

  registerMessage("new-chunk", (message, sender, sendResponse) => {
    newChunk(message, sendResponse);
    return true;
  });

  registerMessage(
    "get-streaming-data",
    async (message, sender) => await handleGetStreamingData(message, sender),
  );
  registerMessage("cancel-recording", (message) => cancelRecording(message));
  registerMessage("stop-recording-tab", (message, sender, sendResponse) => {
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
  registerMessage("set-mic-active-tab", (message) => setMicActiveTab(message));

  // Diagnostic events routed from content scripts / sandbox
  registerMessage("diag-countdown-started", () => diagEvent("countdown-started"));
  registerMessage("diag-countdown-cancelled", () => diagEvent("countdown-cancelled"));
  registerMessage("diag-editor-ready", (message) =>
    diagEvent("editor-load-ready", { path: message?.path || null }),
  );
  // Only accept "sandbox-" / "sw-" prefixed events so a compromised context can't spoof lifecycle events.
  registerMessage("diag-forward", (message) => {
    const ev = typeof message?.event === "string" ? message.event : null;
    if (!ev) return;
    if (!ev.startsWith("sandbox-") && !ev.startsWith("sw-")) return;
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
  registerMessage("on-get-permissions", (message) =>
    handleOnGetPermissions(message),
  );
  registerMessage(
    "recording-complete",
    async (message, sender) => await handleRecordingComplete(message, sender),
  );
  registerMessage("check-recording", (message) => checkRecording(message));
  registerMessage("open-download-mp4", async () => {
    // If cloud features are enabled and the user is signed in, block the
    // local "fast MP4" recovery flow to avoid diverging from the pro/server
    // workflow. Show a toast instead.
    if (CLOUD_FEATURES_ENABLED) {
      try {
        const { authenticated } = await loginWithWebsite();
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

    const tab = await createTab("download.html", true, true);
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
      false,
      true,
    ),
  );
  registerMessage("follow-twitter", () =>
    createTab("https://alyssax.substack.com/", false, true),
  );
  registerMessage("pricing", () =>
    createTab("https://screenity.io/pro", false, true),
  );
  registerMessage("open-processing-info", () =>
    createTab(
      "https://help.screenity.io/editing-and-exporting/dJRFpGq56JFKC7k8zEvsqb/why-is-there-a-5-minute-limit-for-editing/ddy4e4TpbnrFJ8VoRT37tQ",
      true,
      true,
    ),
  );
  registerMessage("upgrade-info", () =>
    createTab(
      "https://help.screenity.io/getting-started/77KizPC8MHVGfpKpqdux9D/what-are-the-technical-requirements-for-using-screenity/6kdB6qru6naVD8ZLFvX3m9",
      true,
      true,
    ),
  );
  registerMessage("trim-info", () =>
    createTab(
      "https://help.screenity.io/editing-and-exporting/dJRFpGq56JFKC7k8zEvsqb/how-to-cut-trim-or-mute-parts-of-your-video/svNbM7YHYY717MuSWXrKXH",
      true,
      true,
    ),
  );
  registerMessage("join-waitlist", () =>
    createTab("https://tally.so/r/npojNV", true, true),
  );
  registerMessage("chrome-update-info", () =>
    createTab(
      "https://help.screenity.io/getting-started/77KizPC8MHVGfpKpqdux9D/what-are-the-technical-requirements-for-using-screenity/6kdB6qru6naVD8ZLFvX3m9",
      true,
      true,
    ),
  );
  registerMessage("set-surface", (message) => setSurface(message));
  registerMessage("pip-ended", () => handlePip(false));
  registerMessage("pip-started", () => handlePip(true));
  registerMessage("sign-out-drive", (message) => handleSignOutDrive(message));
  registerMessage("open-help", () =>
    createTab("https://help.screenity.io/", true, true),
  );
  registerMessage("memory-limit-help", () =>
    createTab(
      "https://help.screenity.io/troubleshooting/9Jy5RGjNrBB42hqUdREQ7W/what-does-%E2%80%9Cmemory-limit-reached%E2%80%9D-mean-when-recording/8WkwHbt3puuXunYqQnyPcb",
      true,
      true,
    ),
  );
  registerMessage("open-home", () =>
    createTab("https://screenity.io/", false, true),
  );
  registerMessage("report-bug", async () => {
    const qs = await supportContextQuery({
      includeRecordingState: true,
      source: "settings",
    });
    createTab(`https://tally.so/r/3ElpXq?${qs}`, false, true);
  });
  registerMessage("report-error", async (message) => {
    const errorCode = message?.errorCode || null;
    const errorWhy = message?.errorWhy || null;
    const source = message?.source || "error-modal";

    // Check auth for form routing
    let user = null;
    let isLoggedIn = false;
    if (CLOUD_FEATURES_ENABLED) {
      try {
        const auth = await loginWithWebsite();
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

    if (isLoggedIn) {
      createTab(`https://tally.so/r/310MNg?extension=true&${qs}`, false, true);
    } else {
      createTab(`https://tally.so/r/3ElpXq?feedbackType=Bug&${qs}`, false, true);
    }
  });
  registerMessage("clear-recordings", () => clearAllRecordings());
  registerMessage("force-processing", (message) => forceProcessing(message));
  registerMessage("focus-this-tab", (message, sender) =>
    focusTab(sender.tab.id),
  );
  registerMessage("stop-recording-tab-backup", (message) =>
    handleStopRecordingTabBackup(message),
  );
  registerMessage("indexed-db-download", (message) =>
    downloadIndexedDB(message),
  );
  registerMessage("get-platform-info", async () => await getPlatformInfo());
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
      // best effort
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

  // Prevent Chrome from discarding the CloudRecorder tab during recording
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
      false,
      true,
    ),
  );
  registerMessage("add-alarm-listener", (payload) => addAlarmListener(payload));
  registerMessage(
    "check-auth-status",
    async () => {
      if (!CLOUD_FEATURES_ENABLED) {
        return {
          authenticated: false,
          message: "Cloud features disabled",
        };
      }
      return await loginWithWebsite();
    },
  );
  registerMessage(
    "create-video-project",
    async (message, sender, sendResponse) => {
      if (!CLOUD_FEATURES_ENABLED) {
        sendResponse({ success: false, message: "Cloud features disabled" });
        return true;
      }
      const { authenticated, subscribed, user } = await loginWithWebsite();

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
    // User is explicitly initiating login — clear the stay-logged-out flag.
    await chrome.storage.local.set({ stayLoggedOut: false });

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
    await chrome.storage.local.remove([
      "screenityToken",
      "screenityUser",
      "lastAuthCheck",
      "isSubscribed",
      "isLoggedIn",
      "proSubscription",
    ]);

    // Preserve a post-logout marker so popup can render the LoggedOut state.
    // stayLoggedOut blocks auto-login until the user explicitly clicks "Log in".
    await chrome.storage.local.set({
      isLoggedIn: false,
      wasLoggedIn: true,
      stayLoggedOut: true,
      isSubscribed: false,
      proSubscription: null,
      screenityUser: null,
    });

    sendResponse({ success: true });
    return true;
  });

  registerMessage("click-event", async ({ payload }, sender) => {
    if (!CLOUD_FEATURES_ENABLED) return;
    const { x, y, surface, region, isTab } = payload;
    const senderWindowId = sender.tab?.windowId;

    // Ask Recorder for current video time
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

  function storeClick(click) {
    chrome.storage.local.get({ clickEvents: [] }, (data) => {
      chrome.storage.local.set({ clickEvents: [...data.clickEvents, click] });
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
          // Save monitor info directly into chrome.storage.local
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
    const { authenticated, subscribed, user } = await loginWithWebsite();

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
      const authResult = await loginWithWebsite();
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

    if (message.multiMode) {
      messageTab = (await getCurrentTab())?.id || null;
    } else {
      const { projectId, instantMode } = await chrome.storage.local.get([
        "projectId",
        "instantMode",
      ]);
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
      await sendMessageTab(messageTab, {
        type: "update-project-loading",
        multiMode: message.multiMode,
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
    // Prefer stored activeTab over getCurrentTab() which can return
    // the pinned recorder tab instead of the user's page.
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

      // Copy to clipboard immediately after focusTab, before the auto-publish
      // network request.  The auto-publish await can take hundreds of ms, during
      // which the renderer may lose document focus — causing navigator.clipboard
      // to throw "Document is not focused".  Copying here gives the best chance
      // the tab is still the topmost focused document.
      if (publicUrl) {
        copyToClipboard(publicUrl);
      }

      if (projectId) {
        await fetch(
          `${API_BASE}/videos/${projectId}/auto-publish`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${await chrome.storage.local
                .get("screenityToken")
                .then((r) => r.screenityToken)}`,
            },
          },
        ).catch((err) =>
          console.warn("[Screenity][BG] Failed to auto-publish project", err),
        );
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

    // Copy for the non-newProject paths (scene additions are excluded because
    // publicUrl is null there; multiMode new-project is excluded because it
    // goes through handleFinishMultiRecording which has its own clipboard call).
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

    const item = await chunksStore.getItem(`chunk_${index}`).catch(() => null);
    if (!item?.chunk) {
      return { ok: false, error: "chunk-missing", index };
    }

    const blob =
      item.chunk instanceof Blob
        ? item.chunk
        : new Blob([item.chunk], { type: "video/webm" });
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
        mimeType: blob.type || "video/webm",
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
    const { authenticated } = await loginWithWebsite();
    if (!authenticated) {
      console.warn("User not authenticated, cannot open account settings");
      return;
    }

    const url = `${process.env.SCREENITY_APP_BASE}/?settings=open`;
    createTab(url, true, true);
  });
  registerMessage("open-support", async () => {
    if (!CLOUD_FEATURES_ENABLED) {
      console.warn("Cloud features disabled");
      return;
    }
    const { authenticated, user } = await loginWithWebsite();
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
    createTab(url, true, true);
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
  registerMessage("clear-recording-alarm", async () => {
    await chrome.alarms.clear("recording-alarm");
  });
  // Relay toasts to the active content script (extension pages can't reach it directly).
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
  registerMessage("get-tab-id", (message, sender, sendResponse) => {
    sendResponse({ tabId: sender?.tab?.id ?? null });
    return true;
  });
  registerMessage("play-beep", async (message, sender, sendResponse) => {
    const ok = await ensureAudioOffscreen();
    if (ok) {
      chrome.runtime.sendMessage({ type: "play-beep-offscreen" });
    }
    if (sendResponse) sendResponse({ ok });
    return true;
  });
  registerMessage("refresh-auth", async () => {
    if (!CLOUD_FEATURES_ENABLED)
      return { success: false, message: "Cloud features disabled" };
    return await loginWithWebsite();
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
};

import React, { useEffect, useState, useRef, useCallback } from "react";
import RecorderUI from "./RecorderUI";
import {
  sendRecordingError as sendRecordingErrorBase,
  sendStopRecording,
} from "./messaging";
import { getBitrates, getResolutionForQuality } from "./recorderConfig";
import BunnyTusUploader from "./bunnyTusUploader";
import localforage from "localforage";
import { createVideoProject } from "./createVideoProject";
import { getUserMediaWithFallback } from "../utils/mediaDeviceFallback";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

const API_BASE = process.env.SCREENITY_API_BASE_URL;
const DEBUG_START_FLOW =
  typeof window !== "undefined" ? !!window.SCREENITY_DEBUG_RECORDER : false;
const SCREEN_CHUNK_MEMORY_WINDOW = 8;
const CAMERA_CHUNK_MEMORY_WINDOW = 8;
const AUDIO_CHUNK_MEMORY_WINDOW = 8;
const STORAGE_CHECK_INTERVAL_MS = 5000;
const STORAGE_LOW_HEADROOM_BYTES = 250 * 1024 * 1024;
const STORAGE_CRITICAL_HEADROOM_BYTES = 120 * 1024 * 1024;
const AUDIO_MAX_BUFFER_BYTES = 150 * 1024 * 1024;
const LOCAL_SCREEN_PLAYBACK_TTL_MS = 20 * 60 * 1000;
const LOCAL_SCREEN_PLAYBACK_MAX_BYTES = 250 * 1024 * 1024;
const MAX_UPLOAD_TELEMETRY_EVENTS = 300;
const UPLOAD_TELEMETRY_KEY = "cloudUploadTelemetryEvents";
const UPLOAD_TELEMETRY_ENDPOINT = `${API_BASE}/log/upload-event`;
const SESSION_STATE_INDEX_KEY = "cloudRecorderSessionStateIndex";
const RECOVERABLE_SESSION_STATUSES = new Set([
  "recording",
  "hidden",
  "unload",
  "stopping",
  "finalize-failed",
  "upload-stalled",
]);

const chunksStore = localforage.createInstance({ name: "chunks" });
const audioChunksStore = localforage.createInstance({ name: "audioChunks" });
const cameraChunksStore = localforage.createInstance({ name: "cameraChunks" });

const urlParams = new URLSearchParams(window.location.search);
const IS_INJECTED_IFRAME = urlParams.has("injected");
const IS_IFRAME_CONTEXT =
  IS_INJECTED_IFRAME ||
  (window.top !== window.self &&
    !document.referrer.startsWith("chrome-extension://"));

const CloudRecorder = () => {
  // Debug bundle removed; keep a no-op logger to preserve calls

  const screenTimer = useRef({ start: null, total: 0, paused: false });
  const cameraTimer = useRef({ start: null, total: 0, paused: false });
  const [started, setStarted] = useState(false);
  const [initProject, setInitProject] = useState(false);
  const [finalizeFailure, setFinalizeFailure] = useState(null);
  const finalizeFailureRef = useRef(null);
  const finalizeContextRef = useRef(null);
  const simulateFinalizeFailureConsumedRef = useRef(false);
  const [retryingFinalize, setRetryingFinalize] = useState(false);

  const retryFinalize = async () => {
    setRetryingFinalize(true);
    try {
      // Attempt to re-run finalize flow by calling stopRecording with shouldFinalize=true
      await stopRecording(true, "retry-finalize");
    } catch (err) {
      console.warn("Retry finalize failed:", err);
    } finally {
      setRetryingFinalize(false);
    }
  };

  const isTab = useRef(false);
  const tabID = useRef(null);
  const recordingTabId = useRef(null);
  const tabPreferred = useRef(false);

  const screenStream = useRef(null);
  const cameraStream = useRef(null);
  const micStream = useRef(null);
  const rawMicStream = useRef(null);

  const screenRecorder = useRef(null);
  const cameraRecorder = useRef(null);
  const audioRecorder = useRef(null);

  const screenUploader = useRef(null);
  const cameraUploader = useRef(null);
  const uploadMetaRef = useRef(null);
  const localScreenPlaybackOfferRef = useRef(null);
  const emptyCleanupRef = useRef(false);

  const backupRef = useRef(false);
  const audioInputGain = useRef(null);
  const audioOutputGain = useRef(null);

  const uploadersInitialized = useRef(false);
  const pendingStartRef = useRef(false);
  const pendingStartAttempts = useRef(0);
  const pendingStartTimer = useRef(null);

  const isRestarting = useRef(false);
  const isFinishing = useRef(false);
  const sentLast = useRef(false);
  const lastTimecode = useRef(0);
  const hasChunks = useRef(false);
  const index = useRef(0);

  const target = useRef(null);
  const regionRef = useRef(null);
  const regionWidth = useRef(0);
  const regionHeight = useRef(0);

  const screenChunks = useRef([]);
  const cameraChunks = useRef([]);
  const audioChunks = useRef([]);

  const recordingType = useRef("screen");

  const instantMode = useRef(false);

  const consecutiveScreenFailures = useRef(0);
  const consecutiveCameraFailures = useRef(0);
  const firstChunkTime = useRef(null);
  const firstChunkLoggedRef = useRef(false);

  const recorderSession = useRef(null);
  const recordingSessionId = useRef(null);
  const unloadGuardRef = useRef({
    pagehideSeen: false,
    beforeUnloadSeen: false,
    abandonedSent: false,
    stopTriggeredFromUnload: false,
  });
  const telemetryRuntimeRef = useRef({
    extensionVersion: null,
    browserVersion: null,
    platform: null,
    arch: null,
    os: null,
  });
  const uploadTelemetryTokenRef = useRef(null);
  const uploadTelemetryNetworkDisabledRef = useRef(false);
  const audioChunkStoreReadyRef = useRef(false);
  const audioChunkIndexRef = useRef(0);
  const cameraChunkStoreReadyRef = useRef(false);
  const cameraChunkIndexRef = useRef(0);
  const sessionStateIndexedRef = useRef(false);
  const sessionHeartbeat = useRef(null);
  const chunkStallTimer = useRef(null);
  const uploadHeartbeatTimer = useRef(null);
  const lastUploadProgress = useRef({
    screen: 0,
    camera: 0,
    ts: 0,
    lastPersistAt: 0,
  });
  const stallNotified = useRef(false);
  const fatalErrorRef = useRef(false);
  const idbReadyRef = useRef(false);
  const recoveryAttempted = useRef(false);
  const recoveryExportedRef = useRef(false);
  const screenTrackLostRef = useRef(false);
  const screenTrackMonitor = useRef(null);
  const pausedStateRef = useRef(false);
  const audioCaptureDegradedRef = useRef(false);
  const storagePressureRef = useRef({
    lastEstimateAt: 0,
    quota: null,
    usage: null,
    headroom: null,
    lowSpace: false,
    critical: false,
    warned: false,
    stopSent: false,
  });
  const networkStateRef = useRef({
    online: navigator.onLine,
    offlineSince: null,
  });
  const sessionTrackState = useRef({
    screen: {
      chunkCount: 0,
      bytesRecorded: 0,
      lastChunkAt: null,
      inMemoryChunkCount: 0,
      droppedInMemoryChunks: 0,
      durableChunkCount: 0,
      lastPersistedChunkIndex: null,
      lastPersistedAt: null,
      lastUploadOffset: 0,
      uploaderUpdatedAt: null,
    },
    camera: {
      chunkCount: 0,
      bytesRecorded: 0,
      lastChunkAt: null,
      inMemoryChunkCount: 0,
      droppedInMemoryChunks: 0,
      durableChunkCount: 0,
      lastPersistedChunkIndex: null,
      lastPersistedAt: null,
      lastUploadOffset: 0,
      uploaderUpdatedAt: null,
    },
    audio: {
      chunkCount: 0,
      bytesRecorded: 0,
      lastChunkAt: null,
      inMemoryChunkCount: 0,
      droppedInMemoryChunks: 0,
      durableChunkCount: 0,
      lastPersistedChunkIndex: null,
      lastPersistedAt: null,
      lastUploadOffset: 0,
      uploaderUpdatedAt: null,
    },
  });

  // This checks if the recording was previously initialized
  const isInit = useRef(false);

  const aCtx = useRef(null);
  const destination = useRef(null);

  const keepAliveInterval = useRef(null);
  const keepAliveAudioCtx = useRef(null);
  const keepAliveOscillator = useRef(null);

  const logDebugEvent = async () => {
    // debug bundle feature removed; noop
  };

  const setCloudRestartPhase = async (phase, details = {}) => {
    try {
      await chrome.storage.local.set({
        lastCloudRegionRestartPhase: {
          phase,
          ts: Date.now(),
          isIframe: Boolean(IS_IFRAME_CONTEXT),
          ...details,
        },
      });
    } catch {}
  };

  const clearPendingStart = () => {
    pendingStartRef.current = false;
    pendingStartAttempts.current = 0;
    if (pendingStartTimer.current) {
      clearTimeout(pendingStartTimer.current);
      pendingStartTimer.current = null;
    }
  };

  const canBeginRecording = () => {
    const hasStreams =
      Boolean(screenStream.current) || Boolean(cameraStream.current);
    return Boolean(uploadersInitialized.current) && hasStreams;
  };

  const maybeStartRecording = (reason = "unknown") => {
    if (!pendingStartRef.current || isFinishing.current) return;
    if (canBeginRecording()) {
      clearPendingStart();
      startRecording();
      return;
    }

    const attempt = pendingStartAttempts.current + 1;
    pendingStartAttempts.current = attempt;
    if (attempt > 75) {
      // ~15s max with 200ms delay
      clearPendingStart();
      sendRecordingError(
        "Recording is taking too long to start. Please try again.",
      );
      return;
    }

    if (pendingStartTimer.current) {
      clearTimeout(pendingStartTimer.current);
    }
    pendingStartTimer.current = setTimeout(() => {
      pendingStartTimer.current = null;
      maybeStartRecording(reason);
    }, 200);
  };

  const logStartFlow = (event, data = {}) => {
    if (!DEBUG_START_FLOW) return;
    const payload = { ts: Date.now(), event, ...data };
    console.info("[Screenity][StartFlow]", payload);
    try {
      const update = {
        startFlowDebug: {
          ...(data || {}),
          event,
          ts: payload.ts,
        },
      };
      if (event === "recording_start") {
        update.recordingStartAt = payload.ts;
      } else if (event === "first_chunk") {
        update.firstChunkAt = payload.ts;
      } else if (event === "recording_stop") {
        update.recordingStopAt = payload.ts;
      } else if (event === "recording_error") {
        update.recordingErrorAt = payload.ts;
      }
      chrome.storage.local.set(update);
    } catch {}
  };

  const assertCountdownBeforeFirstChunk = async (firstChunkAt) => {
    if (!DEBUG_START_FLOW) return;
    try {
      const { countdownFinishedAt } = await chrome.storage.local.get([
        "countdownFinishedAt",
      ]);
      if (
        typeof countdownFinishedAt === "number" &&
        firstChunkAt < countdownFinishedAt
      ) {
        console.error("[Screenity][StartFlow] Chunk before countdown end", {
          firstChunkAt,
          countdownFinishedAt,
        });
      }
    } catch (err) {
      console.warn("[Screenity][StartFlow] Countdown assert failed", err);
    }
  };

  const ensureRecordingSessionId = () => {
    if (!recordingSessionId.current) {
      recordingSessionId.current = crypto.randomUUID();
    }
    return recordingSessionId.current;
  };

  const getBrowserVersion = () => {
    const ua = navigator.userAgent || "";
    const chromeMatch = ua.match(/Chrome\/([0-9.]+)/);
    return chromeMatch?.[1] || null;
  };

  const getBrowserName = () => {
    const ua = navigator.userAgent || "";
    if (ua.includes("Edg/")) return "Edge";
    if (ua.includes("Chrome/")) return "Chrome";
    if (ua.includes("Firefox/")) return "Firefox";
    if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
    return "Other";
  };

  const getOsName = () => {
    const p = navigator.platform || "";
    if (p.includes("Mac")) return "macOS";
    if (p.includes("Win")) return "Windows";
    if (p.includes("Linux")) return "Linux";
    return "Other";
  };

  const ensureTelemetryRuntimeContext = async () => {
    if (telemetryRuntimeRef.current.extensionVersion) {
      return telemetryRuntimeRef.current;
    }
    const manifestVersion =
      chrome?.runtime?.getManifest?.()?.version || null;
    let platformInfo = null;
    try {
      platformInfo = await chrome.runtime.sendMessage({
        type: "get-platform-info",
      });
    } catch {
      platformInfo = null;
    }
    telemetryRuntimeRef.current = {
      extensionVersion: manifestVersion,
      browserVersion: getBrowserVersion(),
      platform: platformInfo?.os || navigator.platform || null,
      arch: platformInfo?.arch || null,
      os: platformInfo?.os || null,
    };
    return telemetryRuntimeRef.current;
  };

  const appendUploadTelemetryEvent = async (eventPayload) => {
    try {
      const existing = await chrome.storage.local.get([UPLOAD_TELEMETRY_KEY]);
      const current = Array.isArray(existing?.[UPLOAD_TELEMETRY_KEY])
        ? existing[UPLOAD_TELEMETRY_KEY]
        : [];
      const next = [...current, eventPayload].slice(-MAX_UPLOAD_TELEMETRY_EVENTS);
      await chrome.storage.local.set({
        [UPLOAD_TELEMETRY_KEY]: next,
        lastUploadTelemetryEvent: eventPayload,
      });
    } catch (err) {
      console.warn("Failed to persist upload telemetry event:", err);
    }
  };

  const resolveUploadTelemetryToken = async () => {
    if (uploadTelemetryTokenRef.current) {
      return uploadTelemetryTokenRef.current;
    }
    try {
      const { screenityToken } = await chrome.storage.local.get([
        "screenityToken",
      ]);
      if (screenityToken) {
        uploadTelemetryTokenRef.current = screenityToken;
        return screenityToken;
      }
    } catch {
      // ignore
    }

    try {
      const res = await fetch(`${API_BASE}/auth/get-extension-token`, {
        method: "GET",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const token = data?.token || data?.extensionToken || null;
        if (token) {
          uploadTelemetryTokenRef.current = token;
          return token;
        }
      }
    } catch {
      // ignore
    }
    return null;
  };

  const toUploadTelemetryRequest = async (eventPayload) => {
    const mediaId =
      eventPayload.mediaId ||
      screenUploader.current?.getMeta?.()?.mediaId ||
      cameraUploader.current?.getMeta?.()?.mediaId ||
      null;
    if (!mediaId) {
      return null;
    }

    const browserVersion = eventPayload.browserVersion || null;
    const browserMajor =
      browserVersion && Number.isFinite(parseInt(browserVersion, 10))
        ? parseInt(browserVersion, 10)
        : null;

    return {
      recordingId: mediaId,
      recordingSessionId: eventPayload.recordingSessionId || null,
      projectId: eventPayload.projectId || null,
      sceneId: eventPayload.sceneId || null,
      mediaId: eventPayload.mediaId || null,
      bunnyVideoId: eventPayload.bunnyVideoId || null,
      source: "extension",
      extVersion: eventPayload.extensionVersion || null,
      env: {
        os: getOsName(),
        browser: getBrowserName(),
        browserMajor,
        appVersion: null,
      },
      event: {
        type: eventPayload.event,
        t: eventPayload.ts || Date.now(),
        trackType: eventPayload.trackType || null,
        offsetBytes:
          typeof eventPayload.offset === "number"
            ? eventPayload.offset
            : null,
        fileSize:
          typeof eventPayload.totalBytes === "number"
            ? eventPayload.totalBytes
            : typeof eventPayload.finalizedBytes === "number"
            ? eventPayload.finalizedBytes
            : null,
        online: typeof navigator !== "undefined" ? navigator.onLine : null,
        visibilityState:
          typeof document !== "undefined" ? document.visibilityState : null,
        errCode: eventPayload.errorCode || null,
        errMsg: eventPayload.message || eventPayload.error || null,
        reason: eventPayload.reason || null,
        mediaId: eventPayload.mediaId || null,
        bunnyVideoId: eventPayload.bunnyVideoId || null,
        projectId: eventPayload.projectId || null,
        sceneId: eventPayload.sceneId || null,
        recordingSessionId: eventPayload.recordingSessionId || null,
      },
    };
  };

  const sendUploadTelemetryNetwork = async (eventPayload) => {
    if (uploadTelemetryNetworkDisabledRef.current) return;
    try {
      const requestBody = await toUploadTelemetryRequest(eventPayload);
      if (!requestBody) {
        return;
      }
      const body = JSON.stringify(requestBody);
      const token = await resolveUploadTelemetryToken();
      const headers = {
        "Content-Type": "application/json",
        "x-screenity-source": "extension",
      };
      if (eventPayload.extensionVersion) {
        headers["x-screenity-ext-version"] = String(
          eventPayload.extensionVersion,
        );
      }
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      if (
        (eventPayload.event === "upload_pagehide" ||
          eventPayload.event === "upload_abandoned_on_unload") &&
        navigator.sendBeacon
      ) {
        const sent = navigator.sendBeacon(
          UPLOAD_TELEMETRY_ENDPOINT,
          new Blob([body], { type: "application/json" }),
        );
        if (sent) return;
      }
      const res = await fetch(UPLOAD_TELEMETRY_ENDPOINT, {
        method: "POST",
        headers,
        credentials: "include",
        keepalive: true,
        body,
      });
      if (res.status === 404 || res.status === 405) {
        uploadTelemetryNetworkDisabledRef.current = true;
      }
    } catch {
      // best effort
    }
  };

  const emitUploadTelemetry = async (event, payload = {}) => {
    const runtime = await ensureTelemetryRuntimeContext();
    const screenSceneId = screenUploader.current?.getMeta?.()?.sceneId || null;
    const cameraSceneId = cameraUploader.current?.getMeta?.()?.sceneId || null;
    const eventPayload = {
      event,
      ts: Date.now(),
      recordingSessionId:
        payload.recordingSessionId ||
        recorderSession.current?.id ||
        recordingSessionId.current ||
        null,
      projectId:
        payload.projectId || recorderSession.current?.projectId || null,
      sceneId: payload.sceneId || screenSceneId || cameraSceneId || null,
      mediaId: payload.mediaId || null,
      bunnyVideoId: payload.bunnyVideoId || null,
      trackType: payload.trackType || null,
      uploaderType: payload.uploaderType || "cloud_recorder",
      extensionVersion: runtime.extensionVersion,
      browserVersion: runtime.browserVersion,
      platform: runtime.platform,
      arch: runtime.arch,
      os: runtime.os,
      ...payload,
    };

    await appendUploadTelemetryEvent(eventPayload);
    if (event !== "upload_progress") {
      void sendUploadTelemetryNetwork(eventPayload);
    }
  };

  const resetUnloadGuard = () => {
    unloadGuardRef.current = {
      pagehideSeen: false,
      beforeUnloadSeen: false,
      abandonedSent: false,
      stopTriggeredFromUnload: false,
    };
  };

  const emitAbandonedOnUnloadOnce = (reason, extra = {}) => {
    if (unloadGuardRef.current.abandonedSent) return;
    unloadGuardRef.current.abandonedSent = true;
    void emitUploadTelemetry("upload_abandoned_on_unload", {
      reason,
      ...extra,
    });
  };

  const resetSessionTrackState = () => {
    sessionTrackState.current = {
      screen: {
        chunkCount: 0,
        bytesRecorded: 0,
        lastChunkAt: null,
        inMemoryChunkCount: 0,
        droppedInMemoryChunks: 0,
        durableChunkCount: 0,
        lastPersistedChunkIndex: null,
        lastPersistedAt: null,
        lastUploadOffset: 0,
        uploaderUpdatedAt: null,
      },
      camera: {
        chunkCount: 0,
        bytesRecorded: 0,
        lastChunkAt: null,
        inMemoryChunkCount: 0,
        droppedInMemoryChunks: 0,
        durableChunkCount: 0,
        lastPersistedChunkIndex: null,
        lastPersistedAt: null,
        lastUploadOffset: 0,
        uploaderUpdatedAt: null,
      },
      audio: {
        chunkCount: 0,
        bytesRecorded: 0,
        lastChunkAt: null,
        inMemoryChunkCount: 0,
        droppedInMemoryChunks: 0,
        durableChunkCount: 0,
        lastPersistedChunkIndex: null,
        lastPersistedAt: null,
        lastUploadOffset: 0,
        uploaderUpdatedAt: null,
      },
    };
  };

  const trimChunkBuffer = (ref, maxChunks) => {
    if (!ref?.current || ref.current.length <= maxChunks) return 0;
    const removed = ref.current.length - maxChunks;
    ref.current.splice(0, removed);
    return removed;
  };

  const noteTrackChunk = (track, blob, extra = {}) => {
    if (!blob || !track || !sessionTrackState.current[track]) return;
    const current = sessionTrackState.current[track];
    sessionTrackState.current[track] = {
      ...current,
      chunkCount: (current.chunkCount || 0) + 1,
      bytesRecorded: (current.bytesRecorded || 0) + (blob.size || 0),
      lastChunkAt: Date.now(),
      ...extra,
    };
  };

  const patchTrackState = (track, extra = {}) => {
    if (!track || !sessionTrackState.current[track]) return;
    sessionTrackState.current[track] = {
      ...sessionTrackState.current[track],
      ...extra,
    };
  };

  const getUploaderResumeMeta = (uploaderRef) => {
    if (!uploaderRef?.current) return null;
    if (typeof uploaderRef.current.getResumeState === "function") {
      return uploaderRef.current.getResumeState();
    }
    if (typeof uploaderRef.current.getMeta === "function") {
      return uploaderRef.current.getMeta();
    }
    return null;
  };

  const buildTrackSnapshot = () => ({
    screen: {
      ...sessionTrackState.current.screen,
      inMemoryChunkCount: screenChunks.current.length,
      hasDurableLocalChunks: true,
      uploader: getUploaderResumeMeta(screenUploader),
    },
    camera: {
      ...sessionTrackState.current.camera,
      inMemoryChunkCount: cameraChunks.current.length,
      hasDurableLocalChunks: cameraChunkStoreReadyRef.current,
      uploader: getUploaderResumeMeta(cameraUploader),
    },
    audio: {
      ...sessionTrackState.current.audio,
      inMemoryChunkCount: audioChunks.current.length,
      hasDurableLocalChunks: audioChunkStoreReadyRef.current,
      uploader: null,
    },
  });

  const setPipelineState = async (step, extra = {}) => {
    const state = {
      step,
      ts: Date.now(),
      projectId: extra.projectId || null,
      sceneId: extra.sceneId || null,
      status: extra.status || null,
      details: extra.details || null,
    };
    try {
      await chrome.storage.local.set({ recorderPipelineState: state });
    } catch {
      // ignore
    }
  };

  const getOrCreateSceneId = async ({ forceNew = false } = {}) => {
    try {
      const { sceneId, sceneIdStatus } = await chrome.storage.local.get([
        "sceneId",
        "sceneIdStatus",
      ]);
      if (!forceNew && sceneId && sceneIdStatus === "recording") {
        return sceneId;
      }
    } catch {
      // ignore
    }
    const next = crypto.randomUUID();
    try {
      await chrome.storage.local.set({
        sceneId: next,
        sceneIdStatus: "recording",
      });
    } catch {
      // ignore
    }
    return next;
  };

  const markSceneComplete = async (sceneId) => {
    if (!sceneId) return;
    try {
      await chrome.storage.local.set({
        sceneIdStatus: "completed",
        lastCompletedSceneId: sceneId,
      });
    } catch {
      // ignore
    }
  };

  const upsertPendingScene = async (sceneId, payload) => {
    if (!sceneId) return;
    const indexKey = "pendingSceneIndex";
    const sceneKey = `pendingScene:${sceneId}`;
    const { pendingSceneIndex = [] } = await chrome.storage.local.get([
      indexKey,
    ]);
    const nextIndex = pendingSceneIndex.includes(sceneId)
      ? pendingSceneIndex
      : [...pendingSceneIndex, sceneId];
    await chrome.storage.local.set({
      [sceneKey]: { ...payload, sceneId, updatedAt: Date.now() },
      [indexKey]: nextIndex,
    });
  };

  const removePendingScene = async (sceneId) => {
    if (!sceneId) return;
    const indexKey = "pendingSceneIndex";
    const sceneKey = `pendingScene:${sceneId}`;
    const { pendingSceneIndex = [] } = await chrome.storage.local.get([
      indexKey,
    ]);
    const nextIndex = pendingSceneIndex.filter((id) => id !== sceneId);
    await chrome.storage.local.remove([sceneKey]);
    await chrome.storage.local.set({ [indexKey]: nextIndex });
  };

  const getSceneCreateStatus = async (sceneId) => {
    if (!sceneId) return null;
    const key = `sceneCreateStatus:${sceneId}`;
    const result = await chrome.storage.local.get([key]);
    return result?.[key] || null;
  };

  const setSceneCreateStatus = async (sceneId, status, extra = {}) => {
    if (!sceneId) return;
    const key = `sceneCreateStatus:${sceneId}`;
    await chrome.storage.local.set({
      [key]: {
        status,
        updatedAt: Date.now(),
        ...extra,
      },
    });
  };

  const linkMediaToScene = async (projectId, sceneId, mediaId) => {
    if (!projectId || !sceneId || !mediaId) return;
    await fetch(`${API_BASE}/media/${mediaId}/scene`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ projectId, sceneId }),
    });
  };

  const confirmLinkedMedia = async (projectId, sceneId, mediaIds = []) => {
    const filtered = mediaIds.filter(Boolean);
    if (!projectId || !sceneId || filtered.length === 0) return;
    await fetch(`${API_BASE}/media/confirm-linked`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ mediaIds: filtered, projectId, sceneId }),
    });
  };

  const ensureMediaLinked = async ({ projectId, sceneId, mediaIds }) => {
    const filtered = (mediaIds || []).filter(Boolean);
    if (!projectId || !sceneId || filtered.length === 0) return;
    await Promise.allSettled(
      filtered.map((mediaId) => linkMediaToScene(projectId, sceneId, mediaId)),
    );
    await confirmLinkedMedia(projectId, sceneId, filtered);
  };

  const recoverScene = async ({
    projectId,
    sceneId,
    screenMediaId,
    cameraMediaId,
    audioMediaId,
  }) => {
    if (!projectId || !sceneId) return { ok: false, error: "missing-ids" };
    const mediaIds = [screenMediaId, cameraMediaId, audioMediaId].filter(
      Boolean,
    );
    const res = await fetch(`${API_BASE}/videos/${projectId}/recover-scene`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        sceneId,
        mediaIds,
        screenMediaId: screenMediaId || null,
        cameraMediaId: cameraMediaId || null,
        audioMediaId: audioMediaId || null,
      }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      return { ok: false, error: errorText || "recover-scene-failed" };
    }
    return { ok: true };
  };

  // exportDebugBundle removed

  // Note: We no longer try to "keep alive" the service worker with pings.
  // Instead, we persist recording state to chrome.storage.local so the SW can
  // recover context when it restarts. The CloudRecorder tab is the source of truth.
  // However, we DO need to keep the tab itself alive using silent audio to prevent
  // Chrome from freezing/discarding this background tab.

  /**
   * Start silent audio playback to prevent Chrome from freezing this tab.
   * Chrome throttles/freezes background tabs after ~5 minutes of inactivity,
   * which would stop our recording. Playing silent audio keeps the tab active.
   */
  const startTabKeepAlive = () => {
    try {
      if (keepAliveAudioCtx.current) return; // Already running

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      keepAliveAudioCtx.current = ctx;

      // Create a silent oscillator (inaudible frequency at zero gain)
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.frequency.value = 0; // DC signal (no audible tone)
      gainNode.gain.value = 0; // Completely silent

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start();

      keepAliveOscillator.current = oscillator;

      // Also request that Chrome not discard this tab
      chrome.runtime.sendMessage({
        type: "set-tab-auto-discardable",
        discardable: false,
      });

      if (globalThis.SCREENITY_VERBOSE_LOGS) {
        if (DEBUG_START_FLOW) {
          console.log("[CloudRecorder] Tab keep-alive started");
        }
      }
    } catch (err) {
      console.warn("[CloudRecorder] Failed to start tab keep-alive:", err);
    }
  };

  /**
   * Stop the silent audio playback when recording ends.
   */
  const stopTabKeepAlive = () => {
    try {
      if (keepAliveOscillator.current) {
        keepAliveOscillator.current.stop();
        keepAliveOscillator.current.disconnect();
        keepAliveOscillator.current = null;
      }
      if (keepAliveAudioCtx.current) {
        keepAliveAudioCtx.current.close();
        keepAliveAudioCtx.current = null;
      }

      // Allow Chrome to discard this tab again if needed
      chrome.runtime.sendMessage({
        type: "set-tab-auto-discardable",
        discardable: true,
      });

      if (globalThis.SCREENITY_VERBOSE_LOGS) {
        if (DEBUG_START_FLOW) {
          console.log("[CloudRecorder] Tab keep-alive stopped");
        }
      }
    } catch (err) {
      console.warn("[CloudRecorder] Failed to stop tab keep-alive:", err);
    }
  };

  const logScreenTrackEvent = async (event, track) => {
    try {
      const settings = track?.getSettings?.() || {};
      const now = Date.now();
      const data = {
        event,
        ts: now,
        label: track?.label || null,
        readyState: track?.readyState || null,
        muted: track?.muted || false,
        settings,
      };
      const { screenTrackLog = [] } = await chrome.storage.local.get([
        "screenTrackLog",
      ]);
      const next = [...screenTrackLog, data].slice(-50);
      chrome.storage.local.set({ screenTrackLog: next });
    } catch (err) {
      console.warn("Failed to log screen track event", err);
    }
  };

  const bindScreenTrack = (track) => {
    if (!track) return;
    screenTrackLostRef.current = false;
    logScreenTrackEvent("track-start", track);

    track.onended = () => {
      screenTrackLostRef.current = true;
      logScreenTrackEvent("track-ended", track);
      const label = track?.label || null;

      // Collect diagnostic info to understand WHY the track ended
      const diagnosticInfo = {
        reason: "screen-track-ended",
        tabId: recordingTabId.current || null,
        label,
        readyState: track?.readyState || null,
        ts: Date.now(),
        isTab: isTab.current,
        recordingType: recordingType.current,
        isIframe: IS_IFRAME_CONTEXT,
        documentHidden: document.hidden,
        documentVisibility: document.visibilityState,
        recorderState: screenRecorder.current?.state || null,
        hasChunks: hasChunks.current,
        chunkCount: index.current,
        lastChunkTime: lastTimecode.current,
        timeSinceLastChunk: lastTimecode.current
          ? Date.now() - lastTimecode.current
          : null,
      };

      console.error("🔴 Screen track ended unexpectedly!", diagnosticInfo);

      chrome.storage.local.set({
        screenTrackLost: true,
        lastTrackEndedEvent: diagnosticInfo,
        lastTrackEnded: diagnosticInfo,
      });

      // When screen track ends, we MUST stop the recording
      // Otherwise we'd be recording black/frozen video with no way for user to know
      if (!isFinishing.current && !sentLast.current) {
        console.warn("⚠️ Screen track ended - stopping recording");
        stopRecording(true, "screen-track-ended");
      }
    };

    track.onmute = () => {
      screenTrackLostRef.current = true;
      logScreenTrackEvent("track-muted", track);
    };
    track.onunmute = () => {
      screenTrackLostRef.current = false;
      logScreenTrackEvent("track-unmuted", track);
    };

    startScreenTrackMonitor();
  };

  const startScreenTrackMonitor = () => {
    if (screenTrackMonitor.current) clearInterval(screenTrackMonitor.current);
    screenTrackMonitor.current = setInterval(() => {
      const track = screenStream.current?.getVideoTracks?.()[0] || null;
      if (!track) return;
      if (track.readyState === "ended" && !screenTrackLostRef.current) {
        screenTrackLostRef.current = true;
        logScreenTrackEvent("monitor-ended", track);

        // Stop the recording when track dies
        if (!isFinishing.current && !sentLast.current) {
          console.warn(
            "⚠️ Screen track monitor detected ended track - stopping recording",
          );
          stopRecording(true, "screen-track-monitor-ended");
        }
      }
    }, 5000);
  };

  const ensureChunkStoreReady = async () => {
    if (idbReadyRef.current) return true;
    try {
      await chunksStore.setItem("__probe", { ts: Date.now() });
      await chunksStore.removeItem("__probe");
      idbReadyRef.current = true;
      void emitUploadTelemetry("upload_local_backup_enabled", {
        backupType: "screen",
      });
      return true;
    } catch (err) {
      fatalErrorRef.current = true;
      void emitUploadTelemetry("upload_local_backup_unavailable", {
        backupType: "screen",
        error: err?.message || String(err),
      });
      sendRecordingError(
        "Local storage is blocked (IndexedDB unavailable). Recording cannot start.",
      );
      return false;
    }
  };

  const ensureAudioChunkStoreReady = async () => {
    if (audioChunkStoreReadyRef.current) return true;
    try {
      await audioChunksStore.setItem("__probe", { ts: Date.now() });
      await audioChunksStore.removeItem("__probe");
      audioChunkStoreReadyRef.current = true;
      void emitUploadTelemetry("upload_local_backup_enabled", {
        backupType: "audio",
      });
      return true;
    } catch (err) {
      audioChunkStoreReadyRef.current = false;
      void emitUploadTelemetry("upload_local_backup_degraded", {
        backupType: "audio",
        error: err?.message || String(err),
      });
      return false;
    }
  };

  const clearAudioChunkStore = async (reason = "unknown") => {
    audioChunkIndexRef.current = 0;
    // Always attempt clear regardless of audioChunkStoreReadyRef state.
    // If IDB degraded mid-session the flag is false, but partial chunks written
    // before degradation must still be cleared to avoid stale data on next session.
    try {
      await audioChunksStore.clear();
      console.info("[CloudRecorder] clearAudioChunkStore:", reason);
    } catch (err) {
      console.warn("Failed to clear audio chunk store:", err);
    }
  };

  const ensureCameraChunkStoreReady = async () => {
    if (cameraChunkStoreReadyRef.current) return true;
    try {
      await cameraChunksStore.setItem("__probe", { ts: Date.now() });
      await cameraChunksStore.removeItem("__probe");
      cameraChunkStoreReadyRef.current = true;
      void emitUploadTelemetry("upload_local_backup_enabled", {
        backupType: "camera",
      });
      return true;
    } catch (err) {
      cameraChunkStoreReadyRef.current = false;
      void emitUploadTelemetry("upload_local_backup_degraded", {
        backupType: "camera",
        error: err?.message || String(err),
      });
      return false;
    }
  };

  const clearCameraChunkStore = async (reason = "unknown") => {
    cameraChunkIndexRef.current = 0;
    // Always attempt clear regardless of cameraChunkStoreReadyRef state.
    // If IDB degraded mid-session the flag is false, but partial chunks written
    // before degradation must still be cleared to avoid stale data on next session.
    try {
      await cameraChunksStore.clear();
      console.info("[CloudRecorder] clearCameraChunkStore:", reason);
    } catch (err) {
      console.warn("Failed to clear camera chunk store:", err);
    }
  };

  const clearLocalScreenPlaybackOffer = async (reason = "unknown") => {
    const existingOffer = localScreenPlaybackOfferRef.current;
    localScreenPlaybackOfferRef.current = null;
    try {
      const result = await chrome.runtime.sendMessage({
        type: "cloud-local-playback-clear",
        offerId: existingOffer?.offerId || null,
        reason,
      });
      if (result?.ok) {
        console.info(
          "[CloudRecorder] Cleared local screen playback offer",
          {
            reason,
            offerId: existingOffer?.offerId || null,
          },
        );
      }
    } catch (err) {
      console.warn(
        "[CloudRecorder] Failed to clear local screen playback offer",
        {
          reason,
          error: err?.message || err,
        },
      );
    }
  };

  const registerLocalScreenPlaybackOffer = async ({
    projectId,
    sceneId,
    uploadMeta,
  }) => {
    if (!projectId || !sceneId) {
      return null;
    }

    let chunkCount = 0;
    try {
      chunkCount = await chunksStore.length();
    } catch {
      chunkCount = 0;
    }
    if (!chunkCount) {
      console.info(
        "[CloudRecorder] Local-first screen offer unavailable: no local chunks",
        {
          projectId,
          sceneId,
        },
      );
      return null;
    }

    const estimatedBytes =
      screenUploader.current?.offset ||
      sessionTrackState.current?.screen?.bytesRecorded ||
      0;
    if (!estimatedBytes || estimatedBytes <= 0) {
      console.info(
        "[CloudRecorder] Local-first screen offer unavailable: no byte estimate",
        {
          projectId,
          sceneId,
          chunkCount,
        },
      );
      return null;
    }

    if (estimatedBytes > LOCAL_SCREEN_PLAYBACK_MAX_BYTES) {
      console.info(
        "[CloudRecorder] Local-first screen offer skipped: source too large",
        {
          projectId,
          sceneId,
          chunkCount,
          estimatedBytes,
          maxBytes: LOCAL_SCREEN_PLAYBACK_MAX_BYTES,
        },
      );
      return null;
    }

    const now = Date.now();
    const nextOffer = {
      offerId: crypto.randomUUID(),
      projectId,
      sceneId,
      recordingSessionId:
        recorderSession.current?.id || recordingSessionId.current || null,
      trackType: "screen",
      chunkCount,
      estimatedBytes,
      mediaId: uploadMeta?.screen?.mediaId || null,
      bunnyVideoId: uploadMeta?.screen?.videoId || null,
      createdAt: now,
      expiresAt: now + LOCAL_SCREEN_PLAYBACK_TTL_MS,
      status: "available",
      source: "indexeddb-screen-chunks",
    };

    try {
      const result = await chrome.runtime.sendMessage({
        type: "cloud-local-playback-register",
        offer: nextOffer,
      });
      if (result?.ok && result.offer) {
        localScreenPlaybackOfferRef.current = result.offer;
        console.info(
          "[CloudRecorder] Local-first screen offer registered",
          {
            projectId,
            sceneId,
            offerId: result.offer.offerId,
            chunkCount: result.offer.chunkCount,
            estimatedBytes: result.offer.estimatedBytes,
            expiresAt: result.offer.expiresAt,
          },
        );
        return result.offer;
      }
    } catch (err) {
      console.warn(
        "[CloudRecorder] Failed to register local-first screen offer",
        {
          projectId,
          sceneId,
          error: err?.message || err,
        },
      );
    }

    return null;
  };

  const buildAudioBlobFromDurableStore = async () => {
    // Always attempt IDB read regardless of audioChunkStoreReadyRef state.
    // The flag can be false if IDB degraded mid-session, but partial IDB data
    // written before the failure is still more complete than the 8-chunk memory
    // window. Falling back to memory prematurely silently drops early audio.
    try {
      const recovered = [];
      await audioChunksStore.iterate((value) => {
        if (value?.chunk) {
          recovered.push(value);
        }
      });
      recovered.sort((a, b) => (a.index || 0) - (b.index || 0));
      if (recovered.length > 0) {
        console.info("[CloudRecorder] buildAudioBlobFromDurableStore: using IDB", {
          chunks: recovered.length,
          storeWasReady: audioChunkStoreReadyRef.current,
        });
        return createBlobFromChunks(
          recovered.map((entry) => entry.chunk),
          "audio/webm",
        );
      }
      console.info("[CloudRecorder] buildAudioBlobFromDurableStore: IDB empty, using memory", {
        memoryChunks: audioChunks.current.length,
        storeWasReady: audioChunkStoreReadyRef.current,
      });
    } catch (err) {
      console.warn("[CloudRecorder] buildAudioBlobFromDurableStore: IDB read failed, falling back to memory", {
        error: err?.message || String(err),
        memoryChunks: audioChunks.current.length,
        storeWasReady: audioChunkStoreReadyRef.current,
      });
      void emitUploadTelemetry("upload_local_backup_degraded", {
        backupType: "audio",
        reason: "audio-idb-read-failed-at-finalize",
        error: err?.message || String(err),
      });
    }
    return createBlobFromChunks(audioChunks.current, "audio/webm");
  };

  const getSessionStateKey = (sessionId) =>
    sessionId ? `cloudRecorderSession:${sessionId}` : null;

  const persistSessionState = async (overrides = {}) => {
    if (!recorderSession.current) return;
    const tracks = buildTrackSnapshot();
    const sessionStateKey = getSessionStateKey(recorderSession.current.id);
    const nextState = {
      ...recorderSession.current,
      recordingSessionId: recorderSession.current.id,
      lastChunkIndex: index.current - 1,
      lastChunkTime: lastTimecode.current || null,
      lastUploadOffset: {
        screen: screenUploader.current?.offset || 0,
        camera: cameraUploader.current?.offset || 0,
      },
      tracks,
      network: {
        online: networkStateRef.current.online,
        offlineSince: networkStateRef.current.offlineSince,
      },
      storagePressure: {
        quota: storagePressureRef.current.quota,
        usage: storagePressureRef.current.usage,
        headroom: storagePressureRef.current.headroom,
        lowSpace: storagePressureRef.current.lowSpace,
        critical: storagePressureRef.current.critical,
      },
      updatedAt: Date.now(),
      ...overrides,
    };
    recorderSession.current = nextState;
    try {
      const payload = {
        recorderSession: nextState,
        [sessionStateKey]: nextState,
      };
      if (!sessionStateIndexedRef.current) {
        const existing = await chrome.storage.local.get([SESSION_STATE_INDEX_KEY]);
        const index = Array.isArray(existing?.[SESSION_STATE_INDEX_KEY])
          ? existing[SESSION_STATE_INDEX_KEY]
          : [];
        payload[SESSION_STATE_INDEX_KEY] = index.includes(recorderSession.current.id)
          ? index
          : [...index, recorderSession.current.id].slice(-30);
        sessionStateIndexedRef.current = true;
      }
      await chrome.storage.local.set(payload);
    } catch (err) {
      console.warn("Failed to persist recorder session state:", err);
    }
  };

  const startRecorderSession = async (meta = {}) => {
    let recorderOwnerTabId = null;
    try {
      const tabRes = await chrome.runtime.sendMessage({ type: "get-tab-id" });
      recorderOwnerTabId = tabRes?.tabId || null;
    } catch {}

    const sessionId = meta.sessionId || ensureRecordingSessionId();
    const session = {
      id: sessionId,
      recordingSessionId: sessionId,
      startedAt: Date.now(),
      recorderTabId: recorderOwnerTabId,
      capturedTabId: recordingTabId.current || null,
      tabId: recordingTabId.current || null,
      tabCaptureId: tabID.current || null,
      isTab: isTab.current,
      region: Boolean(regionRef.current),
      status: "recording",
      tracks: buildTrackSnapshot(),
      network: {
        online: networkStateRef.current.online,
        offlineSince: networkStateRef.current.offlineSince,
      },
      ...meta,
    };
    recorderSession.current = session;
    const sessionStateKey = getSessionStateKey(sessionId);
    const existing = await chrome.storage.local.get([SESSION_STATE_INDEX_KEY]);
    const index = Array.isArray(existing?.[SESSION_STATE_INDEX_KEY])
      ? existing[SESSION_STATE_INDEX_KEY]
      : [];
    const nextIndex = index.includes(sessionId)
      ? index
      : [...index, sessionId].slice(-30);
    await chrome.storage.local.set({
      recorderSession: session,
      [sessionStateKey]: session,
      [SESSION_STATE_INDEX_KEY]: nextIndex,
    });
    sessionStateIndexedRef.current = true;
    logDebugEvent("recorder-session-started", {
      sessionId: session.id,
      projectId: meta.projectId || null,
    });
    try {
      const result = await chrome.runtime.sendMessage({
        type: "register-recording-session",
        session,
      });
      if (result?.ok === false) {
        fatalErrorRef.current = true;
        recorderSession.current = null;
        recordingSessionId.current = null;
        sessionStateIndexedRef.current = false;
        const sessionStateKey = getSessionStateKey(sessionId);
        chrome.storage.local.remove(["recorderSession", sessionStateKey]);
        sendRecordingError(
          result?.error ||
            "Another Screenity recorder is already running. Please close it and try again.",
        );
        return false;
      }
    } catch (err) {
      console.warn(
        "Failed to register recording session with background:",
        err,
      );
    }
    return true;
  };

  const finalizeRecorderSession = async (status = "completed") => {
    if (!recorderSession.current) return;
    const sessionId = recorderSession.current.id;
    const sessionStateKey = getSessionStateKey(sessionId);
    logDebugEvent("recorder-session-finalize-start", {
      status,
      sessionId,
    });
    try {
      const finalizedState = {
        ...recorderSession.current,
        status,
        finishedAt: Date.now(),
      };
      await chrome.storage.local.set({
        recorderSession: finalizedState,
        [sessionStateKey]: finalizedState,
      });
      await chrome.runtime.sendMessage({
        type: "clear-recording-session",
        reason: `cloud-finalize-${status}`,
      });
      logDebugEvent("recorder-session-finalize-complete", { status });
    } catch (err) {
      console.warn("Failed to finalize recorder session cleanly:", err);
      chrome.runtime
        .sendMessage({
          type: "clear-recording-session-safe",
          reason: `cloud-finalize-fallback-${status}`,
        })
        .catch(() => {});
      throw err;
    } finally {
      recorderSession.current = null;
      recordingSessionId.current = null;
      sessionStateIndexedRef.current = false;
      resetSessionTrackState();
      logDebugEvent("recorder-session-finalized", { status });
    }
  };

  const startSessionHeartbeat = () => {
    if (sessionHeartbeat.current) clearInterval(sessionHeartbeat.current);
    sessionHeartbeat.current = setInterval(() => {
      if (!recorderSession.current) return;
      persistSessionState({
        heartbeatAt: Date.now(),
      });
    }, 5000);
  };

  const startChunkWatchdog = () => {
    if (chunkStallTimer.current) clearInterval(chunkStallTimer.current);
    chunkStallTimer.current = setInterval(() => {
      if (!hasChunks.current || fatalErrorRef.current) return;
      const last = lastTimecode.current || 0;
      if (!last) return;
      if (Date.now() - last > 15000) {
        if (!stallNotified.current) {
          stallNotified.current = true;
          chrome.runtime.sendMessage({
            type: "recording-error",
            error: "stream-warning",
            why: "No video data received for 15 seconds. Recording may be stalled.",
          });
        }
      }
    }, 5000);
  };

  const startUploadHeartbeat = () => {
    if (uploadHeartbeatTimer.current)
      clearInterval(uploadHeartbeatTimer.current);
    uploadHeartbeatTimer.current = setInterval(() => {
      const now = Date.now();
      const screenOffset = screenUploader.current?.offset || 0;
      const cameraOffset = cameraUploader.current?.offset || 0;
      const { screen, camera, ts } = lastUploadProgress.current;

      if (screenOffset !== screen || cameraOffset !== camera) {
        lastUploadProgress.current = {
          screen: screenOffset,
          camera: cameraOffset,
          ts: now,
          lastPersistAt: lastUploadProgress.current.lastPersistAt || 0,
        };
        stallNotified.current = false;
        recoveryExportedRef.current = false;
        persistSessionState();
        return;
      }

      if (
        hasChunks.current &&
        ts &&
        now - ts > 30000 &&
        !stallNotified.current
      ) {
        stallNotified.current = true;
        chrome.runtime.sendMessage({
          type: "upload-stalled",
          offset: { screen: screenOffset, camera: cameraOffset },
        });
      } else if (
        hasChunks.current &&
        stallNotified.current &&
        ts &&
        now - ts > 45000
      ) {
        if (!recoveryExportedRef.current) {
          recoveryExportedRef.current = true;
          exportLocalRecovery("upload-stalled");
        }
      }
    }, 5000);
  };

  const stopAllIntervals = () => {
    if (sessionHeartbeat.current) clearInterval(sessionHeartbeat.current);
    if (chunkStallTimer.current) clearInterval(chunkStallTimer.current);
    if (uploadHeartbeatTimer.current)
      clearInterval(uploadHeartbeatTimer.current);
    if (screenTrackMonitor.current) clearInterval(screenTrackMonitor.current);
    sessionHeartbeat.current = null;
    chunkStallTimer.current = null;
    uploadHeartbeatTimer.current = null;
    screenTrackMonitor.current = null;
  };

  const shouldSimulateFinalizeFailure = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("simulateFinalizeFailure") === "1") return true;
      return window.SCREENITY_SIMULATE_FINALIZE_FAILURE === true;
    } catch {
      return false;
    }
  };

  const buildFinalizeDiagnostics = ({
    stage,
    settledResults = [],
    rejectedResults = [],
    incompleteUploaders = [],
    reason = "finalize-failed",
  }) => {
    const screenMeta = screenUploader.current?.getMeta?.() || null;
    const cameraMeta = cameraUploader.current?.getMeta?.() || null;

    return {
      reason,
      stage,
      ts: Date.now(),
      settledResults: settledResults.map((result, i) => ({
        index: i,
        status: result?.status || "unknown",
        reason:
          result?.status === "rejected"
            ? String(result.reason?.message || result.reason || "unknown")
            : null,
      })),
      rejectedResults: rejectedResults.map((result, i) => ({
        index: i,
        reason: String(result.reason?.message || result.reason || "unknown"),
      })),
      incompleteUploaders,
      uploaderMeta: {
        screen: screenMeta,
        camera: cameraMeta,
      },
      recorderSession: recorderSession.current,
      finalizeContext: finalizeContextRef.current,
    };
  };

  const exportFinalizeDiagnostics = async (diagnostics) => {
    try {
      const payload = diagnostics ||
        finalizeFailureRef.current || { reason: "no-diagnostics" };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const objectUrl = URL.createObjectURL(blob);
      try {
        await chrome.downloads.download({
          url: objectUrl,
          filename: `Screenity-Finalize-Diagnostics-${new Date().toISOString()}.json`,
          saveAs: false,
        });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (err) {
      console.warn("[CloudRecorder][Finalize] Failed to export diagnostics", {
        error: err?.message || err,
      });
    }
  };

  const markFinalizeFailure = async (diagnostics) => {
    finalizeFailureRef.current = diagnostics;
    setFinalizeFailure(diagnostics);
    isFinishing.current = false;

    console.error("[CloudRecorder][Finalize] Finalization failed", diagnostics);

    await chrome.storage.local.set({
      lastFinalizeFailure: diagnostics,
    });
    await persistSessionState({
      status: "finalize-failed",
      finalizeFailureAt: Date.now(),
      finalizeFailureReason: diagnostics?.reason || "finalize-failed",
    });
    await setPipelineState("finalize-failed", {
      status: diagnostics?.reason || "finalize-failed",
    });
    try {
      await chrome.storage.local.set({ sceneIdStatus: "failed" });
    } catch {
      // ignore
    }
  };
  const exportLocalRecovery = async (reason = "upload failed") => {
    try {
      let blob = null;
      const recovered = [];
      await chunksStore.iterate((value) => {
        recovered.push(value);
      });
      recovered.sort((a, b) => a.index - b.index);
      if (recovered.length > 0) {
        blob = createBlobFromChunks(
          recovered.map((c) => c.chunk),
          "video/webm",
        );
      }
      if (!blob) {
        blob =
          createBlobFromChunks(screenChunks.current, "video/webm") ||
          createBlobFromChunks(cameraChunks.current, "video/webm");
      }
      if (!blob) return;
      const objectUrl = URL.createObjectURL(blob);
      try {
        await chrome.downloads.download({
          url: objectUrl,
          filename: `Screenity-Recovery-${new Date().toISOString()}-${reason}.webm`,
          saveAs: false,
        });
        chrome.runtime.sendMessage({
          type: "show-toast",
          message: "Upload stalled. A recovery file was saved locally.",
        });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (err) {
      console.warn("Failed to export local recovery:", err);
    }
  };

  // Called inside tryRecoverPreviousSession after IDB chunks are cleared.
  // Removes stale TUS upload journals, lookup keys, and Bunny video-map entries
  // that survive a process crash. Without this cleanup the next recording attempt
  // can pick up the old journal, "resume" from the wrong server offset, and
  // append fresh MediaRecorder chunks to the old partial Bunny upload — producing
  // a garbled video. Also resets sceneId so the next session gets a fresh scene.
  const clearStaleUploadJournals = async (storedSession) => {
    const keysToRemove = [];
    const tracks = storedSession?.tracks || {};

    for (const trackData of Object.values(tracks)) {
      const upl = trackData?.uploader;
      if (!upl) continue;

      if (upl.journalKey) keysToRemove.push(upl.journalKey);
      if (upl.journalLookupKey) keysToRemove.push(upl.journalLookupKey);

      // Also clear the Bunny video-map fallback entry
      const pid = upl.projectId || storedSession?.projectId || null;
      const sid = upl.sceneId || null;
      const t = upl.type || upl.trackType || null;
      if (pid && t) {
        keysToRemove.push(
          `bunnyVideoMap-${pid}-${sid || "none"}-${t || "none"}`,
        );
      }
    }

    // Force a fresh sceneId on the next recording so getOrCreateSceneId doesn't
    // reuse the stale scene that is tied to the now-cleared journals.
    keysToRemove.push("sceneId", "sceneIdStatus");

    const uniqKeys = [...new Set(keysToRemove)];

    const screenUpl = tracks.screen?.uploader || null;
    const cameraUpl = tracks.camera?.uploader || null;

    console.info(
      "[CloudRecorder] clearStaleUploadJournals: removing stale journal + sceneId keys",
      {
        sessionId: storedSession?.id || null,
        keyCount: uniqKeys.length,
        screen: {
          journalKey: screenUpl?.journalKey || null,
          mediaId: screenUpl?.mediaId || null,
          journalOffset: screenUpl?.offset || 0,
          journalTotalBytes: screenUpl?.totalBytes || 0,
          journalStatus: screenUpl?.status || null,
        },
        camera: {
          journalKey: cameraUpl?.journalKey || null,
          mediaId: cameraUpl?.mediaId || null,
          journalOffset: cameraUpl?.offset || 0,
        },
      },
    );

    void emitUploadTelemetry("upload_recovery_journals_cleared", {
      reason: "post-crash-recovery",
      sessionId: storedSession?.id || null,
      projectId: storedSession?.projectId || null,
      clearedKeyCount: uniqKeys.length,
      screenJournalKey: screenUpl?.journalKey || null,
      screenMediaId: screenUpl?.mediaId || null,
      screenJournalOffset: screenUpl?.offset || 0,
      screenJournalTotalBytes: screenUpl?.totalBytes || 0,
      screenJournalStatus: screenUpl?.status || null,
      cameraJournalKey: cameraUpl?.journalKey || null,
      cameraMediaId: cameraUpl?.mediaId || null,
      cameraJournalOffset: cameraUpl?.offset || 0,
    });

    if (!uniqKeys.length) return;
    try {
      await chrome.storage.local.remove(uniqKeys);
    } catch (err) {
      console.warn(
        "[CloudRecorder] clearStaleUploadJournals: failed to remove keys",
        { keys: uniqKeys, error: err?.message || String(err) },
      );
    }
  };

  const tryRecoverPreviousSession = useCallback(async () => {
    if (recoveryAttempted.current) return;
    recoveryAttempted.current = true;
    try {
      const { recorderSession: storedSession } = await chrome.storage.local.get(
        ["recorderSession"],
      );

      const [chunkCount, cameraChunkCount, audioChunkCount] = await Promise.all([
        chunksStore.length().catch(() => 0),
        cameraChunksStore.length().catch(() => 0),
        audioChunksStore.length().catch(() => 0),
      ]);
      const isRecoverable = RECOVERABLE_SESSION_STATUSES.has(
        storedSession?.status,
      );
      const hasDurableChunks =
        chunkCount > 0 || cameraChunkCount > 0 || audioChunkCount > 0;
      if (storedSession && isRecoverable && hasDurableChunks) {
        void emitUploadTelemetry("upload_recovery_available", {
          reason: "durable-chunks",
          recoveredChunkCount: chunkCount,
          recoveredCameraChunkCount: cameraChunkCount,
          recoveredAudioChunkCount: audioChunkCount,
          recordingSessionId: storedSession?.id || null,
          projectId: storedSession?.projectId || null,
        });
        const ts = new Date().toISOString();

        if (chunkCount > 0) {
          const recovered = [];
          await chunksStore.iterate((value) => {
            recovered.push(value);
          });
          recovered.sort((a, b) => a.index - b.index);
          const blob = createBlobFromChunks(
            recovered.map((c) => c.chunk),
            "video/webm",
          );
          if (blob) {
            const objectUrl = URL.createObjectURL(blob);
            try {
              await chrome.downloads.download({
                url: objectUrl,
                filename: `Screenity-Recovered-${ts}.webm`,
                saveAs: false,
              });
            } finally {
              URL.revokeObjectURL(objectUrl);
            }
          }
        }

        if (cameraChunkCount > 0) {
          const cameraRecovered = [];
          await cameraChunksStore.iterate((value) => {
            cameraRecovered.push(value);
          });
          cameraRecovered.sort((a, b) => (a.index || 0) - (b.index || 0));
          const cameraBlob = createBlobFromChunks(
            cameraRecovered.map((c) => c.chunk),
            "video/webm",
          );
          if (cameraBlob) {
            const cameraObjectUrl = URL.createObjectURL(cameraBlob);
            try {
              await chrome.downloads.download({
                url: cameraObjectUrl,
                filename: `Screenity-Recovered-Camera-${ts}.webm`,
                saveAs: false,
              });
            } finally {
              URL.revokeObjectURL(cameraObjectUrl);
            }
          }
        }

        chrome.runtime.sendMessage({
          type: "show-toast",
          message: chrome.i18n.getMessage("toastRecoveredSession"),
        });

        await chunksStore.clear();
        await clearAudioChunkStore("recovery");
        await clearCameraChunkStore("recovery");
        // Clear stale journals and sceneId so the next recording can't accidentally
        // resume the old partial Bunny upload and produce a garbled video.
        await clearStaleUploadJournals(storedSession);
        await chrome.storage.local.set({
          recorderSession: {
            ...storedSession,
            status: "recovered",
            recoveredAt: Date.now(),
            recoveredChunkCount: chunkCount,
            recoveredCameraChunkCount: cameraChunkCount,
          },
        });
      } else if (storedSession && isRecoverable) {
        void emitUploadTelemetry("upload_recovery_available", {
          reason: "metadata-only",
          recoveredChunkCount: 0,
          recordingSessionId: storedSession?.id || null,
          projectId: storedSession?.projectId || null,
        });
        // Even with no durable chunks, stale journals must be cleared — the video
        // map and lookup keys are enough to cause a garbled resume on next start.
        await clearStaleUploadJournals(storedSession);
        await chrome.storage.local.set({
          recorderSession: {
            ...storedSession,
            status: "recovery-metadata-only",
            recoveredAt: Date.now(),
            recoveredChunkCount: 0,
          },
        });
      } else {
        void emitUploadTelemetry("upload_recovery_unavailable", {
          reason: "no-recoverable-session",
        });
      }
    } catch (err) {
      console.warn("Recovery check failed:", err);
    }
  }, []);

  const recoverPendingScenes = useCallback(async () => {
    try {
      const { pendingSceneIndex = [] } = await chrome.storage.local.get([
        "pendingSceneIndex",
      ]);
      if (!pendingSceneIndex.length) return;

      for (const sceneId of pendingSceneIndex) {
        const sceneKey = `pendingScene:${sceneId}`;
        const result = await chrome.storage.local.get([sceneKey]);
        const pending = result?.[sceneKey];
        if (!pending || pending.status === "created") {
          await removePendingScene(sceneId);
          continue;
        }

        const { projectId, screenMediaId, cameraMediaId, audioMediaId } =
          pending;

        if (!projectId) continue;

        await setPipelineState("scene-recovering", {
          projectId,
          sceneId,
        });
        logDebugEvent("scene-recover-attempt", {
          projectId,
          sceneId,
        });

        const recoverResult = await recoverScene({
          projectId,
          sceneId,
          screenMediaId,
          cameraMediaId,
          audioMediaId,
        });

        if (recoverResult.ok) {
          await ensureMediaLinked({
            projectId,
            sceneId,
            mediaIds: [screenMediaId, cameraMediaId, audioMediaId],
          });
          await setSceneCreateStatus(sceneId, "created", {
            recovered: true,
          });
          await removePendingScene(sceneId);
          await markSceneComplete(sceneId);
          await setPipelineState("scene-recovered", {
            projectId,
            sceneId,
          });
          logDebugEvent("scene-recover-success", {
            projectId,
            sceneId,
          });
        } else {
          logDebugEvent("scene-recover-failed", {
            projectId,
            sceneId,
            error: recoverResult.error,
          });
        }
      }
    } catch (err) {
      console.warn("Failed to recover pending scenes", err);
    }
  }, []);

  const attachMicToStream = (videoStream, micStream) => {
    if (!videoStream || !micStream) return videoStream;
    return new MediaStream([
      ...videoStream.getVideoTracks(),
      ...micStream.getAudioTracks(),
    ]);
  };

  const checkMaxMemory = () => {
    const now = Date.now();
    if (now - storagePressureRef.current.lastEstimateAt < STORAGE_CHECK_INTERVAL_MS) {
      return;
    }
    storagePressureRef.current.lastEstimateAt = now;

    navigator.storage
      .estimate()
      .then((data) => {
      const minQuota = 25 * 1024 * 1024;
      const quota = data?.quota || 0;
      const usage = data?.usage || 0;
      const headroom = Math.max(0, quota - usage);
      const lowSpace = headroom > 0 && headroom < STORAGE_LOW_HEADROOM_BYTES;
      const critical =
        headroom > 0 && headroom < STORAGE_CRITICAL_HEADROOM_BYTES;

      storagePressureRef.current = {
        ...storagePressureRef.current,
        quota,
        usage,
        headroom,
        lowSpace,
        critical,
      };

      if (quota < minQuota) {
        void emitUploadTelemetry("upload_storage_pressure", {
          severity: "quota-too-low",
          quota,
          usage,
          headroom,
        });
        chrome.storage.local.set({
          memoryError: true,
          cloudRecorderDegradedMode: {
            reason: "low-storage-quota",
            quota,
            usage,
            headroom,
            at: Date.now(),
          },
        });
        if (!storagePressureRef.current.stopSent) {
          storagePressureRef.current.stopSent = true;
          sendStopRecording("low-storage-quota");
        }
        return;
      }

      if (critical) {
        void emitUploadTelemetry("upload_storage_pressure", {
          severity: "critical",
          quota,
          usage,
          headroom,
        });
        chrome.storage.local.set({
          cloudRecorderDegradedMode: {
            reason: "critical-storage-headroom",
            quota,
            usage,
            headroom,
            at: Date.now(),
          },
        });
        if (!storagePressureRef.current.stopSent) {
          storagePressureRef.current.stopSent = true;
          chrome.runtime.sendMessage({
            type: "show-toast",
            message: chrome.i18n.getMessage("toastStorageCritical"),
          });
          sendStopRecording("critical-storage-headroom");
        }
      } else if (lowSpace && !storagePressureRef.current.warned) {
        storagePressureRef.current.warned = true;
        void emitUploadTelemetry("upload_storage_pressure", {
          severity: "warning",
          quota,
          usage,
          headroom,
        });
        chrome.runtime.sendMessage({
          type: "show-toast",
          message: chrome.i18n.getMessage("toastStorageLow"),
        });
      } else if (!lowSpace) {
        storagePressureRef.current.warned = false;
      }
      })
      .catch((err) => {
        console.warn("Failed to estimate storage usage:", err);
      });
  };

  const setMic = async (result) => {
    if (micStream.current && audioInputGain.current) {
      // Mute merged audio in the main stream
      audioInputGain.current.gain.value = result.active ? 1 : 0;

      // Mute transcription-only mic stream too
      if (rawMicStream.current) {
        rawMicStream.current.getAudioTracks().forEach((track) => {
          track.enabled = result.active;
        });
      }
    }
  };

  const setAudioOutputVolume = (volume) => {
    if (audioOutputGain.current) {
      audioOutputGain.current.gain.value = volume;
    }
  };

  const setRecordingTimingState = async (nextState) => {
    try {
      await chrome.storage.local.set(nextState);
    } catch (err) {
      console.warn("Failed to persist recording timing state:", err);
    }
  };

  const flushPendingChunks = async () => {
    if (screenUploader.current) {
      try {
        await screenUploader.current.waitForPendingUploads?.();
      } catch (e) {
        console.warn("Error waiting for screen chunks to finish:", e);
      }
    }
    if (cameraUploader.current) {
      try {
        await cameraUploader.current.waitForPendingUploads?.();
      } catch (e) {
        console.warn("Error waiting for camera chunks to finish:", e);
      }
    }
  };

  const deleteProject = async (projectId, uploadMeta, deleteVideo = true) => {
    const screenMeta = uploadMeta?.screen;
    const cameraMeta = uploadMeta?.camera;

    const mediaToDelete = [];

    if (screenMeta?.videoId && screenMeta?.mediaId) {
      mediaToDelete.push({
        videoId: screenMeta.videoId,
        mediaId: screenMeta.mediaId,
        type: "video",
      });
    }

    if (cameraMeta?.videoId && cameraMeta?.mediaId) {
      mediaToDelete.push({
        videoId: cameraMeta.videoId,
        mediaId: cameraMeta.mediaId,
        type: "video",
      });
    }

    if (uploadMeta?.audio?.mediaId && uploadMeta?.audio?.path) {
      mediaToDelete.push({
        mediaId: uploadMeta.audio.mediaId,
        path: uploadMeta.audio.path,
        type: "audio",
      });
    }

    await fetch(`${API_BASE}/videos/${projectId}/delete`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mediaToDelete,
        deleteProject: deleteVideo,
        sceneId: uploadMeta.sceneId,
        purgeAllPendingDeletes: false,
        deferDeleteUntilCommit: false,
        forceDelete: true,
        overrideUsedInCheck: true,
      }),
    });
  };

  const cleanupIfEmptyUploads = async (reason) => {
    if (emptyCleanupRef.current) return;
    const screenOffset = screenUploader.current?.offset ?? null;
    const cameraOffset = cameraUploader.current?.offset ?? null;
    const hasScreen = screenOffset !== null;
    const hasCamera = cameraOffset !== null;

    if (!hasScreen && !hasCamera) return;

    const isEmpty =
      (!hasScreen || screenOffset === 0) && (!hasCamera || cameraOffset === 0);

    if (!isEmpty) return;

    emptyCleanupRef.current = true;

    console.warn("[Screenity] empty upload cleanup", {
      reason,
      screenOffset,
      cameraOffset,
    });

    await Promise.allSettled([
      screenUploader.current?.abort?.(),
      cameraUploader.current?.abort?.(),
    ]);

    try {
      const { projectId, recordingToScene } = await chrome.storage.local.get([
        "projectId",
        "recordingToScene",
      ]);
      const uploadMeta = uploadMetaRef.current || {
        screen: screenUploader.current?.getMeta?.() || null,
        camera: cameraUploader.current?.getMeta?.() || null,
        audio: null,
        sceneId:
          screenUploader.current?.getMeta?.()?.sceneId ||
          cameraUploader.current?.getMeta?.()?.sceneId ||
          null,
      };

      if (projectId && uploadMeta) {
        await deleteProject(projectId, uploadMeta, !recordingToScene);
      }
    } catch (err) {
      console.warn("❌ Failed to cleanup empty upload:", err);
    }
  };

  const sendRecordingError = (why, cancel = false) => {
    void cleanupIfEmptyUploads("error");
    sendRecordingErrorBase(why, cancel);
  };

  const dismissRecording = async (restarting = false) => {
    clearPendingStart();
    setInitProject(false);
    await cleanupIfEmptyUploads(restarting ? "restart" : "dismiss");

    // Stop the silent audio keep-alive
    stopTabKeepAlive();
    await setRecordingTimingState({
      recording: false,
      paused: false,
      recordingStartTime: null,
      pausedAt: null,
      totalPausedMs: 0,
    });
    pausedStateRef.current = false;
    await clearAudioChunkStore(restarting ? "dismiss-restart" : "dismiss-recording");
    await clearCameraChunkStore(restarting ? "dismiss-restart" : "dismiss-recording");
    await clearLocalScreenPlaybackOffer(
      restarting ? "dismiss-restart" : "dismiss-recording",
    );

    const { projectId, multiMode, multiSceneCount, recordingToScene } =
      await chrome.storage.local.get([
        "projectId",
        "multiMode",
        "multiSceneCount",
        "recordingToScene",
      ]);

    if (restarting) {
      await Promise.allSettled([
        screenUploader.current?.abort?.(),
        cameraUploader.current?.abort?.(),
      ]);
      if (!recordingToScene) {
        try {
          const uploadMeta = uploadMetaRef.current;
          const { projectId } = await chrome.storage.local.get(["projectId"]);
          if (projectId && uploadMeta) {
            await deleteProject(projectId, uploadMeta, false);
          }
        } catch (err) {
          console.warn("❌ Failed to delete media:", err);
        }
      }
      try {
        await finalizeRecorderSession("restarting");
      } catch {
        // best effort
      }
      uploadMetaRef.current = null;
      sentLast.current = false;
      screenUploader.current = null;
      cameraUploader.current = null;
      uploadersInitialized.current = false;
      cleanupTimers();
      return;
    }

    cleanupTimers();
    stopAllIntervals();

    isRestarting.current = true;

    await Promise.allSettled([
      screenUploader.current?.abort?.(),
      cameraUploader.current?.abort?.(),
    ]);

    await stopRecording(false);

    const uploadMeta = uploadMetaRef.current;
    if (!uploadMeta) {
      console.warn("No upload metadata available for cleanup");
      return;
    }

    if (multiMode) {
      if (multiSceneCount === 0) {
        if (!recordingToScene) {
          // Only delete if new project
          if (projectId) {
            try {
              await deleteProject(projectId, uploadMeta);
            } catch (err) {
              console.warn("❌ Failed to delete project:", err);
            }
          }
        }
        await chrome.storage.local.remove([
          "multiProjectId",
          "multiSceneCount",
        ]);
        await chrome.storage.local.remove("projectId");
      }

      uploadMetaRef.current = null;

      // FLAG: decide whether to close or not
      // window.close();
      return;
    }

    // Not multi-mode: original logic
    if (projectId && !recordingToScene) {
      // Only delete if new project
      try {
        await deleteProject(projectId, uploadMeta);
      } catch (err) {
        console.warn("❌ Failed to delete project:", err);
      }
    } else if (projectId) {
      // Only delete media, not project
      try {
        await deleteProject(projectId, uploadMeta, false);
      } catch (err) {
        console.warn("❌ Failed to delete media:", err);
      }
    }

    if (!multiMode) {
      await chrome.storage.local.remove("projectId");
    }
    uploadMetaRef.current = null;
    isInit.current = false;

    // FLAG: decide whether to close or not
    if (!IS_IFRAME_CONTEXT) {
      try {
        window.close();
      } catch {}
      return;
    }
    // iframe context
    try {
      window.parent.postMessage({ type: "screenity-exit", mode }, "*");
    } catch {}
    // fallback
    window.location.reload();
  };

  const restartRecording = async () => {
    await setCloudRestartPhase("restart-requested", {
      hasTarget: Boolean(target.current),
      hadRegionMode: Boolean(regionRef.current),
    });
    isRestarting.current = true;
    await dismissRecording(true);
    await setCloudRestartPhase("restart-dismissed");
    // Restart keeps existing capture streams; only recorder instances should stop.
    await stopAllRecorders({ stopStreams: false });
    await setCloudRestartPhase("restart-recorders-stopped");
    screenChunks.current = [];
    cameraChunks.current = [];
    audioChunks.current = [];
    await clearAudioChunkStore("restart");
    await clearCameraChunkStore("restart");
    resetSessionTrackState();
    recoveryExportedRef.current = false;
    audioCaptureDegradedRef.current = false;
    index.current = 0;
    lastTimecode.current = 0;

    if (IS_IFRAME_CONTEXT && !target.current) {
      sendRecordingError("No crop target for restart.");
      return false;
    }

    uploadersInitialized.current = await initializeUploaders({
      forceNewSceneId: true,
    });
    if (!uploadersInitialized.current) {
      await setCloudRestartPhase("restart-failed", {
        reason: "uploaders-init-failed",
      });
      sendRecordingError("Failed to re-initialize uploaders on restart.");
      return false;
    }
    if (IS_IFRAME_CONTEXT && target.current) {
      regionRef.current = true;
    }
    await setCloudRestartPhase("restart-uploaders-initialized", {
      hasTarget: Boolean(target.current),
      regionMode: Boolean(regionRef.current),
    });
    await setCloudRestartPhase("restart-ready");
    return true;
  };

  const initializeUploaders = async ({ forceNewSceneId = false } = {}) => {
    try {
      emptyCleanupRef.current = false;
      const { projectId } = await chrome.storage.local.get(["projectId"]);
      const sessionId = ensureRecordingSessionId();

      const sceneId = await getOrCreateSceneId({
        forceNew: forceNewSceneId,
      });
      await chrome.storage.local.set({
        sceneId,
        sceneIdStatus: "recording",
      });
      await setPipelineState("uploaders-initializing", {
        projectId,
        sceneId,
      });
      logDebugEvent("uploaders-init-start", { projectId, sceneId });

      if (!projectId) {
        throw new Error("Missing projectId");
      }

      const onUploaderTelemetry =
        (trackType) => (eventName, payload = {}) => {
          void emitUploadTelemetry(eventName, {
            projectId,
            sceneId,
            trackType,
            ...payload,
          });
        };

      const onUploaderStateChange = (trackType) => (state = {}) => {
        patchTrackState(trackType, {
          lastUploadOffset: state?.offset || 0,
          uploaderUpdatedAt: Date.now(),
        });
        persistSessionState();
        if (state?.status === "error" && state?.error) {
          persistSessionState({
            uploadHealth: "error",
            uploadError: state.error,
            uploadErrorTrack: trackType,
          });
        }
      };

      const onStall = (trackType) => (payload) => {
        stallNotified.current = true;
        persistSessionState({
          uploadHealth: "stalled",
          stalledAt: Date.now(),
          stalledMediaId: payload?.mediaId || null,
          stalledOffset: payload?.offset || 0,
          stalledTrack: trackType,
        });
        void emitUploadTelemetry("upload_stalled", {
          projectId,
          sceneId,
          trackType,
          mediaId: payload?.mediaId || null,
          bunnyVideoId: payload?.videoId || null,
          offset: payload?.offset || 0,
          stallMs: payload?.diff || null,
          reason: payload?.reason || "heartbeat",
          uploaderType: "bunny_tus",
        });
        chrome.runtime.sendMessage({
          type: "upload-stalled",
          offset: {
            screen: payload?.offset || screenUploader.current?.offset || 0,
            camera: cameraUploader.current?.offset || 0,
          },
        });
      };

      if (screenStream.current) {
        screenUploader.current = new BunnyTusUploader({
          sessionId,
          trackType: "screen",
          onProgress: ({ offset }) => {
            const now = Date.now();
            lastUploadProgress.current = {
              ...lastUploadProgress.current,
              screen: offset,
              ts: now,
            };
            patchTrackState("screen", {
              lastUploadOffset: offset,
              uploaderUpdatedAt: now,
            });
            if (now - (lastUploadProgress.current.lastPersistAt || 0) > 2000) {
              lastUploadProgress.current.lastPersistAt = now;
              persistSessionState();
            }
          },
          onStall: onStall("screen"),
          onTelemetry: onUploaderTelemetry("screen"),
          onStateChange: onUploaderStateChange("screen"),
        });
        const track = screenStream.current.getVideoTracks()[0];
        let width, height;
        if (regionRef.current && target.current) {
          width = regionWidth.current;
          height = regionHeight.current;
        } else {
          const settings = track.getSettings();
          width = settings.width;
          height = settings.height;
        }
        await screenUploader.current.initialize(projectId, {
          title: "Screen Recording",
          type: "screen",
          width,
          height,
          sceneId,
          sessionId,
        });
        logDebugEvent("uploader-ready", {
          type: "screen",
          projectId,
          sceneId,
          mediaId: screenUploader.current?.getMeta()?.mediaId || null,
          videoId: screenUploader.current?.getMeta()?.videoId || null,
        });
      }

      if (cameraStream.current) {
        cameraUploader.current = new BunnyTusUploader({
          sessionId,
          trackType: "camera",
          onProgress: ({ offset }) => {
            const now = Date.now();
            lastUploadProgress.current = {
              ...lastUploadProgress.current,
              camera: offset,
              ts: now,
            };
            patchTrackState("camera", {
              lastUploadOffset: offset,
              uploaderUpdatedAt: now,
            });
            if (now - (lastUploadProgress.current.lastPersistAt || 0) > 2000) {
              lastUploadProgress.current.lastPersistAt = now;
              persistSessionState();
            }
          },
          onStall: onStall("camera"),
          onTelemetry: onUploaderTelemetry("camera"),
          onStateChange: onUploaderStateChange("camera"),
        });
        const track = cameraStream.current.getVideoTracks()[0];
        if (track?.readyState === "ended") {
          throw new Error("Camera track has ended");
        }
        const { width, height } = track.getSettings();
        await cameraUploader.current.initialize(projectId, {
          title: "Camera Recording",
          type: "camera",
          linkedMediaId: screenUploader.current?.getMeta()?.mediaId || null,
          width,
          height,
          sceneId,
          sessionId,
        });
        logDebugEvent("uploader-ready", {
          type: "camera",
          projectId,
          sceneId,
          mediaId: cameraUploader.current?.getMeta()?.mediaId || null,
          videoId: cameraUploader.current?.getMeta()?.videoId || null,
        });
      }

      await setPipelineState("uploaders-ready", {
        projectId,
        sceneId,
      });
      logDebugEvent("uploaders-init-complete", { projectId, sceneId });
      return true;
    } catch (err) {
      console.error("❌ Failed to initialize uploaders:", err);
      void emitUploadTelemetry("upload_error", {
        reason: "uploaders-init-failed",
        message: err?.message || String(err),
        uploaderType: "cloud_recorder",
      });
      sendRecordingError("Failed to initialize uploaders: " + err.message);
      await setPipelineState("uploaders-error", {
        status: "error",
        details: err?.message || String(err),
      });
      logDebugEvent("uploaders-init-failed", { error: err?.message || err });
      return false;
    }
  };

  const createMediaRecorder = (stream, options, onDataAvailable) => {
    try {
      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          try {
            const maybePromise = onDataAvailable(event.data);
            if (maybePromise && typeof maybePromise.catch === "function") {
              maybePromise.catch((err) => {
                console.warn("onDataAvailable failed:", err);
              });
            }
          } catch (err) {
            console.warn("onDataAvailable failed:", err);
          }
        }
      };

      recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
        sendRecordingError("Recording error: " + event.error?.message);
      };

      return recorder;
    } catch (err) {
      console.error("Failed to create MediaRecorder:", err);
      throw err;
    }
  };

  const startRecording = async () => {
    setInitProject(false);
    await clearLocalScreenPlaybackOffer("start-recording");
    // Start silent audio to prevent Chrome from freezing this background tab
    startTabKeepAlive();

    const storageReady = await ensureChunkStoreReady();
    if (!storageReady) return;
    await ensureAudioChunkStoreReady();
    await ensureCameraChunkStoreReady();

    if (!uploadersInitialized.current) {
      sendRecordingError(
        "Uploaders not initialized. Please restart recording.",
      );
      return;
    }

    if (!screenStream.current && !cameraStream.current) {
      sendRecordingError("No streams to record");
      logStartFlow("recording_error", { reason: "no-streams" });
      return;
    }

    const { projectId } = await chrome.storage.local.get(["projectId"]);

    if (!projectId) {
      sendRecordingError("No project ID found. Please restart recording.");
      return;
    }

    await setPipelineState("recording-starting", { projectId });
    logDebugEvent("recording-starting", { projectId });

    if (isTab.current && recordingTabId.current) {
      const tabAlive = await chrome.tabs
        .get(recordingTabId.current)
        .then(() => true)
        .catch(() => false);
      if (!tabAlive) {
        sendRecordingError(
          "The tab you selected for recording was closed. Please start again.",
        );
        return;
      }
    }

    if (!recorderSession.current) {
      const registered = await startRecorderSession({
        projectId,
        sessionId: ensureRecordingSessionId(),
      });
      if (!registered) return;
    }

    await Promise.allSettled([
      screenUploader.current?.setSessionId?.(recorderSession.current?.id || null),
      cameraUploader.current?.setSessionId?.(recorderSession.current?.id || null),
    ]);

    if (!screenUploader.current && !cameraUploader.current) {
      sendRecordingError("Uploaders not ready. Please restart recording.");
      logStartFlow("recording_error", { reason: "uploaders-not-ready" });
      return;
    }

    try {
      await chunksStore.clear();
      await clearAudioChunkStore("start-recording");
      await clearCameraChunkStore("start-recording");
    } catch (err) {
      fatalErrorRef.current = true;
      sendRecordingError(
        "Unable to initialize local buffer (IndexedDB issue).",
      );
      return;
    }
    lastTimecode.current = 0;
    hasChunks.current = false;
    index.current = 0;
    firstChunkLoggedRef.current = false;
    resetUnloadGuard();
    recoveryExportedRef.current = false;
    storagePressureRef.current.stopSent = false;
    storagePressureRef.current.warned = false;
    networkStateRef.current = {
      online: navigator.onLine,
      offlineSince: navigator.onLine ? null : Date.now(),
    };
    audioCaptureDegradedRef.current = false;
    resetSessionTrackState();

    // Clear blob storage arrays
    screenChunks.current = [];
    cameraChunks.current = [];
    audioChunks.current = [];

    navigator.storage.persist();

    const screenTrack =
      screenStream.current?.getVideoTracks?.()[0] ?? null;
    const cameraTrack =
      cameraStream.current?.getVideoTracks?.()[0] ?? null;

    if (screenStream.current && !screenTrack) {
      sendRecordingError("No screen video track available.");
      logStartFlow("recording_error", { reason: "no-screen-track" });
      return;
    }

    if (recordingType.current === "camera" && !cameraTrack) {
      sendRecordingError("No camera video track available.");
      logStartFlow("recording_error", { reason: "no-camera-track" });
      return;
    }

    try {
      logStartFlow("recording_start", {
        recordingType: recordingType.current,
        hasScreen: Boolean(screenStream.current),
        hasCamera: Boolean(cameraStream.current),
        hasMic: Boolean(micStream.current),
      });
      // Screen recorder setup
      if (screenStream.current) {
        const stream = attachMicToStream(
          screenStream.current,
          micStream.current,
        );

        const screenOptions = {
          mimeType: "video/webm;codecs=vp9,opus",
          videoBitsPerSecond: 16000000, // 16 Mbps
          audioBitsPerSecond: 128000, // 128 Kbps
        };

        screenRecorder.current = createMediaRecorder(
          stream,
          screenOptions,
          async (blob) => {
            checkMaxMemory();

            // Detect empty chunks which indicate recording failure
            if (!blob || blob.size === 0) {
              console.error("❌ MediaRecorder produced empty chunk!");
              consecutiveScreenFailures.current++;
              if (consecutiveScreenFailures.current > 3) {
                sendRecordingError(
                  "Recording failed - no video data being captured. Please try again.",
                );
                sendStopRecording("empty-screen-chunk");
              }
              return;
            }

            // Store for final blob creation
            screenChunks.current.push(blob);
            const screenDropped = trimChunkBuffer(
              screenChunks,
              SCREEN_CHUNK_MEMORY_WINDOW,
            );
            noteTrackChunk("screen", blob, {
              inMemoryChunkCount: screenChunks.current.length,
              droppedInMemoryChunks:
                (sessionTrackState.current.screen?.droppedInMemoryChunks || 0) +
                screenDropped,
            });

            const timestamp = Date.now();

            if (!hasChunks.current) {
              hasChunks.current = true;
              lastTimecode.current = timestamp;
              firstChunkTime.current = timestamp;
              if (!firstChunkLoggedRef.current) {
                firstChunkLoggedRef.current = true;
                logStartFlow("first_chunk", { type: "screen" });
                assertCountdownBeforeFirstChunk(timestamp);
              }
            } else if (timestamp < lastTimecode.current) {
              return; // Skip duplicate
            } else {
              lastTimecode.current = timestamp;
            }

            await chunksStore
              .setItem(`chunk_${index.current}`, {
                index: index.current,
                chunk: blob,
                timestamp,
              })
              .catch((err) => {
                fatalErrorRef.current = true;
                sendRecordingError(
                  "Could not buffer recording data locally (IndexedDB blocked).",
                );
                sendStopRecording();
                throw err;
              });

            patchTrackState("screen", {
              durableChunkCount: index.current + 1,
              lastPersistedChunkIndex: index.current,
              lastPersistedAt: timestamp,
            });

            persistSessionState({ lastChunkIndex: index.current });

            if (uploadersInitialized.current && screenUploader.current) {
              try {
                if (screenUploader.current?.isPaused) return;
                if (screenUploader.current.queuedBytes > 15 * 1024 * 1024) {
                  await screenUploader.current
                    .waitForPendingUploads?.()
                    .catch(() => {});
                }
                await screenUploader.current.write(blob);
                consecutiveScreenFailures.current = 0; // Reset on success
              } catch (uploadErr) {
                console.error("Failed to upload chunk to Bunny:", uploadErr);
                consecutiveScreenFailures.current++;
                if (consecutiveScreenFailures.current > 3) {
                  stallNotified.current = true;
                  sendRecordingError(
                    "Screen upload failed repeatedly. Continuing locally; upload will retry on finalize.",
                  );
                  screenUploader.current?.pause?.();
                }
              }
            }

            if (backupRef.current) {
              chrome.runtime.sendMessage({
                type: "write-file",
                index: index.current,
              });
            }

            index.current++;
          },
        );

        // Start recording with 2-second time slices
        screenRecorder.current.start(2000);

        if (screenTrack) {
          bindScreenTrack(screenTrack);
        }
      }

      // Audio recorder setup (for transcription)
      if (rawMicStream.current?.getAudioTracks?.().length) {
        const audioOptions = {
          mimeType: "audio/webm", // Using webm instead of wav for better browser support
          audioBitsPerSecond: 128000,
        };

        audioRecorder.current = createMediaRecorder(
          rawMicStream.current,
          audioOptions,
          async (blob) => {
            const timestamp = Date.now();
            // Keep a small in-memory window for UI/quick fallback only.
            audioChunks.current.push(blob);
            const droppedAudio = trimChunkBuffer(
              audioChunks,
              AUDIO_CHUNK_MEMORY_WINDOW,
            );
            noteTrackChunk("audio", blob, {
              inMemoryChunkCount: audioChunks.current.length,
              droppedInMemoryChunks:
                (sessionTrackState.current.audio?.droppedInMemoryChunks || 0) +
                droppedAudio,
            });
            if (audioChunkStoreReadyRef.current) {
              const audioChunkIndex = audioChunkIndexRef.current;
              audioChunkIndexRef.current += 1;
              try {
                await audioChunksStore.setItem(`audio_chunk_${audioChunkIndex}`, {
                  index: audioChunkIndex,
                  chunk: blob,
                  timestamp,
                });
                patchTrackState("audio", {
                  durableChunkCount: audioChunkIndex + 1,
                  lastPersistedChunkIndex: audioChunkIndex,
                  lastPersistedAt: timestamp,
                });
              } catch (err) {
                audioChunkStoreReadyRef.current = false;
                void emitUploadTelemetry("upload_local_backup_degraded", {
                  backupType: "audio",
                  reason: "audio-idb-write-failed",
                  error: err?.message || String(err),
                });
              }
            }
            if (
              !audioCaptureDegradedRef.current &&
              (sessionTrackState.current.audio?.bytesRecorded || 0) >
                AUDIO_MAX_BUFFER_BYTES
            ) {
              audioCaptureDegradedRef.current = true;
              void emitUploadTelemetry("upload_local_backup_degraded", {
                backupType: "audio",
                reason: "audio-buffer-limit",
                bytesRecorded:
                  sessionTrackState.current.audio?.bytesRecorded || 0,
              });
              persistSessionState({
                degradedReason: "audio-buffer-limit",
                audioCaptureDegradedAt: Date.now(),
              });
              chrome.runtime.sendMessage({
                type: "show-toast",
                message: chrome.i18n.getMessage("toastAudioCaptureDegraded"),
              });
              try {
                if (audioRecorder.current?.state === "recording") {
                  audioRecorder.current.stop();
                }
              } catch (err) {
                console.warn("Failed to stop audio recorder after degradation:", err);
              }
              return;
            }
            if (!firstChunkLoggedRef.current) {
              firstChunkLoggedRef.current = true;
              logStartFlow("first_chunk", { type: "audio" });
              assertCountdownBeforeFirstChunk(Date.now());
            }
          },
        );

        audioRecorder.current.start(2000);
      }

      // Camera recorder setup
      if (cameraStream.current) {
        let streamToRecord = cameraStream.current;

        if (recordingType.current === "camera") {
          if (micStream.current) {
            streamToRecord = attachMicToStream(
              cameraStream.current,
              micStream.current,
            );
          } else {
            console.warn("⚠️ Camera-only recording: microphone not available");
          }
        }

        const cameraOptions = {
          mimeType:
            recordingType.current === "camera"
              ? "video/webm;codecs=vp9,opus"
              : "video/webm;codecs=vp9",
          videoBitsPerSecond: 16000000, // 16 Mbps
          audioBitsPerSecond: 128000, // 128 Kbps
        };

        cameraRecorder.current = createMediaRecorder(
          streamToRecord,
          cameraOptions,
          async (blob) => {
            // Detect empty chunks
            if (!blob || blob.size === 0) {
              console.warn("⚠️ Camera MediaRecorder produced empty chunk");
              consecutiveCameraFailures.current++;
              return;
            }

            // Store for final blob creation
            cameraChunks.current.push(blob);
            const cameraDropped = trimChunkBuffer(
              cameraChunks,
              CAMERA_CHUNK_MEMORY_WINDOW,
            );
            noteTrackChunk("camera", blob, {
              inMemoryChunkCount: cameraChunks.current.length,
              droppedInMemoryChunks:
                (sessionTrackState.current.camera?.droppedInMemoryChunks || 0) +
                cameraDropped,
            });
            if (!firstChunkLoggedRef.current) {
              firstChunkLoggedRef.current = true;
              logStartFlow("first_chunk", { type: "camera" });
              assertCountdownBeforeFirstChunk(Date.now());
            }

            if (cameraChunkStoreReadyRef.current) {
              const cameraChunkIndex = cameraChunkIndexRef.current;
              cameraChunkIndexRef.current += 1;
              try {
                await cameraChunksStore.setItem(
                  `camera_chunk_${cameraChunkIndex}`,
                  {
                    index: cameraChunkIndex,
                    chunk: blob,
                    timestamp: Date.now(),
                  },
                );
                patchTrackState("camera", {
                  durableChunkCount: cameraChunkIndex + 1,
                  lastPersistedChunkIndex: cameraChunkIndex,
                  lastPersistedAt: Date.now(),
                });
              } catch (err) {
                cameraChunkStoreReadyRef.current = false;
                console.warn("Failed to persist camera chunk to IDB:", err);
                void emitUploadTelemetry("upload_local_backup_degraded", {
                  backupType: "camera",
                  reason: "camera-idb-write-failed",
                  error: err?.message || String(err),
                });
              }
            }

            if (uploadersInitialized.current && cameraUploader.current) {
              try {
                if (cameraUploader.current?.isPaused) return;
                await cameraUploader.current.write(blob);
                consecutiveCameraFailures.current = 0; // Reset on success
              } catch (uploadErr) {
                console.error(
                  "Failed to upload camera chunk to Bunny:",
                  uploadErr,
                );
                consecutiveCameraFailures.current++;
                if (consecutiveCameraFailures.current > 3) {
                  console.error(
                    "Camera upload failing repeatedly; pausing camera uploader",
                  );
                  cameraUploader.current?.pause?.();
                }
              }
            }
          },
        );

        cameraRecorder.current.start(2000);
      }

      let warned = false;
      const MAX_DURATION =
        parseFloat(process.env.MAX_RECORDING_DURATION) || 60 * 60;
      const WARNING_THRESHOLD =
        parseFloat(process.env.RECORDING_WARNING_THRESHOLD) || 60;

      if (screenTimer.current.notificationInterval)
        clearInterval(screenTimer.current.notificationInterval);

      const timerInterval = setInterval(() => {
        // stop if not recording anymore
        if (!screenStream.current && !cameraStream.current) {
          clearInterval(timerInterval);
          cleanupTimers();
          console.warn("Recording stopped, clearing timer");
          return;
        }

        const elapsed = getActiveVideoTime() / 1000;
        const remaining = MAX_DURATION - elapsed;

        if (!warned && remaining <= WARNING_THRESHOLD) {
          warned = true;
          chrome.runtime.sendMessage({
            type: "time-warning",
          });
        }

        if (remaining <= 0) {
          clearInterval(timerInterval);
          chrome.runtime.sendMessage({
            type: "time-stopped",
          });
          sendStopRecording("max-duration");
        }
      }, 1000);

      // Save to clear later
      screenTimer.current.notificationInterval = timerInterval;
      screenTimer.current.warned = warned;

      const recordingStartTime = Date.now();
      await setRecordingTimingState({
        recording: true,
        paused: false,
        recordingStartTime,
        pausedAt: null,
        totalPausedMs: 0,
      });
      pausedStateRef.current = false;
      persistSessionState({ status: "recording" });
      startSessionHeartbeat();
      setStarted(true);
      await setPipelineState("recording", {
        projectId,
        sceneId:
          screenUploader.current?.getMeta()?.sceneId ||
          cameraUploader.current?.getMeta()?.sceneId ||
          null,
      });
      logDebugEvent("recording-started", {
        projectId,
        sceneId:
          screenUploader.current?.getMeta()?.sceneId ||
          cameraUploader.current?.getMeta()?.sceneId ||
          null,
      });
    } catch (err) {
      sendRecordingError("Recording failed: " + err.message);
    }

    const now = Date.now();
    if (screenStream.current) {
      screenTimer.current.start = now;
      screenTimer.current.paused = false;
      screenTimer.current.total = 0;
    }
    if (cameraStream.current) {
      cameraTimer.current.start = now;
      cameraTimer.current.paused = false;
      cameraTimer.current.total = 0;
    }

    lastUploadProgress.current = {
      screen: screenUploader.current?.offset || 0,
      camera: cameraUploader.current?.offset || 0,
      ts: Date.now(),
      lastPersistAt: Date.now(),
    };
    startChunkWatchdog();
    startUploadHeartbeat();
  };

  function cleanupTimers() {
    const interval = screenTimer.current.notificationInterval;
    if (interval) clearInterval(interval);
    screenTimer.current.notificationInterval = null;
    screenTimer.current.warned = false;
    screenTimer.current.start = null;
    screenTimer.current.paused = false;
    cameraTimer.current.start = null;
    cameraTimer.current.paused = false;
  }

  async function uploadAudioToBunny(audioFile, projectId) {
    const formData = new FormData();
    formData.append("file", audioFile);
    formData.append("projectId", projectId);
    formData.append("type", "audio");

    const res = await fetch(`${API_BASE}/bunny/upload`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result?.error || "Audio upload failed");

    return result;
  }

  const stopAllRecorders = async ({ stopStreams = true } = {}) => {
    const stopRecorder = async (recorderRef) => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          await Promise.race([
            new Promise((resolve) => {
              recorderRef.current.onstop = resolve;
              recorderRef.current.stop();
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Stop timeout")), 5000),
            ),
          ]);
        } catch (err) {
          console.error("Error stopping recorder:", err);
          // Force resolve to prevent hanging
        }
      }
    };

    await Promise.all([
      stopRecorder(screenRecorder),
      stopRecorder(cameraRecorder),
      stopRecorder(audioRecorder),
    ]);

    if (stopStreams) {
      [screenStream, cameraStream, micStream, rawMicStream].forEach((ref) => {
        ref.current?.getTracks().forEach((track) => track.stop());
      });
    }
  };

  const createBlobFromChunks = (chunks, mimeType) => {
    if (!chunks || chunks.length === 0) return null;
    return new Blob(chunks, { type: mimeType });
  };

  const MIN_DURATION_SECONDS = 1;

  const calculateDurations = () => {
    const now = Date.now();

    const getDuration = (timer) => {
      const elapsed = !timer.paused && timer.start ? now - timer.start : 0;
      const total = (timer.total || 0) + elapsed;
      const duration = total / 1000;

      // If timer ever started but duration is zero, use min duration
      if (timer.start && duration < MIN_DURATION_SECONDS) {
        return MIN_DURATION_SECONDS;
      }

      return duration;
    };

    return {
      screen: getDuration(screenTimer.current),
      camera: getDuration(cameraTimer.current),
      fallbackMs:
        firstChunkTime.current && lastTimecode.current
          ? Math.max(0, lastTimecode.current - firstChunkTime.current)
          : null,
    };
  };

  const handleAudioUpload = async (audioBlob, projectId, uploadMeta) => {
    if (!audioBlob) return;

    try {
      const audioFile = new File([audioBlob], "audio-recording.webm", {
        type: "audio/webm",
      });
      logDebugEvent("audio-upload-start", {
        projectId,
        sceneId: uploadMeta?.sceneId || null,
      });
      const result = await uploadAudioToBunny(audioFile, projectId);

      logDebugEvent("audio-upload-complete", {
        projectId,
        sceneId: uploadMeta?.sceneId || null,
        mediaId: result?.mediaId || null,
      });
      return result;
    } catch (err) {
      console.warn("❌ Audio upload/transcription failed:", err);
      logDebugEvent("audio-upload-failed", {
        projectId,
        sceneId: uploadMeta?.sceneId || null,
        error: err?.message || String(err),
      });
    }
  };

  const handleTranscription = async (uploadMeta, projectId) => {
    if (!uploadMeta.audio || !uploadMeta.audio.mediaId) return;
    try {
      const transcriptionTarget =
        uploadMeta.screen?.mediaId || uploadMeta.camera?.mediaId;

      if (transcriptionTarget && uploadMeta.audio?.url) {
        const dedupeKey = `transcriptionQueued:${uploadMeta.sceneId}:${uploadMeta.audio.mediaId}`;
        const dedupe = await chrome.storage.local.get([dedupeKey]);
        if (dedupe?.[dedupeKey]) return;

        await fetch(`${API_BASE}/transcription/queue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            input: uploadMeta.audio.url,
            output: `transcriptions/${uploadMeta.audio.mediaId}.json`,
            videoId: projectId,
            sceneId: uploadMeta.sceneId,
            inputMediaId: uploadMeta.audio.mediaId,
            targetMediaId: transcriptionTarget,
            lang: "en",
            model: "tiny",
          }),
        });
        await chrome.storage.local.set({ [dedupeKey]: true });
        logDebugEvent("transcription-queued", {
          projectId,
          sceneId: uploadMeta.sceneId,
          inputMediaId: uploadMeta.audio.mediaId,
          targetMediaId: transcriptionTarget,
        });
      }
    } catch (err) {
      console.warn("❌ Transcription failed:", err);
      logDebugEvent("transcription-failed", {
        projectId,
        sceneId: uploadMeta.sceneId,
        error: err?.message || String(err),
      });
    }
  };

  useEffect(() => {
    const onHide = (event) => {
      // Only finalize if the page is actually being unloaded (persisted = false)
      // Don't finalize just because the tab went to background
      // event.persisted indicates if the page might be restored from bfcache
      const isActualUnload = !event.persisted;

      // Only finalize if an active recording really exists
      const hasActiveRecorder =
        screenRecorder.current?.state === "recording" ||
        cameraRecorder.current?.state === "recording" ||
        audioRecorder.current?.state === "recording";

      if (!unloadGuardRef.current.pagehideSeen) {
        unloadGuardRef.current.pagehideSeen = true;
        void emitUploadTelemetry("upload_pagehide", {
          persisted: Boolean(event.persisted),
          hasActiveRecorder,
        });
      }

      if (
        hasActiveRecorder &&
        !sentLast.current &&
        !isFinishing.current &&
        isActualUnload &&
        !unloadGuardRef.current.stopTriggeredFromUnload
      ) {
        unloadGuardRef.current.stopTriggeredFromUnload = true;
        emitAbandonedOnUnloadOnce("pagehide");
        console.warn("⚠️ Recorder page unloading — finalizing");
        // Use sendBeacon or sync storage write for reliability
        navigator.sendBeacon?.(
          `${API_BASE}/log/recorder-unload`,
          JSON.stringify({ reason: "pagehide", ts: Date.now() }),
        );
        stopRecording(true, "pagehide-unload");
      }
    };

    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistSessionState({
          visibilityState: "hidden",
          visibilityChangedAt: Date.now(),
        });
      }
    };

    const onBeforeUnload = () => {
      if (hasChunks.current) {
        if (!unloadGuardRef.current.beforeUnloadSeen) {
          unloadGuardRef.current.beforeUnloadSeen = true;
          emitAbandonedOnUnloadOnce("beforeunload");
        }
        persistSessionState({
          unloadAt: Date.now(),
          unloadReason: "beforeunload",
        });
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  useEffect(() => {
    const onOffline = () => {
      networkStateRef.current = {
        online: false,
        offlineSince: Date.now(),
      };
      screenUploader.current?.pause?.();
      cameraUploader.current?.pause?.();
      void emitUploadTelemetry("upload_stalled", {
        reason: "network-offline",
        uploaderType: "cloud_recorder",
      });
      persistSessionState({
        networkOfflineAt: networkStateRef.current.offlineSince,
        degradedReason: "network-offline",
      });
      chrome.runtime.sendMessage({
        type: "show-toast",
        message: chrome.i18n.getMessage("toastNetworkOffline"),
      });
    };

    const RESUMABLE_UPLOADER_STATUSES = new Set([
      "uploading",
      "paused",
      "error",
      "ready",
    ]);

    const onOnline = () => {
      networkStateRef.current = {
        online: true,
        offlineSince: null,
      };
      if (
        screenUploader.current &&
        RESUMABLE_UPLOADER_STATUSES.has(screenUploader.current.status)
      ) {
        screenUploader.current.resume();
      }
      if (
        cameraUploader.current &&
        RESUMABLE_UPLOADER_STATUSES.has(cameraUploader.current.status)
      ) {
        cameraUploader.current.resume();
      }
      void emitUploadTelemetry("upload_resumed", {
        reason: "network-online",
        uploaderType: "cloud_recorder",
      });
      persistSessionState({
        networkOnlineAt: Date.now(),
      });
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    tryRecoverPreviousSession();
  }, [tryRecoverPreviousSession]);

  useEffect(() => {
    void ensureTelemetryRuntimeContext();
  }, []);

  useEffect(() => {
    recoverPendingScenes();
  }, [recoverPendingScenes]);

  useEffect(() => {
    return () => {
      stopAllIntervals();
      stopTabKeepAlive(); // Clean up keep-alive on unmount
    };
  }, []);

  useEffect(() => {
    return () => {
      stopAllIntervals();
    };
  }, []);

  const sendEditorReady = ({
    projectId,
    sceneId,
    recordingToScene,
    multiMode,
  }) => {
    const localPlayback = localScreenPlaybackOfferRef.current;
    const localPlaybackAvailable =
      Boolean(localPlayback?.offerId) &&
      localPlayback?.trackType === "screen" &&
      Number(localPlayback?.expiresAt || 0) > Date.now();

    const shouldNotifyEditor = !multiMode || recordingToScene;
    if (!shouldNotifyEditor || !projectId || !sceneId) {
      console.warn("[Screenity][CloudRecorder] Skipping editor-ready", {
        shouldNotifyEditor,
        hasProjectId: Boolean(projectId),
        hasSceneId: Boolean(sceneId),
        recordingToScene: Boolean(recordingToScene),
        multiMode: Boolean(multiMode),
      });
      return;
    }

    console.info("[Screenity][CloudRecorder] Sending editor-ready", {
      projectId,
      sceneId,
      recordingToScene: Boolean(recordingToScene),
      multiMode: Boolean(multiMode),
      instantMode: Boolean(instantMode.current),
      localPlaybackAvailable,
      localPlaybackOfferId: localPlayback?.offerId || null,
    });
    chrome.runtime.sendMessage({
      type: "editor-ready",
      publicUrl: !recordingToScene
        ? `${process.env.SCREENITY_APP_BASE}/view/${projectId}/`
        : undefined,
      newProject: !recordingToScene && !multiMode,
      multiMode: Boolean(multiMode),
      instantMode: instantMode.current,
      sceneId,
      projectId,
      editorUrl:
        !recordingToScene && !multiMode
          ? instantMode.current
            ? `${process.env.SCREENITY_APP_BASE}/view/${projectId}?load=true`
            : `${process.env.SCREENITY_APP_BASE}/editor/${projectId}/edit?load=true`
          : undefined,
      localPlayback: localPlaybackAvailable
        ? {
            available: true,
            offerId: localPlayback.offerId,
            trackType: "screen",
            chunkCount: localPlayback.chunkCount || 0,
            estimatedBytes: localPlayback.estimatedBytes || 0,
            expiresAt: localPlayback.expiresAt || null,
            mediaId: localPlayback.mediaId || null,
            bunnyVideoId: localPlayback.bunnyVideoId || null,
            source: localPlayback.source || "indexeddb-screen-chunks",
          }
        : {
            available: false,
            trackType: "screen",
          },
    });
  };

  const createSceneOrHandleMultiMode = async (
    uploadMeta,
    durations,
    isSilent,
  ) => {
    const {
      projectId,
      clickEvents = [],
      surface,
      multiMode,
      multiSceneCount = 0,
      multiLastSceneId = null,
      activeSceneId = null,
      recordingToScene = false,
      recordedTabDomain = null,
      recordingType = null,
    } = await chrome.storage.local.get([
      "projectId",
      "clickEvents",
      "surface",
      "multiMode",
      "multiSceneCount",
      "multiLastSceneId",
      "activeSceneId",
      "recordingToScene",
      "recordedTabDomain",
      "recordingType",
    ]);

    // Check if cameraFlipped is set in storage, then pass it in payload
    const { cameraFlipped } = await chrome.storage.local.get(["cameraFlipped"]);

    let insertAfterSceneId = null;
    if (multiMode) {
      insertAfterSceneId = multiLastSceneId || activeSceneId;
    } else {
      insertAfterSceneId = activeSceneId;
    }

    // Validate uploadMeta has required data
    if (!uploadMeta.sceneId) {
      throw new Error("Missing sceneId in uploadMeta");
    }

    if (!uploadMeta.screen?.mediaId && !uploadMeta.camera?.mediaId) {
      throw new Error(
        "No valid media uploaded - both screen and camera mediaId are missing",
      );
    }

    const sceneId = uploadMeta.sceneId;
    const existingStatus = await getSceneCreateStatus(sceneId);
    let sceneOutcome = null;
    let shouldIncrementMultiSceneCount = false;

    if (existingStatus?.status === "created") {
      logDebugEvent("scene-create-skip", {
        projectId,
        sceneId,
      });
      await ensureMediaLinked({
        projectId,
        sceneId,
        mediaIds: [
          uploadMeta.screen?.mediaId,
          uploadMeta.camera?.mediaId,
          uploadMeta.audio?.mediaId,
        ],
      });
      await removePendingScene(sceneId);
      await markSceneComplete(sceneId);
      await setPipelineState("scene-reused", {
        projectId,
        sceneId,
      });
      sceneOutcome = "reused";
    } else {
      await setSceneCreateStatus(sceneId, "creating", {
        projectId,
      });
      await setPipelineState("scene-creating", {
        projectId,
        sceneId,
      });
      logDebugEvent("scene-create-start", {
        projectId,
        sceneId,
      });

      const payload = {
        sceneId,
        screenMediaId: uploadMeta.screen?.mediaId || null,
        cameraMediaId: uploadMeta.camera?.mediaId || null,
        screenVideoId: uploadMeta.screen?.videoId || null,
        cameraVideoId: uploadMeta.camera?.videoId || null,
        audioMediaId: uploadMeta.audio?.mediaId || null,
        recordingSessionId: recorderSession.current?.id || null,
        durations,
        captionSource: uploadMeta.screen ? "screen" : "camera",
        transcriptionSourceMediaId: !isSilent
          ? uploadMeta.audio?.mediaId || null
          : null,
        thumbnail: uploadMeta.screen?.thumbnail || null,
        dimensions: {
          screen: {
            width: uploadMeta.screen?.width || 1920,
            height: uploadMeta.screen?.height || 1080,
          },
          camera: uploadMeta.camera
            ? {
                width: uploadMeta.camera?.width || 1920,
                height: uploadMeta.camera?.height || 1080,
                flip: cameraFlipped,
              }
            : null,
        },
        clickEvents,
        surface,
        instantMode: instantMode.current,
        newProject: !recordingToScene && (!multiMode || multiSceneCount === 0),
        insertAfterSceneId,
        isTab: isTab.current && !regionRef.current,
        domain: recordedTabDomain || null,
      };

      const res = await fetch(`${API_BASE}/videos/${projectId}/scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        const recoverResult = await recoverScene({
          projectId,
          sceneId,
          screenMediaId: uploadMeta.screen?.mediaId || null,
          cameraMediaId: uploadMeta.camera?.mediaId || null,
          audioMediaId: uploadMeta.audio?.mediaId || null,
        });

        if (recoverResult.ok) {
          await setSceneCreateStatus(sceneId, "created", {
            recovered: true,
          });
          await ensureMediaLinked({
            projectId,
            sceneId,
            mediaIds: [
              uploadMeta.screen?.mediaId,
              uploadMeta.camera?.mediaId,
              uploadMeta.audio?.mediaId,
            ],
          });
          await removePendingScene(sceneId);
          await markSceneComplete(sceneId);
          await setPipelineState("scene-recovered", {
            projectId,
            sceneId,
          });
          logDebugEvent("scene-recovered", {
            projectId,
            sceneId,
          });
          sceneOutcome = "recovered";
          shouldIncrementMultiSceneCount = true;
        } else {
          logDebugEvent("scene-create-failed", {
            projectId,
            sceneId,
            error: errorText,
          });
          await setSceneCreateStatus(sceneId, "failed", {
            error: errorText,
          });
          throw new Error(`Failed to create scene: ${errorText}`);
        }
      } else {
        await setSceneCreateStatus(sceneId, "created");
        await ensureMediaLinked({
          projectId,
          sceneId,
          mediaIds: [
            uploadMeta.screen?.mediaId,
            uploadMeta.camera?.mediaId,
            uploadMeta.audio?.mediaId,
          ],
        });
        await removePendingScene(sceneId);
        await markSceneComplete(sceneId);
        await setPipelineState("scene-created", {
          projectId,
          sceneId,
        });
        logDebugEvent("scene-create-complete", {
          projectId,
          sceneId,
        });
        sceneOutcome = "created";
        shouldIncrementMultiSceneCount = true;
      }
    }

    if (multiMode && shouldIncrementMultiSceneCount) {
      await chrome.storage.local.set({
        multiSceneCount: multiSceneCount + 1,
        multiLastSceneId: sceneId,
      });
      chrome.runtime.sendMessage({
        type: "reopen-popup-multi",
      });
    }

    sendEditorReady({
      projectId,
      sceneId,
      recordingToScene,
      multiMode,
    });

    await chrome.storage.local.remove("clickEvents");
    return { [sceneOutcome || "created"]: true };
  };

  // Check if audio is silent to skip transcription
  const isAudioSilent = async (audioBlob, silenceThreshold = 0.01) => {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioCtx = new OfflineAudioContext(1, 44100 * 40, 44100); // up to 40s
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0);
    let total = 0;

    for (let i = 0; i < channelData.length; i++) {
      total += Math.abs(channelData[i]);
    }

    const avg = total / channelData.length;
    return avg < silenceThreshold; // true if basically silent
  };

  const stopRecording = async (shouldFinalize = true, reason = "unknown") => {
    if (isFinishing.current || sentLast.current) return;
    // Lock immediately to prevent duplicate stop/finalize races under unload pressure.
    isFinishing.current = true;
    clearPendingStart();

    if (DEBUG_START_FLOW) {
      console.debug("[Screenity] stopRecording invoked", {
        reason,
        shouldFinalize,
        screenState: screenRecorder.current?.state,
        cameraState: cameraRecorder.current?.state,
        audioState: audioRecorder.current?.state,
        screenOffset: screenUploader.current?.offset || 0,
        cameraOffset: cameraUploader.current?.offset || 0,
        chunkCount:
          (sessionTrackState.current.screen?.chunkCount || 0) +
          (sessionTrackState.current.camera?.chunkCount || 0),
      });
    }
    logStartFlow("recording_stop", { reason, shouldFinalize });
    chrome.storage.local.set({
      lastStopRecordingEvent: {
        reason,
        screenOffset: screenUploader.current?.offset || 0,
        cameraOffset: cameraUploader.current?.offset || 0,
        chunkCount:
          (sessionTrackState.current.screen?.chunkCount || 0) +
          (sessionTrackState.current.camera?.chunkCount || 0),
        ts: Date.now(),
      },
    });
    const stage = reason || (shouldFinalize ? "finalize" : "stop");

    if (keepAliveInterval.current) {
      clearInterval(keepAliveInterval.current);
      keepAliveInterval.current = null;
    }

    // Stop the silent audio keep-alive since we're done recording
    stopTabKeepAlive();

    const { projectId, recordingToScene, multiMode } =
      await chrome.storage.local.get([
        "projectId",
        "recordingToScene",
        "multiMode",
      ]);

    await persistSessionState({ status: "stopping" });

    if (shouldFinalize && reason !== "retry-finalize") {
      // Skip on retry-finalize: editor tab is already open from the first attempt.
      // Re-sending would open a duplicate tab or reload the editor mid-session.
      if (recordingToScene) {
        chrome.runtime.sendMessage({
          type: "prepare-editor-existing",
          multiMode: multiMode,
        });
      } else if (!multiMode && !recordingToScene) {
        chrome.runtime.sendMessage({
          type: "prepare-open-editor",
          projectId,
          url: instantMode.current
            ? `${process.env.SCREENITY_APP_BASE}/view/${projectId}?load=true`
            : `${process.env.SCREENITY_APP_BASE}/editor/${projectId}/edit?load=true`,
          publicUrl: `${process.env.SCREENITY_APP_BASE}/view/${projectId}/`,
          instantMode: instantMode.current,
        });
      }
    }
    await setRecordingTimingState({
      recording: false,
      paused: false,
      recordingStartTime: null,
      pausedAt: null,
      totalPausedMs: 0,
    });
    pausedStateRef.current = false;
    stopAllIntervals();

    await stopAllRecorders();

    const { sceneId } = await chrome.storage.local.get(["sceneId"]);
    const uploadMeta = {
      screen: screenUploader.current?.getMeta() || null,
      camera: cameraUploader.current?.getMeta() || null,
      audio: null,
      // use sceneId as per the metadata in screenUploader or cameraUploader, whichever exists
      sceneId:
        screenUploader.current?.getMeta()?.sceneId ||
        cameraUploader.current?.getMeta()?.sceneId ||
        sceneId,
    };
    uploadMetaRef.current = uploadMeta;
    cleanupTimers();

    if (!shouldFinalize) {
      console.info("[CloudRecorder] stopRecording: skipping uploader finalize", {
        reason,
        shouldFinalize,
        screenStatus: uploadMeta.screen?.status || "none",
        cameraStatus: uploadMeta.camera?.status || "none",
      });
      void emitUploadTelemetry("upload_cancelled", {
        reason: reason || "stop-without-finalize",
        uploaderType: "cloud_recorder",
      });
      try {
        await chrome.storage.local.set({ sceneIdStatus: "cancelled" });
      } catch {
        // ignore
      }
      await finalizeRecorderSession("cancelled");
      await chunksStore.clear().catch((e) =>
        console.warn("[CloudRecorder] chunksStore.clear failed (cancelled-stop):", e),
      );
      await clearAudioChunkStore("cancelled-stop");
      await clearCameraChunkStore("cancelled-stop");
      await clearLocalScreenPlaybackOffer("cancelled-stop");
      return;
    }

    const durations = calculateDurations();

    await flushPendingChunks();

    let finalizeError = null;
    const finalizeCalls = [
      screenUploader.current?.finalize?.(),
      cameraUploader.current?.finalize?.(),
    ];

    if (
      shouldSimulateFinalizeFailure() &&
      !simulateFinalizeFailureConsumedRef.current
    ) {
      simulateFinalizeFailureConsumedRef.current = true;
      finalizeCalls.push(
        Promise.reject(new Error("simulated-finalize-failure")),
      );
    }

    const settledResults = await Promise.allSettled(finalizeCalls);
    const rejectedResults = settledResults.filter(
      (result) => result.status === "rejected",
    );

    const screenMeta = screenUploader.current?.getMeta?.() || null;
    const cameraMeta = cameraUploader.current?.getMeta?.() || null;
    const incompleteUploaders = [];

    if (screenUploader.current && screenMeta?.status !== "completed") {
      incompleteUploaders.push({
        uploader: "screen",
        status: screenMeta?.status || "unknown",
        offset: screenMeta?.offset || 0,
        error: screenMeta?.error || null,
      });
    }

    if (cameraUploader.current && cameraMeta?.status !== "completed") {
      incompleteUploaders.push({
        uploader: "camera",
        status: cameraMeta?.status || "unknown",
        offset: cameraMeta?.offset || 0,
        error: cameraMeta?.error || null,
      });
    }

    if (rejectedResults.length > 0 || incompleteUploaders.length > 0) {
      const diagnostics = buildFinalizeDiagnostics({
        stage,
        settledResults,
        rejectedResults,
        incompleteUploaders,
        reason: "uploader-finalize-incomplete",
      });
      await markFinalizeFailure(diagnostics);
      logDebugEvent("finalize-failed", {
        stage,
        diagnostics,
      });
      finalizeError = new Error("uploader-finalize-incomplete");
    } else {
      if (DEBUG_START_FLOW) {
        console.info("[CloudRecorder][Finalize] Finalization complete", {
          stage,
          settledResults: settledResults.map((result, i) => ({
            index: i,
            status: result.status,
          })),
          screen: screenMeta,
          camera: cameraMeta,
        });
      }
      logDebugEvent("finalize-complete", {
        stage,
        screen: screenMeta,
        camera: cameraMeta,
      });
    }

    if (finalizeError) {
      void emitUploadTelemetry("upload_error", {
        reason: "uploader-finalize-incomplete",
        uploaderType: "cloud_recorder",
      });
      await exportLocalRecovery("finalize-error");
      await chunksStore.clear().catch((e) =>
        console.warn("[CloudRecorder] chunksStore.clear failed (finalize-error):", e),
      );
      await finalizeRecorderSession("failed");
      await clearAudioChunkStore("finalize-error");
      await clearCameraChunkStore("finalize-error");
      await clearLocalScreenPlaybackOffer("finalize-error");
      sendRecordingError(
        "Upload failed to finalize. A recovery copy was downloaded.",
      );
      return;
    }

    // Validate that at least one media source was successfully uploaded
    const hasAnyScreenData = (uploadMeta.screen?.offset || 0) > 0;
    const hasAnyCameraData = (uploadMeta.camera?.offset || 0) > 0;
    const hasValidScreen =
      hasAnyScreenData &&
      uploadMeta.screen?.mediaId &&
      uploadMeta.screen?.videoId;
    const hasValidCamera =
      hasAnyCameraData &&
      uploadMeta.camera?.mediaId &&
      uploadMeta.camera?.videoId;

    // Warn if upload size seems suspiciously small for recording duration
    const screenDuration = durations.screen || 0;
    const cameraDuration = durations.camera || 0;
    const fallbackSeconds = durations.fallbackMs
      ? durations.fallbackMs / 1000
      : 0;
    const effectiveScreenDuration =
      screenDuration < MIN_DURATION_SECONDS && fallbackSeconds > 0
        ? fallbackSeconds
        : screenDuration;
    const effectiveCameraDuration =
      cameraDuration < MIN_DURATION_SECONDS && fallbackSeconds > 0
        ? fallbackSeconds
        : cameraDuration;

    const usedDurations = {
      screen: effectiveScreenDuration || screenDuration,
      camera: effectiveCameraDuration || cameraDuration,
    };
    if (hasValidScreen && effectiveScreenDuration > 5) {
      const screenOffset = uploadMeta.screen?.offset || 0;
      const minExpectedSize = effectiveScreenDuration * 50000; // ~50KB/sec minimum
      if (screenOffset < minExpectedSize) {
        console.warn(
          `⚠️ Screen upload size (${screenOffset} bytes) seems small for ${effectiveScreenDuration}s recording. Expected at least ${minExpectedSize} bytes.`,
        );
      }
    }

    if (!hasValidScreen && !hasValidCamera) {
      const screenStatus = uploadMeta.screen?.status || "none";
      const cameraStatus = uploadMeta.camera?.status || "none";
      const screenOffset = uploadMeta.screen?.offset || 0;
      const cameraOffset = uploadMeta.camera?.offset || 0;
      const screenError = uploadMeta.screen?.error || "none";
      const cameraError = uploadMeta.camera?.error || "none";
      // If we see bytes on Bunny (offset > 0) but status is not completed, treat as success with a warning.
      if (hasAnyScreenData || hasAnyCameraData) {
        console.warn(
          "Uploads have data but were not marked completed. Proceeding with scene creation.",
          { screenStatus, cameraStatus, screenOffset, cameraOffset },
        );
      } else {
        await cleanupIfEmptyUploads("no-upload");
        await exportLocalRecovery("no-upload");
        await chunksStore.clear().catch((e) =>
          console.warn("[CloudRecorder] chunksStore.clear failed (no-upload):", e),
        );
        await finalizeRecorderSession("failed");
        await clearAudioChunkStore("no-upload");
        await clearCameraChunkStore("no-upload");
        await clearLocalScreenPlaybackOffer("no-upload");
        sendRecordingError(
          `No media was successfully uploaded. Screen: ${screenStatus} (${screenOffset} bytes, error: ${screenError}), Camera: ${cameraStatus} (${cameraOffset} bytes, error: ${cameraError})`,
        );
        return;
      }
    }

    // Create final audio blob from durable store when available.
    const audioBlob = await buildAudioBlobFromDurableStore();
    const silent = audioBlob ? await isAudioSilent(audioBlob) : true;

    await upsertPendingScene(uploadMeta.sceneId, {
      projectId,
      screenMediaId: uploadMeta.screen?.mediaId || null,
      cameraMediaId: uploadMeta.camera?.mediaId || null,
      audioMediaId: null,
      status: "ready",
    });
    await setPipelineState("scene-ready", {
      projectId,
      sceneId: uploadMeta.sceneId,
    });
    logDebugEvent("scene-ready", {
      projectId,
      sceneId: uploadMeta.sceneId,
    });

    localScreenPlaybackOfferRef.current = await registerLocalScreenPlaybackOffer(
      {
        projectId,
        sceneId: uploadMeta.sceneId,
        uploadMeta,
      },
    );

    chrome.storage.local.set({ uploadMeta });

    isInit.current = false;

    if (!sentLast.current) {
      sentLast.current = true;
      try {
        await createSceneOrHandleMultiMode(uploadMeta, usedDurations, silent);

        const result = await handleAudioUpload(
          audioBlob,
          projectId,
          uploadMeta,
        );
        uploadMeta.audio = result;
        chrome.storage.local.set({ uploadMeta });

        if (result?.mediaId) {
          await ensureMediaLinked({
            projectId,
            sceneId: uploadMeta.sceneId,
            mediaIds: [uploadMeta.audio?.mediaId],
          });
        }

        if (!silent && audioBlob) {
          await handleTranscription(uploadMeta, projectId);
        }

        chrome.runtime.sendMessage({ type: "video-ready", uploadMeta });
        if (localScreenPlaybackOfferRef.current?.offerId) {
          console.info(
            "[CloudRecorder] Retaining local screen chunks for editor local-first playback",
            {
              offerId: localScreenPlaybackOfferRef.current.offerId,
              projectId,
              sceneId: uploadMeta.sceneId,
              chunkCount: localScreenPlaybackOfferRef.current.chunkCount || 0,
            },
          );
        } else {
          await chunksStore.clear().catch(() => {});
        }
        await clearAudioChunkStore("success");
        await clearCameraChunkStore("success");
        await setPipelineState("completed", {
          projectId,
          sceneId: uploadMeta.sceneId,
        });
        await finalizeRecorderSession("completed");
        void emitUploadTelemetry("upload_complete_client", {
          projectId,
          sceneId: uploadMeta.sceneId,
          uploaderType: "cloud_recorder",
          mediaId: uploadMeta.screen?.mediaId || uploadMeta.camera?.mediaId || null,
        });

        if (!IS_IFRAME_CONTEXT) {
          try {
            window.close();
          } catch {}
        } else {
          window.location.reload();
        }
      } catch (err) {
        console.error("❌ Failed to create scene:", err);

        // Provide user-friendly error message based on the error type
        let userMessage = "Failed to save recording: ";
        if (
          err.message.includes("No data uploaded") ||
          err.message.includes("offset is 0")
        ) {
          userMessage +=
            "No video data was uploaded. This may be due to network issues. Please check your connection and try again.";
        } else if (err.message.includes("No media was successfully uploaded")) {
          userMessage +=
            "Upload did not complete successfully. Please check your internet connection and try recording again.";
        } else {
          userMessage += err.message;
        }

        void emitUploadTelemetry("upload_error", {
          reason: "scene-create-failed",
          message: err?.message || String(err),
          uploaderType: "cloud_recorder",
          projectId,
          sceneId: uploadMeta.sceneId,
        });
        sendRecordingError(userMessage);

        chrome.storage.local.set({
          failedRecording: {
            uploadMeta,
            durations,
            timestamp: Date.now(),
            error: err.message,
          },
        });
        await setPipelineState("failed", {
          projectId,
          sceneId: uploadMeta.sceneId,
          status: err.message,
        });

        // Still close the window even on error to prevent stuck tabs
        // Give user time to see the error message
        setTimeout(() => {
          if (!IS_IFRAME_CONTEXT) {
            try {
              window.close();
            } catch {}
          } else {
            window.location.reload();
          }
        }, 3000);
        await exportLocalRecovery("scene-error");
        await chunksStore.clear().catch((e) =>
          console.warn("[CloudRecorder] chunksStore.clear failed (scene-error):", e),
        );
        try {
          await chrome.storage.local.set({ sceneIdStatus: "failed" });
        } catch {
          // ignore
        }
        await finalizeRecorderSession("failed");
        await clearAudioChunkStore("scene-error");
        await clearCameraChunkStore("scene-error");
        await clearLocalScreenPlaybackOffer("scene-error");
      }
    }
  };

  const startAudioStream = async (id) => {
    const useExact = id && id !== "none";
    const audioStreamOptions = {
      audio: useExact ? { deviceId: { exact: id } } : true,
    };

    try {
      const { defaultAudioInputLabel, audioinput } =
        await chrome.storage.local.get([
          "defaultAudioInputLabel",
          "audioinput",
        ]);
      const desiredLabel =
        defaultAudioInputLabel ||
        audioinput?.find((device) => device.deviceId === id)?.label ||
        "";

      return await getUserMediaWithFallback({
        constraints: audioStreamOptions,
        fallbacks:
          useExact && desiredLabel
            ? [
                {
                  kind: "audioinput",
                  desiredDeviceId: id,
                  desiredLabel,
                  onResolved: (resolvedId) => {
                    chrome.storage.local.set({
                      defaultAudioInput: resolvedId,
                      defaultAudioInputLabel: desiredLabel,
                    });
                  },
                },
              ]
            : [],
      });
    } catch (err) {
      console.warn(
        "⚠️ Failed to access audio with deviceId, trying fallback:",
        err,
      );
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err2) {
        console.warn(
          "⚠️ Microphone blocked/unavailable; continuing without mic:",
          err2,
        );

        // Optional: small non-fatal UI signal
        chrome.runtime.sendMessage({
          type: "show-toast",
          message:
            "Microphone permission is blocked. Recording will be silent.",
        });

        return null;
      }
    }
  };

  const getVideoStreamWithFallback = async (constraints, deviceId) => {
    if (!deviceId || deviceId === "none") {
      return navigator.mediaDevices.getUserMedia(constraints);
    }
    const { defaultVideoInputLabel, videoinput } =
      await chrome.storage.local.get(["defaultVideoInputLabel", "videoinput"]);
    const desiredLabel =
      defaultVideoInputLabel ||
      videoinput?.find((device) => device.deviceId === deviceId)?.label ||
      "";

    return getUserMediaWithFallback({
      constraints,
      fallbacks:
        deviceId && desiredLabel
          ? [
              {
                kind: "videoinput",
                desiredDeviceId: deviceId,
                desiredLabel,
                onResolved: (resolvedId) => {
                  chrome.storage.local.set({
                    defaultVideoInput: resolvedId,
                    defaultVideoInputLabel: desiredLabel,
                  });
                },
              },
            ]
          : [],
    });
  };

  const isUserCaptureCancel = (err) => {
    const name = err?.name || "";
    const message = (err?.message || "").toLowerCase();
    return (
      name === "NotAllowedError" ||
      name === "AbortError" ||
      message.includes("cancel") ||
      message.includes("permission denied")
    );
  };

  const startStream = async (data, id, permissions, permissions2) => {
    // Defaulting quality for now
    //const { qualityValue } = await chrome.storage.local.get(["qualityValue"]);
    const { width = 1920, height = 1080 } = getResolutionForQuality() || {};

    // Defaulting FPS for now
    // const { fpsValue } = await chrome.storage.local.get(["fpsValue"]);
    const fps = parseInt(30);

    const { instantMode: instant } = await chrome.storage.local.get([
      "instantMode",
    ]);
    instantMode.current = instant || false;

    const constraints = {
      audio: false,
      video: {
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: fps },
      },
    };

    recordingType.current = data.recordingType || "screen";

    try {
      const { cameraActive } = await chrome.storage.local.get(["cameraActive"]);
      const shouldUseCamera = cameraActive === true && !instantMode.current;

      if (data.recordingType === "camera") {
        try {
          cameraStream.current = await navigator.mediaDevices.getUserMedia(
            constraints,
          );
        } catch (err) {
          console.warn("⚠️ Failed to access camera stream:", err);
          cameraStream.current = null;
        }
      } else if (data.recordingType === "region" && IS_IFRAME_CONTEXT) {
        try {
          const constraints = {
            preferCurrentTab: true,
            video: {
              width: { max: 2560 }, // or use getResolutionForQuality()
              height: { max: 1440 },
              frameRate: { ideal: 30, max: 60 },
            },
            audio: data.systemAudio,
          };
          const stream = await navigator.mediaDevices.getDisplayMedia(
            constraints,
          );
          screenStream.current = stream;
          regionRef.current = true;
          if (!screenStream.current?.getVideoTracks?.().length) {
            sendRecordingError(
              "Failed to access region stream: no video track.",
            );
            return;
          }

          if (isTab.current) {
            const ctx = new AudioContext();
            const src = ctx.createMediaStreamSource(screenStream.current);
            src.connect(ctx.destination);
          }

          bindScreenTrack(screenStream.current.getVideoTracks()[0]);
        } catch (err) {
          if (isUserCaptureCancel(err)) {
            sendRecordingError("User cancelled stream selection", true);
            return;
          }
          sendRecordingError("Failed to access region stream: " + err.message);
          return;
        }

        if (shouldUseCamera) {
          const { defaultVideoInput } = await chrome.storage.local.get([
            "defaultVideoInput",
          ]);

          const cameraConstraints = {
            video: {
              ...(defaultVideoInput && defaultVideoInput !== "none"
                ? { deviceId: { exact: defaultVideoInput } }
                : {}),
              width: { ideal: width },
              height: { ideal: height },
              frameRate: { ideal: fps },
            },
            audio: false,
          };

          try {
            cameraStream.current = await getVideoStreamWithFallback(
              cameraConstraints,
              defaultVideoInput,
            );
          } catch (err) {
            console.warn(
              "⚠️ Camera permission denied — continuing without camera:",
              err,
            );
            cameraStream.current = null;

            // keep UI consistent (optional)
            await chrome.storage.local.set({ cameraActive: false });

            // only fatal if the user is doing camera-only recording
            if (data.recordingType === "camera") {
              sendRecordingError(
                "Camera permission is blocked. Please allow camera access to record.",
              );
              return;
            }
          }
        }

        try {
          if (target.current) {
            const track = screenStream.current.getVideoTracks()[0];
            await track.cropTo(target.current);
          } else {
            sendRecordingError(
              "No crop target set for region capture. Please select a region.",
            );
            return;
          }
        } catch (err) {
          sendRecordingError("Failed to crop region stream: " + err.message);
          return;
        }
      } else {
        const tabWidth = isTab.current ? window.innerWidth : width;
        const tabHeight = isTab.current ? window.innerHeight : height;

        const videoConstraints = isTab.current
          ? {
              // Tab recording - minimal constraints, let Chrome determine optimal capture
              chromeMediaSource: "tab",
              chromeMediaSourceId: id,
              maxFrameRate: fps,
              // No width/height constraints for tabs - Chrome will capture at the tab's natural size
              maxWidth: tabWidth,
              maxHeight: tabHeight,
            }
          : {
              // Desktop/window recording - use quality settings as max bounds
              chromeMediaSource: "desktop",
              chromeMediaSourceId: id,
              maxWidth: width,
              maxHeight: height,
              maxFrameRate: fps,
            };

        const desktopConstraints = {
          audio: {
            mandatory: {
              chromeMediaSource: isTab.current ? "tab" : "desktop",
              chromeMediaSourceId: id,
            },
          },
          video: {
            mandatory: { ...videoConstraints },
          },
        };

        try {
          screenStream.current = await navigator.mediaDevices.getUserMedia(
            desktopConstraints,
          );
          if (!screenStream.current?.getVideoTracks?.().length) {
            sendRecordingError(
              "Failed to access screen stream: no video track.",
            );
            return;
          }
          const track = screenStream.current.getVideoTracks()[0];
          const {
            width,
            height,
            displaySurface: surface,
          } = track.getSettings(); // Always use displaySurface from track

          const settings = screenStream.current
            .getVideoTracks()[0]
            .getSettings();

          if (surface === "browser") {
            setTimeout(() => {
              chrome.runtime.sendMessage({ type: "preparing-recording" });
            }, 200);
          }

          chrome.runtime.sendMessage(
            { type: "get-monitor-for-window" },
            (response) => {
              if (!response || chrome.runtime.lastError || response.error) {
                console.error(
                  "Failed to get monitor info:",
                  response?.error || chrome.runtime.lastError || "No response",
                );
                return;
              }

              const { monitorId, monitorBounds, displays } = response;

              chrome.storage.local.set({
                surface,
                displays,
                recordedMonitorId: monitorId,
                monitorBounds,
                recordedStreamDimensions: { width, height },
              });
            },
          );

          chrome.runtime.sendMessage({
            type: "set-surface",
            surface: surface,
          });

          if (isTab.current) {
            const ctx = new AudioContext();
            const src = ctx.createMediaStreamSource(screenStream.current);
            src.connect(ctx.destination);
          }

          bindScreenTrack(screenStream.current.getVideoTracks()[0]);
        } catch (err) {
          if (isUserCaptureCancel(err)) {
            sendRecordingError("User cancelled stream selection", true);
            return;
          }
          sendRecordingError("Failed to access screen stream: " + err.message);
          return;
        }

        if (shouldUseCamera) {
          const { defaultVideoInput } = await chrome.storage.local.get([
            "defaultVideoInput",
          ]);

          const cameraConstraints = {
            video: {
              ...(defaultVideoInput && defaultVideoInput !== "none"
                ? { deviceId: { exact: defaultVideoInput } }
                : {}),
              width: { ideal: width },
              height: { ideal: height },
              frameRate: { ideal: fps },
            },
            audio: false,
          };

          try {
            cameraStream.current = await getVideoStreamWithFallback(
              cameraConstraints,
              defaultVideoInput,
            );
          } catch (err) {
            console.warn(
              "⚠️ Camera permission denied — continuing without camera:",
              err,
            );
            cameraStream.current = null;

            // keep UI consistent (optional)
            await chrome.storage.local.set({ cameraActive: false });

            // only fatal if the user is doing camera-only recording
            if (data.recordingType === "camera") {
              sendRecordingError(
                "Camera permission is blocked. Please allow camera access to record.",
              );
              return;
            }
          }
        }
      }

      setInitProject(true);

      // Try to get microphone access
      micStream.current = await startAudioStream(data.defaultAudioInput);
      rawMicStream.current = micStream.current;

      // Setup audio context and routing
      aCtx.current = new AudioContext();
      destination.current = aCtx.current.createMediaStreamDestination();

      if (micStream.current?.getAudioTracks().length) {
        audioInputGain.current = aCtx.current.createGain();
        const micSource = aCtx.current.createMediaStreamSource(
          micStream.current,
        );
        micSource.connect(audioInputGain.current).connect(destination.current);
        micStream.current = destination.current.stream;

        const { micActive } = await chrome.storage.local.get(["micActive"]);
        if (micActive === false) {
          audioInputGain.current.gain.value = 0;
        }
      }

      if (screenStream.current?.getAudioTracks().length) {
        audioOutputGain.current = aCtx.current.createGain();
        const screenSource = aCtx.current.createMediaStreamSource(
          screenStream.current,
        );
        screenSource
          .connect(audioOutputGain.current)
          .connect(destination.current);

        // Set initial system audio volume based on preferences
        const { systemAudioVolume } = await chrome.storage.local.get([
          "systemAudioVolume",
        ]);
        if (systemAudioVolume !== undefined) {
          audioOutputGain.current.gain.value = systemAudioVolume;
        }
      }

      try {
        // Try to get projectId from storage - this may have been set externally
        const { projectId, multiMode, multiProjectId, multiSceneCount } =
          await chrome.storage.local.get([
            "projectId",
            "multiMode",
            "multiProjectId",
            "multiSceneCount",
          ]);

        let videoId = projectId || multiProjectId;

        if (videoId) {
          if (multiMode) {
            await chrome.storage.local.set({
              multiSceneCount: multiSceneCount || 0,
            });
          }
        } else {
          const now = new Date();
          const options = { day: "2-digit", month: "short", year: "numeric" };
          const title = `Untitled video - ${now.toLocaleString(
            "en-GB",
            options,
          )}`;

          videoId = await createVideoProject({
            title,
            instantMode: instantMode.current,
          });
          if (!videoId) throw new Error("Failed to create video project");

          if (multiMode) {
            await chrome.storage.local.set({
              multiProjectId: videoId,
              multiSceneCount: 0,
            });
          }
        }

        await chrome.storage.local.set({ projectId: videoId });
        await setPipelineState("project-ready", {
          projectId: videoId,
          status: multiMode ? "multi" : "single",
        });
        logDebugEvent("project-ready", {
          projectId: videoId,
          multiMode: Boolean(multiMode),
        });

        uploadersInitialized.current = await initializeUploaders();
        if (!uploadersInitialized.current) {
          throw new Error("Failed to initialize uploaders");
        }

        setStarted(true);
        setInitProject(false);
        chrome.runtime.sendMessage({ type: "reset-active-tab" });
        if (pendingStartRef.current) {
          maybeStartRecording("uploaders-ready");
        }
      } catch (err) {
        sendRecordingError("Failed to initialize uploaders: " + err.message);
      }
    } catch (err) {
      setInitProject(false);
      sendRecordingError("Failed to start stream: " + err.message, true);
    }
  };

  const startStreaming = async (data) => {
    try {
      const permissions = await navigator.permissions.query({ name: "camera" });
      const permissions2 = await navigator.permissions.query({
        name: "microphone",
      });

      if (isTab.current) {
        // Wait for getStreamID to resolve regardless of recordingType — the
        // previous guard (data.recordingType !== "region") caused startStream
        // to be called with tabID.current = null for region tab-captures when
        // getStreamID hadn't resolved yet.
        let attempts = 0;
        while (!tabID.current && attempts < 20) {
          // wait for tab stream id to resolve
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, 50));
          attempts += 1;
        }
        if (!tabID.current) {
          sendRecordingError("Failed to prepare tab capture.");
          return;
        }
      }

      if (data.recordingType === "camera") {
        startStream(data, null, permissions, permissions2);
      } else if (!isTab.current && (data.recordingType != "region" || tabPreferred.current)) {
        // Show the desktop picker when:
        //   - not tab-capture mode AND not region recording, OR
        //   - tabPreferred=true (playground) forced isTab=false even for a region
        //     recording — in that case we still need the picker because there is
        //     no pre-obtained stream ID to pass to startStream.
        chrome.desktopCapture.chooseDesktopMedia(
          ["screen", "window", "tab", "audio"],
          null,
          (streamId) => {
            if (!streamId) {
              sendRecordingError("User cancelled stream selection", true);
            } else {
              startStream(data, streamId, permissions, permissions2);
            }
          },
        );
      } else {
        startStream(data, tabID.current, permissions, permissions2);
      }
    } catch (err) {
      sendRecordingError("Failed to setup streaming: " + err.message);
    }
  };

  const getStreamID = async (id) => {
    try {
      const streamId = await chrome.tabCapture.getMediaStreamId({
        targetTabId: id,
      });
      tabID.current = streamId;
    } catch (err) {
      sendRecordingError("Failed to get stream ID: " + err.message);
    }
  };

  useEffect(() => {
    if (!IS_IFRAME_CONTEXT) return;

    // Notify parent that the region capture iframe has loaded
    const sendReady = () => {
      window.parent.postMessage(
        { type: "screenity-region-capture-loaded" },
        "*",
      );
    };

    sendReady();
  }, []);

  useEffect(() => {
    if (!IS_IFRAME_CONTEXT) return;

    const onMessage = (event) => {
      if (event.data.type === "crop-target") {
        target.current = event.data.target;
        regionRef.current = true;
        regionWidth.current = event.data.width;
        regionHeight.current = event.data.height;
      } else if (event.data.type === "restart-recording") {
        // Legacy path: restart is now orchestrated via runtime message.
        void setCloudRestartPhase("restart-postmessage-ignored");
      }
    };
    window.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  function getActiveVideoTime() {
    const now = Date.now();
    // Choose whichever timer is running
    const timer = screenTimer.current.start
      ? screenTimer
      : cameraTimer.current.start
      ? cameraTimer
      : null;
    if (!timer) return 0;

    return timer.current.paused
      ? timer.current.total
      : timer.current.total + (now - timer.current.start);
  }

  const onMessage = useCallback((request, sender, sendResponse) => {
    if (request.type === "loaded") {
      setInitProject(false);
      backupRef.current = request.backup;
      if (IS_IFRAME_CONTEXT) {
        // Only trigger if it's actually a region recording
        if (request.region) {
          isInit.current = true;
          chrome.runtime.sendMessage({ type: "get-streaming-data" });
        }
      } else if (!request.region) {
        // If the background included tabPreferred in the message, apply it
        // synchronously before we use it — this eliminates a race where
        // chrome.storage.local.get(["tabPreferred"]) hasn't completed yet when
        // "loaded" arrives, causing isTab.current to be set incorrectly on the
        // first attempt from playground.html.
        if (typeof request.tabPreferred === "boolean") {
          tabPreferred.current = request.tabPreferred;
          console.info(
            "[CloudRecorder] tabPreferred from loaded message:",
            request.tabPreferred,
          );
        }
        if (!tabPreferred.current) {
          isTab.current = request.isTab;
          recordingTabId.current = request.tabID || null;
          if (request.isTab) getStreamID(request.tabID);
        } else {
          isTab.current = false;
        }
        isInit.current = true;
        chrome.runtime.sendMessage({ type: "get-streaming-data" });
      }
    } else if (request.type === "streaming-data") {
      if (!isInit.current) return;
      if (IS_IFRAME_CONTEXT) {
        if (regionRef.current) {
          startStreaming(JSON.parse(request.data));
        }
      } else if (!regionRef.current) {
        startStreaming(JSON.parse(request.data));
      }
    } else if (request.type === "start-recording-tab") {
      if (!isInit.current) return;

      chrome.storage.local.set({
        lastStartRecordingTabMessage: {
          ts: Date.now(),
          region: Boolean(request.region),
          isIframe: IS_IFRAME_CONTEXT,
        },
      });

      if (IS_IFRAME_CONTEXT) {
        if (request.region || target.current) {
          if (target.current) {
            regionRef.current = true;
          }
          pendingStartRef.current = true;
          pendingStartAttempts.current = 0;
          maybeStartRecording("start-message");
        }
      } else if (!regionRef.current) {
        pendingStartRef.current = true;
        pendingStartAttempts.current = 0;
        maybeStartRecording("start-message");
      }
    } else if (request.type === "restart-recording-tab") {
      if (!isInit.current) return;
      Promise.resolve(restartRecording())
        .then((restarted) => {
          if (!restarted) {
            sendResponse?.({
              ok: false,
              error: "restart-teardown-failed",
            });
            return;
          }
          sendResponse?.({ ok: true, restarted: true });
        })
        .catch((error) => {
          sendResponse?.({
            ok: false,
            error: error?.message || String(error),
          });
        });
      return true;
    } else if (request.type === "stop-recording-tab") {
      if (!isInit.current) return;
      stopRecording(true, request.reason || "message-stop");
      sendResponse?.({ ok: true });
      return true;
    } else if (request.type === "set-mic-active-tab") {
      if (!isInit.current) return;
      setMic(request);
    } else if (request.type === "set-audio-output-volume") {
      if (!isInit.current) return;
      setAudioOutputVolume(request.volume);
    } else if (request.type === "get-video-time") {
      if (!isInit.current) return;
      const videoTime = getActiveVideoTime() / 1000; // in seconds
      sendResponse({ videoTime });
      return true;
    } else if (request.type === "pause-recording-tab") {
      if (!isInit.current) return;
      if (pausedStateRef.current) return;

      // Pause all active recorders
      if (
        screenRecorder.current &&
        screenRecorder.current.state === "recording"
      ) {
        screenRecorder.current.pause();
      }
      if (
        cameraRecorder.current &&
        cameraRecorder.current.state === "recording"
      ) {
        cameraRecorder.current.pause();
      }
      if (
        audioRecorder.current &&
        audioRecorder.current.state === "recording"
      ) {
        audioRecorder.current.pause();
      }

      const now = Date.now();
      if (!screenTimer.current.paused && screenTimer.current.start) {
        screenTimer.current.total += now - screenTimer.current.start;
        screenTimer.current.paused = true;
      }
      if (!cameraTimer.current.paused && cameraTimer.current.start) {
        cameraTimer.current.total += now - cameraTimer.current.start;
        cameraTimer.current.paused = true;
      }
      pausedStateRef.current = true;
      void setRecordingTimingState({
        paused: true,
        pausedAt: now,
      });
      void persistSessionState({
        paused: true,
        pausedAt: now,
      });
    } else if (request.type === "resume-recording-tab") {
      if (!isInit.current) return;
      if (!pausedStateRef.current) return;

      // Resume all paused recorders
      if (screenRecorder.current && screenRecorder.current.state === "paused") {
        screenRecorder.current.resume();
      }
      if (cameraRecorder.current && cameraRecorder.current.state === "paused") {
        cameraRecorder.current.resume();
      }
      if (audioRecorder.current && audioRecorder.current.state === "paused") {
        audioRecorder.current.resume();
      }

      const now = Date.now();
      if (screenTimer.current.paused) {
        screenTimer.current.start = now;
        screenTimer.current.paused = false;
      }
      if (cameraTimer.current.paused) {
        cameraTimer.current.start = now;
        cameraTimer.current.paused = false;
      }
      pausedStateRef.current = false;
      void (async () => {
        try {
          const { pausedAt, totalPausedMs } = await chrome.storage.local.get([
            "pausedAt",
            "totalPausedMs",
          ]);
          const additional = pausedAt ? Math.max(0, now - pausedAt) : 0;
          await setRecordingTimingState({
            paused: false,
            pausedAt: null,
            totalPausedMs: (totalPausedMs || 0) + additional,
          });
          await persistSessionState({
            paused: false,
            resumedAt: now,
          });
        } catch (err) {
          console.warn("Failed to update resume timing state:", err);
        }
      })();
    } else if (request.type === "dismiss-recording") {
      if (!isInit.current) return;
      dismissRecording();
    }
  }, []);

  useEffect(() => {
    chrome.storage.local.get(["tabPreferred"], (result) => {
      tabPreferred.current = result.tabPreferred;
    });

    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, []);

  return (
    <RecorderUI
      started={started}
      isTab={isTab.current}
      initProject={initProject}
      finalizeFailure={finalizeFailure}
      retryingFinalize={retryingFinalize}
      onRetryFinalize={retryFinalize}
      onExportDiagnostics={() =>
        exportFinalizeDiagnostics(finalizeFailureRef.current)
      }
    />
  );
};

export default CloudRecorder;

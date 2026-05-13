import React, { useEffect, useRef, useCallback } from "react";
import { getUserMediaWithFallback } from "../utils/mediaDeviceFallback";
import {
  WebCodecsRecorder,
  preloadWebCodecsModules,
} from "../Recorder/webcodecs/WebCodecsRecorder";
import { startPrewarm, stopPrewarm } from "../Recorder/streamWarmup";
import {
  debugRecordingEvent,
  resetRecordingDebugSession,
  isRecordingDebugEnabled,
  hydrateRecordingDebugFlag,
} from "../utils/recordingDebug";
import {
  probeFastRecorderSupport,
  shouldUseFastRecorder,
  getFastRecorderStickyState,
  markFastRecorderFailure,
  validateFastRecorderOutputBlob,
  isTransientFastRecorderError,
} from "../../media/fastRecorderGate";
import { chooseWriter } from "../Recorder/recorderStorage/chooseWriter";
import { chooseReader } from "../Recorder/recorderStorage/chooseReader";
import { lifecycle } from "../utils/lifecycleLog";
import { perfMark, perfSpan } from "../utils/perfMarks";

import localforage from "localforage";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

const chunksStore = localforage.createInstance({
  name: "chunks",
});

const DEBUG_RECORDER =
  typeof window !== "undefined" ? !!window.SCREENITY_DEBUG_RECORDER : false;
const logPrefix = "[Screenity Region Recorder]";

function debug(...args) {
  if (!DEBUG_RECORDER) return;
  // eslint-disable-next-line no-console
  console.log(logPrefix, ...args);
}

function debugWarn(...args) {
  if (!DEBUG_RECORDER) return;
  // eslint-disable-next-line no-console
  console.warn(logPrefix, ...args);
}

function debugError(...args) {
  if (!DEBUG_RECORDER) return;
  // eslint-disable-next-line no-console
  console.error(logPrefix, ...args);
}

function buildTrackSnapshot(track) {
  if (!track) return null;
  const settings =
    typeof track.getSettings === "function" ? track.getSettings() : {};
  const constraints =
    typeof track.getConstraints === "function" ? track.getConstraints() : {};
  const capabilities =
    typeof track.getCapabilities === "function" ? track.getCapabilities() : {};
  return {
    label: track.label,
    settings,
    constraints,
    capabilities,
  };
}

function logRecordingSnapshot(label, data) {
  if (!DEBUG_RECORDER && !isRecordingDebugEnabled()) return;
  debug(`Recording snapshot: ${label}`, data);
}

const selectMimeType = (preferredCodec) => {
  const preferred = (preferredCodec || "").toLowerCase();
  const mimeTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp8",
    "video/webm;codecs=avc1",
    "video/webm;codecs=h264",
    "video/webm",
  ];
  const ordered = preferred
    ? mimeTypes
        .filter((type) => type.includes(preferred))
        .concat(mimeTypes.filter((type) => !type.includes(preferred)))
    : mimeTypes;
  return ordered.find((type) => MediaRecorder.isTypeSupported(type)) || null;
};

const getCodecLabel = (mimeType) => {
  if (!mimeType) return "unknown";
  if (mimeType.includes("vp9")) return "vp9";
  if (mimeType.includes("vp8")) return "vp8";
  if (mimeType.includes("avc1") || mimeType.includes("h264")) return "h264";
  return "unknown";
};

const Recorder = () => {
  const isRestarting = useRef(false);
  const isDismissing = useRef(false);
  const isFinishing = useRef(false);
  const isFinished = useRef(false);
  const sentLast = useRef(false);
  const index = useRef(0);
  const lastTimecode = useRef(0);
  const hasChunks = useRef(false);
  const lastSize = useRef(0);
  const pausedStateRef = useRef(false);
  const recordingStartTimeRef = useRef(null);
  const recordingTick = useRef(null);

  const liveStream = useRef(null);
  const prewarmRef = useRef(null);

  const helperVideoStream = useRef(null);
  const helperAudioStream = useRef(null);
  const startRetryTimer = useRef(null);
  const startRetryAttempts = useRef(0);

  const aCtx = useRef(null);
  const destination = useRef(null);
  const audioInputSource = useRef(null);
  const audioOutputSource = useRef(null);
  const audioInputGain = useRef(null);
  const audioOutputGain = useRef(null);

  const recorder = useRef(null);
  const useWebCodecs = useRef(false);
  const recdbgSessionRef = useRef(null);

  const target = useRef(null);

  const recordingRef = useRef();
  const regionRef = useRef();
  const backupRef = useRef(false);

  const pending = useRef([]);
  const draining = useRef(false);
  const lowStorageAbort = useRef(false);
  const savedCount = useRef(0);

  const streamingDataHandled = useRef(false);
  const streamingDataRetryTimer = useRef(null);

  const chunkWriter = useRef(null);
  const chunkBackendRef = useRef(null);

  // Retry with backoff: SW mid-wakeup can drop the initial sendMessage
  // silently. Combined with SW-side retry and handler idempotency, this
  // covers slow Windows cold-starts.
  const requestStreamingDataWithRetry = (attempt = 0) => {
    if (streamingDataHandled.current) return;
    const backoffMs = [0, 250, 500, 1000, 2000];
    const delay = backoffMs[Math.min(attempt, backoffMs.length - 1)];
    if (streamingDataRetryTimer.current) {
      clearTimeout(streamingDataRetryTimer.current);
    }
    streamingDataRetryTimer.current = setTimeout(() => {
      streamingDataRetryTimer.current = null;
      if (streamingDataHandled.current) return;
      persistRegionStartDebug({
        stage: "get-streaming-data-send",
        attempt,
      });
      try {
        chrome.runtime.sendMessage({ type: "get-streaming-data" }, () => {
          const err = chrome.runtime.lastError;
          if (err) {
            persistRegionStartDebug({
              stage: "get-streaming-data-send-error",
              attempt,
              err: String(err.message || err).slice(0, 120),
            });
          }
          if (
            err &&
            !streamingDataHandled.current &&
            attempt + 1 < backoffMs.length
          ) {
            requestStreamingDataWithRetry(attempt + 1);
          }
        });
      } catch (e) {
        persistRegionStartDebug({
          stage: "get-streaming-data-throw",
          attempt,
          err: String(e?.message || e).slice(0, 120),
        });
        if (
          !streamingDataHandled.current &&
          attempt + 1 < backoffMs.length
        ) {
          requestStreamingDataWithRetry(attempt + 1);
        }
      }
    }, delay);
  };

  const lastEstimateAt = useRef(0);
  const ESTIMATE_INTERVAL_MS = 5000;
  const MIN_HEADROOM = 25 * 1024 * 1024;
  const MAX_PENDING_BYTES = 8 * 1024 * 1024;
  const pendingBytes = useRef(0);
  const recordingIdRef = useRef(null);

  const clearStartRetry = () => {
    if (startRetryTimer.current) {
      clearTimeout(startRetryTimer.current);
      startRetryTimer.current = null;
    }
    startRetryAttempts.current = 0;
  };

  const persistRegionStartDebug = (payload) => {
    try {
      chrome.storage.local.set({
        lastRegionStartFailure: {
          ts: Date.now(),
          ...payload,
        },
      });
    } catch {}
  };

  const setRegionRestartPhase = async (phase, details = {}) => {
    try {
      await chrome.storage.local.set({
        lastRegionRestartPhase: {
          phase,
          ts: Date.now(),
          ...details,
        },
      });
    } catch {}
  };

  const sendStopWithReason = (reason) => {
    chrome.runtime.sendMessage({ type: "stop-recording-tab", reason });
  };

  const setRecordingTimingState = async (nextState) => {
    try {
      await chrome.storage.local.set(nextState);
    } catch (err) {
      console.warn(
        "[Region Recorder] Failed to persist recording timing state",
        err,
      );
    }
  };

  const startRecordingTick = () => {
    if (recordingTick.current) clearInterval(recordingTick.current);
    recordingTick.current = setInterval(async () => {
      if (!recordingStartTimeRef.current) return;
      const { totalPausedMs, pausedAt, paused } =
        await chrome.storage.local.get(["totalPausedMs", "pausedAt", "paused"]);
      const now = Date.now();
      const basePaused = Number(totalPausedMs) || 0;
      const extraPaused =
        paused && pausedAt ? Math.max(0, now - Number(pausedAt)) : 0;
      const elapsed = Math.max(
        0,
        now - recordingStartTimeRef.current - basePaused - extraPaused,
      );
      chrome.storage.local.set({ recordingNow: now, recordingDuration: elapsed });
    }, 1000);
  };

  const stopRecordingTick = () => {
    if (recordingTick.current) {
      clearInterval(recordingTick.current);
      recordingTick.current = null;
    }
  };

  async function canFitChunk(byteLength) {
    const now = performance.now();
    if (now - lastEstimateAt.current < ESTIMATE_INTERVAL_MS) {
      return !lowStorageAbort.current;
    }
    lastEstimateAt.current = now;

    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      const remaining = quota - usage;
      return remaining > MIN_HEADROOM + (byteLength || 0);
    } catch {
      return !lowStorageAbort.current;
    }
  }

  async function saveChunk(e, i) {
    const ts = e.timecode ?? 0;

    if (!(await canFitChunk(e.data.size))) {
      // Post-stop, navigator.storage.estimate() can read false-low.
      // Don't surface "Memory limit reached"; save the tail chunk.
      if (isFinishing.current || !recordingRef.current) {
        lifecycle("Region.Recorder", "saveChunk-canFitChunk-suppressed", {
          isFinishing: Boolean(isFinishing.current),
          recordingRef: Boolean(recordingRef.current),
          savedCount: savedCount.current,
          size: e?.data?.size ?? null,
        });
      } else {
        if (!lowStorageAbort.current) {
          chrome.runtime.sendMessage({
            type: "show-toast",
            message: chrome.i18n.getMessage("toastStorageCritical"),
            timeout: 8000,
          });
        }
        lifecycle("Region.Recorder", "memory-error-flag-set", {
          reason: "saveChunk-canFitChunk",
          size: e?.data?.size ?? null,
          savedCount: savedCount.current,
        });
        lowStorageAbort.current = true;
        chrome.storage.local.set({
          recording: false,
          restarting: false,
          tabRecordedID: null,
          memoryError: true,
        });
        sendStopWithReason("region-low-storage-headroom");
        window.location.reload();
        return false;
      }
    }

    lifecycle("Region.Recorder", "saveChunk-enter", {
      i,
      size: e?.data?.size ?? null,
      timecode: ts,
      hasWriter: Boolean(chunkWriter.current),
      lowStorageAbort: lowStorageAbort.current,
    });
    try {
      if (chunkWriter.current) {
        await chunkWriter.current.write({
          chunk: e.data,
          index: i,
          timestamp: ts,
        });
      } else {
        await chunksStore.setItem(`chunk_${i}`, {
          index: i,
          chunk: e.data,
          timestamp: ts,
        });
      }
    } catch (err) {
      lifecycle("Region.Recorder", "saveChunk-write-failed", {
        i,
        err: String(err?.message || err).slice(0, 120),
        code: err?.code || null,
      });
      // OPFS writer death preserves the partial file; quota fail uses a generic toast.
      const isOpfsWriterDead = err?.code === "opfs-writer-failed";
      if (isOpfsWriterDead && err?.fileName) {
        chunkBackendRef.current = {
          backend: "opfs",
          fileName: err.fileName,
        };
        try {
          await chrome.storage.local.set({
            lastRecordingBackendRef: chunkBackendRef.current,
          });
        } catch {}
      }
      if (!lowStorageAbort.current) {
        const toastMessage = isOpfsWriterDead
          ? chrome.i18n.getMessage("recordingWriterFailedToast")
          : chrome.i18n.getMessage("toastStorageCritical");
        chrome.runtime.sendMessage({
          type: "show-toast",
          message: toastMessage,
          timeout: 8000,
        });
      }
      lifecycle("Region.Recorder", "memory-error-flag-set", {
        reason: "saveChunk-write-failed",
        isOpfsWriterDead,
        err: String(err?.message || err).slice(0, 120),
        savedCount: savedCount.current,
      });
      lowStorageAbort.current = true;
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
        memoryError: true,
      });
      sendStopWithReason(
        isOpfsWriterDead ? "opfs-writer-failed" : "region-save-chunk-failed",
      );
      window.location.reload();
      return false;
    }

    lastTimecode.current = ts;
    lastSize.current = e.data.size;
    savedCount.current += 1;
    lifecycle("Region.Recorder", "saveChunk-ok", {
      i,
      savedCount: savedCount.current,
    });

    if (backupRef.current) {
      chrome.runtime.sendMessage({ type: "write-file", index: i });
    }
    return true;
  }

  const rebuildBlobFromChunks = async () => {
    const backendRef = chunkBackendRef.current || { backend: "idb" };
    const reader = chooseReader(backendRef);
    try {
      await reader.open(backendRef);
      const { blob, chunkCount } = await reader.readBlob();
      if (!blob || chunkCount === 0) return null;
      return blob;
    } finally {
      try {
        await reader.close();
      } catch {}
    }
  };

  const updateFreeFinalizeStatus = async (stage, percent = 0, error = null) => {
    try {
      const recordingId =
        recordingIdRef.current ||
        (await chrome.storage.local.get(["fastRecorderActiveRecordingId"]))
          .fastRecorderActiveRecordingId;
      if (!recordingId) return;
      const key = `freeFinalizeStatus:${recordingId}`;
      const existing = await chrome.storage.local.get([key]);
      const current = existing[key];
      if (
        current &&
        (current.stage === "ready" || current.stage === "chunks_ready") &&
        (stage === "stopping" || stage === "finalizing")
      ) {
        return;
      }
      await chrome.storage.local.set({
        [key]: {
          recordingId,
          stage,
          percent,
          updatedAt: Date.now(),
          error: error || undefined,
        },
      });
    } catch {}
  };

  async function drainQueue() {
    if (draining.current) {
      lifecycle("Region.Recorder", "drainQueue-skip-busy", {
        pendingLen: pending.current.length,
      });
      return;
    }
    draining.current = true;
    const drainStartedAt = Date.now();
    const initialPending = pending.current.length;

    try {
      while (pending.current.length) {
        if (lowStorageAbort.current) {
          pending.current.length = 0;
          pendingBytes.current = 0;
          break;
        }

        const e = pending.current.shift();
        pendingBytes.current -= e.data.size;

        if (!(await canFitChunk(e.data.size))) {
          if (isFinishing.current || !recordingRef.current) {
            lifecycle("Region.Recorder", "drainQueue-canFitChunk-suppressed", {
              isFinishing: Boolean(isFinishing.current),
              recordingRef: Boolean(recordingRef.current),
              savedCount: savedCount.current,
              size: e?.data?.size ?? null,
            });
            // Keep the chunk to avoid losing the tail; skip memoryError abort.
          } else {
          if (!lowStorageAbort.current) {
            chrome.runtime.sendMessage({
              type: "show-toast",
              message: chrome.i18n.getMessage("toastStorageCritical"),
              timeout: 8000,
            });
          }
          lifecycle("Region.Recorder", "memory-error-flag-set", {
            reason: "drainQueue-canFitChunk",
            size: e?.data?.size ?? null,
            savedCount: savedCount.current,
            recorderState: recorder.current?.state || null,
          });
          lowStorageAbort.current = true;
          chrome.storage.local.set({
            recording: false,
            restarting: false,
            tabRecordedID: null,
            memoryError: true,
          });
          sendStopWithReason("region-drainqueue-low-storage");
          pending.current.length = 0;
          pendingBytes.current = 0;
          window.location.reload();
          break;
          }
        }

        const i = index.current;
        const saved = await saveChunk(e, i);
        if (saved) index.current = i + 1;
      }
    } finally {
      draining.current = false;
      lifecycle("Region.Recorder", "drainQueue-done", {
        elapsedMs: Date.now() - drainStartedAt,
        initialPending,
        savedCount: savedCount.current,
        finalPending: pending.current.length,
      });
    }
  }

  async function waitForDrain() {
    // Cap so a wedged drain doesn't block stop forever.
    const deadline = Date.now() + 30000;
    while (draining.current || pending.current.length) {
      if (Date.now() > deadline) {
        console.warn("[Region] waitForDrain timed out", {
          pending: pending.current.length,
          draining: draining.current,
        });
        break;
      }
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  useEffect(() => {
    window.parent.postMessage(
      {
        type: "screenity-region-capture-loaded",
      },
      "*",
    );
  }, []);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.data.type === "crop-target") {
        target.current = event.data.target;
        regionRef.current = true;
      } else if (event.data.type === "restart-recording") {
        restartRecording();
      }
    };
    window.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  async function startRecording() {
    if (recorder.current !== null) return;
    // Bail out if this iframe isn't actually the recording target. Without
    // this guard, a stale state (e.g. start-recording-tab arriving by some
    // unexpected path) makes the iframe spin its 5s preflight retry loop,
    // then fire "Capture stream is not ready yet" - which tears down a
    // legitimate recording happening in a different tab.
    if (!regionRef.current && !target.current) {
      persistRegionStartDebug({
        stage: "start-recording-bailout",
        reason: "not-region-target-for-this-iframe",
      });
      return;
    }
    persistRegionStartDebug({ stage: "start-recording-enter" });

    await stopPrewarm(prewarmRef.current);
    prewarmRef.current = null;

    const hasHelperVideoTrack =
      !!helperVideoStream.current &&
      typeof helperVideoStream.current.getVideoTracks === "function" &&
      helperVideoStream.current.getVideoTracks().length > 0;
    const hasLiveVideoTrack =
      !!liveStream.current &&
      typeof liveStream.current.getVideoTracks === "function" &&
      liveStream.current.getVideoTracks().length > 0;

    if (!hasHelperVideoTrack || !hasLiveVideoTrack) {
      if (startRetryAttempts.current < 50) {
        startRetryAttempts.current += 1;
        if (startRetryTimer.current) {
          clearTimeout(startRetryTimer.current);
        }
        startRetryTimer.current = setTimeout(() => {
          startRetryTimer.current = null;
          startRecording();
        }, 100);
        return;
      }

      clearStartRetry();
      persistRegionStartDebug({
        stage: "preflight-stream-ready-timeout",
        why: "Capture stream is not ready yet",
        hasHelperVideoTrack,
        hasLiveVideoTrack,
      });
      chrome.runtime.sendMessage({
        type: "recording-error",
        error: "stream-error",
        why: "Capture stream is not ready yet",
      });
      // Don't location.reload(): active getDisplayMedia triggers a
      // beforeunload prompt. BG teardown handles cleanup.
      return;
    }

    clearStartRetry();
    navigator.storage.persist();
    isFinishing.current = false;
    sentLast.current = false;
    lastTimecode.current = 0;
    lastSize.current = 0;
    hasChunks.current = false;
    isFinished.current = false;
    savedCount.current = 0;
    pending.current = [];
    draining.current = false;
    lowStorageAbort.current = false;
    pendingBytes.current = 0;
    try {
      if (helperVideoStream.current.getVideoTracks().length === 0) {
        persistRegionStartDebug({
          stage: "preflight-helper-video-empty",
          why: "No video tracks available",
          helperVideo: buildTrackSnapshot(
            helperVideoStream.current?.getVideoTracks?.()[0] || null,
          ),
          liveVideo: buildTrackSnapshot(
            liveStream.current?.getVideoTracks?.()[0] || null,
          ),
        });
        chrome.runtime.sendMessage({
          type: "recording-error",
          error: "stream-error",
          why: "No video tracks available",
        });

        window.location.reload();
        return;
      }
    } catch (err) {
      persistRegionStartDebug({
        stage: "preflight-helper-video-throw",
        why: String(err),
        helperVideo: buildTrackSnapshot(
          helperVideoStream.current?.getVideoTracks?.()[0] || null,
        ),
        liveVideo: buildTrackSnapshot(
          liveStream.current?.getVideoTracks?.()[0] || null,
        ),
      });
      if (useWebCodecs.current) {
        await chrome.storage.local.set({
          useWebCodecsRecorder: false,
          lastWebCodecsFailureAt: Date.now(),
          lastWebCodecsFailureCode: "start-exception",
        });
        chrome.runtime.sendMessage({
          type: "show-toast",
          message: chrome.i18n.getMessage("webcodecsFailedOffToast"),
        });
      }
      chrome.runtime.sendMessage({
        type: "recording-error",
        error: "stream-error",
        why: String(err),
      });

      window.location.reload();
      return;
    }

    await chunksStore.clear();

    try {
      const { qualityValue } = await chrome.storage.local.get(["qualityValue"]);
      const { fpsValue } = await chrome.storage.local.get(["fpsValue"]);
      const activeVideoTrack =
        liveStream.current?.getVideoTracks?.()[0] ||
        helperVideoStream.current?.getVideoTracks?.()[0] ||
        null;
      const trackSettings =
        activeVideoTrack && typeof activeVideoTrack.getSettings === "function"
          ? activeVideoTrack.getSettings()
          : {};
      const width =
        Number.isFinite(trackSettings.width) && trackSettings.width > 0
          ? Math.floor(trackSettings.width)
          : 1920;
      const height =
        Number.isFinite(trackSettings.height) && trackSettings.height > 0
          ? Math.floor(trackSettings.height)
          : 1080;
      let fps = Number.parseInt(fpsValue, 10);
      if (!Number.isFinite(fps) || fps <= 0) {
        fps =
          Number.isFinite(trackSettings.frameRate) && trackSettings.frameRate > 0
            ? Math.round(trackSettings.frameRate)
            : 30;
      }

      let audioBitsPerSecond = 128000;
      let videoBitsPerSecond = 5000000;

      if (qualityValue === "4k") {
        audioBitsPerSecond = 192000;
        videoBitsPerSecond = 40000000;
      } else if (qualityValue === "1080p") {
        audioBitsPerSecond = 192000;
        videoBitsPerSecond = 8000000;
      } else if (qualityValue === "720p") {
        audioBitsPerSecond = 128000;
        videoBitsPerSecond = 5000000;
      } else if (qualityValue === "480p") {
        audioBitsPerSecond = 96000;
        videoBitsPerSecond = 2500000;
      } else if (qualityValue === "360p") {
        audioBitsPerSecond = 96000;
        videoBitsPerSecond = 1000000;
      } else if (qualityValue === "240p") {
        audioBitsPerSecond = 64000;
        videoBitsPerSecond = 500000;
      }

      const mimeTypes = [
        "video/webm;codecs=avc1",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm;codecs=h264",
        "video/webm",
      ];

      let mimeType = mimeTypes.find((mimeType) =>
        MediaRecorder.isTypeSupported(mimeType),
      );

      const recordingId = `${Date.now()}-${Math.random()
        .toString(16)
        .slice(2, 8)}`;
      recordingIdRef.current = recordingId;

      await chrome.storage.local.set({
        fastRecorderActiveRecordingId: recordingId,
        fastRecorderInUse: false,
        fastRecorderValidationFailed: false,
        fastRecorderValidation: null,
      });

      const { useWebCodecsRecorder } = await chrome.storage.local.get([
        "useWebCodecsRecorder",
      ]);
      // undefined defaults to enabled; only explicit `false` opts out.
      const userSetting = useWebCodecsRecorder === false ? false : true;
      const stickyState = await getFastRecorderStickyState();
      const probeResult = await probeFastRecorderSupport();
      const shouldUseFast = shouldUseFastRecorder(
        userSetting,
        probeResult,
        stickyState,
      );
      const selectedVideoConfig =
        probeResult?.details?.selectedVideoConfig || null;
      const containerKind =
        probeResult?.details?.containerKind === "webm" ? "webm" : "mp4";
      let recorderToken = 0;
      let codecFallbackTriggered = false;
      let webcodecsFallbackTriggered = false;
      let mediaRecorderStartAt = Date.now();
      let recdbgChunkCount = 0;
      let recdbgTotalBytes = 0;

      await chrome.storage.local.set({
        fastRecorderDecision: {
          shouldUseFast,
          reasons: probeResult.reasons,
          stickyDisabled: stickyState.disabled,
        },
        fastRecorderStatus: {
          userSetting,
          probe: {
            ok: probeResult.ok,
            reasons: probeResult.reasons,
            details: probeResult.details,
            at: probeResult.at || Date.now(),
          },
          decision: {
            useFast: shouldUseFast,
            why:
              userSetting === false
                ? "user_disabled"
                : stickyState?.disabled && userSetting !== true
                ? "sticky_disabled"
                : probeResult.ok
                ? "probe_ok"
                : "probe_failed",
            at: Date.now(),
          },
          disabled: stickyState.disabled,
          disabledReason: stickyState.reason || null,
          disabledDetails: stickyState.details || null,
          disabledAt: stickyState.disabledAt || null,
          updatedAt: Date.now(),
        },
      });

      const resetChunkState = async () => {
        await chunksStore.clear();
        index.current = 0;
        pending.current = [];
        pendingBytes.current = 0;
        savedCount.current = 0;
        hasChunks.current = false;
        lastTimecode.current = 0;
        lastSize.current = 0;
        sentLast.current = false;
      };

      const waitForSavedChunks = async (timeoutMs = 4000) => {
        if (savedCount.current > 0) return true;
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (savedCount.current > 0) return true;
        }
        return savedCount.current > 0;
      };

      const waitForTrailingChunks = async (timeoutMs = 1600) => {
        const deadline = Date.now() + timeoutMs;
        let stableRounds = 0;
        let lastSaved = savedCount.current;
        while (Date.now() < deadline) {
          await waitForDrain();
          await new Promise((resolve) => setTimeout(resolve, 120));
          await waitForDrain();
          const currentSaved = savedCount.current;
          if (currentSaved === lastSaved) {
            stableRounds += 1;
            if (stableRounds >= 2) break;
          } else {
            stableRounds = 0;
            lastSaved = currentSaved;
          }
        }
      };

      const handleWebCodecsChunk = async (blob, timestampUs) => {
        if (lowStorageAbort.current) return;
        const timecodeMs = timestampUs ? Math.floor(timestampUs / 1000) : 0;
        recdbgChunkCount += 1;
        recdbgTotalBytes += blob.size || 0;
        if (recdbgChunkCount <= 3) {
          debugRecordingEvent(recdbgSessionRef, "chunk", {
            index: recdbgChunkCount,
            size: blob.size,
            timecode: timecodeMs,
          });
        } else if (recdbgChunkCount % 10 === 0) {
          debugRecordingEvent(recdbgSessionRef, "chunk-progress", {
            count: recdbgChunkCount,
            totalBytes: recdbgTotalBytes,
          });
        }

        pending.current.push({ data: blob, timecode: timecodeMs });
        pendingBytes.current += blob.size;

        if (pendingBytes.current > MAX_PENDING_BYTES) {
          try {
            await drainQueue();
          } catch {}
        }
        void drainQueue();
      };

      const startWebCodecsRecorder = async () => {
        const hasAudioTrack =
          !!liveStream.current &&
          typeof liveStream.current.getAudioTracks === "function" &&
          liveStream.current.getAudioTracks().length > 0;

        useWebCodecs.current = true;
        await chrome.storage.local.set({ fastRecorderInUse: true });

        // Fall back to IDB if OPFS open() fails.
        chunkWriter.current = null;
        const writerRecordingId = `region-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        try {
          const regionExt =
            probeResult?.details?.containerKind === "webm" ? "webm" : "mp4";
          let selection = await chooseWriter({ preferOpfs: true });
          let openResult = null;
          try {
            openResult = await selection.writer.open(writerRecordingId, {
              extension: regionExt,
            });
          } catch (openErr) {
            if (selection.backend === "opfs") {
              try {
                await selection.writer.abort();
              } catch {}
              selection = await chooseWriter({ preferOpfs: false });
              openResult = await selection.writer.open(writerRecordingId, {
                extension: regionExt,
              });
            } else {
              throw openErr;
            }
          }
          chunkWriter.current = selection.writer;
          const backendRefAtOpen = openResult?.backendRef || {
            backend: selection.backend,
          };
          chunkBackendRef.current = backendRefAtOpen;
          try {
            await chrome.storage.local.set({
              lastRecordingBackendRef: backendRefAtOpen,
            });
          } catch {}
          if (process.env.SCREENITY_DEV_MODE === "true") {
            console.log("[recorder-opfs][region] writer-open", {
              backend: selection.backend,
              path: "webcodecs",
              backendRef: backendRefAtOpen,
            });
          }
        } catch (err) {
          persistRegionStartDebug({
            stage: "chunk-writer-init-failed",
            err: String(err?.message || err).slice(0, 120),
          });
          chunkBackendRef.current = { backend: "idb" };
          try {
            await chrome.storage.local.set({
              lastRecordingBackendRef: { backend: "idb" },
            });
          } catch {}
        }

        recorder.current = new WebCodecsRecorder(liveStream.current, {
          width,
          height,
          fps,
          videoBitrate: videoBitsPerSecond,
          audioBitrate: hasAudioTrack ? audioBitsPerSecond : undefined,
          enableAudio: hasAudioTrack,
          videoEncoderConfig: selectedVideoConfig,
          containerKind,
          debug: DEBUG_RECORDER,
          onFinalized: async () => {
            await waitForDrain();
            const hasSavedChunks = await waitForSavedChunks();
            if (!hasSavedChunks) {
              persistRegionStartDebug({
                stage: "finalize-no-chunks",
                recorderType: "WebCodecsRecorder",
                savedCount: savedCount.current,
                pending: pending.current.length,
              });
              chrome.runtime.sendMessage({
                type: "recording-error",
                error: "stream-error",
                why: "No recording data was generated",
              });
              return;
            }
            // OPFS holds an exclusive handle; close before reading.
            if (chunkWriter.current) {
              try {
                const closeResult = await chunkWriter.current.close();
                chunkBackendRef.current =
                  closeResult?.backendRef || { backend: "idb" };
              } catch (err) {
                if (err?.code === "opfs-writer-failed" && err?.fileName) {
                  // Close failed; partial file is still on disk.
                  chunkBackendRef.current = {
                    backend: "opfs",
                    fileName: err.fileName,
                  };
                } else {
                  chunkBackendRef.current = { backend: "idb" };
                }
              }
              chunkWriter.current = null;
            }
            await updateFreeFinalizeStatus("chunks_ready", 95);
            let validation = null;
            try {
              const blob = await rebuildBlobFromChunks();
              validation = await validateFastRecorderOutputBlob(blob, {
                minBytes: 64 * 1024,
                // 15s for multi-GB demuxer scans on slow disks.
                timeoutMs: 15000,
                videoCodec: recorder.current?.selectedVideoCodec || undefined,
                audioCodec: hasAudioTrack ? "mp4a.40.2" : null,
                recordingId,
              });
              debugRecordingEvent(recdbgSessionRef, "fast-recorder-validate", {
                validation,
              });
            } catch (err) {
              validation = {
                ok: false,
                hardFail: true,
                reasons: ["validation-exception"],
                details: { error: String(err) },
              };
            }

            if (validation && !validation.ok) {
              await markFastRecorderFailure("validation-failed", validation);
              await chrome.storage.local.set({
                useWebCodecsRecorder: false,
                lastWebCodecsFailureAt: Date.now(),
                lastWebCodecsFailureCode: "validation-failed",
              });
              const hardFail = Boolean(validation.hardFail);
              await chrome.storage.local.set({
                fastRecorderValidationFailed: hardFail,
                fastRecorderValidation: validation,
              });
              await updateFreeFinalizeStatus(
                "failed",
                100,
                validation.reasons || "validation-failed",
              );
              chrome.runtime.sendMessage({
                type: "show-toast",
                message: chrome.i18n.getMessage("webcodecsFailedOffToast"),
              });
              if (hardFail) {
                chrome.runtime.sendMessage({
                  type: "fast-recorder-hard-fail",
                  recordingId,
                });
                if (!sentLast.current) {
                  sentLast.current = true;
                  isFinished.current = true;
                  isFinishing.current = false;
                  if (!isRestarting.current) {
                    chrome.runtime.sendMessage({ type: "video-ready" });
                  }
                }
                return;
              }
            } else {
              await chrome.storage.local.set({
                fastRecorderValidationFailed: false,
                fastRecorderValidation: validation,
              });
            }

            await chrome.storage.local.set({
              lastRecordingBackendRef: chunkBackendRef.current || {
                backend: "idb",
              },
            });
            await updateFreeFinalizeStatus("ready", 100);
            if (!sentLast.current) {
              sentLast.current = true;
              isFinished.current = true;
              isFinishing.current = false;
              if (!isRestarting.current) {
                // Verify ≥1 chunk persisted before claiming ready;
                // zero-output encoder (config mismatch, immediate close)
                // would otherwise produce 0-byte video.
                if (savedCount.current === 0 && !hasChunks.current) {
                  chrome.runtime.sendMessage({
                    type: "recording-error",
                    error: "stream-error",
                    why: "No recording data was generated",
                  });
                } else {
                  chrome.runtime.sendMessage({ type: "video-ready" });
                }
              }
            }
          },
          onChunk: (chunkData, timestampUs) => {
            const blob = new Blob([chunkData], { type: "video/mp4" });
            handleWebCodecsChunk(blob, timestampUs);
          },
          onError: (err) => {
            const errStr = String(err);
            const transient = isTransientFastRecorderError(errStr);
            markFastRecorderFailure("webcodecs-error", { error: errStr });
            // Keep useWebCodecsRecorder on for transient stream errors.
            const persisted = {
              lastWebCodecsFailureAt: Date.now(),
              lastWebCodecsFailureCode: transient
                ? "webcodecs-transient"
                : "webcodecs-error",
            };
            if (!transient) persisted.useWebCodecsRecorder = false;
            chrome.storage.local.set(persisted);
            updateFreeFinalizeStatus("failed", 100, errStr);

            // Same-session fallback: encoder errored before any chunk landed
            // and the capture track is still live. Swap to MediaRecorder so
            // the user doesn't have to re-pick the region / re-grant prompts.
            // Skip on transient errors (WebCodecs may recover) and on repeat
            // calls (VideoEncoder.error can fire more than once).
            const liveVideoTrack =
              liveStream.current?.getVideoTracks?.()[0] || null;
            const trackLive = liveVideoTrack?.readyState === "live";
            const noChunksYet =
              savedCount.current === 0 && !hasChunks.current;
            if (
              !transient &&
              !webcodecsFallbackTriggered &&
              noChunksYet &&
              trackLive
            ) {
              webcodecsFallbackTriggered = true;
              persistRegionStartDebug({
                stage: "webcodecs-onerror-swap",
                why: errStr.slice(0, 200),
              });
              (async () => {
                const prev = recorder.current;
                recorder.current = null;
                useWebCodecs.current = false;
                try {
                  await chrome.storage.local.set({
                    fastRecorderInUse: false,
                  });
                } catch {}
                try {
                  prev?.cleanup?.();
                } catch {}
                let swapped = false;
                try {
                  swapped = await startMediaRecorderWithCodec("vp9");
                } catch (e) {
                  swapped = false;
                }
                if (
                  swapped &&
                  recorder.current instanceof MediaRecorder
                ) {
                  try {
                    recorder.current.start(5000);
                    setTimeout(() => {
                      try {
                        recorder.current?.requestData?.();
                      } catch {}
                    }, 250);
                    persistRegionStartDebug({
                      stage: "webcodecs-onerror-swap-ok",
                    });
                    return;
                  } catch (startErr) {
                    persistRegionStartDebug({
                      stage: "webcodecs-onerror-swap-start-throw",
                      why: String(startErr),
                    });
                  }
                }
                // Fallback failed too — surface the original failure.
                chrome.runtime.sendMessage({
                  type: "show-toast",
                  message: chrome.i18n.getMessage("webcodecsFailedOffToast"),
                });
                chrome.runtime.sendMessage({
                  type: "recording-error",
                  error: "stream-error",
                  why: "Fast recorder failed. Please try compatibility mode.",
                });
              })();
              return;
            }

            if (!transient) {
              chrome.runtime.sendMessage({
                type: "show-toast",
                message: chrome.i18n.getMessage("webcodecsFailedOffToast"),
              });
            }
            chrome.runtime.sendMessage({
              type: "recording-error",
              error: "stream-error",
              why: transient
                ? errStr
                : "Fast recorder failed. Please try compatibility mode.",
            });
          },
          onStop: async () => {
            debugRecordingEvent(recdbgSessionRef, "recorder-stop", {
              count: recdbgChunkCount,
              totalBytes: recdbgTotalBytes,
              encoder: "webcodecs",
            });
          },
        });

        const started = await recorder.current.start();
        if (!started) {
          useWebCodecs.current = false;
          await chrome.storage.local.set({ fastRecorderInUse: false });
          await chrome.storage.local.set({
            useWebCodecsRecorder: false,
            lastWebCodecsFailureAt: Date.now(),
            lastWebCodecsFailureCode: "start-failed",
          });
          // The OPFS writer was opened for the WebCodecs path. If we let it
          // hang around, startMediaRecorderWithCodec's no-existing-writer guard
          // would reuse it, sending MediaRecorder bytes into OPFS where the
          // sandboxed editor can't read them. Abort here so the MR path opens
          // a fresh IDB writer.
          if (chunkWriter.current) {
            try {
              await chunkWriter.current.abort();
            } catch {}
            chunkWriter.current = null;
            chunkBackendRef.current = null;
          }
          chrome.runtime.sendMessage({
            type: "show-toast",
            message: chrome.i18n.getMessage("webcodecsFailedOffToast"),
          });
          return false;
        }

        debugRecordingEvent(recdbgSessionRef, "recorder-start", {
          encoder: "webcodecs",
          codec: "webcodecs",
          width,
          height,
          fps,
          timesliceMs: 1000,
        });

        return true;
      };

      const startMediaRecorderWithCodec = async (codec) => {
        const mimeType = selectMimeType(codec);
        lifecycle("Region.Recorder", "startMediaRecorderWithCodec", {
          codec,
          mimeType,
          hasExistingRecorder: Boolean(recorder.current),
          hasChunkWriter: Boolean(chunkWriter.current),
        });
        if (!mimeType) {
          chrome.runtime.sendMessage({
            type: "recording-error",
            error: "stream-error",
            why: `No supported mimeTypes available for ${codec}`,
          });

          window.location.reload();
          return false;
        }

        recorderToken += 1;
        const token = recorderToken;
        recdbgChunkCount = 0;
        recdbgTotalBytes = 0;
        mediaRecorderStartAt = Date.now();

        recorder.current = new MediaRecorder(liveStream.current, {
          mimeType: mimeType,
          audioBitsPerSecond: audioBitsPerSecond,
          videoBitsPerSecond: videoBitsPerSecond,
        });

        // Force IDB: MediaRecorder chunks must relay to the null-origin sandbox
        // editor, which cannot read OPFS. Always replace whatever is in
        // chunkWriter.current — if WebCodecs opened an OPFS writer earlier and
        // then fell back to us, leaving the OPFS writer in place would silently
        // route MR bytes into OPFS and strand them.
        if (chunkWriter.current) {
          try {
            await chunkWriter.current.abort();
          } catch {}
          chunkWriter.current = null;
          chunkBackendRef.current = null;
        }
        try {
          const selection = await chooseWriter({ preferOpfs: false });
          chunkWriter.current = selection.writer;
          const openResult = await chunkWriter.current.open(
            `region-mr-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`,
          );
          const backendRefAtOpen = openResult?.backendRef || {
            backend: "idb",
          };
          chunkBackendRef.current = backendRefAtOpen;
          try {
            await chrome.storage.local.set({
              lastRecordingBackendRef: backendRefAtOpen,
            });
          } catch {}
        } catch (err) {
          chunkWriter.current = null;
        }
        debug("MediaRecorder config", {
          mimeType: recorder.current?.mimeType,
          audioBitsPerSecond,
          videoBitsPerSecond,
        });
        debugRecordingEvent(recdbgSessionRef, "recorder-start", {
          encoder: "mediarecorder",
          codec: getCodecLabel(mimeType),
          mimeType: recorder.current?.mimeType,
          audioBitsPerSecond,
          videoBitsPerSecond,
          width,
          height,
          fps,
          timesliceMs: 1000,
        });

        setTimeout(() => {
          if (token !== recorderToken) return;
          const afterTrack = liveStream.current?.getVideoTracks?.()[0] ?? null;
          logRecordingSnapshot("after-start-500ms", {
            capture: buildTrackSnapshot(afterTrack),
          });
          debugRecordingEvent(recdbgSessionRef, "after-start-500ms", {
            capture: buildTrackSnapshot(afterTrack),
          });
        }, 500);

        setTimeout(() => {
          if (token !== recorderToken) return;
          const afterTrack = liveStream.current?.getVideoTracks?.()[0] ?? null;
          debugRecordingEvent(recdbgSessionRef, "after-start-1500ms", {
            capture: buildTrackSnapshot(afterTrack),
          });
        }, 1500);

        recorder.current.onerror = (ev) => {
          if (token !== recorderToken) return;
          const errStr = String(ev?.error || ev?.error?.name || "unknown");
          const isTransient =
            /invalidstateerror/i.test(errStr) ||
            /not in recording state/i.test(errStr) ||
            /already (stopped|inactive)/i.test(errStr);
          if (!isTransient) {
            chrome.runtime.sendMessage({
              type: "recording-error",
              error: "mediarecorder",
              why: errStr,
            });
          }
          if (!isFinishing.current) {
            stopRecording().catch(() => {});
          }
        };

        recorder.current.onstop = async () => {
          if (token !== recorderToken) return;
          try {
            recorder.current.requestData();
          } catch {}

          if (isRestarting.current) return;

          regionRef.current = false;
          recordingRef.current = false;

          await waitForTrailingChunks();
          try {
            await chrome.storage.local.set({
              lastRegionChunkStats: {
                ts: Date.now(),
                savedCount: savedCount.current,
                pendingCount: pending.current.length,
                pendingBytes: pendingBytes.current,
                hasChunks: hasChunks.current,
              },
            });
          } catch {}
          const hasSavedChunks = await waitForSavedChunks();
          if (!hasSavedChunks) {
            persistRegionStartDebug({
              stage: "stop-no-chunks",
              recorderType: "MediaRecorder",
              savedCount: savedCount.current,
              pending: pending.current.length,
            });
            // Mark terminal so 15s watchdog can't re-fire recording-error.
            sentLast.current = true;
            isFinished.current = true;
            isFinishing.current = false;
            chrome.runtime.sendMessage({
              type: "recording-error",
              error: "stream-error",
              why: "No recording data was generated",
            });
            return;
          }

          if (!sentLast.current) {
            sentLast.current = true;
            isFinished.current = true;
            chrome.runtime.sendMessage({ type: "video-ready" });
            isFinishing.current = false;
          }
        };

        recorder.current.ondataavailable = async (e) => {
          if (token !== recorderToken) return;
          if (!e || !e.data || !e.data.size) {
            lifecycle("Region.Recorder", "ondataavailable-empty", {
              hasEvent: Boolean(e),
              hasData: Boolean(e?.data),
              size: e?.data?.size ?? null,
              recorderState: recorder.current?.state || null,
            });
            if (recorder.current && recorder.current.state === "inactive") {
              chrome.storage.local.set({
                recording: false,
                restarting: false,
                tabRecordedID: null,
              });
              sendStopWithReason("region-empty-mediarecorder-data");
            }
            return;
          }
          // Avoid spamming logs on long recordings.
          if (recdbgChunkCount < 3) {
            lifecycle("Region.Recorder", "ondataavailable", {
              index: recdbgChunkCount,
              size: e.data.size,
              timecode: e.timecode ?? 0,
            });
          }

          if (lowStorageAbort.current) {
            return;
          }

          recdbgChunkCount += 1;
          recdbgTotalBytes += e.data.size || 0;
          const elapsedSec = Math.max(
            0.001,
            (Date.now() - mediaRecorderStartAt) / 1000,
          );
          const derivedMbps = (recdbgTotalBytes * 8) / elapsedSec / 1e6;

          if (recdbgChunkCount <= 3) {
            debugRecordingEvent(recdbgSessionRef, "chunk", {
              index: recdbgChunkCount,
              size: e.data.size,
              timecode: e.timecode ?? 0,
            });
          }

          if (recdbgChunkCount % 3 === 0) {
            debugRecordingEvent(recdbgSessionRef, "bitrate", {
              codec: getCodecLabel(mimeType),
              elapsedSec,
              derivedMbps,
              bytes: recdbgTotalBytes,
              targetVideoBps: videoBitsPerSecond,
            });
          }

          if (
            !codecFallbackTriggered &&
            recdbgChunkCount >= 3 &&
            elapsedSec >= 3 &&
            recordingRef.current &&
            !isFinishing.current &&
            !isRestarting.current
          ) {
            if (derivedMbps < 5 && getCodecLabel(mimeType) !== "vp8") {
              codecFallbackTriggered = true;
              lifecycle("Region.Recorder", "codec-fallback", {
                from: getCodecLabel(mimeType),
                to: "vp8",
                derivedMbps,
                recdbgChunkCount,
                elapsedSec,
                savedCount: savedCount.current,
              });
              debugRecordingEvent(recdbgSessionRef, "codec-fallback", {
                from: getCodecLabel(mimeType),
                to: "vp8",
                derivedMbps,
              });
              recorderToken += 1;
              await resetChunkState();
              try {
                recorder.current.stop();
              } catch {}
              const switched = await startMediaRecorderWithCodec("vp8");
              if (switched && recorder.current instanceof MediaRecorder) {
                try {
                  recorder.current.start(5000);
                  setTimeout(() => {
                    try { recorder.current?.requestData?.(); } catch (_) {}
                  }, 250);
                } catch (startErr) {
                  persistRegionStartDebug({
                    stage: "codec-fallback-start-failed",
                    why: String(startErr),
                  });
                }
              }
              return;
            }
          }

          if (!hasChunks.current) {
            hasChunks.current = true;
            lastTimecode.current = e.timecode ?? 0;
            lastSize.current = e.data.size;
          }

          pending.current.push(e);
          pendingBytes.current += e.data.size;

          if (pendingBytes.current > MAX_PENDING_BYTES) {
            try {
              recorder.current.pause();
              await drainQueue();
              recorder.current.resume();
            } catch {}
          }

          void drainQueue();
        };

        recorder.current.addEventListener("stop", () => {
          if (token !== recorderToken) return;
          debugRecordingEvent(recdbgSessionRef, "recorder-stop", {
            count: recdbgChunkCount,
            totalBytes: recdbgTotalBytes,
            encoder: "mediarecorder",
            codec: getCodecLabel(mimeType),
          });
        });

        return true;
      };

      if (shouldUseFast) {
        const ok = await startWebCodecsRecorder();
        if (!ok) {
          useWebCodecs.current = false;
          await chrome.storage.local.set({ fastRecorderInUse: false });
          await startMediaRecorderWithCodec("vp9");
          persistRegionStartDebug({ stage: "start-recorder-fallback-vp9" });
        } else {
          persistRegionStartDebug({ stage: "start-recorder-webcodecs-ok" });
        }
      } else {
        useWebCodecs.current = false;
        await chrome.storage.local.set({ fastRecorderInUse: false });
        await startMediaRecorderWithCodec("vp9");
        persistRegionStartDebug({ stage: "start-recorder-mediarecorder-vp9" });
      }
    } catch (err) {
      persistRegionStartDebug({
        stage: "start-pipeline-exception",
        why: String(err),
        helperVideo: buildTrackSnapshot(
          helperVideoStream.current?.getVideoTracks?.()[0] || null,
        ),
        liveVideo: buildTrackSnapshot(
          liveStream.current?.getVideoTracks?.()[0] || null,
        ),
      });
      chrome.runtime.sendMessage({
        type: "recording-error",
        error: "stream-error",
        why: String(err),
      });

      window.location.reload();
      return;
    }

    isRestarting.current = false;
    index.current = 0;
    recordingRef.current = true;
    isDismissing.current = false;

    const isMediaRecorder = recorder.current instanceof MediaRecorder;
    if (isMediaRecorder) {
      try {
        // Snapshot stream/track health pre-start to attribute zero-chunk
        // recordings to a dead-at-start stream.
        const vTracks = liveStream.current?.getVideoTracks?.() || [];
        const aTracks = liveStream.current?.getAudioTracks?.() || [];
        lifecycle("Region.Recorder", "mediarecorder-start", {
          videoTracks: vTracks.length,
          audioTracks: aTracks.length,
          videoState: vTracks[0]
            ? {
                readyState: vTracks[0].readyState,
                muted: vTracks[0].muted,
                enabled: vTracks[0].enabled,
              }
            : null,
          mimeType: recorder.current?.mimeType || null,
          recorderState: recorder.current?.state || null,
        });
        recorder.current.start(5000);
        // Force early first chunk so short recordings persist before nav.
        setTimeout(() => {
          try { recorder.current?.requestData?.(); } catch (_) {}
        }, 250);
      } catch (err) {
        persistRegionStartDebug({
          stage: "mediarecorder-start-throw",
          why: String(err),
          recorderType: recorder.current?.constructor?.name || null,
          helperVideo: buildTrackSnapshot(
            helperVideoStream.current?.getVideoTracks?.()[0] || null,
          ),
          liveVideo: buildTrackSnapshot(
            liveStream.current?.getVideoTracks?.()[0] || null,
          ),
        });
        lifecycle("Region.Recorder", "memory-error-flag-set", {
          reason: "mediarecorder-start-throw",
          err: String(err).slice(0, 120),
        });
        chrome.storage.local.set({
          recording: false,
          restarting: false,
          tabRecordedID: null,
          memoryError: true,
        });
        sendStopWithReason("region-mediarecorder-start-throw");

        window.location.reload();
        return;
      }
    }

    const recordingStartTime = Date.now();
    recordingStartTimeRef.current = recordingStartTime;
    await setRecordingTimingState({
      recording: true,
      paused: false,
      recordingStartTime,
      pausedAt: null,
      totalPausedMs: 0,
    });
    pausedStateRef.current = false;
    startRecordingTick();
    chrome.storage.local.set({
      recording: true,
      restarting: false,
    });
    persistRegionStartDebug({
      stage: "recording-started",
      recorderType: recorder.current?.constructor?.name || null,
    });

    if (isMediaRecorder && recorder.current) {
      recorder.current.onpause = () => {
        lastTimecode.current = 0;
      };

      recorder.current.onresume = () => {
        lastTimecode.current = 0;
        lastSize.current = 0;
      };
    }

    const liveVideoTrack = liveStream.current?.getVideoTracks?.()[0] || null;
    if (liveVideoTrack) {
      liveVideoTrack.onended = () => {
        regionRef.current = false;
        chrome.storage.local.set({
          recording: false,
          restarting: false,
          tabRecordedID: null,
        });
        sendStopWithReason("region-live-video-ended");
      };
    }

    const vTrack = liveVideoTrack;
    if (vTrack) {
      vTrack.oninactive = () => {
        persistRegionStartDebug({
          stage: "live-video-inactive",
          why: "Video track became inactive",
          liveVideo: buildTrackSnapshot(vTrack),
        });
      };
    }

    const aTrack = helperAudioStream.current?.getAudioTracks()[0];
    if (aTrack) {
      aTrack.oninactive = () => {
        persistRegionStartDebug({
          stage: "audio-inactive",
          why: "Audio track became inactive",
        });
      };
      // Mirrors Recorder.jsx sysTrack.onended; surfaces mid-recording
      // mic disconnects.
      aTrack.onended = () => {
        try {
          chrome.runtime.sendMessage({
            type: "diag-forward",
            event: "recorder-region-audio-track-ended",
            data: {
              trackLabel: String(aTrack.label || "").slice(0, 80),
            },
          });
        } catch {}
        chrome.runtime.sendMessage({
          type: "show-toast",
          message: chrome.i18n.getMessage("audioTrackEndedToast"),
          timeout: 8000,
        }).catch(() => {});
      };
      aTrack.onmute = () => {
        try {
          chrome.runtime.sendMessage({
            type: "diag-forward",
            event: "recorder-region-audio-track-muted",
            data: { trackLabel: String(aTrack.label || "").slice(0, 80) },
          });
        } catch {}
      };
    }

    const helperVideoTrack =
      helperVideoStream.current?.getVideoTracks?.()[0] || null;
    if (helperVideoTrack) {
      helperVideoTrack.onended = () => {
        regionRef.current = false;
        chrome.storage.local.set({
          recording: false,
          restarting: false,
          tabRecordedID: null,
        });
        sendStopWithReason("region-helper-video-ended");
      };
    }
  }

  async function stopRecording() {
    clearStartRetry();
    stopRecordingTick();
    recordingStartTimeRef.current = null;
    isFinishing.current = true;
    regionRef.current = false;
    // Reset customRegion crop target: otherwise it sticks for the iframe's
    // life and a later regular screen recording (stream in a separate
    // recorder tab) hits "Capture stream is not ready yet" at 5s.
    target.current = null;
    streamingDataHandled.current = false;
    await updateFreeFinalizeStatus("stopping", 0);
    await setRecordingTimingState({
      recording: false,
      paused: false,
      recordingStartTime: null,
      pausedAt: null,
      totalPausedMs: 0,
    });
    pausedStateRef.current = false;

    if (recorder.current) {
      if (
        useWebCodecs.current &&
        recorder.current instanceof WebCodecsRecorder
      ) {
        try {
          await updateFreeFinalizeStatus("finalizing", 20);
          await recorder.current.stop();
        } catch {}
        await waitForDrain();
        recorder.current = null;
      } else {
        try {
          recorder.current.requestData();
        } catch {}

        try {
          if (recorder.current.state !== "inactive") {
            recorder.current.stop();
          }
        } catch {}

        // Watchdog: if onstop never fires, force finalize so the editor
        // isn't stuck waiting for video-ready.
        setTimeout(() => {
          if (sentLast.current || isFinished.current) return;
          // Mark terminal in both branches so a late onstop can't double-
          // fire recording-error / video-ready.
          sentLast.current = true;
          isFinished.current = true;
          isFinishing.current = false;
          if (!hasChunks.current || savedCount.current === 0) {
            chrome.runtime.sendMessage({
              type: "recording-error",
              error: "stream-error",
              why: "Recorder stop timed out with no data",
            });
            return;
          }
          chrome.runtime.sendMessage({ type: "video-ready" });
        }, 15000);

        await waitForDrain();
        recorder.current = null;
        // Capture backendRef for the sandbox.
        if (chunkWriter.current) {
          try {
            const closeResult = await chunkWriter.current.close();
            // Prefer close-result backendRef; never hardcode "idb",
            // would misroute editor reads when chunks are in OPFS.
            if (closeResult?.backendRef) {
              chunkBackendRef.current = closeResult.backendRef;
            }
            if (chunkBackendRef.current) {
              await chrome.storage.local.set({
                lastRecordingBackendRef: chunkBackendRef.current,
              });
            }
          } catch {}
          chunkWriter.current = null;
        }
        await updateFreeFinalizeStatus("chunks_ready", 100);
      }
    }

    useWebCodecs.current = false;

    if (liveStream.current !== null) {
      liveStream.current.getTracks().forEach(function (track) {
        track.stop();
      });
      liveStream.current = null;
    }

    if (helperVideoStream.current !== null) {
      helperVideoStream.current.getTracks().forEach(function (track) {
        track.stop();
      });
      helperVideoStream.current = null;
    }

    if (helperAudioStream.current !== null) {
      helperAudioStream.current.getTracks().forEach(function (track) {
        track.stop();
      });
      helperAudioStream.current = null;
    }
  }

  const dismissRecording = async () => {
    clearStartRetry();
    stopRecordingTick();
    recordingStartTimeRef.current = null;
    regionRef.current = false;
    target.current = null;
    streamingDataHandled.current = false;
    useWebCodecs.current = false;
    await setRecordingTimingState({
      recording: false,
      paused: false,
      recordingStartTime: null,
      pausedAt: null,
      totalPausedMs: 0,
    });
    pausedStateRef.current = false;
    chrome.runtime.sendMessage({ type: "handle-dismiss" });
    isRestarting.current = true;
    isDismissing.current = true;
    if (recorder.current !== null) {
      // Detach handlers before stop(); queued onstop microtask would
      // otherwise fire post-dismiss and open the editor on a discarded recording.
      try { recorder.current.onstop = null; } catch {}
      try { recorder.current.ondataavailable = null; } catch {}
      try { recorder.current.onerror = null; } catch {}
      try { recorder.current.stop(); } catch {}
      recorder.current = null;
    }
    if (liveStream.current !== null) {
      liveStream.current.getTracks().forEach(function (track) {
        track.stop();
      });
      liveStream.current = null;
    }

    if (helperVideoStream.current !== null) {
      helperVideoStream.current.getTracks().forEach(function (track) {
        track.stop();
      });
      helperVideoStream.current = null;
    }

    if (helperAudioStream.current !== null) {
      helperAudioStream.current.getTracks().forEach(function (track) {
        track.stop();
      });
      helperAudioStream.current = null;
    }
    // dismissRecording reuses isRestarting as an "incoming-chunks shield"
    // during teardown; release here or a later restartRecording sees a
    // stuck-true flag and early-returns false.
    isRestarting.current = false;
    isDismissing.current = false;
  };

  const restartRecording = async () => {
    clearStartRetry();
    stopRecordingTick();
    recordingStartTimeRef.current = null;
    if (isRestarting.current) {
      return false;
    }
    await setRegionRestartPhase("restart-requested");
    const wasRegionMode = Boolean(regionRef.current || target.current);
    isRestarting.current = true;
    isDismissing.current = false;
    pausedStateRef.current = false;
    const wasUsingWebCodecs = useWebCodecs.current;
    try {
      if (
        wasUsingWebCodecs &&
        recorder.current instanceof WebCodecsRecorder
      ) {
        recorder.current.running = false;
        recorder.current.paused = false;
        await recorder.current.cleanup();
      } else if (recorder.current && recorder.current.state !== "inactive") {
        await new Promise((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(timeoutId);
            resolve();
          };
          const timeoutId = setTimeout(finish, 1600);
          try {
            recorder.current.addEventListener("stop", finish, { once: true });
          } catch {}
          try {
            recorder.current.stop();
          } catch {
            finish();
          }
        });
      }
    } catch {
      isRestarting.current = false;
      await setRegionRestartPhase("restart-stop-failed");
      return false;
    }
    await setRegionRestartPhase("restart-stop-complete");
    recorder.current = null;
    sentLast.current = false;
    isFinished.current = false;
    isFinishing.current = false;
    hasChunks.current = false;
    lastTimecode.current = 0;
    lastSize.current = 0;
    savedCount.current = 0;
    pending.current = [];
    pendingBytes.current = 0;
    await chunksStore.clear();
    await setRecordingTimingState({
      recording: false,
      paused: false,
      recordingStartTime: null,
      pausedAt: null,
      totalPausedMs: 0,
    });
    useWebCodecs.current = false;
    regionRef.current = wasRegionMode;
    await setRegionRestartPhase("restart-state-restored", {
      regionMode: Boolean(regionRef.current),
      hasTarget: Boolean(target.current),
    });
    isRestarting.current = false;
    return true;
  };

  async function startAudioStream(id) {
    const useExact = id && id !== "none";
    const audioStreamOptions = {
      mimeType: "video/webm;codecs=vp8,opus",
      audio: useExact
        ? {
            deviceId: {
              exact: id,
            },
          }
        : true,
    };

    const { defaultAudioInputLabel, audioinput } =
      await chrome.storage.local.get(["defaultAudioInputLabel", "audioinput"]);
    const desiredLabel =
      defaultAudioInputLabel ||
      audioinput?.find((device) => device.deviceId === id)?.label ||
      "";

    const result = await getUserMediaWithFallback({
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
    })
      .then((stream) => {
        return stream;
      })
      .catch((err) => {
        // Retry without device ID.
        const audioStreamOptions = {
          mimeType: "video/webm;codecs=vp8,opus",
          audio: true,
        };

        return navigator.mediaDevices
          .getUserMedia(audioStreamOptions)
          .then((stream) => {
            return stream;
          })
          .catch((err) => {
            return null;
          });
      });

    return result;
  }
  function setAudioInputVolume(volume) {
    if (!audioInputGain.current) return;
    audioInputGain.current.gain.value = volume;
  }

  function setAudioOutputVolume(volume) {
    if (!audioOutputGain.current) return;
    audioOutputGain.current.gain.value = volume;
  }

  async function startStreaming(data) {
    perfMark("Region.Recorder startStreaming.enter", {
      hasTarget: Boolean(target.current),
      systemAudio: Boolean(data?.systemAudio),
      hasMic: Boolean(data?.defaultAudioInput && data.defaultAudioInput !== "none"),
    });
    try {
      const endStorageReads = perfSpan("Region.Recorder storage.reads");
      const { qualityValue } = await chrome.storage.local.get(["qualityValue"]);

      let width = 1920;
      let height = 1080;

      if (qualityValue === "4k") {
        width = 4096;
        height = 2160;
      } else if (qualityValue === "1080p") {
        width = 1920;
        height = 1080;
      } else if (qualityValue === "720p") {
        width = 1280;
        height = 720;
      } else if (qualityValue === "480p") {
        width = 854;
        height = 480;
      } else if (qualityValue === "360p") {
        width = 640;
        height = 360;
      } else if (qualityValue === "240p") {
        width = 426;
        height = 240;
      }

      const { fpsValue } = await chrome.storage.local.get(["fpsValue"]);
      let fps = parseInt(fpsValue);

      if (isNaN(fps)) {
        fps = 30;
      }
      endStorageReads();

      let stream;

      const constraints = {
        preferCurrentTab: true,
        // Suppress Chrome's "Share this tab instead" banner: the crop target
        // is a RestrictionTarget tied to this tab's DOM; switching surfaces
        // mid-session breaks the crop.
        surfaceSwitching: "exclude",
        audio: data.systemAudio,
        video: {
          frameRate: fps,
          width: {
            ideal: width,
          },
          height: {
            ideal: height,
          },
        },
      };
      const endGetDisplayMedia = perfSpan("Region.Recorder getDisplayMedia");
      stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      endGetDisplayMedia({
        videoTracks: stream?.getVideoTracks?.()?.length ?? 0,
        audioTracks: stream?.getAudioTracks?.()?.length ?? 0,
      });
      if (!stream || typeof stream.getVideoTracks !== "function") {
        chrome.runtime.sendMessage({
          type: "recording-error",
          error: "stream-error",
          why: "Display stream is unavailable",
        });
        window.location.reload();
        return;
      }
      if (!stream.getVideoTracks().length) {
        chrome.runtime.sendMessage({
          type: "recording-error",
          error: "stream-error",
          why: "Display stream has no video track",
        });
        window.location.reload();
        return;
      }

      helperVideoStream.current = stream;

      stopPrewarm(prewarmRef.current);
      prewarmRef.current = startPrewarm(helperVideoStream.current);
      preloadWebCodecsModules();

      aCtx.current = new AudioContext();
      destination.current = aCtx.current.createMediaStreamDestination();
      liveStream.current = new MediaStream();
      const endMic = perfSpan("Region.Recorder startAudioStream(mic)");
      const micstream = await startAudioStream(data.defaultAudioInput);
      endMic({ hasMic: Boolean(micstream) });

      helperAudioStream.current = micstream;

      if (
        helperAudioStream.current != null &&
        helperAudioStream.current.getAudioTracks().length > 0
      ) {
        audioInputGain.current = aCtx.current.createGain();
        audioInputSource.current = aCtx.current.createMediaStreamSource(
          helperAudioStream.current,
        );
        audioInputSource.current
          .connect(audioInputGain.current)
          .connect(destination.current);
      }

      if (helperAudioStream.current != null && !data.micActive) {
        setAudioInputVolume(0);
      }

      if (helperVideoStream.current.getAudioTracks().length > 0) {
        audioOutputGain.current = aCtx.current.createGain();
        audioOutputSource.current = aCtx.current.createMediaStreamSource(
          helperVideoStream.current,
        );
        audioOutputSource.current
          .connect(audioOutputGain.current)
          .connect(destination.current);
      }

      const helperVideoTrack = helperVideoStream.current.getVideoTracks()[0];
      if (!helperVideoTrack) {
        chrome.runtime.sendMessage({
          type: "recording-error",
          error: "stream-error",
          why: "Display stream missing video track",
        });
        window.location.reload();
        return;
      }
      liveStream.current.addTrack(helperVideoTrack);

      if (
        (helperAudioStream.current != null &&
          helperAudioStream.current.getAudioTracks().length > 0) ||
        helperVideoStream.current.getAudioTracks().length > 0
      ) {
        const mixedAudioTrack = destination.current.stream.getAudioTracks()[0];
        if (mixedAudioTrack) {
          liveStream.current.addTrack(mixedAudioTrack);
        }
      }

      try {
        if (target.current) {
          const track = liveStream.current.getVideoTracks()[0];
          if (!track || typeof track.cropTo !== "function") {
            chrome.runtime.sendMessage({
              type: "recording-error",
              error: "cancel-modal",
              why: "Selected source does not support region cropping",
            });
            window.location.reload();
            return;
          }
          const endCropTo = perfSpan("Region.Recorder cropTo");
          await track.cropTo(target.current);
          endCropTo();
        } else {
          chrome.runtime.sendMessage({
            type: "recording-error",
            error: "cancel-modal",
            why: "No target",
          });

          window.location.reload();
        }
      } catch (err) {
        chrome.runtime.sendMessage({
          type: "recording-error",
          error: "cancel-modal",
          why: String(err),
        });

        window.location.reload();
      }

      perfMark("Region.Recorder reset-active-tab.sent");
      chrome.runtime.sendMessage({ type: "reset-active-tab" });
    } catch (err) {
      chrome.runtime.sendMessage({
        type: "recording-error",
        error: "cancel-modal",
        why: String(err),
      });

      window.location.reload();
    }
  }

  useEffect(() => {
    chrome.storage.local.get(["backup"], (result) => {
      if (result.backup) {
        backupRef.current = true;
      } else {
        backupRef.current = false;
      }
    });
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (recordingRef.current && regionRef.current) {
        // The "Leave page?" dialog gives ondataavailable enough time to
        // persist the chunk before the frame is torn down.
        try {
          recorder.current?.requestData?.();
        } catch (_) {}
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // pagehide fires synchronously during iframe teardown; the IPC
    // sendMessage is delivered before the frame is gone (no async race).
    const handlePageHide = () => {
      if (recordingRef.current && regionRef.current) {
        try {
          chrome.runtime.sendMessage({
            type: "region-iframe-destroyed",
          });
        } catch (_) {}
      }
    };
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  const setMic = async (result) => {
    if (helperAudioStream.current != null) {
      if (result.active) {
        setAudioInputVolume(1);
      } else {
        setAudioInputVolume(0);
      }
    }
  };

  const onMessage = useCallback(
    (request, sender, sendResponse) => {
      if (request.type === "loaded") {
        perfMark("Region.Recorder loaded.received", {
          isRegion: Boolean(request.region),
        });
        backupRef.current = request.backup;
        if (request.region) {
          requestStreamingDataWithRetry();
        }
        // Ack so BG's sendMessageRecord doesn't reject + trigger retries.
        try { sendResponse?.({ ok: true }); } catch {}
        return true;
      }
      if (request.type === "streaming-data") {
        perfMark("Region.Recorder streaming-data.received", {
          duplicate: streamingDataHandled.current,
          regionMode: Boolean(regionRef.current),
        });
        const wasDuplicate = streamingDataHandled.current;
        if (!wasDuplicate) {
          streamingDataHandled.current = true;
          if (regionRef.current) {
            startStreaming(JSON.parse(request.data));
          }
        }
        try { sendResponse?.({ ok: true, duplicate: wasDuplicate }); } catch {}
        return true;
      } else if (request.type === "start-recording-tab") {
        setRegionRestartPhase("restart-start-message-received", {
          regionMode: Boolean(regionRef.current),
          hasTarget: Boolean(target.current),
        });
        if (regionRef.current || target.current) {
          regionRef.current = true;
          setRegionRestartPhase("restart-started");
          startRecording();
        }
      } else if (request.type === "restart-recording-tab") {
        const recState = () => {
          const r = recorder.current;
          let recorderType = "none";
          if (r) {
            if (r instanceof MediaRecorder) recorderType = "MediaRecorder";
            else if (useWebCodecs.current) recorderType = "WebCodecs";
            else recorderType = "other";
          }
          return {
            attemptId: request.attemptId || null,
            hasRecorder: Boolean(r),
            recorderType,
            mediaRecorderState:
              r instanceof MediaRecorder ? r.state : null,
            recordingRef: Boolean(recordingRef.current),
            isRestarting: Boolean(isRestarting.current),
            isFinishing: Boolean(isFinishing.current),
            hasLiveStream: Boolean(liveStream.current),
            regionMode: Boolean(regionRef.current),
            hasTarget: Boolean(target.current),
            docHidden: document.hidden,
          };
        };
        const stateAtEntry = recState();
        lifecycle("Region.Recorder", "restart-tab-received", stateAtEntry);

        Promise.resolve(restartRecording())
          .then((restarted) => {
            const after = recState();
            if (!restarted) {
              lifecycle("Region.Recorder", "restart-tab-result", {
                ...after,
                ok: false,
                error: "restart-teardown-failed",
              });
              sendResponse?.({
                ok: false,
                error: "restart-teardown-failed",
                recorderState: after,
              });
              return;
            }
            lifecycle("Region.Recorder", "restart-tab-result", {
              ...after,
              ok: true,
            });
            sendResponse?.({
              ok: true,
              restarted: true,
              recorderState: after,
            });
          })
          .catch((error) => {
            const reason = error?.message || String(error);
            lifecycle("Region.Recorder", "restart-tab-result", {
              ...recState(),
              ok: false,
              error: reason,
              threw: true,
            });
            sendResponse?.({
              ok: false,
              error: reason,
              recorderState: recState(),
            });
          });
        return true;
      } else if (request.type === "stop-recording-tab") {
        // Ack BG so it doesn't surface stopAckTimeoutToast; ack is just "received".
        try { sendResponse?.({ ok: true, received: true }); } catch {}
        if (isFinishing.current) return;
        stopRecording();
      } else if (request.type === "recorder-keepalive-ping") {
        try { sendResponse?.({ ok: true, alive: true, ts: Date.now() }); } catch {}
        return true;
      } else if (request.type === "recorder-wake-aggressive") {
        // Bumping lastChunkAt proves the main thread is responsive.
        try {
          chrome.storage.local.set({ lastChunkAt: Date.now() });
        } catch {}
        try { sendResponse?.({ ok: true, woke: true }); } catch {}
        return true;
      } else if (request.type === "set-mic-active-tab") {
        setMic(request);
      } else if (request.type === "set-audio-output-volume") {
        setAudioOutputVolume(request.volume);
      } else if (request.type === "pause-recording-tab") {
        if (!recorder.current) return;
        if (pausedStateRef.current) return;
        recorder.current.pause();
        const now = Date.now();
        pausedStateRef.current = true;
        void setRecordingTimingState({
          paused: true,
          pausedAt: now,
        });
      } else if (request.type === "resume-recording-tab") {
        if (!recorder.current) return;
        if (!pausedStateRef.current) return;
        recorder.current.resume();
        const now = Date.now();
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
          } catch (err) {
            console.warn(
              "[Region Recorder] Failed to update resume timing state",
              err,
            );
          }
        })();
      } else if (request.type === "dismiss-recording") {
        dismissRecording();
      }
    },
    [regionRef.current, isFinishing.current, recorder.current],
  );

  useEffect(() => {
    chrome.runtime.onMessage.addListener(onMessage);
    perfMark("Region.Recorder mount.useEffect");
    lifecycle("Region.Recorder", "iframe-mount", {
      href: typeof window !== "undefined" ? window.location?.href?.slice(0, 200) : null,
    });

    return () => {
      clearStartRetry();
      chrome.runtime.onMessage.removeListener(onMessage);
      lifecycle("Region.Recorder", "iframe-unmount", {
        regionRef: regionRef.current,
        hasTarget: Boolean(target.current),
        hasRecorder: Boolean(recorder.current),
      });
    };
  }, []);

  return (
    <div>
      {process.env.SCREENITY_DEV_MODE === "true" && (
        <div
          style={{
            position: "fixed",
            top: 4,
            right: 4,
            zIndex: 2147483647,
            background: "rgba(0,0,0,0.65)",
            color: "#0f0",
            fontSize: "10px",
            padding: "3px 7px",
            borderRadius: "4px",
            fontFamily: "monospace",
            pointerEvents: "none",
          }}
        >
          DEV
        </div>
      )}
    </div>
  );
};

export default Recorder;

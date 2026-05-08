import React, { useEffect, useState, useRef } from "react";
import localforage from "localforage";
import RecorderUI from "./RecorderUI";
import { createMediaRecorder } from "./mediaRecorderUtils";
import { sendRecordingError, sendStopRecording } from "./messaging";
import { getBitrates, getResolutionForQuality } from "./recorderConfig";
import {
  WebCodecsRecorder,
  preloadWebCodecsModules,
} from "./webcodecs/WebCodecsRecorder";
import { startPrewarm, stopPrewarm } from "./streamWarmup";
import { getUserMediaWithFallback } from "../utils/mediaDeviceFallback";
import { IS_OFFSCREEN_HOST } from "../utils/recordingHost";
import { chooseWriter } from "./recorderStorage/chooseWriter";
import { chooseReader } from "./recorderStorage/chooseReader";
import { lifecycle } from "../utils/lifecycleLog";
import { perfMark, perfSpan } from "../utils/perfMarks";
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

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

const chunksStore = localforage.createInstance({
  name: "chunks",
});

document.body.style.willChange = "contents";

// Toggle: window.SCREENITY_DEBUG_RECORDER = true
const DEBUG_RECORDER =
  typeof window !== "undefined" ? !!window.SCREENITY_DEBUG_RECORDER : false;
const FORCE_MEDIARECORDER =
  typeof window !== "undefined"
    ? !!window.SCREENITY_FORCE_MEDIARECORDER
    : false;
const logPrefix = "[Screenity Recorder]";

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

// Stream lifecycle ring-buffer, persisted to storage, survives tab discards.
const SL_KEY = "streamLifecycleLog";
const SL_MAX = 40;
const _slBuffer = [];

function slLog(tag, extra = {}) {
  const entry = { t: Date.now(), tag, ...extra };
  if (DEBUG_RECORDER) {
    // eslint-disable-next-line no-console
    console.log("[Screenity:SL]", tag, entry);
  }
  _slBuffer.push(entry);
  if (_slBuffer.length > SL_MAX) _slBuffer.splice(0, _slBuffer.length - SL_MAX);
  try {
    chrome.storage.local.set({ [SL_KEY]: [..._slBuffer] });
  } catch {}
}

function logCaptureContext(label, stream) {
  if (!DEBUG_RECORDER && !isRecordingDebugEnabled()) return;
  const videoTracks =
    stream && typeof stream.getVideoTracks === "function"
      ? stream.getVideoTracks()
      : [];

  debug(`${label} environment`, {
    devicePixelRatio: window.devicePixelRatio,
    screen: { width: window.screen?.width, height: window.screen?.height },
    inner: { width: window.innerWidth, height: window.innerHeight },
  });

  videoTracks.forEach((track, index) => {
    const settings =
      typeof track.getSettings === "function" ? track.getSettings() : {};
    const constraints =
      typeof track.getConstraints === "function" ? track.getConstraints() : {};
    const capabilities =
      typeof track.getCapabilities === "function"
        ? track.getCapabilities()
        : {};
    debug(`${label} videoTrack[${index}]`, {
      label: track.label,
      settings,
      constraints,
      capabilities,
    });
  });
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

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const QUALITY_ORDER = ["240p", "360p", "480p", "720p", "1080p", "4k"];

const clampQualityValue = (value, maxValue) => {
  const current = QUALITY_ORDER.includes(value) ? value : "1080p";
  const max = QUALITY_ORDER.includes(maxValue) ? maxValue : "1080p";
  return QUALITY_ORDER.indexOf(current) <= QUALITY_ORDER.indexOf(max)
    ? current
    : max;
};

const getFreeCaptureCaps = async () => {
  try {
    const { isLoggedIn, isSubscribed } = await chrome.storage.local.get([
      "isLoggedIn",
      "isSubscribed",
    ]);
    const isPro = Boolean(isLoggedIn && isSubscribed);
    return {
      isPro,
      maxQuality: "1080p",
      maxFps: 60,
    };
  } catch {
    return {
      isPro: false,
      maxQuality: "1080p",
      maxFps: 60,
    };
  }
};

// bits/pixel/sec. Pro gets higher quality, Free smaller files.
const VIDEO_BPP_FPS_PRO = 0.10;
const VIDEO_BPP_FPS_FREE = 0.08;
const VIDEO_BPS_MIN = 4_000_000;
const VIDEO_BPS_MAX = 24_000_000;

const computeTargetVideoBps = (width, height, fps, isPro = false) => {
  const pixels = Number(width) * Number(height);
  const rate = Number.isFinite(fps) && fps > 0 ? fps : 30;
  const factor = isPro ? VIDEO_BPP_FPS_PRO : VIDEO_BPP_FPS_FREE;
  const target = Math.round(pixels * rate * factor);
  return clamp(target, VIDEO_BPS_MIN, VIDEO_BPS_MAX);
};

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
  const pendingStartAfterRestart = useRef(false);
  const recordingGeneration = useRef(0);
  const isFinishing = useRef(false);
  const sentLast = useRef(false);
  const lastTimecode = useRef(0);
  const hasChunks = useRef(false);

  const recdbgSessionRef = useRef(null);

  const lastSize = useRef(0);
  const index = useRef(0);

  const [started, setStarted] = useState(false);
  const streamReadyAt = useRef(null);

  // Keep getDisplayMedia track hot during countdown so the OS capture pipeline
  // doesn't go idle between warm-up and recorder.start(). On macOS, an idle
  // capture stream re-warms in ~1s and emits stale frames in the meantime.
  const prewarmRef = useRef(null);
  // Holds an in-flight chunksStore.clear() kicked off during the countdown so
  // startRecording's await is near-instant. Re-clearing on the actual start
  // path is a no-op since the store is already empty.
  const prewarmChunksClearRef = useRef(null);
  // Pre-opened OPFS writer + recordingId. Saves ~30-90ms of file create + sync
  // handle setup off the post-countdown critical path. Aborted if startRecording
  // determines a different backend is needed, or if the prewarm is cancelled.
  const prewarmedWriterRef = useRef(null);

  // Start gate: defer startRecording() until the stream is ready.
  const startRequested = useRef(false);
  const startRequestedAt = useRef(null);
  // Null after a start-gate timeout marks SW-to-tab handoff failure.
  const streamingDataReceivedAt = useRef(null);
  const startGateTimeout = useRef(null);
  // 12s: cold SW wake-ups on Windows Chrome can take several seconds; 8s was too tight.
  const START_GATE_TIMEOUT_MS = 12000;
  const streamingDataRetryTimer = useRef(null);

  // Retry get-streaming-data: an initial sendMessage during SW wake-up can fail
  // with "Receiving end does not exist" and silently drop. The SW also pushes
  // streaming-data proactively, so the handler must remain idempotent.
  const requestStreamingDataWithRetry = (attempt = 0) => {
    if (streamingDataReceivedAt.current != null) return;
    const maxAttempts = 5;
    const backoffMs = [0, 250, 500, 1000, 2000];
    const delay = backoffMs[Math.min(attempt, backoffMs.length - 1)];
    if (streamingDataRetryTimer.current) {
      clearTimeout(streamingDataRetryTimer.current);
    }
    streamingDataRetryTimer.current = setTimeout(() => {
      streamingDataRetryTimer.current = null;
      if (streamingDataReceivedAt.current != null) return;
      slLog("get-streaming-data-send", { attempt });
      try {
        chrome.runtime.sendMessage({ type: "get-streaming-data" }, () => {
          const err = chrome.runtime.lastError;
          if (err) {
            slLog("get-streaming-data-send-error", {
              attempt,
              err: String(err.message || err).slice(0, 120),
            });
          }
          if (
            err &&
            streamingDataReceivedAt.current == null &&
            attempt + 1 < maxAttempts
          ) {
            requestStreamingDataWithRetry(attempt + 1);
          }
        });
      } catch (e) {
        slLog("get-streaming-data-throw", {
          attempt,
          err: String(e?.message || e).slice(0, 120),
        });
        if (
          streamingDataReceivedAt.current == null &&
          attempt + 1 < maxAttempts
        ) {
          requestStreamingDataWithRetry(attempt + 1);
        }
      }
    }, delay);
  };

  const liveStream = useRef(null);

  const helperVideoStream = useRef(null);
  const helperAudioStream = useRef(null);

  const aCtx = useRef(null);
  const destination = useRef(null);
  const audioInputSource = useRef(null);
  const audioOutputSource = useRef(null);
  const audioInputGain = useRef(null);
  const audioOutputGain = useRef(null);

  const recorder = useRef(null);
  const useWebCodecs = useRef(false);
  // null on MediaRecorder path.
  const chunkWriter = useRef(null);
  const chunkWriterBackend = useRef(null);
  // Set at writer.close(); validator + sandbox use this to pick the reader.
  const chunkBackendRef = useRef(null);

  const isTab = useRef(false);
  const tabID = useRef(null);
  // Numeric chrome tab id (tabID holds the chromeMediaSourceId from
  // tabCapture). Used to query the tab's viewport for aspect-correct
  // capture constraints.
  const recordedTabId = useRef(null);
  const tabPreferred = useRef(false);

  const backupRef = useRef(false);

  const pending = useRef([]);
  const draining = useRef(false);
  const lowStorageAbort = useRef(false);
  const savedCount = useRef(0);

  const lastEstimateAt = useRef(0);
  const ESTIMATE_INTERVAL_MS = 5000;
  const MIN_HEADROOM = 25 * 1024 * 1024;
  const WARN_HEADROOM = 100 * 1024 * 1024;
  const MAX_PENDING_BYTES = 8 * 1024 * 1024;
  const pendingBytes = useRef(0);
  const lowStorageWarned = useRef(false);
  const estimateFailed = useRef(false);
  const deviceChangeListenerRef = useRef(null);
  const silenceWatchdogRef = useRef(null);

  const uiClosing = useRef(false);

  const isRecording = useRef(false);
  const isStarting = useRef(false);
  const pausedStateRef = useRef(false);
  const pausedAtRef = useRef(null);
  const stopSignalSent = useRef(false);

  const keepAliveAudioCtx = useRef(null);
  const keepAliveOscillator = useRef(null);
  const keepAliveLockAbort = useRef(null);
  const keepAliveMediaSessionActive = useRef(false);

  const recordingStartTime = useRef(null);
  const sessionHeartbeat = useRef(null);
  const recordingTick = useRef(null);

  debug("Recorder component mounted");
  slLog("component-mount");

  const setRecordingTimingState = async (nextState) => {
    try {
      await chrome.storage.local.set(nextState);
    } catch (err) {
      debugWarn("Failed to persist recording timing state", err);
    }
  };

  async function canFitChunk(byteLength) {
    const now = performance.now();
    if (now - lastEstimateAt.current < ESTIMATE_INTERVAL_MS) {
      // In the throttle window: trust prior result; bail if last estimate failed.
      if (estimateFailed.current) return false;
      return !lowStorageAbort.current;
    }
    lastEstimateAt.current = now;

    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      estimateFailed.current = false;
      const remaining = quota - usage;
      const ok = remaining > MIN_HEADROOM + (byteLength || 0);
      if (DEBUG_RECORDER) {
        debug("Storage estimate", {
          usage,
          quota,
          remaining,
          byteLength,
          ok,
        });
      }
      if (!lowStorageWarned.current && remaining < WARN_HEADROOM) {
        lowStorageWarned.current = true;
        chrome.runtime.sendMessage({
          type: "show-toast",
          message: chrome.i18n.getMessage("toastStorageLow"),
          timeout: 8000,
        }).catch(() => {});
      }
      return ok;
    } catch (err) {
      // No quota info: caller bails ("stop recording" beats QuotaExceeded mid-write).
      debugWarn("navigator.storage.estimate() failed, treating as low-storage", err);
      estimateFailed.current = true;
      return false;
    }
  }

  // Tab keep-alive: Chrome throttles/freezes background tabs after ~5 minutes of
  // inactivity. Multi-layered signals stack against the freeze heuristic.
  // recorder.html runs an inline keepalive bootstrap (see Recorder/index.html)
  // so throttling can't kick in before React mounts; we reuse those resources
  // to avoid a duplicate AudioContext or second lock holder.
  const startTabKeepAlive = () => {
    if (IS_OFFSCREEN_HOST) return;

    perfMark("Recorder keepalive.enter");

    const inlineKA =
      typeof window !== "undefined" ? window.__SCREENITY_KEEPALIVE : null;

    // startedAt/completedAt are written by the inline IIFE in recorder.html.
    // Missing means the inline path failed (or was stripped) and we're cold.
    perfMark("Recorder keepalive.inline-state", {
      hasInline: Boolean(inlineKA),
      hasAudioCtx: Boolean(inlineKA?.audioCtx),
      hasLock: Boolean(inlineKA?.lockAbort),
      hasMediaSession: Boolean(inlineKA?.mediaSession),
      inlineStartedAt: inlineKA?.startedAt || null,
      inlineCompletedAt: inlineKA?.completedAt || null,
      inlineDurationMs:
        inlineKA?.startedAt && inlineKA?.completedAt
          ? inlineKA.completedAt - inlineKA.startedAt
          : null,
    });

    const endAudio = perfSpan("Recorder keepalive.audio");
    let audioPath = "skip-already-set";
    try {
      if (!keepAliveAudioCtx.current) {
        if (inlineKA?.audioCtx && inlineKA?.oscillator) {
          // Adopt the inline context so it survives GC and stop can clean it up.
          keepAliveAudioCtx.current = inlineKA.audioCtx;
          keepAliveOscillator.current = inlineKA.oscillator;
          audioPath = "adopt-inline";
        } else {
          audioPath = "create-fresh";
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          keepAliveAudioCtx.current = ctx;
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();
          oscillator.type = "sine";
          oscillator.frequency.value = 20000;
          gainNode.gain.value = 0.0001;
          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);
          oscillator.start();
          keepAliveOscillator.current = oscillator;
        }
      }
    } catch (err) {
      debugWarn("keepalive: audio layer failed:", err);
      audioPath = "error";
    }
    endAudio({ path: audioPath });

    const endLocks = perfSpan("Recorder keepalive.locks");
    let lockPath = "skip-already-set";
    try {
      if (typeof navigator.locks !== "undefined" && !keepAliveLockAbort.current) {
        if (inlineKA?.lockAbort) {
          keepAliveLockAbort.current = inlineKA.lockAbort;
          lockPath = "adopt-inline";
        } else {
          lockPath = "create-fresh";
          const ac = new AbortController();
          keepAliveLockAbort.current = ac;
          navigator.locks
            .request(
              "screenity-recorder-keepalive",
              { mode: "exclusive", signal: ac.signal },
              () => new Promise(() => {}),
            )
            .catch(() => {});
        }
      }
    } catch (err) {
      debugWarn("keepalive: lock layer failed:", err);
      lockPath = "error";
    }
    endLocks({ path: lockPath });

    const endMs = perfSpan("Recorder keepalive.mediaSession");
    let msPath = "skip-already-set";
    try {
      if (navigator.mediaSession && !keepAliveMediaSessionActive.current) {
        if (inlineKA?.mediaSession) {
          keepAliveMediaSessionActive.current = true;
          msPath = "adopt-inline";
        } else {
          msPath = "create-fresh";
          navigator.mediaSession.metadata = new window.MediaMetadata({
            title: "Screenity recording",
            artist: "Screenity",
          });
          navigator.mediaSession.playbackState = "playing";
          try {
            navigator.mediaSession.setActionHandler("pause", () => {});
          } catch {}
          keepAliveMediaSessionActive.current = true;
        }
      }
    } catch (err) {
      debugWarn("keepalive: mediaSession layer failed:", err);
      msPath = "error";
    }
    endMs({ path: msPath });

    perfMark("Recorder keepalive.bg-messages.start");
    chrome.runtime
      .sendMessage({ type: "set-tab-auto-discardable", discardable: false })
      .catch(() => {});
    chrome.runtime
      .sendMessage({ type: "start-recorder-keepalive-alarm" })
      .catch(() => {});
    perfMark("Recorder keepalive.bg-messages.end");

    debug("Tab keep-alive started");
  };

  const stopTabKeepAlive = () => {
    try {
      if (keepAliveOscillator.current) {
        try { keepAliveOscillator.current.stop(); } catch {}
        try { keepAliveOscillator.current.disconnect(); } catch {}
        keepAliveOscillator.current = null;
      }
      if (keepAliveAudioCtx.current) {
        try { keepAliveAudioCtx.current.close(); } catch {}
        keepAliveAudioCtx.current = null;
      }
      if (keepAliveLockAbort.current) {
        try { keepAliveLockAbort.current.abort(); } catch {}
        keepAliveLockAbort.current = null;
      }
      if (keepAliveMediaSessionActive.current && navigator.mediaSession) {
        try { navigator.mediaSession.playbackState = "none"; } catch {}
        try { navigator.mediaSession.metadata = null; } catch {}
        try { navigator.mediaSession.setActionHandler("pause", null); } catch {}
        keepAliveMediaSessionActive.current = false;
      }
      chrome.runtime
        .sendMessage({ type: "stop-recorder-keepalive-alarm" })
        .catch(() => {});

      chrome.runtime
        .sendMessage({ type: "set-tab-auto-discardable", discardable: true })
        .catch(() => {});

      chrome.runtime
        .sendMessage({ type: "cancel-first-chunk-watchdog" })
        .catch(() => {});

      debug("Tab keep-alive stopped");
    } catch (err) {
      debugWarn("Failed to stop tab keep-alive:", err);
    }
  };

  const persistSessionState = async (status = "recording") => {
    try {
      await chrome.storage.local.set({
        freeRecorderSession: {
          status,
          chunkCount: savedCount.current,
          lastChunkTime: lastTimecode.current,
          startedAt: recordingStartTime.current,
          updatedAt: Date.now(),
        },
      });
    } catch (err) {
      debugWarn("Failed to persist session state:", err);
    }
  };

  /**
   * Start a heartbeat to periodically persist session state.
   */
  const startSessionHeartbeat = () => {
    if (sessionHeartbeat.current) clearInterval(sessionHeartbeat.current);
    // For WebCodecs: the muxer only emits a single chunk at finalize, so
    // handleChunk can't drive the recording-stall watchdog heartbeat during
    // the recording. Drive it from here instead, writes lastChunkAt every
    // 10s, plus firstChunkAt on the first tick (also overwrites any stale
    // values left from a prior session that hadn't been cleaned up yet).
    let firstHeartbeat = true;
    const tick = () => {
      if (!isRecording.current) return;
      persistSessionState("recording");
      if (useWebCodecs.current) {
        const now = Date.now();
        const update = { lastChunkAt: now };
        if (firstHeartbeat) {
          update.firstChunkAt = now;
          firstHeartbeat = false;
        }
        chrome.storage.local.set(update).catch(() => {});
      }
    };
    tick(); // first heartbeat must land before the 30s stall window
    sessionHeartbeat.current = setInterval(tick, 10000);
  };

  const stopSessionHeartbeat = () => {
    if (sessionHeartbeat.current) {
      clearInterval(sessionHeartbeat.current);
      sessionHeartbeat.current = null;
    }
  };

  // Update a storage tick so content-script timer UIs stay responsive.
  const startRecordingTick = () => {
    if (recordingTick.current) clearInterval(recordingTick.current);
    recordingTick.current = setInterval(async () => {
      if (!isRecording.current || !recordingStartTime.current) return;
      const { totalPausedMs, pausedAt, paused } =
        await chrome.storage.local.get(["totalPausedMs", "pausedAt", "paused"]);
      const now = Date.now();
      const basePaused = Number(totalPausedMs) || 0;
      const extraPaused =
        paused && pausedAt ? Math.max(0, now - Number(pausedAt)) : 0;
      const elapsed = Math.max(
        0,
        now - recordingStartTime.current - basePaused - extraPaused,
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

  // At most one stop emission per recording session.
  const requestStop = (reason = "generic", extra = {}) => {
    if (stopSignalSent.current) {
      debugWarn("requestStop() ignored; already sent", { reason });
      return false;
    }
    if (isFinishing.current || !isRecording.current) {
      debug("requestStop() ignored; recorder not active", {
        reason,
        isFinishing: isFinishing.current,
        isRecording: isRecording.current,
      });
      return false;
    }
    stopSignalSent.current = true;
    sendStopRecording(reason, extra);
    return true;
  };

  async function saveChunk(e, i) {
    const ts = e.timecode ?? 0;

    if (!(await canFitChunk(e.data.size))) {
      debugWarn("Low storage, aborting recording");
      if (!lowStorageAbort.current) {
        // Forward to BG diag so the support zip captures abort timing/amount.
        try {
          chrome.runtime.sendMessage({
            type: "diag-forward",
            event: "recorder-low-storage-abort",
            data: {
              chunkSize: e.data.size,
              chunkIndex: index.current,
              savedCount: savedCount.current,
              estimateFailed: estimateFailed.current,
            },
          });
        } catch {}
        chrome.runtime.sendMessage({
          type: "show-toast",
          message: chrome.i18n.getMessage("toastStorageCritical"),
          timeout: 8000,
        });
      }
      lowStorageAbort.current = true;
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
        memoryError: true,
        lowStorageAbortAt: Date.now(),
        lowStorageAbortChunks: index.current,
      });
      requestStop("low-storage", { memoryError: true, savedChunks: savedCount.current });
      return false;
    }

    try {
      await chunksStore.setItem(`chunk_${i}`, {
        index: i,
        chunk: e.data,
        timestamp: ts,
      });
      const heartbeatUpdate = { lastChunkAt: Date.now() };
      if (i === 0) heartbeatUpdate.firstChunkAt = Date.now();
      chrome.storage.local.set(heartbeatUpdate).catch(() => {});
      if (DEBUG_RECORDER) {
        debug("Saved chunk to IndexedDB", {
          key: `chunk_${i}`,
          size: e.data.size,
          ts,
        });
      }
    } catch (err) {
      debugError("Failed to save chunk, aborting recording", err);
      if (!lowStorageAbort.current) {
        chrome.runtime.sendMessage({
          type: "show-toast",
          message: chrome.i18n.getMessage("toastStorageCritical"),
          timeout: 8000,
        });
      }
      lowStorageAbort.current = true;
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
        memoryError: true,
        lowStorageAbortAt: Date.now(),
        lowStorageAbortChunks: index.current,
      });
      requestStop("chunk-save-failed", { memoryError: true, savedChunks: savedCount.current });
      return false;
    }

    lastTimecode.current = ts;
    lastSize.current = e.data.size;
    savedCount.current += 1;

    if (backupRef.current) {
      chrome.runtime.sendMessage({ type: "write-file", index: i });
    }
    return true;
  }

  async function drainQueue() {
    if (draining.current) return;
    draining.current = true;

    try {
      if (DEBUG_RECORDER) {
        debug("Draining queue start", {
          pending: pending.current.length,
          pendingBytes: pendingBytes.current,
        });
      }
      while (pending.current.length) {
        if (lowStorageAbort.current) {
          // Bypass the 25MB headroom gate post-abort: chunks are <500KB so disk
          // usually accepts a few more, recovering the last 1-2s. Stop on first throw.
          let savedDuringAbort = 0;
          while (pending.current.length) {
            const tail = pending.current.shift();
            pendingBytes.current -= tail.data.size;
            try {
              const i = index.current;
              await chunksStore.setItem(`chunk_${i}`, {
                index: i,
                chunk: tail.data,
                timestamp: tail.timecode ?? 0,
              });
              index.current = i + 1;
              savedCount.current += 1;
              savedDuringAbort += 1;
            } catch (writeErr) {
              debugWarn("low-storage tail write failed, stopping drain", writeErr);
              break;
            }
          }
          if (DEBUG_RECORDER) {
            debug("Low-storage tail drained", { savedDuringAbort });
          }
          pending.current.length = 0;
          pendingBytes.current = 0;
          break;
        }

        const e = pending.current.shift();
        pendingBytes.current -= e.data.size;

        if (!(await canFitChunk(e.data.size))) {
          debugWarn("Low storage during drain, stopping recording");
          if (!lowStorageAbort.current) {
            chrome.runtime.sendMessage({
              type: "show-toast",
              message: chrome.i18n.getMessage("toastStorageCritical"),
              timeout: 8000,
            });
          }
          lowStorageAbort.current = true;
          chrome.storage.local.set({
            recording: false,
            restarting: false,
            tabRecordedID: null,
            memoryError: true,
            lowStorageAbortAt: Date.now(),
            lowStorageAbortChunks: index.current,
          });
          requestStop("low-storage", { memoryError: true, savedChunks: savedCount.current });
          // Save the dequeued chunk as a tail; mirrors the abort branch above.
          try {
            const i = index.current;
            await chunksStore.setItem(`chunk_${i}`, {
              index: i,
              chunk: e.data,
              timestamp: e.timecode ?? 0,
            });
            index.current = i + 1;
            savedCount.current += 1;
          } catch {}
          pending.current.length = 0;
          pendingBytes.current = 0;
          break;
        }

        const i = index.current;
        const saved = await saveChunk(e, i);
        if (saved) index.current = i + 1;
      }
    } finally {
      if (DEBUG_RECORDER) {
        debug("Draining queue finished", {
          pending: pending.current.length,
          pendingBytes: pendingBytes.current,
        });
      }
      draining.current = false;
    }
  }

  async function waitForDrain() {
    if (DEBUG_RECORDER) {
      debug("waitForDrain() called");
    }
    // Cap so a wedged drain doesn't block stop forever.
    const deadline = Date.now() + 30000;
    while (draining.current || pending.current.length) {
      if (Date.now() > deadline) {
        debugWarn("waitForDrain timed out", {
          pending: pending.current.length,
          draining: draining.current,
        });
        break;
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    if (DEBUG_RECORDER) {
      debug("waitForDrain() resolved");
    }
  }

  useEffect(() => {
    chrome.storage.local.get(["backup"], (result) => {
      backupRef.current = !!result.backup;
      debug("Loaded backup flag from storage", backupRef.current);
    });
  }, []);

  // The recorder tab opens hidden (active:false for region/non-camera). Chrome
  // throttles silent hidden tabs after ~1s, before streaming-data arrives, so
  // start keepalive at mount.
  useEffect(() => {
    perfMark("Recorder mount.useEffect");
    try {
      startTabKeepAlive();
      perfMark("Recorder mount.startTabKeepAlive-done");
    } catch (err) {}
  }, []);

  function getStreamReadiness() {
    if (!helperVideoStream.current) return { ready: false, reason: "stream-ref-null" };
    const vt = helperVideoStream.current.getVideoTracks();
    if (vt.length === 0) return { ready: false, reason: "zero-video-tracks" };
    if (vt[0].readyState !== "live") return { ready: false, reason: "track-not-live", trackState: vt[0].readyState };
    return { ready: true };
  }

  function buildStreamDiagInfo(bucket) {
    const stream = helperVideoStream.current;
    const vt = stream?.getVideoTracks?.() ?? [];
    return {
      bucket,
      started,
      streamReadyAt: streamReadyAt.current,
      msSinceReady: streamReadyAt.current ? Date.now() - streamReadyAt.current : null,
      msSinceStartRequested: startRequestedAt.current ? Date.now() - startRequestedAt.current : null,
      streamExists: !!stream,
      streamActive: stream?.active ?? null,
      streamId: stream?.id ?? null,
      videoTrackCount: vt.length,
      audioTrackCount: stream?.getAudioTracks?.()?.length ?? null,
      trackReadyState: vt[0]?.readyState ?? null,
      trackEnabled: vt[0]?.enabled ?? null,
      trackMuted: vt[0]?.muted ?? null,
      docHidden: document.hidden,
      docVisibility: document.visibilityState,
    };
  }

  function armStartGateTimeout() {
    clearStartGateTimeout();
    startGateTimeout.current = setTimeout(() => {
      if (!startRequested.current) return;
      const readiness = getStreamReadiness();
      if (readiness.ready) {
        // Stream arrived just before timeout.
        slLog("start-gate-timeout-race-ok");
        tryStartIfReady();
        return;
      }
      const diagInfo = {
        ...buildStreamDiagInfo("start-gate-timeout"),
        streamingDataReceivedAt: streamingDataReceivedAt.current,
      };
      console.warn("[Screenity:startRec] stream never became ready", diagInfo);
      slLog("start-gate-timeout", diagInfo);
      chrome.storage.local.set({ lastStreamCheckFail: diagInfo });
      resetGateState();
      if (streamingDataReceivedAt.current == null) {
        sendRecordingError(
          "Recording not ready: streaming-data never arrived from background (SW→tab handoff failed)",
        );
      } else {
        sendRecordingError(
          "Recording not ready: screen stream is missing (tab may have been suspended)",
        );
      }
    }, START_GATE_TIMEOUT_MS);
  }

  function clearStartGateTimeout() {
    if (startGateTimeout.current) {
      clearTimeout(startGateTimeout.current);
      startGateTimeout.current = null;
    }
  }

  function resetGateState() {
    startRequested.current = false;
    startRequestedAt.current = null;
    streamingDataReceivedAt.current = null;
    isStarting.current = false;
    clearStartGateTimeout();
    if (streamingDataRetryTimer.current) {
      clearTimeout(streamingDataRetryTimer.current);
      streamingDataRetryTimer.current = null;
    }
  }

  function requestStart() {
    if (recorder.current !== null || isStarting.current) {
      debugWarn("requestStart() called but recorder already exists or start in flight");
      slLog("requestStart-bail-already-active", {
        hasRecorder: recorder.current !== null,
        isStarting: isStarting.current,
      });
      return;
    }
    if (isRestarting.current) {
      pendingStartAfterRestart.current = true;
      slLog("requestStart-queued-restart");
      debug("Queued start request while restarting");
      return;
    }
    if (startRequested.current) {
      slLog("requestStart-bail-already-requested");
      return;
    }

    startRequested.current = true;
    startRequestedAt.current = Date.now();
    slLog("requestStart", {
      hasStream: !!helperVideoStream.current,
      started,
      docHidden: document.hidden,
      docVisibility: document.visibilityState,
    });

    const readiness = getStreamReadiness();
    if (readiness.ready) {
      slLog("requestStart-immediate", readiness);
      startRecording();
    } else {
      slLog("requestStart-deferred", readiness);
      armStartGateTimeout();
    }
  }

  function tryStartIfReady() {
    if (!startRequested.current) return;
    const readiness = getStreamReadiness();
    slLog("tryStartIfReady", readiness);
    if (readiness.ready) {
      clearStartGateTimeout();
      startRecording();
    }
  }

  async function startRecording() {
    if (process.env.SCREENITY_DEV_MODE === "true") {
      console.log("[recorder-opfs][recorder] startRecording entry");
    }
    slLog("startRecording-enter", {
      hasRecorder: recorder.current !== null,
      hasStream: !!helperVideoStream.current,
      started,
      streamReadyAt: streamReadyAt.current,
      docHidden: document.hidden,
    });

    resetGateState();

    if (recorder.current !== null || isStarting.current) {
      debugWarn("startRecording() called but recorder already exists or start in flight");
      slLog("startRecording-bail-already-active", {
        hasRecorder: recorder.current !== null,
        isStarting: isStarting.current,
      });
      return;
    }

    isStarting.current = true;
    debug("startRecording()");
    recordingGeneration.current += 1;
    const runGeneration = recordingGeneration.current;

    startTabKeepAlive();

    // Fire-and-forget prewarm cancel: awaiting it leaves a gap with no
    // reader on the track, which macOS interprets as "no demand" and puts
    // capture back to sleep. Re-spinning takes 5s under load and the first
    // encoded frame freezes on screen for that long. Not awaiting lets
    // WebCodecsRecorder.start() open its own processor while the prewarm
    // reader is still releasing, so the OS sees continuous demand.
    // keepClear / keepWriter pass the in-flight clear and pre-opened writer
    // to the preflight code below.
    endPrewarm({ keepClear: true, keepWriter: true });

    recordingStartTime.current = Date.now();

    // Final preflight: state may have changed since the gate.
    navigator.storage.persist();
    if (!helperVideoStream.current) {
      const diagInfo = buildStreamDiagInfo("stream-ref-null");
      console.warn("[Screenity:startRec] helperVideoStream is null", diagInfo);
      slLog("startRecording-fail-stream-null", diagInfo);
      chrome.storage.local.set({ lastStreamCheckFail: diagInfo });
      sendRecordingError(
        "Recording not ready: screen stream is missing (tab may have been suspended)",
      );
      stopTabKeepAlive();
      isStarting.current = false;
      return;
    }
    const videoTracks = helperVideoStream.current.getVideoTracks();
    if (videoTracks.length === 0) {
      const diagInfo = buildStreamDiagInfo("stream-zero-video-tracks");
      console.warn("[Screenity:startRec] helperVideoStream has 0 video tracks", diagInfo);
      slLog("startRecording-fail-zero-tracks", diagInfo);
      chrome.storage.local.set({ lastStreamCheckFail: diagInfo });
      sendRecordingError("No video tracks available");
      stopTabKeepAlive();
      isStarting.current = false;
      return;
    }
    {
      const vt = videoTracks[0];
      const diagInfo = {
        bucket: "stream-ok",
        trackReadyState: vt.readyState,
        trackEnabled: vt.enabled,
        trackMuted: vt.muted,
        msSinceReady: streamReadyAt.current
          ? Date.now() - streamReadyAt.current
          : null,
      };
      slLog("startRecording-preflight-ok", diagInfo);
      if (vt.readyState === "ended") {
        console.warn("[Screenity:startRec] video track present but ended", diagInfo);
        slLog("startRecording-fail-track-ended", diagInfo);
        chrome.storage.local.set({ lastStreamCheckFail: diagInfo });
        sendRecordingError(
          "Recording not ready: screen stream ended (tab may have been suspended)",
        );
        stopTabKeepAlive();
        isStarting.current = false;
        return;
      }
    }

    perfMark("Recorder.preflight.enter");
    const endChunksClear = perfSpan("Recorder.preflight chunksStore.clear");
    if (prewarmChunksClearRef.current) {
      await prewarmChunksClearRef.current;
      prewarmChunksClearRef.current = null;
    } else {
      await chunksStore.clear();
    }
    endChunksClear();
    debug("Cleared chunksStore");

    lastTimecode.current = 0;
    lastSize.current = 0;
    hasChunks.current = false;
    savedCount.current = 0;
    pending.current = [];
    draining.current = false;
    lowStorageAbort.current = false;
    pendingBytes.current = 0;
    sentLast.current = false;
    isFinishing.current = false;
    stopSignalSent.current = false;

    const endCapsRead = perfSpan("Recorder.preflight storage+caps");
    const [
      { qualityValue, useWebCodecsRecorder: prefUseWebCodecs },
      { isPro, maxQuality, maxFps },
    ] = await Promise.all([
      chrome.storage.local.get(["qualityValue", "useWebCodecsRecorder"]),
      getFreeCaptureCaps(),
    ]);
    endCapsRead();
    const effectiveQualityValue = isPro
      ? qualityValue
      : clampQualityValue(qualityValue, maxQuality);
    const { audioBitsPerSecond, videoBitsPerSecond: bitratePreset } =
      getBitrates(effectiveQualityValue);
    let videoBitsPerSecond = bitratePreset;

    debug("Bitrates resolved", {
      qualityValue: effectiveQualityValue,
      audioBitsPerSecond,
      videoBitsPerSecond,
    });

    // If the prewarm pre-opened an OPFS writer, consume it (saves ~30-90ms).
    // Resolve the in-flight promise here without blocking on it later.
    const prewarmedWriter = prewarmedWriterRef.current
      ? await prewarmedWriterRef.current.catch(() => null)
      : null;
    prewarmedWriterRef.current = null;

    const recordingId =
      prewarmedWriter?.recordingId ||
      `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const endActiveSet = perfSpan("Recorder.preflight set fastRecorderActive");
    await chrome.storage.local.set({
      fastRecorderActiveRecordingId: recordingId,
      fastRecorderInUse: false,
      fastRecorderValidationFailed: false,
      fastRecorderValidation: null,
    });
    endActiveSet();

    // Chunk backend: fall back to IDB if OPFS open() fails. Prefer IDB up-front
    // when WebCodecs is skipped: the legacy editor's sandboxed iframe lacks
    // allow-same-origin and can't read OPFS.
    const endStickyRead = perfSpan("Recorder.preflight getStickyState");
    const earlyStickyState = await getFastRecorderStickyState();
    endStickyRead();
    const willLikelyUseFast =
      prefUseWebCodecs !== false &&
      !(earlyStickyState?.disabled && prefUseWebCodecs !== true);

    chunkWriter.current = null;
    chunkWriterBackend.current = null;
    if (process.env.SCREENITY_DEV_MODE === "true") {
      console.log("[recorder-opfs][recorder] chooseWriter entry", {
        recordingId,
        willLikelyUseFast,
      });
    }
    try {
      const endChoose = perfSpan("Recorder.preflight chooseWriter");
      let selection;
      let openResult = null;
      const wantBackend = willLikelyUseFast ? "opfs" : "idb";
      const prewarmedMatches =
        prewarmedWriter && prewarmedWriter.selection.backend === wantBackend;
      if (prewarmedMatches) {
        selection = prewarmedWriter.selection;
        openResult = prewarmedWriter.openResult;
      } else {
        if (prewarmedWriter?.selection?.writer?.abort) {
          prewarmedWriter.selection.writer.abort().catch(() => {});
        }
        selection = await chooseWriter({ preferOpfs: willLikelyUseFast });
      }
      endChoose({ backend: selection?.backend, prewarmed: prewarmedMatches });
      if (process.env.SCREENITY_DEV_MODE === "true") {
        console.log("[recorder-opfs][recorder] chooseWriter returned", {
          backend: selection.backend,
          prewarmed: prewarmedMatches,
        });
      }
      const endOpen = perfSpan("Recorder.preflight writer.open");
      try {
        if (!openResult) {
          openResult = await selection.writer.open(recordingId);
        }
        endOpen({ backend: selection.backend, prewarmed: prewarmedMatches });
      } catch (openErr) {
        endOpen({ backend: selection.backend, ok: false });
        if (process.env.SCREENITY_DEV_MODE === "true") {
          console.warn(
            "[recorder-opfs][recorder] writer.open failed",
            selection.backend,
            openErr,
          );
        }
        if (selection.backend === "opfs") {
          try {
            await selection.writer.abort();
          } catch {}
          selection = await chooseWriter({ preferOpfs: false });
          openResult = await selection.writer.open(recordingId);
        } else {
          throw openErr;
        }
      }
      chunkWriter.current = selection.writer;
      chunkWriterBackend.current = selection.backend;
      // Persist backendRef at open time - the OPFS file is wiped on open.
      const backendRefAtOpen = openResult?.backendRef || {
        backend: selection.backend,
      };
      chunkBackendRef.current = backendRefAtOpen;
      const endBackendRefSet = perfSpan("Recorder.preflight set backendRef");
      try {
        await chrome.storage.local.set({
          lastRecordingBackendRef: backendRefAtOpen,
        });
      } catch {}
      endBackendRefSet();
      perfMark("Recorder.preflight.done");
      if (process.env.SCREENITY_DEV_MODE === "true") {
        console.log("[recorder-opfs][recorder] writer-open", {
          backend: selection.backend,
          recordingId,
          backendRef: backendRefAtOpen,
        });
      }
    } catch (err) {
      if (process.env.SCREENITY_DEV_MODE === "true") {
        console.error("[recorder-opfs][recorder] chooseWriter path threw", err);
      }
      debugWarn("chooseWriter failed, falling back to direct chunksStore", err);
      chunkBackendRef.current = { backend: "idb" };
      try {
        await chrome.storage.local.set({
          lastRecordingBackendRef: { backend: "idb" },
        });
      } catch {}
    }

    const { useWebCodecsRecorder } = await chrome.storage.local.get([
      "useWebCodecsRecorder",
    ]);
    // Default-on: undefined means enabled; only explicit `false` opts out.
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
        disabled: Boolean(stickyState?.disabled),
        disabledReason: stickyState?.reason || null,
        disabledDetails: stickyState?.details || null,
        disabledAt: null,
        updatedAt: Date.now(),
      },
      fastRecorderSelectedVideoConfig: selectedVideoConfig,
    });

    debugRecordingEvent(recdbgSessionRef, "fast-recorder-probe", {
      probe: probeResult,
      stickyState,
      userSetting,
      shouldUseFast,
    });

    const canUseWebCodecs = shouldUseFast;

    const videoTrack = liveStream.current?.getVideoTracks()[0] ?? null;
    const settings = videoTrack?.getSettings() || {};
    const { width: qualityWidth, height: qualityHeight } =
      getResolutionForQuality(effectiveQualityValue);
    const trackWidth = settings.width ?? qualityWidth ?? 1920;
    const trackHeight = settings.height ?? qualityHeight ?? 1080;
    const width = Math.min(trackWidth, qualityWidth ?? trackWidth);
    const height = Math.min(trackHeight, qualityHeight ?? trackHeight);

    const { fpsValue } = await chrome.storage.local.get(["fpsValue"]);
    let fps = parseInt(fpsValue);
    if (Number.isNaN(fps)) fps = 30;

    if (!isPro) {
      fps = Math.min(fps, maxFps);
    }
    const computedBps = computeTargetVideoBps(width, height, fps, isPro);
    videoBitsPerSecond = !isPro
      ? Math.min(computedBps, bitratePreset)
      : computedBps;
    debug("Video bitrate target", {
      bitratePreset,
      videoBitsPerSecond,
      isPro,
    });

    debug("Recorder capabilities", {
      canUseWebCodecs,
      FORCE_MEDIARECORDER,
      width,
      height,
      fps,
    });

    // Pre-recording reset. isRecording/heartbeat/timing are set post-construction.
    pausedStateRef.current = false;
    chrome.storage.local.set({ restarting: false });
    isRestarting.current = false;
    index.current = 0;

    // Track in-flight WebCodecs IDB writes: onChunk dispatches handleChunk
    // fire-and-forget, waitForDrain only covers MediaRecorder, so onFinalized
    // could race ahead of slicing. Chain handleChunks and await in onFinalized.
    let webcodecsWriteChain = Promise.resolve();

    const handleChunk = async (data, timestampMs) => {
      if (runGeneration !== recordingGeneration.current) {
        return;
      }
      if (useWebCodecs.current) {
        if (lowStorageAbort.current) return;

        // fMP4 fragments stream in (~1MB each, coalesced upstream); concatenated
        // they form a valid fMP4 playable directly in <video> and re-muxable later.
        const blob =
          data instanceof Blob ? data : new Blob([data], { type: "video/mp4" });

        const ts = timestampMs ?? 0;

        // Pre-flight quota: setItem throwing QuotaExceededError mid-write would
        // silently drop subsequent fragments.
        if (!(await canFitChunk(blob.size))) {
          if (!lowStorageAbort.current) {
            chrome.runtime.sendMessage({
              type: "show-toast",
              message: chrome.i18n.getMessage("toastStorageCritical"),
              timeout: 8000,
            });
          }
          lowStorageAbort.current = true;
          chrome.storage.local.set({
            recording: false,
            restarting: false,
            tabRecordedID: null,
            memoryError: true,
            lowStorageAbortAt: Date.now(),
            lowStorageAbortChunks: index.current,
          });
          requestStop("low-storage", {
            memoryError: true,
            savedChunks: savedCount.current,
          });
          return;
        }

        try {
          const i = index.current;
          if (chunkWriter.current) {
            await chunkWriter.current.write({
              chunk: blob,
              index: i,
              timestamp: ts,
            });
          } else {
            // chooseWriter failed at start; write directly so data isn't lost.
            await chunksStore.setItem(`chunk_${i}`, {
              index: i,
              chunk: blob,
              timestamp: ts,
            });
          }

          // First-fragment heartbeat + watchdog cancel keeps the SW stall detector quiet.
          const heartbeatUpdate = { lastChunkAt: Date.now() };
          if (i === 0) heartbeatUpdate.firstChunkAt = Date.now();
          chrome.storage.local.set(heartbeatUpdate).catch(() => {});
          if (!hasChunks.current) {
            chrome.runtime
              .sendMessage({ type: "cancel-first-chunk-watchdog" })
              .catch(() => {});
            hasChunks.current = true;
          }

          index.current = i + 1;
          savedCount.current += 1;

          if (DEBUG_RECORDER) {
            debug("WebCodecs fragment saved", {
              i,
              ts,
              size: blob.size,
              savedCount: savedCount.current,
            });
          }

          if (backupRef.current) {
            chrome.runtime.sendMessage({ type: "write-file", index: i });
          }
        } catch (err) {
          debugError("Failed to save WebCodecs chunk", err);
          // Stop recording but preserve what's on disk.
          const name = err?.name || err?.errorName || "";
          const msg = String(err?.message || err || "").toLowerCase();
          const looksLikeQuotaError =
            name === "QuotaExceededError" ||
            msg.includes("quota") ||
            msg.includes("disk");
          const isOpfsWriterDead = err?.code === "opfs-writer-failed";

          if ((looksLikeQuotaError || isOpfsWriterDead) && !lowStorageAbort.current) {
            // Keep the OPFS ref: the partial MP4 is still readable.
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
            const toastMessage = isOpfsWriterDead
              ? chrome.i18n.getMessage("recordingWriterFailedToast")
              : chrome.i18n.getMessage("toastStorageCritical");
            chrome.runtime.sendMessage({
              type: "show-toast",
              message: toastMessage,
              timeout: 8000,
            });
            lowStorageAbort.current = true;
            chrome.storage.local.set({
              recording: false,
              restarting: false,
              tabRecordedID: null,
              memoryError: true,
              lowStorageAbortAt: Date.now(),
              lowStorageAbortChunks: index.current,
            });
            requestStop(isOpfsWriterDead ? "opfs-writer-failed" : "low-storage", {
              memoryError: true,
              savedChunks: savedCount.current,
            });
          }
        }

        return;
      }

      if (lowStorageAbort.current) return;

      const blob =
        data instanceof Blob ? data : new Blob([data], { type: "video/mp4" });

      const e = {
        data: blob,
        timecode: timestampMs ?? 0,
      };

      if (!hasChunks.current) {
        chrome.runtime
          .sendMessage({ type: "cancel-first-chunk-watchdog" })
          .catch(() => {});
        hasChunks.current = true;
        lastTimecode.current = e.timecode;
        lastSize.current = e.data.size;
      }

      pending.current.push(e);
      pendingBytes.current += e.data.size;

      if (DEBUG_RECORDER) {
        debug("Queued MediaRecorder chunk", {
          size: blob.size,
          timecode: e.timecode,
          pending: pending.current.length,
          pendingBytes: pendingBytes.current,
        });
      }

      if (pendingBytes.current > MAX_PENDING_BYTES) {
        debugWarn(
          "Pending bytes exceeded threshold, pausing MediaRecorder and draining queue",
        );
        try {
          if (
            recorder.current instanceof MediaRecorder &&
            recorder.current.state !== "paused"
          ) {
            recorder.current.pause();
          }
          await drainQueue();
          if (
            recorder.current instanceof MediaRecorder &&
            recorder.current.state === "paused"
          ) {
            recorder.current.resume();
          }
        } catch (err) {
          debugError(
            "Error while draining queue with MediaRecorder paused",
            err,
          );
          await drainQueue();
        }
      }

      void drainQueue();
    };

    if (isFinishing.current || uiClosing.current) {
      slLog("startRecording-abort-interrupted", {
        isFinishing: isFinishing.current,
        uiClosing: uiClosing.current,
      });
      isStarting.current = false;
      stopTabKeepAlive();
      return;
    }

    try {
      if (canUseWebCodecs) {
        useWebCodecs.current = true;

        const hasAudioTrack =
          !!liveStream.current &&
          typeof liveStream.current.getAudioTracks === "function" &&
          liveStream.current.getAudioTracks().length > 0;

        // Snapshot for diagnostic zip; useful when debugging "No video track".
        const lsVideoTracks = liveStream.current?.getVideoTracks?.() || [];
        const helperVideo = helperVideoStream.current?.getVideoTracks?.() || [];
        const constructSnapshot = {
          liveStreamPresent: !!liveStream.current,
          liveStreamId: liveStream.current?.id || null,
          liveStreamActive: liveStream.current?.active ?? null,
          liveVideoTrackCount: lsVideoTracks.length,
          liveVideoTrackStates: lsVideoTracks.map((t) => ({
            id: t.id,
            label: t.label,
            readyState: t.readyState,
            enabled: t.enabled,
            muted: t.muted,
          })),
          helperVideoStreamPresent: !!helperVideoStream.current,
          helperVideoStreamId: helperVideoStream.current?.id || null,
          helperVideoStreamActive: helperVideoStream.current?.active ?? null,
          helperVideoTrackCount: helperVideo.length,
          helperVideoTrackStates: helperVideo.map((t) => ({
            id: t.id,
            label: t.label,
            readyState: t.readyState,
          })),
          hasAudioTrack,
          at: Date.now(),
        };
        try {
          chrome.storage.local.set({
            webcodecsConstructSnapshot: constructSnapshot,
          });
        } catch {}
        debug("Initializing WebCodecsRecorder", {
          ...constructSnapshot,
          videoBitsPerSecond,
          audioBitsPerSecond,
        });

        recorder.current = new WebCodecsRecorder(liveStream.current, {
          width,
          height,
          fps,
          videoBitrate: videoBitsPerSecond,
          audioBitrate: hasAudioTrack ? audioBitsPerSecond : undefined,
          enableAudio: hasAudioTrack,
          videoEncoderConfig: selectedVideoConfig,
          debug: DEBUG_RECORDER,
          onFinalized: async () => {
            debug("WebCodecsRecorder onFinalized()");
            await waitForDrain();
            try {
              await webcodecsWriteChain;
            } catch {}
            // Close before validating: OPFS holds an exclusive handle until close.
            if (chunkWriter.current) {
              try {
                const closeResult = await chunkWriter.current.close();
                // Only overwrite chunkBackendRef when close returns one; otherwise
                // {backend:"idb"} would silently reroute editor reads from OPFS to IDB.
                if (closeResult?.backendRef) {
                  chunkBackendRef.current = closeResult.backendRef;
                }
                if (process.env.SCREENITY_DEV_MODE === "true") {
                  console.log("[recorder-opfs][recorder] writer-close", {
                    backendRef: chunkBackendRef.current,
                    byteSize: closeResult?.byteSize,
                    chunkCount: closeResult?.chunkCount,
                  });
                }
              } catch (err) {
                debugWarn("chunkWriter.close failed before validate", err);
                if (err?.code === "opfs-writer-failed" && err?.fileName) {
                  // Partial file still on disk.
                  chunkBackendRef.current = {
                    backend: "opfs",
                    fileName: err.fileName,
                  };
                } else {
                  chunkBackendRef.current = { backend: "idb" };
                }
              }
              chunkWriter.current = null;
              chunkWriterBackend.current = null;
            }
            await updateFreeFinalizeStatus("chunks_ready", 95);
            let validation = null;
            try {
              const blob = await rebuildBlobFromChunks();
              validation = await validateFastRecorderOutputBlob(blob, {
                minBytes: 64 * 1024,
                // Multi-GB demuxer scans on slow disks need ~15s.
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
                // Survives subsequent starts (which clear fastRecorderValidation).
                lastFailedValidation: {
                  at: Date.now(),
                  recordingId,
                  validation,
                },
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
                // Clear backendRef: prevents the sandbox from reading a stale OPFS file.
                await chrome.storage.local.remove([
                  "lastRecordingBackendRef",
                ]);
                chrome.runtime.sendMessage({
                  type: "fast-recorder-hard-fail",
                  recordingId,
                });
                if (!sentLast.current) {
                  sentLast.current = true;
                  isFinishing.current = false;
                  chrome.runtime.sendMessage({ type: "video-ready" });
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
              isFinishing.current = false;
              chrome.runtime.sendMessage({ type: "video-ready" });
            }
          },
          onChunk: (chunkData, timestampUs) => {
            const blob = new Blob([chunkData], { type: "video/mp4" });
            const timestampMs = timestampUs
              ? Math.floor(timestampUs / 1000)
              : 0;
            if (DEBUG_RECORDER) {
              debug("WebCodecsRecorder onChunk", {
                size: blob.size,
                timestampUs,
                timestampMs,
              });
            }
            webcodecsWriteChain = webcodecsWriteChain
              .catch(() => {})
              .then(() => handleChunk(blob, timestampMs));
          },
          onError: (err) => {
            debugError("WebCodecsRecorder error", err);
            const errStr = String(err);
            const transient = isTransientFastRecorderError(errStr);
            markFastRecorderFailure("webcodecs-error", { error: errStr });
            // Transient stream errors don't disable WebCodecs.
            const persisted = {
              lastWebCodecsFailureAt: Date.now(),
              lastWebCodecsFailureCode: transient
                ? "webcodecs-transient"
                : "webcodecs-error",
            };
            if (!transient) persisted.useWebCodecsRecorder = false;
            chrome.storage.local.set(persisted);
            updateFreeFinalizeStatus("failed", 100, errStr);
            if (!transient) {
              chrome.runtime.sendMessage({
                type: "show-toast",
                message: chrome.i18n.getMessage("webcodecsFailedOffToast"),
              });
            }
            sendRecordingError(errStr);
          },
          onStop: async () => {
            debug("WebCodecsRecorder onStop()");
            await waitForDrain();
          },
        });

        // Records when .start() fires vs countdown end so a diag zip distinguishes
        // early-start (capturing the countdown overlay) from React paint lag.
        try {
          const { countdownFinishedAt } = await chrome.storage.local.get([
            "countdownFinishedAt",
          ]);
          chrome.storage.local.set({
            recorderStartTimings: {
              path: "webcodecs",
              startCalledAt: Date.now(),
              countdownFinishedAt: countdownFinishedAt || null,
              deltaSinceCountdownMs:
                countdownFinishedAt
                  ? Date.now() - Number(countdownFinishedAt)
                  : null,
            },
          });
        } catch {}
        const ok = await recorder.current.start();

        debug("WebCodecsRecorder.start() result", ok);

        if (!ok) {
          debugWarn(
            "Falling back to MediaRecorder because WebCodecsRecorder failed",
          );
          useWebCodecs.current = false;
          await chrome.storage.local.set({ fastRecorderInUse: false });
          await chrome.storage.local.set({
            useWebCodecsRecorder: false,
            lastWebCodecsFailureAt: Date.now(),
            lastWebCodecsFailureCode: "start-failed",
          });
          chrome.runtime.sendMessage({
            type: "show-toast",
            message: chrome.i18n.getMessage("webcodecsFailedOffToast"),
          });
          recorder.current = null;
          return await startRecording();
        }
        await chrome.storage.local.set({ fastRecorderInUse: true });

        debugRecordingEvent(recdbgSessionRef, "recorder-start", {
          encoder: "webcodecs",
          codec: "webcodecs",
          width,
          height,
          fps,
          videoBitrate: videoBitsPerSecond,
          audioBitrate: hasAudioTrack ? audioBitsPerSecond : undefined,
        });

        setTimeout(() => {
          const afterTrack = liveStream.current?.getVideoTracks?.()[0] ?? null;
          logRecordingSnapshot("after-start-500ms", {
            capture: buildTrackSnapshot(afterTrack),
          });
          debugRecordingEvent(recdbgSessionRef, "after-start-500ms", {
            capture: buildTrackSnapshot(afterTrack),
          });
        }, 500);

        setTimeout(() => {
          const afterTrack = liveStream.current?.getVideoTracks?.()[0] ?? null;
          debugRecordingEvent(recdbgSessionRef, "after-start-1500ms", {
            capture: buildTrackSnapshot(afterTrack),
          });
        }, 1500);
      } else {
        debug("Using MediaRecorder fallback");
        useWebCodecs.current = false;
        await chrome.storage.local.set({ fastRecorderInUse: false });
        let recorderToken = 0;
        let codecFallbackTriggered = false;
        let mediaRecorderStartAt = Date.now();
        let recdbgChunkCount = 0;
        let recdbgTotalBytes = 0;
        let activeCodec = "vp9";
        let activeMimeType = null;

        try {
          if (!recorder.current) {
            try {
              recorder.current = createMediaRecorder(liveStream.current, {
                audioBitsPerSecond,
                videoBitsPerSecond: videoBitsPerSecond,
              });
              debug("Created MediaRecorder instance for fallback");
            } catch (initErr) {
              debugError("Failed to create MediaRecorder", initErr);
              sendRecordingError(
                "Failed to start recording: " + String(initErr),
              );
              isStarting.current = false;
              stopTabKeepAlive();
              return;
            }
          }

          // Same start-vs-countdown logging as the WebCodecs path.
          try {
            const { countdownFinishedAt } = await chrome.storage.local.get([
              "countdownFinishedAt",
            ]);
            chrome.storage.local.set({
              recorderStartTimings: {
                path: "mediarecorder",
                startCalledAt: Date.now(),
                countdownFinishedAt: countdownFinishedAt || null,
                deltaSinceCountdownMs:
                  countdownFinishedAt
                    ? Date.now() - Number(countdownFinishedAt)
                    : null,
              },
            });
          } catch {}
          // Stream/track snapshot for diagnosing "no chunks" failures.
          try {
            const vTracks = liveStream.current?.getVideoTracks?.() || [];
            const aTracks = liveStream.current?.getAudioTracks?.() || [];
            lifecycle("Recorder", "mediarecorder-start", {
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
          } catch {}
          // Re-attach listeners every (re)start so the new MediaRecorder doesn't
          // read from a track whose mute/end events would be silently missed.
          try {
            const vt0 = liveStream.current?.getVideoTracks?.()[0];
            if (vt0) {
              vt0.onmute = () => {
                lifecycle("Recorder", "videoTrack-mute", {
                  readyState: vt0.readyState,
                  enabled: vt0.enabled,
                  savedCount: savedCount.current,
                });
              };
              vt0.onunmute = () => {
                lifecycle("Recorder", "videoTrack-unmute", {
                  readyState: vt0.readyState,
                  enabled: vt0.enabled,
                  savedCount: savedCount.current,
                });
              };
              vt0.onended = () => {
                lifecycle("Recorder", "videoTrack-ended", {
                  readyState: vt0.readyState,
                  savedCount: savedCount.current,
                });
              };
            }
          } catch {}
          recorder.current.onstart = () => {
            lifecycle("Recorder", "mediarecorder-onstart", {
              recorderState: recorder.current?.state || null,
              videoState: (() => {
                const t = liveStream.current?.getVideoTracks?.()[0];
                return t
                  ? {
                      readyState: t.readyState,
                      muted: t.muted,
                      enabled: t.enabled,
                    }
                  : null;
              })(),
            });
          };
          recorder.current.start(5000);
          debug("MediaRecorder.start(5000) called");

          // First-chunk watchdog (8s, chrome.alarms-backed).
          chrome.runtime
            .sendMessage({ type: "start-first-chunk-watchdog" })
            .catch(() => {});
        } catch (err) {
          debugError("Failed to start MediaRecorder", err);
          sendRecordingError("Failed to start recording: " + String(err));
          recorder.current = null;
          isStarting.current = false;
          stopTabKeepAlive();
          return;
        }

        recorder.current.onerror = (ev) => {
          debugError("MediaRecorder.onerror", ev);
          const errStr = String(ev?.error || ev?.error?.name || "unknown");
          lifecycle("Recorder", "mediarecorder-onerror", {
            error: errStr,
            errorName: ev?.error?.name || null,
            recorderState: recorder.current?.state || null,
            savedCount: savedCount.current,
          });
          // Transient errors (stop-time state races, already-inactive) shouldn't
          // surface a modal; saved chunks are still valid via the normal stop path.
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
          // Stop locally; don't wait for the BG round-trip.
          requestStop("mediarecorder-onerror");
        };

        recorder.current.onstop = async () => {
          perfMark("Recorder mediarecorder.onstop.fired", {
            savedCount: savedCount.current,
          });
          debug("MediaRecorder.onstop");
          try {
            recorder.current.requestData();
          } catch {}
          if (isRestarting.current) return;
          const endDrain = perfSpan("Recorder waitForDrain");
          await waitForDrain();
          endDrain({ savedCount: savedCount.current });
          if (!sentLast.current) {
            sentLast.current = true;
            isFinishing.current = false;
            // Skip video-ready if no chunks landed; otherwise the editor opens on a 0-byte file.
            if (!hasChunks.current || savedCount.current === 0) {
              debugWarn("MediaRecorder.onstop: no chunks saved", {
                hasChunks: hasChunks.current,
                savedCount: savedCount.current,
              });
              chrome.runtime.sendMessage({
                type: "recording-error",
                error: "stream-error",
                why: "No recording data was generated",
              });
              return;
            }
            perfMark("Recorder video-ready.sent", {
              savedCount: savedCount.current,
            });
            chrome.runtime.sendMessage({ type: "video-ready" });
          }
        };

        recorder.current.ondataavailable = async (e) => {
          if (runGeneration !== recordingGeneration.current) {
            return;
          }
          if (!e || !e.data || !e.data.size) {
            debugWarn("MediaRecorder.ondataavailable with empty data", e);
            lifecycle("Recorder", "ondataavailable-empty", {
              hasEvent: Boolean(e),
              hasData: Boolean(e?.data),
              size: e?.data?.size ?? null,
              recorderState: recorder.current?.state || null,
              savedCount: savedCount.current,
            });
            if (
              recorder.current instanceof MediaRecorder &&
              recorder.current.state === "inactive"
            ) {
              chrome.storage.local.set({
                recording: false,
                restarting: false,
                tabRecordedID: null,
              });
              requestStop("mediarecorder-empty-inactive");
            }
            return;
          }

          if (DEBUG_RECORDER) {
            debug("MediaRecorder.ondataavailable", {
              size: e.data.size,
              timecode: e.timecode ?? 0,
            });
          }
          if (savedCount.current < 3) {
            lifecycle("Recorder", "ondataavailable", {
              index: savedCount.current,
              size: e.data.size,
              timecode: e.timecode ?? 0,
            });
          }

          await handleChunk(e.data, e.timecode ?? 0);
        };
      }
    } catch (err) {
      debugError("startRecording() top-level error", err);
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
      sendRecordingError(String(err));
      isStarting.current = false;
      stopTabKeepAlive();
      return;
    }

    await setRecordingTimingState({
      recording: true,
      paused: false,
      recordingStartTime: recordingStartTime.current,
      pausedAt: null,
      totalPausedMs: 0,
    });
    isStarting.current = false;
    isRecording.current = true;
    startSessionHeartbeat();
    startRecordingTick();
    persistSessionState("recording");

    if (helperAudioStream.current) {
      const track = helperAudioStream.current.getAudioTracks()[0];
      if (track) {
        // Mute fires when OS/driver silences the mic without ending the track
        // (macOS DND, privacy revoke, BT disconnect): surface to avoid silent recordings.
        track.onmute = () => {
          if (isFinishing.current || !isRecording.current) return;
          console.warn("[Recorder] mic track muted (device may have switched)");
          try {
            chrome.runtime.sendMessage({
              type: "diag-forward",
              event: "recorder-mic-track-muted",
              data: {
                trackLabel: String(track.label || "").slice(0, 80),
                trackReadyState: track.readyState,
              },
            });
          } catch {}
        };
        track.onunmute = () => {
          try {
            chrome.runtime.sendMessage({
              type: "diag-forward",
              event: "recorder-mic-track-unmuted",
            });
          } catch {}
        };
        track.onended = () => {
          if (isFinishing.current || !isRecording.current) return;
          const diagnosticInfo = {
            reason: "audio-track-ended",
            savedChunks: savedCount.current,
            lastTimecode: lastTimecode.current,
            recordingDuration: recordingStartTime.current
              ? Date.now() - recordingStartTime.current
              : null,
            trackLabel: track?.label || null,
            trackReadyState: track?.readyState || null,
          };
          console.warn(
            "[Recorder] Audio track ended unexpectedly",
            diagnosticInfo,
          );
          chrome.runtime.sendMessage({
            type: "recording-error",
            error: "stream-ended",
            why: chrome.i18n.getMessage("audioTrackEndedToast"),
          }).catch(() => {});
          chrome.storage.local.set({
            recording: false,
            lastTrackEndEvent: diagnosticInfo,
          });
          requestStop("audio-track-ended");
        };
      }
    }

    // OS audio topology changes (BT/USB plug, default switch) keep the original
    // deviceId streaming, possibly silent. Surface diag event; don't auto-switch
    // (mid-recording device changes risk sample-rate mismatch and drift).
    if (
      typeof navigator !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.addEventListener === "function"
    ) {
      const onDeviceChange = async () => {
        if (isFinishing.current || !isRecording.current) return;
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter((d) => d.kind === "audioinput");
          chrome.runtime.sendMessage({
            type: "diag-forward",
            event: "recorder-devicechange-mid-recording",
            data: {
              audioInputCount: audioInputs.length,
              labels: audioInputs.map((d) => d.label).slice(0, 5),
            },
          });
        } catch {}
      };
      try {
        navigator.mediaDevices.addEventListener(
          "devicechange",
          onDeviceChange,
        );
        // Stashed so stop() can detach it.
        deviceChangeListenerRef.current = onDeviceChange;
      } catch {}
    }

    const liveVideoTrack = liveStream.current?.getVideoTracks?.()[0] || null;
    if (liveVideoTrack) {
      liveVideoTrack.onended = () => {
        if (isFinishing.current || !isRecording.current) return;
        const track = liveStream.current?.getVideoTracks?.()[0] || null;
        const diagnosticInfo = {
          reason: "liveStream-video-track-ended",
          savedChunks: savedCount.current,
          lastTimecode: lastTimecode.current,
          recordingDuration: recordingStartTime.current
            ? Date.now() - recordingStartTime.current
            : null,
          trackLabel: track?.label || null,
          trackReadyState: track?.readyState || null,
        };
        console.warn("[Recorder] liveStream video track ended", diagnosticInfo);
        // Notify via stream-ended-warning toast
        chrome.runtime.sendMessage({
          type: "recording-error",
          error: "stream-ended",
          why: chrome.i18n.getMessage("videoTrackEndedToast"),
        }).catch(() => {});
        chrome.storage.local.set({
          recording: false,
          restarting: false,
          tabRecordedID: null,
          lastTrackEndEvent: diagnosticInfo,
        });
        requestStop("live-video-track-ended");
      };
    }

    const helperVideoTrack =
      helperVideoStream.current?.getVideoTracks?.()[0] || null;
    if (helperVideoTrack) {
      helperVideoTrack.onended = () => {
        if (isFinishing.current || !isRecording.current) return;
        const track = helperVideoStream.current?.getVideoTracks?.()[0] || null;
        // Log detailed diagnostics for debugging
        const diagnosticInfo = {
          reason: "helperVideoStream-video-track-ended",
          savedChunks: savedCount.current,
          lastTimecode: lastTimecode.current,
          recordingDuration: recordingStartTime.current
            ? Date.now() - recordingStartTime.current
            : null,
          trackLabel: track?.label || null,
          trackReadyState: track?.readyState || null,
        };
        console.warn(
          "[Recorder] helperVideoStream video track ended",
          diagnosticInfo,
        );
        chrome.runtime.sendMessage({
          type: "recording-error",
          error: "stream-ended",
          why: chrome.i18n.getMessage("videoTrackEndedToast"),
        }).catch(() => {});
        chrome.storage.local.set({
          recording: false,
          restarting: false,
          tabRecordedID: null,
          lastTrackEndEvent: diagnosticInfo,
        });
        requestStop("helper-video-track-ended");
      };
    }
  }

  async function warmUpStream(liveStream) {
    debug("warmUpStream() start", {
      hasVideo: liveStream.getVideoTracks().length,
      hasAudio: liveStream.getAudioTracks().length,
    });

    const videoTrack = liveStream.getVideoTracks()[0];
    const audioTrack = liveStream.getAudioTracks()[0];
    const VIDEO_TIMEOUT_MS = 4000;
    const AUDIO_TIMEOUT_MS = 2000;

    // Hard-timeout track read: without it, a dormant tab-capture stream (e.g.
    // after a prior pause/restart) hangs reader.read() forever, leaving the
    // recorder stuck on "Starting recording..." since MediaRecorder.start() never runs.
    const readWithTimeout = async (track, timeoutMs, kind, isValid) => {
      const startedAt = Date.now();
      let proc;
      let reader;
      try {
        proc = new MediaStreamTrackProcessor({ track });
        reader = proc.readable.getReader();
      } catch (err) {
        lifecycle("Recorder", "warmUp-processor-error", {
          kind,
          error: String(err),
          trackState: {
            readyState: track.readyState,
            muted: track.muted,
            enabled: track.enabled,
          },
        });
        return { ok: false, reason: "processor-error" };
      }
      let done = false;
      const timeout = new Promise((resolve) =>
        setTimeout(() => {
          if (done) return;
          done = true;
          try {
            reader.cancel().catch(() => {});
          } catch {}
          resolve({ ok: false, reason: "timeout" });
        }, timeoutMs),
      );
      const readLoop = (async () => {
        try {
          while (!done) {
            const { value, done: streamDone } = await reader.read();
            if (streamDone) {
              return { ok: false, reason: "stream-ended" };
            }
            if (value && isValid(value)) {
              done = true;
              try {
                value.close?.();
              } catch {}
              try {
                reader.releaseLock();
              } catch {}
              return { ok: true };
            }
            try {
              value?.close?.();
            } catch {}
          }
          return { ok: false, reason: "cancelled" };
        } catch (err) {
          return { ok: false, reason: "read-error", error: String(err) };
        }
      })();
      const result = await Promise.race([readLoop, timeout]);
      lifecycle("Recorder", "warmUp-track", {
        kind,
        ok: result.ok,
        reason: result.reason || null,
        durMs: Date.now() - startedAt,
        trackState: {
          readyState: track.readyState,
          muted: track.muted,
          enabled: track.enabled,
        },
      });
      return result;
    };

    const videoResult = await readWithTimeout(
      videoTrack,
      VIDEO_TIMEOUT_MS,
      "video",
      (frame) => frame.codedWidth > 0 && frame.codedHeight > 0,
    );

    let audioResult = { ok: true, skipped: true };
    if (audioTrack) {
      audioResult = await readWithTimeout(
        audioTrack,
        AUDIO_TIMEOUT_MS,
        "audio",
        (a) => a.numberOfFrames > 0,
      );
    }

    if (!videoResult.ok || !audioResult.ok) {
      // Don't block startup: MediaRecorder.start may still wake the stream;
      // otherwise the first-chunk watchdog surfaces a clear error.
      lifecycle("Recorder", "warmUp-degraded-proceeding", {
        videoOk: videoResult.ok,
        audioOk: audioResult.ok,
        videoReason: videoResult.reason || null,
        audioReason: audioResult.reason || null,
      });
    }
    debug("warmUpStream() done", {
      videoOk: videoResult.ok,
      audioOk: audioResult.ok,
    });
  }

  function beginPrewarm(liveStream) {
    endPrewarm();
    prewarmRef.current = startPrewarm(liveStream);
    preloadWebCodecsModules();
    // Kick off the IDB clear in the background so startRecording's await
    // resolves immediately. Safe to re-run if it doesn't actually fire.
    if (!prewarmChunksClearRef.current) {
      prewarmChunksClearRef.current = chunksStore.clear().catch(() => {});
    }
    // Pre-open the OPFS writer in parallel. Default-on path: WebCodecs +
    // OPFS. If startRecording's preflight ends up wanting IDB instead, the
    // pre-opened writer is aborted and a fresh chooseWriter runs.
    if (!prewarmedWriterRef.current) {
      const recordingId = `${Date.now()}-${Math.random()
        .toString(16)
        .slice(2, 8)}`;
      prewarmedWriterRef.current = (async () => {
        try {
          const selection = await chooseWriter({ preferOpfs: true });
          const openResult = await selection.writer.open(recordingId);
          return { selection, openResult, recordingId };
        } catch {
          return null;
        }
      })();
    }
  }

  async function endPrewarm({ keepClear = false, keepWriter = false } = {}) {
    const ctrl = prewarmRef.current;
    prewarmRef.current = null;
    if (!keepClear) {
      prewarmChunksClearRef.current = null;
    }
    if (!keepWriter) {
      const writerPromise = prewarmedWriterRef.current;
      prewarmedWriterRef.current = null;
      if (writerPromise) {
        writerPromise
          .then((pw) => {
            if (pw?.selection?.writer?.abort) {
              return pw.selection.writer.abort().catch(() => {});
            }
          })
          .catch(() => {});
      }
    }
    await stopPrewarm(ctrl);
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
      const { fastRecorderActiveRecordingId } = await chrome.storage.local.get([
        "fastRecorderActiveRecordingId",
      ]);
      if (!fastRecorderActiveRecordingId) return;
      const key = `freeFinalizeStatus:${fastRecorderActiveRecordingId}`;
      const existing = await chrome.storage.local.get([key]);
      const current = existing[key];
      if (
        current &&
        (current.stage === "ready" || current.stage === "chunks_ready") &&
        (stage === "stopping" || stage === "finalizing")
      ) {
        return;
      }
      debugRecordingEvent(recdbgSessionRef, "free-finalize-status", {
        recordingId: fastRecorderActiveRecordingId,
        stage,
        percent,
        error: error || undefined,
      });
      await chrome.storage.local.set({
        [key]: {
          recordingId: fastRecorderActiveRecordingId,
          stage,
          percent,
          updatedAt: Date.now(),
          error: error || undefined,
        },
      });
    } catch {}
  };

  async function stopRecording() {
    if (isFinishing.current) {
      debugWarn("stopRecording() called while already finishing");
      return;
    }
    perfMark("Recorder stopRecording.enter", {
      recorderType: useWebCodecs.current ? "webcodecs" : "mediarecorder",
      savedCount: savedCount.current,
    });
    debug("stopRecording()");
    // Stop preempts any pending start gate.
    resetGateState();
    isFinishing.current = true;
    isRecording.current = false;
    await updateFreeFinalizeStatus("stopping", 0);

    stopSessionHeartbeat();
    stopRecordingTick();
    persistSessionState("stopping");
    await setRecordingTimingState({
      recording: false,
      paused: false,
      recordingStartTime: null,
      pausedAt: null,
      totalPausedMs: 0,
    });
    pausedStateRef.current = false;

    try {
      if (
        useWebCodecs.current &&
        recorder.current instanceof WebCodecsRecorder
      ) {
        debug("Stopping WebCodecsRecorder");
        await updateFreeFinalizeStatus("finalizing", 20);
        await recorder.current.stop();
      } else if (recorder.current instanceof MediaRecorder) {
        debug("Stopping MediaRecorder");
        await updateFreeFinalizeStatus("finalizing", 20);
        try {
          recorder.current.requestData();
        } catch {}
        if (recorder.current.state !== "inactive") {
          perfMark("Recorder mediarecorder.stop()-called");
          recorder.current.stop();
        }
        // Watchdog: if onstop never fires (Chrome bug, stream crash, encoder
        // teardown race), recorder hangs in finalize forever; force-finalize at 15s.
        setTimeout(() => {
          if (sentLast.current) return;
          debugWarn("MediaRecorder.onstop watchdog: forcing finalize");
          sentLast.current = true;
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
      }
    } catch (err) {
      debugError("stopRecording() error while stopping recorder", err);
    }

    await waitForDrain();
    if (!useWebCodecs.current) {
      await updateFreeFinalizeStatus("chunks_ready", 100);
    }
    recorder.current = null;

    stopTabKeepAlive();

    persistSessionState("completed");

    if (!isRestarting.current) {
      debug("Stopping tracks and clearing streams");
      slLog("helperVideoStream-nulling", { path: "stopRecording" });
      endPrewarm();
      liveStream.current?.getTracks().forEach((t) => t.stop());
      helperVideoStream.current?.getTracks().forEach((t) => t.stop());
      helperAudioStream.current?.getTracks().forEach((t) => t.stop());

      liveStream.current = null;
      helperVideoStream.current = null;
      helperAudioStream.current = null;
    }
    // Detach devicechange + silence watchdog: otherwise they keep firing for
    // subsequent recordings in the same tab with stale state.
    if (deviceChangeListenerRef.current) {
      try {
        navigator.mediaDevices.removeEventListener(
          "devicechange",
          deviceChangeListenerRef.current,
        );
      } catch {}
      deviceChangeListenerRef.current = null;
    }
    if (silenceWatchdogRef.current) {
      try {
        clearInterval(silenceWatchdogRef.current.intervalId);
        silenceWatchdogRef.current.analyser?.disconnect?.();
      } catch {}
      silenceWatchdogRef.current = null;
    }
    if (!useWebCodecs.current) {
      await updateFreeFinalizeStatus("ready", 100);
    }
  }

  const dismissRecording = async () => {
    debug("dismissRecording()");
    resetGateState();
    uiClosing.current = true;
    isRecording.current = false;
    recordingGeneration.current += 1;

    // Late ondataavailable could re-arm lastChunkAt after watchdog reset; detach.
    if (recorder.current instanceof MediaRecorder) {
      try {
        recorder.current.ondataavailable = null;
        recorder.current.onstop = null;
        recorder.current.onerror = null;
      } catch {}
    }

    if (chunkWriter.current) {
      try {
        await chunkWriter.current.abort();
      } catch {}
      chunkWriter.current = null;
      chunkWriterBackend.current = null;
    }

    stopTabKeepAlive();
    stopSessionHeartbeat();
    persistSessionState("dismissed");
    await setRecordingTimingState({
      recording: false,
      paused: false,
      recordingStartTime: null,
      pausedAt: null,
      totalPausedMs: 0,
    });
    pausedStateRef.current = false;

    window.close();
  };

  const restartRecording = async () => {
    if (isRestarting.current) {
      debugWarn("restartRecording() called while already restarting");
      return false;
    }

    debug("restartRecording()");
    recordingGeneration.current += 1;

    resetGateState();

    isRestarting.current = true;
    isRecording.current = false;
    sentLast.current = false;
    isFinishing.current = false;
    stopSignalSent.current = false;
    pausedStateRef.current = false;

    try {
      if (
        useWebCodecs.current &&
        recorder.current instanceof WebCodecsRecorder
      ) {
        debug("Cleaning up WebCodecsRecorder for restart");
        recorder.current.running = false;
        recorder.current.paused = false;
        await recorder.current.cleanup();
      } else if (recorder.current instanceof MediaRecorder) {
        debug("Stopping MediaRecorder for restart");
        const mediaRecorder = recorder.current;
        mediaRecorder.ondataavailable = null;
        mediaRecorder.onstop = null;
        mediaRecorder.onerror = null;
        try {
          mediaRecorder.requestData();
        } catch {}
        if (mediaRecorder.state !== "inactive") {
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
              mediaRecorder.addEventListener("stop", finish, { once: true });
            } catch {}
            try {
              mediaRecorder.stop();
            } catch {
              finish();
            }
          });
        }
      }
    } catch (err) {
      debugError("Error while restarting recorder", err);
      isRestarting.current = false;
      return false;
    }

    recorder.current = null;

    pending.current = [];
    pendingBytes.current = 0;
    draining.current = false;
    hasChunks.current = false;
    savedCount.current = 0;
    lastSize.current = 0;
    lastTimecode.current = 0;
    await chunksStore.clear();
    await setRecordingTimingState({
      recording: false,
      paused: false,
      recordingStartTime: null,
      pausedAt: null,
      totalPausedMs: 0,
    });

    useWebCodecs.current = false;

    isRestarting.current = false;
    debug("restartRecording() done, ready to start again");
    slLog("restart-done", {
      hasStream: !!helperVideoStream.current,
      hasPendingStart: pendingStartAfterRestart.current,
    });
    if (pendingStartAfterRestart.current) {
      pendingStartAfterRestart.current = false;
      debug("Processing queued start after restart");
      requestStart();
    }
    return true;
  };

  async function startAudioStream(id) {
    debug("startAudioStream()", { id });
    // "none" sentinel: bail before getUserMedia would otherwise grab the default mic.
    if (!id || id === "none") {
      debug("startAudioStream() skipped: no audio input selected");
      return null;
    }
    const useExact = true;
    const audioStreamOptions = {
      mimeType: "video/webm;codecs=vp8,opus",
      audio: {
        deviceId: {
          exact: id,
        },
      },
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
        debug("startAudioStream() got stream with exact device", {
          hasAudio: stream.getAudioTracks().length,
        });
        return stream;
      })
      .catch((err) => {
        debugWarn(
          "startAudioStream() exact device failed, retrying generic",
          err,
        );
        const audioStreamOptions = {
          mimeType: "video/webm;codecs=vp8,opus",
          audio: true,
        };

        return navigator.mediaDevices
          .getUserMedia(audioStreamOptions)
          .then((stream) => {
            debug("startAudioStream() got generic stream", {
              hasAudio: stream.getAudioTracks().length,
            });
            return stream;
          })
          .catch((err2) => {
            debugError("startAudioStream() failed completely", err2);
            return null;
          });
      });

    return result;
  }

  function setAudioInputVolume(volume) {
    if (!audioInputGain.current) {
      debugWarn("setAudioInputVolume() called but audioInputGain is null");
      return;
    }
    debug("setAudioInputVolume()", volume);
    audioInputGain.current.gain.value = volume;
  }

  function setAudioOutputVolume(volume) {
    if (!audioOutputGain.current) {
      debugWarn("setAudioOutputVolume() called but audioOutputGain is null");
      return;
    }
    debug("setAudioOutputVolume()", volume);
    audioOutputGain.current.gain.value = volume;
  }

  const setMic = async (result) => {
    debug("setMic()", result);
    if (helperAudioStream.current != null) {
      if (result.active) {
        setAudioInputVolume(1);
      } else {
        setAudioInputVolume(0);
      }
    }
  };

  async function startStream(data, id, options, permissions, permissions2) {
    perfMark("Recorder startStream.enter", {
      recordingType: data?.recordingType,
      hasId: Boolean(id),
      isTab: Boolean(isTab.current),
    });
    slLog("startStream-enter", {
      recordingType: data.recordingType,
      hasId: !!id,
      isTab: isTab.current,
    });
    debug("startStream()", {
      recordingType: data.recordingType,
      id,
      isTab: isTab.current,
      options,
      permissions: permissions?.state,
      micPermissions: permissions2?.state,
    });

    const { qualityValue } = await chrome.storage.local.get(["qualityValue"]);
    const { isPro, maxQuality, maxFps } = await getFreeCaptureCaps();
    const effectiveQualityValue = isPro
      ? qualityValue
      : clampQualityValue(qualityValue, maxQuality);
    const { width, height } = getResolutionForQuality(effectiveQualityValue);

    const { fpsValue } = await chrome.storage.local.get(["fpsValue"]);
    let fps = parseInt(fpsValue);

    if (isNaN(fps)) {
      fps = 30;
    }
    if (!isPro) {
      fps = Math.min(fps, maxFps);
    }

    let userConstraints = {
      audio: {
        deviceId: data.defaultAudioInput,
      },
      video: {
        deviceId: data.defaultVideoInput,
        width: {
          ideal: width,
        },
        height: {
          ideal: height,
        },
        frameRate: {
          ideal: fps,
        },
      },
    };
    if (!isPro && userConstraints.video) {
      userConstraints.video = {
        ...userConstraints.video,
        width: {
          ideal: width,
          max: width,
        },
        height: {
          ideal: height,
          max: height,
        },
      };
    }
    if (permissions.state === "denied") {
      userConstraints.video = false;
    }
    if (permissions2.state === "denied") {
      userConstraints.audio = false;
    }

    debug("User media constraints", {
      userConstraints,
      qualityValue: effectiveQualityValue,
      fps,
    });

    // Mic acquisition runs in parallel: startAudioStream() ~400ms; await later.
    const endMicPar = perfSpan("Recorder startAudioStream(mic).parallel", {
      hasDevice: Boolean(data?.defaultAudioInput && data.defaultAudioInput !== "none"),
    });
    const micPromise =
      permissions2?.state === "denied"
        ? Promise.resolve(null)
        : startAudioStream(data.defaultAudioInput).catch((err) => {
            debugWarn("startAudioStream parallel kickoff failed", err);
            return null;
          });

    let userStream;
    if (
      permissions.state != "denied" &&
      permissions2.state != "denied" &&
      data.recordingType === "camera"
    ) {
      debug("Requesting camera userStream");
      const {
        defaultAudioInputLabel,
        defaultVideoInputLabel,
        audioinput,
        videoinput,
      } = await chrome.storage.local.get([
        "defaultAudioInputLabel",
        "defaultVideoInputLabel",
        "audioinput",
        "videoinput",
      ]);
      const desiredAudioLabel =
        defaultAudioInputLabel ||
        audioinput?.find((device) => device.deviceId === data.defaultAudioInput)
          ?.label ||
        "";
      const desiredVideoLabel =
        defaultVideoInputLabel ||
        videoinput?.find((device) => device.deviceId === data.defaultVideoInput)
          ?.label ||
        "";

      const hasAudioDevice =
        data.defaultAudioInput && data.defaultAudioInput !== "none";
      const hasVideoDevice =
        data.defaultVideoInput && data.defaultVideoInput !== "none";
      const cameraConstraints = {
        ...userConstraints,
        // Drop audio entirely when "none"/missing; otherwise getUserMedia falls
        // back to system default and injects audio into every camera-only recording.
        audio: hasAudioDevice
          ? userConstraints.audio
            ? {
                ...userConstraints.audio,
                deviceId: { exact: data.defaultAudioInput },
              }
            : userConstraints.audio
          : false,
        video:
          userConstraints.video && hasVideoDevice
            ? {
                ...userConstraints.video,
                deviceId: { exact: data.defaultVideoInput },
              }
            : userConstraints.video,
      };

      userStream = await getUserMediaWithFallback({
        constraints: cameraConstraints,
        fallbacks: [
          hasVideoDevice && desiredVideoLabel
            ? {
                kind: "videoinput",
                desiredDeviceId: data.defaultVideoInput,
                desiredLabel: desiredVideoLabel,
                onResolved: (resolvedId) => {
                  chrome.storage.local.set({
                    defaultVideoInput: resolvedId,
                    defaultVideoInputLabel: desiredVideoLabel,
                  });
                },
              }
            : null,
          hasAudioDevice && desiredAudioLabel
            ? {
                kind: "audioinput",
                desiredDeviceId: data.defaultAudioInput,
                desiredLabel: desiredAudioLabel,
                onResolved: (resolvedId) => {
                  chrome.storage.local.set({
                    defaultAudioInput: resolvedId,
                    defaultAudioInputLabel: desiredAudioLabel,
                  });
                },
              }
            : null,
        ].filter(Boolean),
      });
      debug("Camera userStream acquired", {
        videoTracks: userStream.getVideoTracks().length,
        audioTracks: userStream.getAudioTracks().length,
      });
    }

    if (data.recordingType === "camera") {
      if (!userStream || typeof userStream.getVideoTracks !== "function") {
        debugWarn("Camera stream unavailable");
        resetGateState();
        sendRecordingError("Camera stream unavailable");
        return;
      }
      if (!userStream.getVideoTracks().length) {
        debugWarn("Camera stream has no video track");
        resetGateState();
        sendRecordingError("Camera stream has no video track");
        return;
      }
      helperVideoStream.current = userStream;
      slLog("helperVideoStream-assigned", { path: "camera", streamId: userStream.id });
    } else {
      // Chrome's tab capture defaults to a 1920x1080 frame and pillarboxes
      // narrower tabs to fit. Match the constraint box to the tab's real
      // aspect ratio so the captured frame has no padding. Desktop capture
      // is left unconstrained (the OS reports its own size).
      let videoMaxW = null;
      let videoMaxH = null;
      if (isTab.current) {
        const viewport = await getRecordedTabViewport(recordedTabId.current);
        if (viewport) {
          const tabW = viewport.width;
          const tabH = viewport.height;
          // Cap to the user's quality limits (width x height) while
          // preserving the tab's aspect ratio. Chrome won't upscale, so for
          // tabs smaller than the cap the request resolves to native size.
          const fitScale = Math.min(width / tabW, height / tabH, 1);
          videoMaxW = Math.max(2, Math.round(tabW * fitScale));
          videoMaxH = Math.max(2, Math.round(tabH * fitScale));
          if (videoMaxW % 2) videoMaxW -= 1;
          if (videoMaxH % 2) videoMaxH -= 1;
          debug("Tab viewport-aware constraints", {
            tabW,
            tabH,
            capW: width,
            capH: height,
            videoMaxW,
            videoMaxH,
          });
        } else {
          debug("Tab viewport unknown; falling back to no-dim constraints");
        }
      }

      const videoMandatory = {
        chromeMediaSource: isTab.current ? "tab" : "desktop",
        chromeMediaSourceId: id,
        maxFrameRate: fps,
      };
      if (videoMaxW && videoMaxH) {
        videoMandatory.maxWidth = videoMaxW;
        videoMandatory.maxHeight = videoMaxH;
        videoMandatory.minWidth = videoMaxW;
        videoMandatory.minHeight = videoMaxH;
      }

      const constraints = {
        audio: {
          mandatory: {
            chromeMediaSource: isTab.current ? "tab" : "desktop",
            chromeMediaSourceId: id,
          },
        },
        video: {
          mandatory: videoMandatory,
        },
      };

      debug("desktopCapture getUserMedia constraints", constraints);
      slLog("getUserMedia-start", { isTab: isTab.current });

      let stream;

      const endGum = perfSpan("Recorder getUserMedia(desktop/tab)", {
        isTab: Boolean(isTab.current),
      });
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        endGum({
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
        });

        if (stream.getVideoTracks().length === 0) {
          debugError("No video tracks returned from getUserMedia");
          resetGateState();
          sendRecordingError("No video tracks available");
          return;
        }
      } catch (err) {
        endGum({ error: String(err?.message || err).slice(0, 80) });
        debugError("Failed to get user media for desktop/tab capture", err);
        resetGateState();
        sendRecordingError("Failed to get user media: " + String(err));
        return;
      }

      debug("desktop/tab stream acquired", {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
      });
      slLog("getUserMedia-resolved", {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        streamId: stream.id,
        trackState: stream.getVideoTracks()[0]?.readyState,
      });

      if (isTab.current) {
        const output = new AudioContext();
        const source = output.createMediaStreamSource(stream);
        source.connect(output.destination);
        debug("Created playback AudioContext for tab preview");
      }

      helperVideoStream.current = stream;
      slLog("helperVideoStream-assigned", { path: "desktop/tab", streamId: stream.id });

      const surface = stream.getVideoTracks()[0].getSettings().displaySurface;
      debug("Display surface", surface);
      chrome.runtime.sendMessage({ type: "set-surface", surface: surface });
    }

    perfMark("Recorder pre-audio-setup");
    aCtx.current = new AudioContext();
    destination.current = aCtx.current.createMediaStreamDestination();
    liveStream.current = new MediaStream();
    let mixedAudioConnected = false;

    // Mic was kicked off in parallel above (micPromise); just await it now.
    const endMicJoin = perfSpan("Recorder startAudioStream(mic).join");
    const micstream = await micPromise;
    endMicJoin({ hasMic: Boolean(micstream) });
    endMicPar({ hasMic: Boolean(micstream) });
    helperAudioStream.current = micstream;

    if (helperAudioStream.current != null && !data.micActive) {
      setAudioInputVolume(0);
    }

    // chrome `tab` mediaSource always returns an audio track when available;
    // gate mixing on `data.systemAudio`.
    const sysTracks = helperVideoStream.current.getAudioTracks();
    debug("System/tab audio tracks", sysTracks.length, "systemAudio:", data.systemAudio);
    if (sysTracks.length > 0 && data.systemAudio) {
      const sysTrack = sysTracks[0];
      const sysSource = aCtx.current.createMediaStreamSource(
        new MediaStream([sysTrack]),
      );
      audioOutputGain.current = aCtx.current.createGain();
      sysSource.connect(audioOutputGain.current).connect(destination.current);
      mixedAudioConnected = true;
      // Symmetric with mic onended: detect dead system/tab audio mid-recording
      // (closed tab, OS mute, BT disconnect) instead of silently capturing dead audio.
      sysTrack.onended = () => {
        if (isFinishing.current || !isRecording.current) return;
        const info = {
          reason: "system-audio-track-ended",
          trackLabel: String(sysTrack.label || "").slice(0, 80),
          savedChunks: savedCount.current,
        };
        console.warn("[Recorder] System audio track ended", info);
        try {
          chrome.runtime.sendMessage({
            type: "diag-forward",
            event: "recorder-system-audio-track-ended",
            data: info,
          });
        } catch {}
        chrome.storage.local.set({ lastTrackEndEvent: info });
        // Don't kill recording: video/mic may still be capturing.
        chrome.runtime.sendMessage({
          type: "show-toast",
          message: chrome.i18n.getMessage("audioTrackEndedToast"),
          timeout: 8000,
        }).catch(() => {});
      };
      sysTrack.onmute = () => {
        if (isFinishing.current || !isRecording.current) return;
        try {
          chrome.runtime.sendMessage({
            type: "diag-forward",
            event: "recorder-system-audio-track-muted",
            data: { trackLabel: String(sysTrack.label || "").slice(0, 80) },
          });
        } catch {}
      };
    } else if (sysTracks.length > 0) {
      // Stop unused tab-audio so the captured-audio indicator doesn't show.
      try {
        sysTracks[0].stop();
      } catch {}
    }

    const micTracks = helperAudioStream.current?.getAudioTracks() ?? [];
    debug("Mic audio tracks", micTracks.length);
    if (micTracks.length > 0) {
      const micSource = aCtx.current.createMediaStreamSource(
        new MediaStream([micTracks[0]]),
      );
      audioInputGain.current = aCtx.current.createGain();
      micSource.connect(audioInputGain.current).connect(destination.current);
      mixedAudioConnected = true;
      // Gate via gain so the user can toggle the mic mid-recording without re-acquiring it.
      if (!data.micActive) {
        audioInputGain.current.gain.value = 0;
      }
    }

    const helperVideoTrack = helperVideoStream.current.getVideoTracks()[0];
    if (!helperVideoTrack) {
      resetGateState();
      sendRecordingError("Display stream missing video track");
      return;
    }
    liveStream.current.addTrack(helperVideoTrack);

    const mainVideoTrack = liveStream.current?.getVideoTracks()[0];
    if (mainVideoTrack) {
      mainVideoTrack.onmute = () => {
        debugWarn("mainVideoTrack muted");
      };
      mainVideoTrack.oninactive = () => {
        if (isFinishing.current || !isRecording.current) return;
        debugWarn("mainVideoTrack inactive → stopping recording");
        requestStop("main-video-track-inactive");
        stopRecording();
      };
    }
    // Only attach a mixed track if at least one source (mic or sys/tab audio)
    // was connected; otherwise we'd append a silent AAC track to every recording.
    if (mixedAudioConnected) {
      const mixedAudioTrack = destination.current.stream.getAudioTracks()[0];
      if (mixedAudioTrack) {
        liveStream.current.addTrack(mixedAudioTrack);
      }
      // Silence watchdog: analyser tap detects sustained zero-energy audio
      // (perm revoke, BT cutout, OS mute). Sample 5s, fire after 30s silence.
      try {
        const analyser = aCtx.current.createAnalyser();
        analyser.fftSize = 1024;
        const buf = new Uint8Array(analyser.frequencyBinCount);
        // Parallel tap: analyser doesn't connect back, so the output graph is unaffected.
        destination.current.stream
          .getAudioTracks()
          .forEach((t) => {
            try {
              const tapSource = aCtx.current.createMediaStreamSource(
                new MediaStream([t]),
              );
              tapSource.connect(analyser);
            } catch {}
          });
        let silentSamples = 0;
        let alreadyReported = false;
        const SILENCE_THRESHOLD = 2;
        const SAMPLES_BEFORE_ALERT = 6;
        const intervalId = setInterval(() => {
          if (!isRecording.current || isFinishing.current) return;
          analyser.getByteTimeDomainData(buf);
          // Byte amplitude 0-255; 128 is silence center, deviation = energy.
          let maxDev = 0;
          for (let i = 0; i < buf.length; i += 1) {
            const dev = Math.abs(buf[i] - 128);
            if (dev > maxDev) maxDev = dev;
          }
          if (maxDev < SILENCE_THRESHOLD) {
            silentSamples += 1;
            if (silentSamples >= SAMPLES_BEFORE_ALERT && !alreadyReported) {
              alreadyReported = true;
              try {
                chrome.runtime.sendMessage({
                  type: "diag-forward",
                  event: "recorder-audio-silent-30s",
                  data: {
                    elapsedRecordingMs: recordingStartTime.current
                      ? Date.now() - recordingStartTime.current
                      : null,
                    hasMic: !!helperAudioStream.current?.getAudioTracks?.()
                      ?.length,
                    hasSystemAudio:
                      sysTracks.length > 0 && data.systemAudio,
                  },
                });
              } catch {}
              // Surface but don't stop: silence may be intentional.
              try {
                chrome.runtime.sendMessage({
                  type: "show-toast",
                  message: chrome.i18n.getMessage("audioSilentToast"),
                  timeout: 8000,
                }).catch(() => {});
              } catch {}
            }
          } else {
            silentSamples = 0;
            if (alreadyReported) {
              alreadyReported = false;
              try {
                chrome.runtime.sendMessage({
                  type: "diag-forward",
                  event: "recorder-audio-recovered",
                });
              } catch {}
            }
          }
        }, 5000);
        silenceWatchdogRef.current = { intervalId, analyser };
      } catch (err) {
        console.warn("[Recorder] silence watchdog setup failed", err);
      }
    }

    debug("liveStream ready", {
      videoTracks: liveStream.current.getVideoTracks().length,
      audioTracks: liveStream.current.getAudioTracks().length,
    });

    setStarted(true);
    streamReadyAt.current = Date.now();
    perfMark("Recorder stream-ready");
    slLog("stream-ready", {
      streamId: helperVideoStream.current?.id,
      videoTracks: helperVideoStream.current?.getVideoTracks().length,
      trackState: helperVideoStream.current?.getVideoTracks()[0]?.readyState,
      startRequested: startRequested.current,
    });

    const endWarmUp = perfSpan("Recorder warmUpStream");
    await warmUpStream(liveStream.current);
    endWarmUp();

    beginPrewarm(liveStream.current);

    slLog("warmUp-done");
    perfMark("Recorder reset-active-tab.sent");
    chrome.runtime.sendMessage({ type: "reset-active-tab" });
    slLog("reset-active-tab-sent");

    tryStartIfReady();
  }

  async function startStreaming(data) {
    perfMark("Recorder startStreaming.enter");
    startTabKeepAlive();

    if (document.visibilityState === "hidden") {
      debugWarn("Tab is hidden at recording start, requesting activation");
      const endActivate = perfSpan("Recorder activate-recorder-tab");
      try {
        await chrome.runtime.sendMessage({ type: "activate-recorder-tab" });
      } catch {}
      endActivate();
    }

    debug("startStreaming()", { data });
    slLog("startStreaming-enter", { recordingType: data?.recordingType });
    const endPerms = perfSpan("Recorder permissions.query");
    const permissions = await navigator.permissions.query({
      name: "camera",
    });
    const permissions2 = await navigator.permissions.query({
      name: "microphone",
    });
    endPerms();

    debug("Permissions", {
      camera: permissions.state,
      microphone: permissions2.state,
    });

    try {
      if (data.recordingType === "camera") {
        debug("Streaming camera recording");
        startStream(data, null, null, permissions, permissions2);
      } else if (!isTab.current) {
        let captureTypes = ["screen", "window", "tab", "audio"];
        if (tabPreferred.current) {
          captureTypes = ["tab", "screen", "window", "audio"];
        }
        debug("desktopCapture.chooseDesktopMedia", {
          captureTypes,
          tabPreferred: tabPreferred.current,
          host: IS_OFFSCREEN_HOST ? "offscreen" : "tab",
        });
        slLog("chooseDesktopMedia-show");
        if (IS_OFFSCREEN_HOST) {
          const response = await chrome.runtime
            .sendMessage({
              type: "offscreen-request-stream",
              mode: "screen",
              // "tab" excluded - offscreen can't consume tab-scoped streamIds as desktop sources.
              sources: captureTypes.filter((t) => t !== "tab"),
            })
            .catch((err) => ({ ok: false, error: String(err) }));
          slLog("chooseDesktopMedia-picked", {
            hasStreamId: !!response?.streamId,
            via: "sw",
          });
          if (!response?.ok || !response.streamId) {
            const cancelled =
              response?.source === "cancelled" || !response?.streamId;
            debugWarn(
              cancelled
                ? "User cancelled the desktop capture modal"
                : `Stream acquisition failed: ${response?.error || "unknown"}`
            );
            resetGateState();
            sendRecordingError(
              cancelled
                ? "User cancelled the modal"
                : response?.error || "Stream acquisition failed",
              cancelled
            );
            return;
          }
          startStream(
            data,
            response.streamId,
            { canRequestAudioTrack: response.canRequestAudioTrack },
            permissions,
            permissions2
          );
        } else {
          chrome.desktopCapture.chooseDesktopMedia(
            captureTypes,
            null,
            (streamId, options) => {
              slLog("chooseDesktopMedia-picked", { hasStreamId: !!streamId });
              debug("chooseDesktopMedia callback", { streamId, options });
              if (
                streamId === undefined ||
                streamId === null ||
                streamId === ""
              ) {
                debugWarn("User cancelled the desktop capture modal");
                resetGateState();
                sendRecordingError("User cancelled the modal", true);
                return;
              } else {
                startStream(data, streamId, options, permissions, permissions2);
              }
            },
          );
        }
      } else {
        perfMark("Recorder path.tab-precapture");
        const tabStreamId = await waitForTabStreamId();
        debug("Streaming with pre-resolved tabID", tabStreamId);
        if (!tabStreamId) {
          resetGateState();
          sendRecordingError("Unable to resolve tab stream id", true);
          return;
        }
        startStream(data, tabStreamId, null, permissions, permissions2);
      }
    } catch (err) {
      debugError("startStreaming() error", err);
      resetGateState();
      sendRecordingError("Failed to start streaming: " + String(err), true);
    }
  }

  useEffect(() => {
    chrome.storage.local.get(["tabPreferred"], (result) => {
      tabPreferred.current = result.tabPreferred;
      debug("Loaded tabPreferred", tabPreferred.current);
    });
  }, []);

  const getStreamID = async (id) => {
    perfMark("Recorder getStreamID.enter", { tabId: id });
    debug("getStreamID()", id);
    let streamId;
    if (IS_OFFSCREEN_HOST) {
      // chrome.tabCapture isn't callable from offscreen; delegate to SW.
      const endOff = perfSpan("Recorder offscreen-request-stream(tab)");
      const response = await chrome.runtime
        .sendMessage({
          type: "offscreen-request-stream",
          mode: "tab",
          targetTabId: id,
        })
        .catch((err) => ({ ok: false, error: String(err) }));
      endOff({ ok: Boolean(response?.ok) });
      if (!response?.ok || !response.streamId) {
        debug("Offscreen tab stream acquisition failed", response);
        return;
      }
      streamId = response.streamId;
    } else {
      const endTc = perfSpan("Recorder tabCapture.getMediaStreamId");
      streamId = await chrome.tabCapture.getMediaStreamId({
        targetTabId: id,
      });
      endTc({ hasStreamId: Boolean(streamId) });
    }
    debug("Resolved tabCapture streamId", streamId);
    tabID.current = streamId;
    perfMark("Recorder getStreamID.done");
  };

  // chromeMediaSource constraints have no "no padding" knob: any combo
  // (including no width/height) still produces the 1920x1080 padded box.
  // Only maxWidth/maxHeight matching the source aspect ratio yields a clean
  // native-aspect frame. Read the viewport in CSS pixels x DPR to size them.
  const getRecordedTabViewport = async (tabId) => {
    if (!tabId) return null;
    try {
      if (IS_OFFSCREEN_HOST) {
        const response = await chrome.runtime
          .sendMessage({
            type: "get-tab-viewport",
            tabId,
          })
          .catch(() => null);
        if (response?.ok && response.width > 0 && response.height > 0) {
          return { width: response.width, height: response.height };
        }
        return null;
      }
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({
          w: Math.round(window.innerWidth * (window.devicePixelRatio || 1)),
          h: Math.round(window.innerHeight * (window.devicePixelRatio || 1)),
        }),
      });
      const r = results?.[0]?.result;
      if (r && r.w > 0 && r.h > 0) return { width: r.w, height: r.h };
      return null;
    } catch (err) {
      debugWarn("getRecordedTabViewport failed", err);
      return null;
    }
  };

  const waitForTabStreamId = async () => {
    if (tabID.current) return tabID.current;
    const endWait = perfSpan("Recorder waitForTabStreamId");
    let attempts = 0;
    for (let i = 0; i < 30; i += 1) {
      attempts = i + 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (tabID.current) {
        endWait({ attempts, hasId: true });
        return tabID.current;
      }
    }
    endWait({ attempts, hasId: false });
    return null;
  };

  useEffect(() => {
    return () => {
      debug("Component unmounting - cleaning up");
      slLog("component-unmount", {
        hadStream: !!helperVideoStream.current,
        started,
        startRequested: startRequested.current,
      });
      resetGateState();
      stopTabKeepAlive();
      stopSessionHeartbeat();
    };
  }, []);

  useEffect(() => {
    const handleClose = (e) => {
      debug("beforeunload event", {
        uiClosing: uiClosing.current,
        isRecording: isRecording.current,
      });
      if (uiClosing.current || !isRecording.current) return;

      // beforeunload can't await async; keep-alive + session state aid recovery.
      stopRecording();

      e.preventDefault();
      e.returnValue = "";
    };

    if (IS_OFFSCREEN_HOST) return undefined;

    window.addEventListener("beforeunload", handleClose);
    return () => {
      debug("Removing beforeunload handler");
      window.removeEventListener("beforeunload", handleClose);
    };
  }, []);

  // Registered once on mount; refs keep the closure fresh.
  const onMessageRef = useRef(null);
  onMessageRef.current = (request, sender, sendResponse) => {
    if (DEBUG_RECORDER) {
      debug("onMessage()", request.type, { request, sender });
    }

    if (request.type === "loaded") {
      perfMark("Recorder loaded.received", { isTab: Boolean(request?.isTab) });
      slLog("msg-loaded");
      backupRef.current = request.backup;
      if (!tabPreferred.current) {
        isTab.current = request.isTab;
        if (request.isTab) {
          recordedTabId.current = request.tabID ?? null;
          getStreamID(request.tabID);
        }
      } else {
        isTab.current = false;
        recordedTabId.current = null;
      }
      requestStreamingDataWithRetry();
    } else if (request.type === "streaming-data") {
      // Streaming-data may arrive twice (SW push + tab pull, or retries).
      if (streamingDataReceivedAt.current != null) {
        slLog("msg-streaming-data-duplicate");
        return;
      }
      slLog("msg-streaming-data");
      perfMark("Recorder streaming-data.received");
      streamingDataReceivedAt.current = Date.now();
      startStreaming(JSON.parse(request.data));
    } else if (request.type === "start-recording-tab") {
      slLog("msg-start-recording-tab", {
        hasStream: !!helperVideoStream.current,
        streamReady: getStreamReadiness(),
        isRestarting: isRestarting.current,
        docHidden: document.hidden,
        docVisibility: document.visibilityState,
      });
      requestStart();
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
          isRecording: Boolean(isRecording.current),
          isRestarting: Boolean(isRestarting.current),
          isFinishing: Boolean(isFinishing.current),
          hasStream: Boolean(helperVideoStream.current),
          docHidden: document.hidden,
        };
      };
      const stateAtEntry = recState();
      lifecycle("Recorder", "restart-tab-received", stateAtEntry);

      if (isRestarting.current) {
        lifecycle("Recorder", "restart-tab-result", {
          ...stateAtEntry,
          ok: false,
          error: "restart-in-progress",
        });
        sendResponse?.({
          ok: false,
          error: "restart-in-progress",
          recorderState: stateAtEntry,
        });
        return true;
      }
      pendingStartAfterRestart.current = false;
      Promise.resolve(restartRecording())
        .then((restarted) => {
          const after = recState();
          if (!restarted) {
            lifecycle("Recorder", "restart-tab-result", {
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
          lifecycle("Recorder", "restart-tab-result", { ...after, ok: true });
          sendResponse?.({
            ok: true,
            restarted: true,
            recorderState: after,
          });
        })
        .catch((error) => {
          const reason = error?.message || String(error);
          lifecycle("Recorder", "restart-tab-result", {
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
      perfMark("Recorder stop-recording-tab.received");
      stopRecording();
      sendResponse?.({ ok: true });
      return true;
    } else if (request.type === "recorder-state-snapshot") {
      // First-chunk watchdog wants to know why no data arrived before killing.
      try {
        const r = recorder.current;
        const vt = liveStream.current?.getVideoTracks?.()[0] || null;
        const at = liveStream.current?.getAudioTracks?.()[0] || null;
        const helperVt = helperVideoStream.current?.getVideoTracks?.()[0] || null;
        sendResponse?.({
          ok: true,
          ts: Date.now(),
          recorder: r
            ? {
                type:
                  r instanceof MediaRecorder
                    ? "MediaRecorder"
                    : useWebCodecs.current
                      ? "WebCodecs"
                      : "other",
                state: r instanceof MediaRecorder ? r.state : null,
                mimeType: r instanceof MediaRecorder ? r.mimeType : null,
              }
            : null,
          flags: {
            isRecording: Boolean(isRecording.current),
            isRestarting: Boolean(isRestarting.current),
            isFinishing: Boolean(isFinishing.current),
            isStarting: Boolean(isStarting?.current),
            useWebCodecs: Boolean(useWebCodecs.current),
            paused: Boolean(pausedStateRef.current),
          },
          counts: {
            saved: savedCount.current,
            pending: pending.current?.length ?? 0,
            pendingBytes: pendingBytes.current ?? 0,
            hasChunks: Boolean(hasChunks.current),
          },
          stream: {
            hasLive: Boolean(liveStream.current),
            hasHelper: Boolean(helperVideoStream.current),
            liveVideoTracks:
              liveStream.current?.getVideoTracks?.()?.length ?? 0,
            liveAudioTracks:
              liveStream.current?.getAudioTracks?.()?.length ?? 0,
            videoTrack: vt
              ? {
                  readyState: vt.readyState,
                  muted: vt.muted,
                  enabled: vt.enabled,
                  label: vt.label || null,
                }
              : null,
            audioTrack: at
              ? { readyState: at.readyState, muted: at.muted, enabled: at.enabled }
              : null,
            helperVideoTrack: helperVt
              ? {
                  readyState: helperVt.readyState,
                  muted: helperVt.muted,
                  enabled: helperVt.enabled,
                }
              : null,
          },
          docHidden: document.hidden,
          docVisibility: document.visibilityState,
        });
      } catch (err) {
        sendResponse?.({ ok: false, error: String(err) });
      }
      return true;
    } else if (request.type === "recorder-keepalive-ping") {
      // BG watchdog liveness probe; without this it can't tell slow from dead.
      sendResponse?.({ ok: true, alive: true, ts: Date.now() });
      return true;
    } else if (request.type === "recorder-wake-aggressive") {
      // BG asks the tab to prove its main thread runs by bumping lastChunkAt.
      // Check track readyState first: a tab whose JS runs but tracks died
      // (post-sleep teardown pre-onended) would otherwise paper over death.
      let trackEnded = false;
      try {
        const v = liveStream.current?.getVideoTracks?.()[0] || null;
        if (v && v.readyState === "ended") trackEnded = true;
        const a = liveStream.current?.getAudioTracks?.()[0] || null;
        if (a && a.readyState === "ended") trackEnded = true;
      } catch {}
      if (trackEnded) {
        sendResponse?.({ ok: true, woke: false, trackEnded: true });
        return true;
      }
      try {
        chrome.storage.local.set({ lastChunkAt: Date.now() });
      } catch {}
      sendResponse?.({ ok: true, woke: true });
      return true;
    } else if (request.type === "offscreen-shutdown") {
      const timeoutMs = Number(request.timeoutMs) || 20000;
      (async () => {
        try {
          if (isRecording.current) stopRecording();
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (err) {
          console.warn("[Recorder] offscreen-shutdown error", err);
        } finally {
          chrome.runtime
            .sendMessage({ type: "offscreen-shutdown-complete" })
            .catch(() => {});
        }
      })();
      sendResponse?.({ ok: true, accepted: true });
      return true;
    } else if (request.type === "set-mic-active-tab") {
      setMic(request);
    } else if (request.type === "set-audio-output-volume") {
      setAudioOutputVolume(request.volume);
    } else if (request.type === "pause-recording-tab") {
      if (!recorder.current) return;
      if (pausedStateRef.current) return;
      if (
        useWebCodecs.current &&
        recorder.current instanceof WebCodecsRecorder
      ) {
        debug("Pausing WebCodecsRecorder");
        recorder.current.pause();
      } else if (recorder.current instanceof MediaRecorder) {
        debug("Pausing MediaRecorder");
        recorder.current.pause();
      }
      const now = Date.now();
      pausedStateRef.current = true;
      // Local pausedAt so rapid resume avoids storage round-trip.
      pausedAtRef.current = now;
      void setRecordingTimingState({
        paused: true,
        pausedAt: now,
      });
    } else if (request.type === "resume-recording-tab") {
      if (!recorder.current) return;
      if (!pausedStateRef.current) return;
      if (
        useWebCodecs.current &&
        recorder.current instanceof WebCodecsRecorder
      ) {
        debug("Resuming WebCodecsRecorder");
        recorder.current.resume();
      } else if (recorder.current instanceof MediaRecorder) {
        debug("Resuming MediaRecorder");
        recorder.current.resume();
      }
      const now = Date.now();
      pausedStateRef.current = false;
      // Local pausedAt: storage may not have propagated yet.
      const pausedAt = pausedAtRef.current;
      pausedAtRef.current = null;
      const additional = pausedAt ? Math.max(0, now - pausedAt) : 0;
      void (async () => {
        try {
          const { totalPausedMs } = await chrome.storage.local.get([
            "totalPausedMs",
          ]);
          await setRecordingTimingState({
            paused: false,
            pausedAt: null,
            totalPausedMs: (totalPausedMs || 0) + additional,
          });
        } catch (err) {
          debugWarn("Failed to update resume timing state", err);
        }
      })();
    } else if (request.type === "dismiss-recording") {
      dismissRecording();
    }
  };

  useEffect(() => {
    const stableHandler = (request, sender, sendResponse) => {
      return onMessageRef.current?.(request, sender, sendResponse);
    };
    debug("Adding chrome.runtime.onMessage listener (stable)");
    slLog("listener-add");
    chrome.runtime.onMessage.addListener(stableHandler);

    return () => {
      debug("Removing chrome.runtime.onMessage listener (stable)");
      slLog("listener-remove");
      chrome.runtime.onMessage.removeListener(stableHandler);
    };
  }, []);

  return (
    <>
      <RecorderUI started={started} isTab={isTab.current} />
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
    </>
  );
};

export default Recorder;

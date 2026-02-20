import React, { useEffect, useState, useRef, useCallback } from "react";
import localforage from "localforage";
import RecorderUI from "./RecorderUI";
import { createMediaRecorder } from "./mediaRecorderUtils";
import { sendRecordingError, sendStopRecording } from "./messaging";
import { getBitrates, getResolutionForQuality } from "./recorderConfig";
import { WebCodecsRecorder } from "./webcodecs/WebCodecsRecorder";
import { getUserMediaWithFallback } from "../utils/mediaDeviceFallback";
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

// Debug flag for logging
//   window.SCREENITY_DEBUG_RECORDER = true;
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
      maxFps: 30,
    };
  } catch {
    return {
      isPro: false,
      maxQuality: "1080p",
      maxFps: 30,
    };
  }
};

const computeTargetVideoBps = (width, height, fps) => {
  const pixels = Number(width) * Number(height);
  const rate = Number.isFinite(fps) && fps > 0 ? fps : 30;
  const target = Math.round(pixels * rate * 0.1);
  return clamp(target, 6_000_000, 24_000_000);
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
  const isFinishing = useRef(false);
  const sentLast = useRef(false);
  const lastTimecode = useRef(0);
  const hasChunks = useRef(false);

  const recdbgSessionRef = useRef(null);

  const lastSize = useRef(0);
  const index = useRef(0);

  const [started, setStarted] = useState(false);

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

  const isTab = useRef(false);
  const tabID = useRef(null);
  const tabPreferred = useRef(false);

  const backupRef = useRef(false);

  const pending = useRef([]);
  const draining = useRef(false);
  const lowStorageAbort = useRef(false);
  const savedCount = useRef(0);

  const lastEstimateAt = useRef(0);
  const ESTIMATE_INTERVAL_MS = 5000;
  const MIN_HEADROOM = 25 * 1024 * 1024;
  const MAX_PENDING_BYTES = 8 * 1024 * 1024;
  const pendingBytes = useRef(0);

  const uiClosing = useRef(false);

  const isRecording = useRef(false);
  const pausedStateRef = useRef(false);

  // Keep-alive mechanism to prevent Chrome from freezing this background tab
  const keepAliveAudioCtx = useRef(null);
  const keepAliveOscillator = useRef(null);

  const recordingStartTime = useRef(null);
  const sessionHeartbeat = useRef(null);
  const recordingTick = useRef(null);

  debug("Recorder component mounted");

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
      return !lowStorageAbort.current;
    }
    lastEstimateAt.current = now;

    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
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
      return ok;
    } catch (err) {
      debugWarn("navigator.storage.estimate() failed, assuming OK", err);
      return !lowStorageAbort.current;
    }
  }

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

      // Request Chrome not to discard this tab
      chrome.runtime
        .sendMessage({ type: "set-tab-auto-discardable", discardable: false })
        .catch(() => {});

      debug("Tab keep-alive started");
    } catch (err) {
      debugWarn("Failed to start tab keep-alive:", err);
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
      chrome.runtime
        .sendMessage({ type: "set-tab-auto-discardable", discardable: true })
        .catch(() => {});

      debug("Tab keep-alive stopped");
    } catch (err) {
      debugWarn("Failed to stop tab keep-alive:", err);
    }
  };

  /**
   * Persist recording session state for recovery and diagnostics.
   */
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
    sessionHeartbeat.current = setInterval(() => {
      if (isRecording.current) {
        persistSessionState("recording");
      }
    }, 10000); // Every 10 seconds
  };

  /**
   * Stop the session heartbeat.
   */
  const stopSessionHeartbeat = () => {
    if (sessionHeartbeat.current) {
      clearInterval(sessionHeartbeat.current);
      sessionHeartbeat.current = null;
    }
  };

  /**
   * Keep timer UI responsive in content scripts by updating a tick in storage.
   * This runs in the recorder tab, which is kept alive during recording.
   */
  const startRecordingTick = () => {
    if (recordingTick.current) clearInterval(recordingTick.current);
    recordingTick.current = setInterval(() => {
      if (isRecording.current) {
        chrome.storage.local.set({ recordingNow: Date.now() });
      }
    }, 1000);
  };

  const stopRecordingTick = () => {
    if (recordingTick.current) {
      clearInterval(recordingTick.current);
      recordingTick.current = null;
    }
  };

  async function saveChunk(e, i) {
    const ts = e.timecode ?? 0;

    if (!(await canFitChunk(e.data.size))) {
      debugWarn("Low storage, aborting recording");
      lowStorageAbort.current = true;
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
        memoryError: true,
      });
      chrome.runtime.sendMessage({ type: "stop-recording-tab" });
      return false;
    }

    try {
      await chunksStore.setItem(`chunk_${i}`, {
        index: i,
        chunk: e.data,
        timestamp: ts,
      });
      if (DEBUG_RECORDER) {
        debug("Saved chunk to IndexedDB", {
          key: `chunk_${i}`,
          size: e.data.size,
          ts,
        });
      }
    } catch (err) {
      debugError("Failed to save chunk, aborting recording", err);
      lowStorageAbort.current = true;
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
        memoryError: true,
      });
      chrome.runtime.sendMessage({ type: "stop-recording-tab" });
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
          debugWarn("Low storage while draining, clearing queue");
          pending.current.length = 0;
          pendingBytes.current = 0;
          break;
        }

        const e = pending.current.shift();
        pendingBytes.current -= e.data.size;

        if (!(await canFitChunk(e.data.size))) {
          debugWarn("Low storage during drain, stopping recording");
          lowStorageAbort.current = true;
          chrome.storage.local.set({
            recording: false,
            restarting: false,
            tabRecordedID: null,
            memoryError: true,
          });
          chrome.runtime.sendMessage({ type: "stop-recording-tab" });
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
    while (draining.current || pending.current.length) {
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

  async function startRecording() {
    if (recorder.current !== null) {
      debugWarn("startRecording() called but recorder already exists");
      return;
    }

    debug("startRecording()");

    // Start silent audio to prevent Chrome from freezing this background tab
    startTabKeepAlive();

    // Record the start time for session tracking
    recordingStartTime.current = Date.now();

    navigator.storage.persist();
    if (
      !helperVideoStream.current ||
      helperVideoStream.current.getVideoTracks().length === 0
    ) {
      debugError("No video tracks available in helperVideoStream");
      sendRecordingError("No video tracks available");
      stopTabKeepAlive();
      return;
    }

    await chunksStore.clear();
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

    const { qualityValue } = await chrome.storage.local.get(["qualityValue"]);
    const { isPro, maxQuality, maxFps } = await getFreeCaptureCaps();
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

    const recordingId = `${Date.now()}-${Math.random()
      .toString(16)
      .slice(2, 8)}`;
    await chrome.storage.local.set({
      fastRecorderActiveRecordingId: recordingId,
      fastRecorderInUse: false,
      fastRecorderValidationFailed: false,
      fastRecorderValidation: null,
    });

    const { useWebCodecsRecorder } = await chrome.storage.local.get([
      "useWebCodecsRecorder",
    ]);
    const userSetting = useWebCodecsRecorder === true ? true : false;
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
    const computedBps = computeTargetVideoBps(width, height, fps);
    videoBitsPerSecond = !isPro
      ? Math.min(computedBps, bitratePreset)
      : computedBps;
    debug("Video bitrate target", {
      bitratePreset,
      videoBitsPerSecond,
    });

    debug("Recorder capabilities", {
      canUseWebCodecs,
      FORCE_MEDIARECORDER,
      width,
      height,
      fps,
    });

    await setRecordingTimingState({
      recording: true,
      paused: false,
      recordingStartTime: recordingStartTime.current,
      pausedAt: null,
      totalPausedMs: 0,
    });
    pausedStateRef.current = false;
    chrome.storage.local.set({ restarting: false });

    isRecording.current = true;
    isRestarting.current = false;
    index.current = 0;

    // Start session heartbeat for recovery tracking
    startSessionHeartbeat();
    startRecordingTick();
    persistSessionState("recording");

    const handleChunk = async (data, timestampMs) => {
      if (useWebCodecs.current) {
        const blob =
          data instanceof Blob ? data : new Blob([data], { type: "video/mp4" });

        const ts = timestampMs ?? 0;
        const i = index.current;

        try {
          await chunksStore.setItem(`chunk_${i}`, {
            index: i,
            chunk: blob,
            timestamp: ts,
          });
          index.current = i + 1;
          hasChunks.current = true;
          savedCount.current += 1;

          if (DEBUG_RECORDER) {
            debug("WebCodecs chunk saved", {
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

    try {
      if (canUseWebCodecs) {
        useWebCodecs.current = true;

        const hasAudioTrack =
          !!liveStream.current &&
          typeof liveStream.current.getAudioTracks === "function" &&
          liveStream.current.getAudioTracks().length > 0;

        debug("Initializing WebCodecsRecorder", {
          hasAudioTrack,
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
            await updateFreeFinalizeStatus("chunks_ready", 95);
            let validation = null;
            try {
              const blob = await rebuildBlobFromChunks();
              validation = await validateFastRecorderOutputBlob(blob, {
                minBytes: 64 * 1024,
                timeoutMs: 4000,
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
            handleChunk(blob, timestampMs);
          },
          onError: (err) => {
            debugError("WebCodecsRecorder error", err);
            markFastRecorderFailure("webcodecs-error", {
              error: String(err),
            });
            chrome.storage.local.set({
              useWebCodecsRecorder: false,
              lastWebCodecsFailureAt: Date.now(),
              lastWebCodecsFailureCode: "webcodecs-error",
            });
            updateFreeFinalizeStatus("failed", 100, String(err));
            chrome.runtime.sendMessage({
              type: "show-toast",
              message: chrome.i18n.getMessage("webcodecsFailedOffToast"),
            });
            sendRecordingError(String(err));
          },
          onStop: async () => {
            debug("WebCodecsRecorder onStop()");
            await waitForDrain();
          },
        });

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
          // Ensure recorder.current is initialized (createMediaRecorder may
          // be used elsewhere; create a MediaRecorder here if missing).
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
              return;
            }
          }

          recorder.current.start(1000);
          debug("MediaRecorder.start(1000) called");
        } catch (err) {
          debugError("Failed to start MediaRecorder", err);
          sendRecordingError("Failed to start recording: " + String(err));
          return;
        }

        recorder.current.onerror = (ev) => {
          debugError("MediaRecorder.onerror", ev);
          chrome.runtime.sendMessage({
            type: "recording-error",
            error: "mediarecorder",
            why: String(ev?.error || "unknown"),
          });
        };

        recorder.current.onstop = async () => {
          debug("MediaRecorder.onstop");
          try {
            recorder.current.requestData();
          } catch {}
          if (isRestarting.current) return;
          await waitForDrain();
          if (!sentLast.current) {
            sentLast.current = true;
            isFinishing.current = false;
            chrome.runtime.sendMessage({ type: "video-ready" });
          }
        };

        recorder.current.ondataavailable = async (e) => {
          if (!e || !e.data || !e.data.size) {
            debugWarn("MediaRecorder.ondataavailable with empty data", e);
            if (
              recorder.current instanceof MediaRecorder &&
              recorder.current.state === "inactive"
            ) {
              chrome.storage.local.set({
                recording: false,
                restarting: false,
                tabRecordedID: null,
              });
              sendStopRecording();
            }
            return;
          }

          if (DEBUG_RECORDER) {
            debug("MediaRecorder.ondataavailable", {
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
      return;
    }

    if (helperAudioStream.current) {
      const track = helperAudioStream.current.getAudioTracks()[0];
      if (track) {
        track.onended = () => {
          // Log detailed diagnostics for debugging
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
          chrome.storage.local.set({
            recording: false,
            lastTrackEndEvent: diagnosticInfo,
          });
          sendStopRecording("audio-track-ended");
        };
      }
    }

    liveStream.current.getVideoTracks()[0].onended = () => {
      const track = liveStream.current?.getVideoTracks()[0];
      // Log detailed diagnostics for debugging
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
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
        lastTrackEndEvent: diagnosticInfo,
      });
      sendStopRecording("video-track-ended");
    };

    helperVideoStream.current.getVideoTracks()[0].onended = () => {
      const track = helperVideoStream.current?.getVideoTracks()[0];
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
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
        lastTrackEndEvent: diagnosticInfo,
      });
      sendStopRecording("video-track-ended");
    };
  }

  async function warmUpStream(liveStream) {
    debug("warmUpStream() start", {
      hasVideo: liveStream.getVideoTracks().length,
      hasAudio: liveStream.getAudioTracks().length,
    });

    const videoTrack = liveStream.getVideoTracks()[0];
    const audioTrack = liveStream.getAudioTracks()[0];

    await new Promise(async (resolve) => {
      const proc = new MediaStreamTrackProcessor({ track: videoTrack });
      const reader = proc.readable.getReader();

      while (true) {
        const { value: frame } = await reader.read();
        if (frame) {
          if (frame.codedWidth > 0 && frame.codedHeight > 0) {
            debug("warmUpStream() video frame OK", {
              codedWidth: frame.codedWidth,
              codedHeight: frame.codedHeight,
            });
            frame.close();
            reader.releaseLock();
            resolve();
            break;
          }
          frame.close();
        }
      }
    });

    if (audioTrack) {
      await new Promise(async (resolve) => {
        const proc = new MediaStreamTrackProcessor({ track: audioTrack });
        const reader = proc.readable.getReader();

        while (true) {
          const { value: audio } = await reader.read();
          if (audio && audio.numberOfFrames > 0) {
            debug("warmUpStream() audio OK", {
              numberOfFrames: audio.numberOfFrames,
            });
            audio.close?.();
            reader.releaseLock();
            resolve();
            break;
          }
          audio?.close?.();
        }
      });
    }

    debug("warmUpStream() done");
  }

  const rebuildBlobFromChunks = async () => {
    const items = [];
    await chunksStore.ready();
    await chunksStore.iterate((value) => (items.push(value), undefined));
    items.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    const parts = items.map((c) =>
      c.chunk instanceof Blob ? c.chunk : new Blob([c.chunk]),
    );
    if (!parts.length) return null;
    const first = parts[0];
    const inferredType = first?.type || "video/mp4";
    return new Blob(parts, { type: inferredType });
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
    debug("stopRecording()");
    isFinishing.current = true;
    isRecording.current = false;
    await updateFreeFinalizeStatus("stopping", 0);

    // Stop the session heartbeat and persist final state
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
          recorder.current.stop();
        }
      }
    } catch (err) {
      debugError("stopRecording() error while stopping recorder", err);
    }

    await waitForDrain();
    if (!useWebCodecs.current) {
      await updateFreeFinalizeStatus("chunks_ready", 100);
    }
    recorder.current = null;

    // Stop the silent audio keep-alive
    stopTabKeepAlive();

    // Clear session state after successful stop
    persistSessionState("completed");

    if (!isRestarting.current) {
      debug("Stopping tracks and clearing streams");
      liveStream.current?.getTracks().forEach((t) => t.stop());
      helperVideoStream.current?.getTracks().forEach((t) => t.stop());
      helperAudioStream.current?.getTracks().forEach((t) => t.stop());

      liveStream.current = null;
      helperVideoStream.current = null;
      helperAudioStream.current = null;
    }
    if (!useWebCodecs.current) {
      await updateFreeFinalizeStatus("ready", 100);
    }
  }

  const dismissRecording = async () => {
    debug("dismissRecording()");
    uiClosing.current = true;
    isRecording.current = false;

    // Clean up keep-alive and session tracking
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
      return;
    }

    debug("restartRecording()");

    isRestarting.current = true;
    isRecording.current = false;
    sentLast.current = false;
    isFinishing.current = false;
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
        recorder.current.ondataavailable = null;
        recorder.current.onstop = null;
        recorder.current.onerror = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
    } catch (err) {
      debugError("Error while restarting recorder", err);
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

    useWebCodecs.current = false;

    isRestarting.current = false;
    debug("restartRecording() done, ready to start again");
  };

  async function startAudioStream(id) {
    debug("startAudioStream()", { id });
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
        audio:
          userConstraints.audio && hasAudioDevice
            ? {
                ...userConstraints.audio,
                deviceId: { exact: data.defaultAudioInput },
              }
            : userConstraints.audio,
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
      helperVideoStream.current = userStream;
    } else {
      const constraints = {
        audio: {
          mandatory: {
            chromeMediaSource: isTab.current ? "tab" : "desktop",
            chromeMediaSourceId: id,
          },
        },
        video: {
          mandatory: {
            chromeMediaSource: isTab.current ? "tab" : "desktop",
            chromeMediaSourceId: id,
            maxWidth: width,
            maxHeight: height,
            width: { ideal: width, max: width },
            height: { ideal: height, max: height },
            maxFrameRate: fps,
          },
        },
      };

      debug("desktopCapture getUserMedia constraints", constraints);

      let stream;

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (stream.getVideoTracks().length === 0) {
          debugError("No video tracks returned from getUserMedia");
          sendRecordingError("No video tracks available");
          return;
        }
      } catch (err) {
        debugError("Failed to get user media for desktop/tab capture", err);
        sendRecordingError("Failed to get user media: " + String(err));
        return;
      }

      debug("desktop/tab stream acquired", {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
      });

      if (isTab.current) {
        const output = new AudioContext();
        const source = output.createMediaStreamSource(stream);
        source.connect(output.destination);
        debug("Created playback AudioContext for tab preview");
      }

      helperVideoStream.current = stream;

      const surface = stream.getVideoTracks()[0].getSettings().displaySurface;
      debug("Display surface", surface);
      chrome.runtime.sendMessage({ type: "set-surface", surface: surface });
    }

    aCtx.current = new AudioContext();
    destination.current = aCtx.current.createMediaStreamDestination();
    liveStream.current = new MediaStream();

    const micstream = await startAudioStream(data.defaultAudioInput);
    helperAudioStream.current = micstream;

    if (helperAudioStream.current != null && !data.micActive) {
      setAudioInputVolume(0);
    }

    // System/Tab audio
    const sysTracks = helperVideoStream.current.getAudioTracks();
    debug("System/tab audio tracks", sysTracks.length);
    if (sysTracks.length > 0) {
      const sysSource = aCtx.current.createMediaStreamSource(
        new MediaStream([sysTracks[0]]),
      );
      audioOutputGain.current = aCtx.current.createGain();
      sysSource.connect(audioOutputGain.current).connect(destination.current);
    }

    // Mic audio
    const micTracks = helperAudioStream.current?.getAudioTracks() ?? [];
    debug("Mic audio tracks", micTracks.length);
    if (micTracks.length > 0) {
      const micSource = aCtx.current.createMediaStreamSource(
        new MediaStream([micTracks[0]]),
      );
      audioInputGain.current = aCtx.current.createGain();
      micSource.connect(audioInputGain.current).connect(destination.current);

      if (!data.micActive) {
        audioInputGain.current.gain.value = 0;
      }
    }

    liveStream.current.addTrack(helperVideoStream.current.getVideoTracks()[0]);

    const mainVideoTrack = liveStream.current?.getVideoTracks()[0];
    if (mainVideoTrack) {
      mainVideoTrack.onmute = () => {
        debugWarn("mainVideoTrack muted");
      };
      mainVideoTrack.oninactive = () => {
        debugWarn("mainVideoTrack inactive → stopping recording");
        stopRecording();
      };
    }
    if (
      (helperAudioStream.current != null &&
        helperAudioStream.current.getAudioTracks().length > 0) ||
      helperVideoStream.current.getAudioTracks().length > 0
    ) {
      liveStream.current.addTrack(
        destination.current.stream.getAudioTracks()[0],
      );
    }

    debug("liveStream ready", {
      videoTracks: liveStream.current.getVideoTracks().length,
      audioTracks: liveStream.current.getAudioTracks().length,
    });

    setStarted(true);

    await warmUpStream(liveStream.current);

    chrome.runtime.sendMessage({ type: "reset-active-tab" });
  }

  async function startStreaming(data) {
    debug("startStreaming()", { data });
    const permissions = await navigator.permissions.query({
      name: "camera",
    });
    const permissions2 = await navigator.permissions.query({
      name: "microphone",
    });

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
        });
        chrome.desktopCapture.chooseDesktopMedia(
          captureTypes,
          null,
          (streamId, options) => {
            debug("chooseDesktopMedia callback", { streamId, options });
            if (
              streamId === undefined ||
              streamId === null ||
              streamId === ""
            ) {
              debugWarn("User cancelled the desktop capture modal");
              sendRecordingError("User cancelled the modal", true);
              return;
            } else {
              startStream(data, streamId, options, permissions, permissions2);
            }
          },
        );
      } else {
        debug("Streaming with pre-resolved tabID", tabID.current);
        startStream(data, tabID.current, null, permissions, permissions2);
      }
    } catch (err) {
      debugError("startStreaming() error", err);
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
    debug("getStreamID()", id);
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: id,
    });
    debug("Resolved tabCapture streamId", streamId);
    tabID.current = streamId;
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      debug("Component unmounting - cleaning up");
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

      // Stop recording - note: beforeunload can't reliably wait for async
      // The keep-alive and session state will help with recovery if needed
      stopRecording();

      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleClose);
    return () => {
      debug("Removing beforeunload handler");
      window.removeEventListener("beforeunload", handleClose);
    };
  }, []);

  const onMessage = useCallback(
    (request, sender, sendResponse) => {
      if (DEBUG_RECORDER) {
        debug("onMessage()", request.type, { request, sender });
      }

      if (request.type === "loaded") {
        backupRef.current = request.backup;
        if (!tabPreferred.current) {
          isTab.current = request.isTab;
          if (request.isTab) {
            getStreamID(request.tabID);
          }
        } else {
          isTab.current = false;
        }
        chrome.runtime.sendMessage({ type: "get-streaming-data" });
      } else if (request.type === "streaming-data") {
        startStreaming(JSON.parse(request.data));
      } else if (request.type === "start-recording-tab") {
        startRecording();
      } else if (request.type === "restart-recording-tab") {
        if (!isRestarting.current) {
          restartRecording();
        }
      } else if (request.type === "stop-recording-tab") {
        stopRecording();
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
            debugWarn("Failed to update resume timing state", err);
          }
        })();
      } else if (request.type === "dismiss-recording") {
        dismissRecording();
      }
    },
    [recorder.current, tabPreferred.current],
  );

  useEffect(() => {
    debug("Adding chrome.runtime.onMessage listener");
    chrome.runtime.onMessage.addListener(onMessage);

    return () => {
      debug("Removing chrome.runtime.onMessage listener");
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, [onMessage]);

  return <RecorderUI started={started} isTab={isTab.current} />;
};

export default Recorder;

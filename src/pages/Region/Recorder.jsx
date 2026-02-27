import React, { useEffect, useRef, useCallback } from "react";
import { getUserMediaWithFallback } from "../utils/mediaDeviceFallback";
import { WebCodecsRecorder } from "../Recorder/webcodecs/WebCodecsRecorder";
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

import localforage from "localforage";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

// Get chunks store
const chunksStore = localforage.createInstance({
  name: "chunks",
});

// Debug flag for logging
//   window.SCREENITY_DEBUG_RECORDER = true;
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

  // Main stream (recording)
  const liveStream = useRef(null);

  // Helper streams
  const helperVideoStream = useRef(null);
  const helperAudioStream = useRef(null);
  const startRetryTimer = useRef(null);
  const startRetryAttempts = useRef(0);

  // Audio controls, with refs to persist across renders
  const aCtx = useRef(null);
  const destination = useRef(null);
  const audioInputSource = useRef(null);
  const audioOutputSource = useRef(null);
  const audioInputGain = useRef(null);
  const audioOutputGain = useRef(null);

  const recorder = useRef(null);
  const useWebCodecs = useRef(false);
  const recdbgSessionRef = useRef(null);

  // Target
  const target = useRef(null);

  // Recording ref
  const recordingRef = useRef();
  const regionRef = useRef();
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

    // FLAG: disabled duplicate chunk check due to issues with some devices
    // if (
    //   savedCount.current > 0 &&
    //   ts === lastTimecode.current &&
    //   e.data.size === lastSize.current
    // ) {
    //   return false;
    // }

    if (!(await canFitChunk(e.data.size))) {
      lowStorageAbort.current = true;
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
        memoryError: true,
      });
      sendStopWithReason("region-low-storage-headroom");
      // Reload this iframe
      window.location.reload();
      return false;
    }

    try {
      await chunksStore.setItem(`chunk_${i}`, {
        index: i,
        chunk: e.data,
        timestamp: ts,
      });
    } catch (err) {
      lowStorageAbort.current = true;
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
        memoryError: true,
      });
      sendStopWithReason("region-save-chunk-failed");
      // Reload this iframe
      window.location.reload();
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
    if (draining.current) return;
    draining.current = true;

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
          // Reload this iframe
          window.location.reload();
          break;
        }

        const i = index.current;
        const saved = await saveChunk(e, i);
        if (saved) index.current = i + 1;
      }
    } finally {
      draining.current = false;
    }
  }

  async function waitForDrain() {
    while (draining.current || pending.current.length) {
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

  // Receive post message from parent (this is an iframe)
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
    // Check that a recording is not already in progress
    if (recorder.current !== null) return;
    persistRegionStartDebug({ stage: "start-recording-enter" });

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
      window.location.reload();
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
    // Check if the stream actually has data in it
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

        // Reload this iframe
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

      // Reload this iframe
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

      // List all mimeTypes
      const mimeTypes = [
        "video/webm;codecs=avc1",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm;codecs=h264",
        "video/webm",
      ];

      // Check if the browser supports any of the mimeTypes, make sure to select the first one that is supported from the list
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
      let recorderToken = 0;
      let codecFallbackTriggered = false;
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

            await updateFreeFinalizeStatus("ready", 100);
            if (!sentLast.current) {
              sentLast.current = true;
              isFinished.current = true;
              isFinishing.current = false;
              if (!isRestarting.current) {
                chrome.runtime.sendMessage({ type: "video-ready" });
              }
            }
          },
          onChunk: (chunkData, timestampUs) => {
            const blob = new Blob([chunkData], { type: "video/mp4" });
            handleWebCodecsChunk(blob, timestampUs);
          },
          onError: (err) => {
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
            chrome.runtime.sendMessage({
              type: "recording-error",
              error: "stream-error",
              why: "Fast recorder failed. Please try compatibility mode.",
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
        if (!mimeType) {
          chrome.runtime.sendMessage({
            type: "recording-error",
            error: "stream-error",
            why: `No supported mimeTypes available for ${codec}`,
          });

          // Reload this iframe
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
          chrome.runtime.sendMessage({
            type: "recording-error",
            error: "mediarecorder",
            why: String(ev?.error || "unknown"),
          });
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
            (recdbgChunkCount >= 3 || elapsedSec >= 3)
          ) {
            if (derivedMbps < 5 && getCodecLabel(mimeType) !== "vp8") {
              codecFallbackTriggered = true;
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
                  recorder.current.start(1000);
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

      // Reload this iframe
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
        recorder.current.start(1000);
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
        chrome.storage.local.set({
          recording: false,
          restarting: false,
          tabRecordedID: null,
          memoryError: true,
        });
        sendStopWithReason("region-mediarecorder-start-throw");

        // Reload this iframe
        window.location.reload();
        return;
      }
    }

    const recordingStartTime = Date.now();
    await setRecordingTimingState({
      recording: true,
      paused: false,
      recordingStartTime,
      pausedAt: null,
      totalPausedMs: 0,
    });
    pausedStateRef.current = false;
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
    isFinishing.current = true;
    regionRef.current = false;
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

        await waitForDrain();
        recorder.current = null;
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
    regionRef.current = false;
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
      recorder.current.stop();
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
  };

  const restartRecording = async () => {
    clearStartRetry();
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
        // Try again without the device ID
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
  // Set audio input volume
  function setAudioInputVolume(volume) {
    if (!audioInputGain.current) return;
    audioInputGain.current.gain.value = volume;
  }

  // Set audio output volume
  function setAudioOutputVolume(volume) {
    if (!audioOutputGain.current) return;
    audioOutputGain.current.gain.value = volume;
  }

  async function startStreaming(data) {
    try {
      // Get quality value
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

      // Check if fps is a number
      if (isNaN(fps)) {
        fps = 30;
      }

      let stream;

      const constraints = {
        preferCurrentTab: true,
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
      stream = await navigator.mediaDevices.getDisplayMedia(constraints);
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

      // Create an audio context, destination, and stream
      aCtx.current = new AudioContext();
      destination.current = aCtx.current.createMediaStreamDestination();
      liveStream.current = new MediaStream();
      const micstream = await startAudioStream(data.defaultAudioInput);

      // Save the helper streams
      helperAudioStream.current = micstream;

      // Check if micstream has an audio track
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
      } else {
        // No microphone available
      }

      if (helperAudioStream.current != null && !data.micActive) {
        setAudioInputVolume(0);
      }

      // Check if stream has an audio track
      if (helperVideoStream.current.getAudioTracks().length > 0) {
        audioOutputGain.current = aCtx.current.createGain();
        audioOutputSource.current = aCtx.current.createMediaStreamSource(
          helperVideoStream.current,
        );
        audioOutputSource.current
          .connect(audioOutputGain.current)
          .connect(destination.current);
      } else {
        // No system audio available
      }

      // Add the tracks to the stream
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
          await track.cropTo(target.current);
        } else {
          // No target
          chrome.runtime.sendMessage({
            type: "recording-error",
            error: "cancel-modal",
            why: "No target",
          });

          // Reload this iframe
          window.location.reload();
        }
      } catch (err) {
        chrome.runtime.sendMessage({
          type: "recording-error",
          error: "cancel-modal",
          why: String(err),
        });

        // Reload this iframe
        window.location.reload();
      }

      // Send message to go back to the previously active tab
      chrome.runtime.sendMessage({ type: "reset-active-tab" });
    } catch (err) {
      chrome.runtime.sendMessage({
        type: "recording-error",
        error: "cancel-modal",
        why: String(err),
      });

      // Reload this iframe
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
        e.preventDefault();
        e.returnValue = "";

        // Save and stop recording
        stopRecording();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const setMic = async (result) => {
    if (helperAudioStream.current != null) {
      if (result.active) {
        setAudioInputVolume(1);
      } else {
        setAudioInputVolume(0);
      }
    } else {
      // No microphone available
    }
  };

  const onMessage = useCallback(
    (request, sender, sendResponse) => {
      if (request.type === "loaded") {
        backupRef.current = request.backup;
        if (request.region) {
          chrome.runtime.sendMessage({ type: "get-streaming-data" });
        }
      }
      if (request.type === "streaming-data") {
        if (regionRef.current) {
          startStreaming(JSON.parse(request.data));
        }
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
        Promise.resolve(restartRecording())
          .then((restarted) => {
            if (!restarted) {
              sendResponse?.({ ok: false, error: "restart-teardown-failed" });
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
        if (isFinishing.current) return;
        stopRecording();
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
    // Event listener (extension messaging)
    chrome.runtime.onMessage.addListener(onMessage);

    return () => {
      clearStartRetry();
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  return <div></div>;
};

export default Recorder;

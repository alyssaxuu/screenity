import React, { useEffect, useState, useRef, useCallback } from "react";
import RecorderUI from "./RecorderUI";
import {
  sendRecordingError as sendRecordingErrorBase,
  sendStopRecording,
} from "../utils/recorderMessaging";
import { getBitrates, getResolutionForQuality } from "./recorderConfig";
import { pickEncodedDims, scaleClickEvents } from "./encodedDims";
import { planGapResend } from "./uploadGapRecovery";
import { getClientSessionId } from "./clientSessionId";
import BunnyTusUploader from "./bunnyTusUploader";
import localforage from "localforage";
import { createVideoProject } from "./createVideoProject";
import { notifyRecordingStarted } from "./notifyRecordingStarted";
import { getUserMediaWithFallback } from "../utils/mediaDeviceFallback";
import { startAudioStream as acquireMicStream } from "../utils/startAudioStream";
import { shouldAcquireMicAtStart } from "../utils/micAcquisitionPolicy";
import { attachAudioContextWatchdog } from "../utils/audioContextWatchdog";
import { startTabKeepalive, stopTabKeepalive } from "../utils/tabKeepalive";
import { traceStep } from "../utils/startFlowTrace";
import { markStartProgress } from "../utils/startProgress";
import { IS_OFFSCREEN_HOST } from "../utils/recordingHost";
import { sendSystemAudioGuidanceToast } from "../utils/systemAudioGuidance";
import { isCaptureAudioSourceError } from "../utils/captureAudioFallback";
import {
  isSeparatedInFact,
  shouldDeclareSeparated,
} from "./separatedInFact";
import {
  shouldUseDisplayMediaForScreen,
  screenSurfaceSwitching,
} from "../utils/screenCaptureMode";
import { acquireDisplayMediaWithFocusRetry } from "../utils/acquireDisplayMedia";
import {
  resolveCaptureSurface,
  setCapturedSurface,
} from "../utils/captureSurface";
import { startPrewarm, stopPrewarm } from "../Recorder/streamWarmup";
import { preloadWebCodecsModules } from "../Recorder/webcodecs/WebCodecsRecorder";
import {
  startEncoderPrewarm,
  closeActiveEncoderPrewarm,
} from "../Recorder/encoderPrewarm";
import { perfMark, perfSpan } from "../utils/perfMarks";
import {
  chooseChunksStore,
  openExistingChunksStore,
} from "./recorderStorage/chooseChunksStore";
import { destroySessionDir } from "./recorderStorage/opfsKvStore";
import { createTrackStallState, sweepTrackStalls } from "./trackStallSweep";
import {
  chooseTrackEncoder,
  resetEncoderProbeCache,
  computeEncodedDimensions,
  computeCameraBitrate,
  WEBCODECS_CAP_WIDTH,
  WEBCODECS_CAP_HEIGHT,
} from "./encoder/chooseEncoder";
import {
  computeCaptureCap,
  isOversampleDisabled,
  constrainTrackDown,
  enforceOversampleRatio,
} from "../utils/captureResolution";
import { getCompressedLifecycleLog } from "../utils/lifecycleLog";
import {
  CHUNK_PURGE_COMFORT_HEADROOM_BYTES,
  resolvePrefixBudget,
  resolvePurgeMode,
  emptyRetainedPrefix,
  extendRetainedPrefix,
  selectChunksToPurge,
  selectPrefixChunksToDrop,
  resolveLocalPlaybackPlan,
} from "./localPlaybackRetention";

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

import { shouldSeparateAudio } from "./shouldSeparateAudio";
import {
  shouldMuxBusAudio,
  needsContextResume,
  isBusSilentFault,
} from "./audioBusPolicy";
import {
  setPendingMicRecovery,
  setPendingMicRecoveryScene,
  clearPendingMicRecovery,
  runMicRecoveryScan,
} from "./micRecovery";
// Upload and attach separately, not through uploadAndAttachMic: the upload
// starts before the scene POST and the attach is only needed when the id did
// not make it into the payload.
import {
  collectMicChunks,
  uploadMicToStorage,
  attachSceneAudio,
} from "./uploadMicToStorage";

const API_BASE = process.env.SCREENITY_API_BASE_URL;
// Big mic file on a slow uplink, but a wedged POST must not hold the recorder
// tab open. Over budget falls to the launch scan.
const SEPARATED_MIC_UPLOAD_BUDGET_MS = 120000;
// Tighter: this one sits in front of the countdown, so the user watches it.
// Over budget only the IDB chunks go, the same loss as not trying.
const START_MIC_RECOVERY_BUDGET_MS = 15000;
// Runs beside video finalize and the silence check, so it is usually done
// by the scene POST: born with the mic beats gaining a voice after the
// editor already loaded. Short because the editor waits on this POST;
// over budget falls back to the attach path.
const PRE_SCENE_MIC_UPLOAD_BUDGET_MS = 2500;
// Enable the start-flow logs unconditionally for dev builds so the
// startup timeline is visible in the cloudrecorder tab console without
// needing to set `window.SCREENITY_DEBUG_RECORDER = true` first. Prod
// builds keep the original flag.
const DEBUG_START_FLOW =
  typeof window !== "undefined"
    ? !!window.SCREENITY_DEBUG_RECORDER || process.env.NODE_ENV !== "production"
    : false;
// Statuses a plain resume() recovers. Shared by the network-online handler and
// the per-track stall sweep.
const RESUMABLE_UPLOADER_STATUSES = new Set([
  "uploading",
  "paused",
  "error",
  "ready",
]);
// Stop is user-visible, so the pre-finalize gap re-send is capped.
const GAP_RESEND_BUDGET_MS = 45000;
// prepareGapResend refuses to rewind under an in-flight PATCH, and the call
// site quiesces the queue before reading the offset it plans against.
const GAP_RESEND_ENABLED = true;
const SCREEN_CHUNK_MEMORY_WINDOW = 8;
const CAMERA_CHUNK_MEMORY_WINDOW = 8;
const AUDIO_CHUNK_MEMORY_WINDOW = 8;
const STORAGE_CHECK_INTERVAL_MS = 5000;
const STORAGE_LOW_HEADROOM_BYTES = 250 * 1024 * 1024;
const STORAGE_CRITICAL_HEADROOM_BYTES = 120 * 1024 * 1024;
const AUDIO_MAX_BUFFER_BYTES = 150 * 1024 * 1024;
const LOCAL_SCREEN_PLAYBACK_TTL_MS = 20 * 60 * 1000;
// The old 250MB was the base64 transport limit, not a storage or playback bound.
// The bridge passes a Blob by reference now, so headroom governs and this is a backstop.
const LOCAL_SCREEN_PLAYBACK_MAX_BYTES = 8 * 1024 * 1024 * 1024;
// Bytes kept past lastServerOffset before purging - covers in-flight PATCHes, HEAD resyncs, 409 retries.
const CHUNK_PURGE_SAFETY_WINDOW_BYTES = 32 * 1024 * 1024;
const MAX_UPLOAD_TELEMETRY_EVENTS = 300;
const UPLOAD_TELEMETRY_KEY = "cloudUploadTelemetryEvents";
const UPLOAD_TELEMETRY_ENDPOINT = `${API_BASE}/log/upload-event`;
// Resolve the extension version at call time so upload events carry it (the
// cached telemetry runtime can come up without one). Without this the version
// only rides the BG beacon and lands on a separate, unjoinable session doc.
const resolveExtVersion = () => {
  try {
    return chrome?.runtime?.getManifest?.()?.version || null;
  } catch {
    return null;
  }
};
const SESSION_STATE_INDEX_KEY = "cloudRecorderSessionStateIndex";
// stale-cleared and crashed are what a toolbar click or a closed recorder tab
// rewrite a crashed take to.
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
const HOST_BUSY_BEAT_MS = 15000;

// `let` (not `const`) so ensureChunkStoreReady() can swap each instance
// from the IDB default to an OPFS-backed adapter at session start. All
// callsites in this file see the new reference via closure.
let chunksStore = localforage.createInstance({ name: "chunks" });
let audioChunksStore = localforage.createInstance({ name: "audioChunks" });
let cameraChunksStore = localforage.createInstance({ name: "cameraChunks" });
// Backend tag per track, written into recorderSession so restore /
// download / cloud-local-playback paths can route to the same backend
// the writer used.
let storageBackends = { screen: "idb", audio: "idb", camera: "idb" };
let storageOpfsSessionId = null;
// Encoder kind chosen per track ("webcodecs" | "mediarecorder"). Persisted
// into recorderSession so the resume / Download recovery paths know what
// container the chunks are in (mp4 vs webm).
let encoderKinds = {
  screen: "mediarecorder",
  audio: "mediarecorder",
  camera: "mediarecorder",
};
let trackContainers = {
  screen: "video/webm",
  audio: "video/webm",
  camera: "video/webm",
};
let trackCodecs = { screen: "vp9", audio: "opus", camera: "vp9" };
let encoderHwSlots = null;
// Per-track encoder-selection reason from inspectTrackPlan ("ok",
// "aac-unsupported", "fastRecorderGate-sticky-disabled", ...). null until start.
let encoderReasons = { screen: null, audio: null, camera: null };
// WebCodecs sticky-disable device state at plan time, from
// getFastRecorderStickyState().
let encoderSticky = { disabled: null, reason: null };

// Diagnostic-only snapshot taken once at session start. userAgent is
// fingerprinting-grade but is already covered by the crash-reports
// clause in the privacy policy; the rest are aggregate.
const captureSessionDiag = () => {
  try {
    const nav = navigator || {};
    return {
      userAgentFull:
        typeof nav.userAgent === "string" ? nav.userAgent.slice(0, 256) : null,
      platformFull:
        typeof nav.platform === "string" ? nav.platform.slice(0, 64) : null,
      hardwareConcurrency: Number.isFinite(nav.hardwareConcurrency)
        ? nav.hardwareConcurrency
        : null,
      deviceMemoryGb: Number.isFinite(nav.deviceMemory)
        ? nav.deviceMemory
        : null,
      pageVisibilityStateAtStart:
        typeof document !== "undefined" && document.visibilityState
          ? document.visibilityState
          : null,
    };
  } catch {
    return null;
  }
};

const urlParams = new URLSearchParams(window.location.search);
const IS_INJECTED_IFRAME = urlParams.has("injected");
const IS_IFRAME_CONTEXT =
  IS_INJECTED_IFRAME ||
  (window.top !== window.self &&
    !document.referrer.startsWith("chrome-extension://"));

const CloudRecorder = () => {
  const screenTimer = useRef({ start: null, total: 0, paused: false });
  const cameraTimer = useRef({ start: null, total: 0, paused: false });
  // The mic records on its own recorder, started after the video ones and able
  // to die without them, so its length is measured rather than inherited.
  const audioTimer = useRef({
    start: null,
    total: 0,
    paused: false,
    everStarted: false,
  });
  const [started, setStarted] = useState(false);
  const [initProject, setInitProject] = useState(false);
  const [finalizeFailure, setFinalizeFailure] = useState(null);
  const finalizeFailureRef = useRef(null);
  const finalizeContextRef = useRef(null);
  // Timing trace for the stop→finalize→scene-create→close pipeline.
  // Populated when stopRecording fires; ticked at each milestone so
  // dead time is visible in the console.
  const stopFlowRef = useRef(null);
  const simulateFinalizeFailureConsumedRef = useRef(false);
  const [retryingFinalize, setRetryingFinalize] = useState(false);

  const retryFinalize = async () => {
    setRetryingFinalize(true);
    // clear first so a re-failure re-sets it (and re-opens the content modal);
    // if it's still null after, the retry succeeded.
    finalizeFailureRef.current = null;
    setFinalizeFailure(null);
    try {
      await stopRecording(true, "retry-finalize");
      if (!finalizeFailureRef.current && IS_OFFSCREEN_HOST) {
        chrome.runtime
          .sendMessage({ type: "finalize-recovered" })
          .catch(() => {});
      }
    } catch (err) {
      console.warn("Retry finalize failed:", err);
    } finally {
      setRetryingFinalize(false);
    }
  };

  const isTab = useRef(false);
  const tabID = useRef(null);
  const audioIntent = useRef({ micActive: false, systemAudio: false });
  const recordingTabId = useRef(null);
  const tabPreferred = useRef(false);

  const screenStream = useRef(null);
  // What the capture was asked for, so a MediaRecorder fallback can constrain a
  // supersampled track back down before it encodes at 2x the intended size.
  const captureCapRef = useRef(null);
  const prewarmRef = useRef(null);
  const cameraStream = useRef(null);
  const micStream = useRef(null);
  const rawMicStream = useRef(null);
  // Set at start and not re-read, so a take stays separated or muxed for its
  // whole length.
  const separatedAudio = useRef(false);
  // While a separated mic still owes an upload, so the success path leaves its
  // chunks on disk instead of clearing them from under the scan.
  const micRecoveryPending = useRef(false);

  const screenRecorder = useRef(null);
  const cameraRecorder = useRef(null);
  const audioRecorder = useRef(null);

  const screenUploader = useRef(null);
  const cameraUploader = useRef(null);
  const audioUploader = useRef(null);
  const uploadMetaRef = useRef(null);
  const localScreenPlaybackOfferRef = useRef(null);
  const emptyCleanupRef = useRef(false);

  const audioInputGain = useRef(null);
  const audioOutputGain = useRef(null);
  // Set only when we force the bus to mono, since getSettings() can report 2
  // while mixing mono. Null lets the encoder read the track it actually encodes.
  const audioBusChannels = useRef(null);

  const uploadersInitialized = useRef(false);
  const pendingStartRef = useRef(false);
  const pendingStartAttempts = useRef(0);
  const pendingStartTimer = useRef(null);

  const isRestarting = useRef(false);
  const isFinishing = useRef(false);
  // Re-entry guard for setMic()'s lazy acquire branch (see Recorder.jsx).
  const isLazyAcquiringMic = useRef(false);
  // Latest mic-toggle intent so a mid-acquire toggle-off is honored.
  const pendingMicIntent = useRef(null);
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
  const consecutiveAudioFailures = useRef(0);
  const firstChunkTime = useRef(null);
  const firstChunkLoggedRef = useRef(false);

  const recorderSession = useRef(null);
  const recordingSessionId = useRef(null);
  // SW push + tab pull both deliver streaming-data by design (push at
  // openRecorderTab.js:163, pull from our "loaded" handler). Without this
  // guard, both fire startStreaming → two getDisplayMedia prompts and a
  // silent recorder close. Mirrors the same guard in legacy Recorder.jsx.
  const streamingDataReceivedAt = useRef(null);
  const streamingDataRetryTimer = useRef(null);
  // Backup guard: even if a future code path bypasses the message-level
  // dedup, this prevents startStreaming itself from running twice.
  const startStreamingInFlight = useRef(false);
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
  const screenChunkByteRangesRef = useRef([]);
  const cameraChunkByteRangesRef = useRef([]);
  const audioChunkByteRangesRef = useRef([]);
  const chunksPurgedDuringRecordingRef = useRef(false);
  const screenChunksPurgedCountRef = useRef(0);
  const cameraChunksPurgedCountRef = useRef(0);
  const chunksPurgedBytesRef = useRef(0);
  // A healthy OPFS write is a few ms. Sustained spikes while the page lags is
  // the local-disk-contention signature.
  const localWriteStatsRef = useRef({
    count: 0,
    totalMs: 0,
    maxMs: 0,
    slowCount: 0,
  });
  // Leading screen chunks [0, chunks) still on disk. `dropped` is sticky so a
  // hole can never be reported as a contiguous prefix.
  const screenRetainedPrefixRef = useRef(emptyRetainedPrefix());
  const purgeModeRef = useRef("none");
  // purgeConfirmedChunks runs un-awaited per chunk write. Overlapping passes
  // would both consume ranges, leaving live chunks untracked and never deleted.
  const purgeInFlightRef = useRef({ screen: false, camera: false });
  const sessionStateIndexedRef = useRef(false);
  const sessionHeartbeat = useRef(null);
  const chunkStallTimer = useRef(null);
  const uploadHeartbeatTimer = useRef(null);
  const trackSweepTicks = useRef(0);
  // Set when the resend budget expires. finalize starts the moment the outer
  // race resolves, and a write landing after that is lost bytes.
  const gapResendAbortRef = useRef(false);
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
  const purgeMarksRef = useRef({});
  const purgeMarkChainRef = useRef(Promise.resolve());
  const recoveryExportedRef = useRef(false);
  const screenTrackLostRef = useRef(false);
  const screenTrackMonitor = useRef(null);
  // null = not muted; the reported flag keeps the breadcrumb to one per
  // mute stretch.
  const screenTrackMutedSinceRef = useRef(null);
  const screenTrackMuteReportedRef = useRef(false);
  // Capture identity (recordingType/surface enums only, no labels/URLs) for
  // forensic telemetry, so a frozen session's capture mechanism is known.
  const captureContextRef = useRef(null);
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

  const isInit = useRef(false);

  const aCtx = useRef(null);
  // audioCtxWallMs minus audioCtxTimeMs growing = the mix bus underran
  // (samples never rendered, the drift source).
  const aCtxCreatedAtRef = useRef(null);
  // Live AudioContext interruption stats from attachAudioContextWatchdog,
  // folded into the audio diag snapshot at finalize for upload telemetry.
  const audioHealthRef = useRef(null);
  // What is actually wired into the bus, not what the user asked for.
  // The mux decision reads this so an empty bus is never encoded.
  const busSources = useRef({ mic: false, system: false });
  // audioRecorder is null for all of startStream (startRecording waits on
  // uploader init), so it can't tell "too late to separate" from "not built yet".
  const recordersBuilt = useRef(false);
  // audioRecorder is never nulled, so after a restart it still points at the
  // previous take's recorder.
  const micRecordedThisTake = useRef(false);
  // stopAllRecorders() resets the refs above, and every consumer in
  // stopRecording runs after it. Teardown must not clear this one.
  const stopAudioVerdict = useRef(null);
  // Read this, not separatedAudio, anywhere the answer decides what the
  // server is told about where the voice lives.
  const separatedNow = () =>
    isSeparatedInFact({
      separatedAudio: separatedAudio.current,
      hasAudioRecorder: micRecordedThisTake.current,
      busHasMic: Boolean(busSources.current.mic),
    });
  // Bus health at recording start, folded into the audio diag snapshot.
  const busWarmupRef = useRef({
    ran: false,
    rms: null,
    silentFault: false,
    ctxResumedAtStart: false,
    ctxStateAtStart: null,
  });
  const busTap = useRef(null);
  const destination = useRef(null);

  const keepAliveInterval = useRef(null);
  // Single handle covering audio osc, navigator.locks, mediaSession,
  // and the loopback RTC priority boost (see utils/tabKeepalive.js).
  const keepAliveHandle = useRef(null);

  const logDebugEvent = async () => {};

  // logDebugEvent is a no-op, so anything that has to reach a diag zip goes
  // here. The BG handler drops names outside its prefix allowlist.
  const diagForward = (event, data = null) => {
    try {
      chrome.runtime
        .sendMessage({
          type: "diag-forward",
          event: `cloudrecorder-${event}`,
          data,
        })
        .catch(() => {});
      // diag-forward only reaches the zip; mirror to the BG console so a live
      // failure is watchable.
      chrome.runtime
        .sendMessage({ type: "offscreen-diag", source: event, payload: data })
        .catch(() => {});
    } catch {}
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
      if (pendingStartAttempts.current > 0) {
        perfMark("CloudRecorder capture-late-recovered", {
          polls: pendingStartAttempts.current,
          approxLostMs: pendingStartAttempts.current * 200,
        });
        // Not a step in the trace's t map, so this merges the counts without
        // stamping a timestamp. Survives the perf timeline's event cap.
        traceStep("captureLate", {
          captureLatePolls: pendingStartAttempts.current,
          captureLateApproxMs: pendingStartAttempts.current * 200,
        });
      }
      clearPendingStart();
      startRecording();
      return;
    }

    const attempt = pendingStartAttempts.current + 1;
    pendingStartAttempts.current = attempt;
    if (attempt === 1) {
      // The countdown finished before the recorder was ready, so capture
      // starts late and the user loses the head of the recording. Each poll
      // is 200ms; the attempt count at start tells us how much was lost.
      perfMark("CloudRecorder capture-late-after-countdown", { reason });
    }
    if (attempt > 75) {
      clearPendingStart();
      sendRecordingError(
        "Recording is taking too long to start. Please try again."
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
    // console.warn (not console.info); Terser drop_console removes
    // info/log/debug in prod builds.
    console.warn("[Screenity][StartFlow]", payload);
    // Mirror to BG so the timeline is visible even if the cloud
    // recorder tab closes mid-sequence (e.g. an unhandled error
    // tearing the tab down before the user can read the console).
    try {
      chrome.runtime.sendMessage({
        type: "start-flow-tick",
        event,
        data,
        ts: payload.ts,
      });
    } catch {}
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
      try {
        chrome.storage.local.set({
          recordingSessionId: recordingSessionId.current,
        });
      } catch {}
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
    const manifestVersion = chrome?.runtime?.getManifest?.()?.version || null;
    let platformInfo = null;
    try {
      platformInfo = await chrome.runtime.sendMessage({
        type: "get-platform-info",
      });
    } catch {
      platformInfo = null;
    }
    telemetryRuntimeRef.current = {
      // BG (get-platform-info) is the authoritative version source since it
      // always has manifest access; fall back through the local manifest read.
      extensionVersion:
        manifestVersion || platformInfo?.extVersion || resolveExtVersion(),
      browserVersion: getBrowserVersion(),
      platform: platformInfo?.os || navigator.platform || null,
      arch: platformInfo?.arch || null,
      os: platformInfo?.os || null,
    };
    return telemetryRuntimeRef.current;
  };

  // Route telemetry writes through BG. window.close() races the
  // storage IPC when written from this tab and the event drops; BG
  // outlives the tab. Counter so the pre-close flush can await sends.
  const inflightTelemetryWritesRef = useRef(new Set());
  const appendUploadTelemetryEvent = async (eventPayload) => {
    const p = (async () => {
      try {
        await chrome.runtime.sendMessage({
          type: "cloud-telemetry-event",
          event: eventPayload,
        });
      } catch (err) {
        console.warn("Failed to forward upload telemetry event:", err);
      }
    })();
    inflightTelemetryWritesRef.current.add(p);
    p.finally(() => inflightTelemetryWritesRef.current.delete(p));
    return p;
  };

  // Called by the close paths just before window.close() so any
  // event emitted in the last microtask actually lands in BG storage.
  const flushInflightTelemetry = async () => {
    const writes = Array.from(inflightTelemetryWritesRef.current);
    if (writes.length === 0) return;
    try {
      await Promise.race([
        Promise.allSettled(writes),
        // Hard cap so a wedged BG SW can't block tab close forever.
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } catch {}
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
    } catch {}

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
    } catch {}
    return null;
  };

  const toUploadTelemetryRequest = async (eventPayload) => {
    const mediaId =
      eventPayload.mediaId ||
      screenUploader.current?.getMeta?.()?.mediaId ||
      cameraUploader.current?.getMeta?.()?.mediaId ||
      null;
    // Diagnostic events fire before mediaId exists; keep them and let the
    // server attach them by recordingSessionId instead.
    const DIAG_EVENT_TYPES = new Set([
      "recording_heartbeat",
      "recording_stop_diag",
      "recording_failed_bundle",
      // Fires when a track dies during setup, exactly when its uploader has no
      // meta yet, so the guard below would drop it silently.
      "recording_track_setup_failed_after_live",
    ]);
    if (
      !mediaId &&
      eventPayload.event !== "recording_outcome" &&
      !DIAG_EVENT_TYPES.has(eventPayload.event)
    ) {
      return null;
    }

    const browserVersion = eventPayload.browserVersion || null;
    const browserMajor =
      browserVersion && Number.isFinite(parseInt(browserVersion, 10))
        ? parseInt(browserVersion, 10)
        : null;

    const recordingIdForRequest =
      mediaId || eventPayload.recordingSessionId || null;
    return {
      recordingId: recordingIdForRequest,
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
        // Carry the version on env.appVersion so it's queryable. Was hardcoded
        // null, so per-version upload attribution only had the event/header.
        appVersion: eventPayload.extensionVersion || null,
      },
      event: {
        type: eventPayload.event,
        t: eventPayload.ts || Date.now(),
        // `recording_forensic_event` is one type covering many events (track
        // mute/end, visibility, focus, page freeze). Without name/tMs the
        // whole forensic channel lands indistinguishable.
        name: typeof eventPayload.name === "string" ? eventPayload.name : null,
        tMs: typeof eventPayload.tMs === "number" ? eventPayload.tMs : null,
        // How long the screen track stayed `muted`
        // (screen-track-muted-sustained / -mute-cleared).
        mutedMs:
          typeof eventPayload.mutedMs === "number"
            ? eventPayload.mutedMs
            : null,
        trackType: eventPayload.trackType || null,
        offsetBytes:
          typeof eventPayload.offset === "number" ? eventPayload.offset : null,
        fileSize:
          typeof eventPayload.totalBytes === "number"
            ? eventPayload.totalBytes
            : typeof eventPayload.finalizedBytes === "number"
            ? eventPayload.finalizedBytes
            : null,
        // The heartbeat schema reads totalBytes, the fileSize mapping above
        // serves the upload events.
        totalBytes:
          typeof eventPayload.totalBytes === "number"
            ? eventPayload.totalBytes
            : null,
        // Uploader emits this on upload_error but the mapping never forwarded it,
        // so a failed chunk's status was only recoverable by parsing errMsg.
        httpStatus:
          typeof eventPayload.httpStatus === "number"
            ? eventPayload.httpStatus
            : null,
        // One id per host (page load). Two ids on one bunnyVideoId means two
        // writers. The same id twice means one host re-signed.
        clientSessionId: eventPayload.clientSessionId || null,
        trackSweepTicks:
          typeof eventPayload.trackSweepTicks === "number"
            ? eventPayload.trackSweepTicks
            : null,
        queueLength:
          typeof eventPayload.queueLength === "number"
            ? eventPayload.queueLength
            : null,
        // PATCH accounting. This shaper has no passthrough, so a field that
        // is not named here never leaves the extension.
        patchAttempts:
          typeof eventPayload.patchAttempts === "number"
            ? eventPayload.patchAttempts
            : null,
        patchResponses:
          typeof eventPayload.patchResponses === "number"
            ? eventPayload.patchResponses
            : null,
        patchThrows:
          typeof eventPayload.patchThrows === "number"
            ? eventPayload.patchThrows
            : null,
        patchInFlight:
          typeof eventPayload.patchInFlight === "boolean"
            ? eventPayload.patchInFlight
            : null,
        lastPatchStatus:
          typeof eventPayload.lastPatchStatus === "number"
            ? eventPayload.lastPatchStatus
            : null,
        lastPatchOutcome:
          typeof eventPayload.lastPatchOutcome === "string"
            ? eventPayload.lastPatchOutcome
            : null,
        sinceLastPatchStartMs:
          typeof eventPayload.sinceLastPatchStartMs === "number"
            ? eventPayload.sinceLastPatchStartMs
            : null,
        sinceLastPatchEndMs:
          typeof eventPayload.sinceLastPatchEndMs === "number"
            ? eventPayload.sinceLastPatchEndMs
            : null,
        // Allowlisting here is necessary but not sufficient: the server sanitizer
        // needs them too. Folded into `reason`, which survives either way.
        queuedBytes:
          typeof eventPayload.queuedBytes === "number"
            ? eventPayload.queuedBytes
            : null,
        stallMs:
          typeof eventPayload.stallMs === "number"
            ? eventPayload.stallMs
            : null,
        serverOffset:
          typeof eventPayload.serverOffset === "number"
            ? eventPayload.serverOffset
            : null,
        clientOffset:
          typeof eventPayload.clientOffset === "number"
            ? eventPayload.clientOffset
            : null,
        divergence:
          typeof eventPayload.divergence === "number"
            ? eventPayload.divergence
            : null,
        gapBytes:
          typeof eventPayload.gapBytes === "number"
            ? eventPayload.gapBytes
            : null,
        sentBytes:
          typeof eventPayload.sentBytes === "number"
            ? eventPayload.sentBytes
            : null,
        stuckAtInit:
          typeof eventPayload.stuckAtInit === "boolean"
            ? eventPayload.stuckAtInit
            : null,
        siblingProgressing:
          typeof eventPayload.siblingProgressing === "boolean"
            ? eventPayload.siblingProgressing
            : null,
        // isPaused true + patchAttempts 0 means processQueue never ran, not a hung PATCH.
        isPaused:
          typeof eventPayload.isPaused === "boolean"
            ? eventPayload.isPaused
            : null,
        isFinalizing:
          typeof eventPayload.isFinalizing === "boolean"
            ? eventPayload.isFinalizing
            : null,
        resUrlMatches:
          typeof eventPayload.resUrlMatches === "boolean"
            ? eventPayload.resUrlMatches
            : null,
        trigger:
          typeof eventPayload.trigger === "string"
            ? eventPayload.trigger
            : null,
        // Set on recording_heartbeat. These existed in the server schema but
        // no client path ever sent them.
        availableBytes:
          typeof eventPayload.availableBytes === "number"
            ? eventPayload.availableBytes
            : null,
        localBytes:
          typeof eventPayload.localBytes === "number"
            ? eventPayload.localBytes
            : null,
        storageQuotaBytes:
          typeof eventPayload.storageQuotaBytes === "number"
            ? eventPayload.storageQuotaBytes
            : null,
        storageUsageBytes:
          typeof eventPayload.storageUsageBytes === "number"
            ? eventPayload.storageUsageBytes
            : null,
        localWriteStats: eventPayload.localWriteStats || null,
        online: typeof navigator !== "undefined" ? navigator.onLine : null,
        visibilityState:
          typeof document !== "undefined" ? document.visibilityState : null,
        errCode: eventPayload.errorCode || null,
        // errMsg first: callers passing the server's own field name were
        // silently nulled here for as long as the mapping has existed.
        errMsg:
          eventPayload.errMsg ||
          eventPayload.message ||
          eventPayload.error ||
          null,
        reason: eventPayload.reason || null,
        mediaId: eventPayload.mediaId || null,
        bunnyVideoId: eventPayload.bunnyVideoId || null,
        projectId: eventPayload.projectId || null,
        sceneId: eventPayload.sceneId || null,
        recordingSessionId: eventPayload.recordingSessionId || null,
        codec: eventPayload.codec || null,
        container: eventPayload.container || null,
        // Fall back to the module globals so post-startup events carry
        // these without every caller threading them through. Events before
        // encoder selection still get null, which is correct.
        encoderKind:
          eventPayload.encoderKind ||
          encoderKinds.screen ||
          encoderKinds.camera ||
          null,
        encoderHwSlots: eventPayload.encoderHwSlots || encoderHwSlots || null,
        // Why this track's encoder was chosen (fallback attribution). Falls
        // back to the per-track module global keyed off the event's track,
        // then screen, so post-selection events carry it without threading.
        encoderReason:
          eventPayload.encoderReason ||
          encoderReasons[eventPayload.trackType] ||
          encoderReasons.screen ||
          encoderReasons.camera ||
          null,
        // Device WebCodecs sticky-disable state at plan time.
        encoderStickyDisabled:
          typeof eventPayload.encoderStickyDisabled === "boolean"
            ? eventPayload.encoderStickyDisabled
            : typeof encoderSticky.disabled === "boolean"
            ? encoderSticky.disabled
            : null,
        encoderStickyReason:
          eventPayload.encoderStickyReason || encoderSticky.reason || null,
        // Capture identity. `event` is a fixed allowlist, so these were
        // dropped client-side before the server sanitizer saw them: that's
        // why upload_sessions logs recordingType/isTab/region as "unknown" on
        // every session. Enums and booleans only, no labels or URLs.
        recordingType:
          eventPayload.recordingType || recordingType.current || null,
        isTab:
          typeof eventPayload.isTab === "boolean"
            ? eventPayload.isTab
            : Boolean(isTab.current),
        region:
          typeof eventPayload.region === "boolean"
            ? eventPayload.region
            : Boolean(regionRef.current),
        // Null on tab capture: displaySurface only exists on getDisplayMedia
        // tracks, so isTab/region are what separate tab from screen.
        screenSurface:
          eventPayload.screenSurface ||
          captureContextRef.current?.screenSurface ||
          null,
        // "No sound in my recording" is unanswerable without knowing whether
        // they asked for sound at all.
        micActive:
          typeof eventPayload.micActive === "boolean"
            ? eventPayload.micActive
            : Boolean(audioIntent.current?.micActive),
        systemAudio:
          typeof eventPayload.systemAudio === "boolean"
            ? eventPayload.systemAudio
            : Boolean(audioIntent.current?.systemAudio),
        storageBackend: eventPayload.storageBackend || null,
        storageInitMs:
          typeof eventPayload.storageInitMs === "number"
            ? eventPayload.storageInitMs
            : null,
        screenStorageBackend: eventPayload.screenStorageBackend || null,
        cameraStorageBackend: eventPayload.cameraStorageBackend || null,
        audioStorageBackend: eventPayload.audioStorageBackend || null,
        // Diagnostic event fields. Only populated on the diagnostic
        // event types (recording_heartbeat, recording_stop_diag,
        // recording_failed_bundle); null otherwise. The server
        // sanitizer drops them cleanly when absent.
        // In `event`, not at the request root: nested objects here are a
        // shape the server sanitizes, an unknown root key risks the body.
        encodeStats: eventPayload.encodeStats || null,
        screenDiag: eventPayload.screenDiag || null,
        cameraDiag: eventPayload.cameraDiag || null,
        audioDiag: eventPayload.audioDiag || null,
        lifecycleBundle: eventPayload.lifecycleBundle || null,
        status: eventPayload.status || null,
        // Finalize reconciliation from bunnyTusUploader: tail bytes lost to a
        // truncated prefix, prior-session bytes recovered from the server
        // offset. Undefined on normal events; truncatedBytes > 0 means loss.
        truncatedBytes:
          typeof eventPayload.truncatedBytes === "number"
            ? eventPayload.truncatedBytes
            : null,
        recoveredBytes:
          typeof eventPayload.recoveredBytes === "number"
            ? eventPayload.recoveredBytes
            : null,
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
          eventPayload.extensionVersion
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
          new Blob([body], { type: "application/json" })
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
      if (res.status === 404 || res.status === 405 || res.status === 413) {
        uploadTelemetryNetworkDisabledRef.current = true;
      }
    } catch {}
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
      extensionVersion: runtime.extensionVersion || resolveExtVersion(),
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

  // Stamps a lifecycle/focus/track event with ms-since-start so a frozen
  // session can be reconstructed. Enums and ms only, no labels/URLs/titles.
  const logForensicEvent = (name, extra = {}) => {
    try {
      const startedAt = recorderSession.current?.startedAt || null;
      // Only during an active recording; capture-context is exempt (fires at acquire).
      if (!startedAt && name !== "capture-context") return;
      const host = IS_OFFSCREEN_HOST
        ? "offscreen"
        : IS_IFRAME_CONTEXT
        ? "iframe"
        : "tab";
      void emitUploadTelemetry("recording_forensic_event", {
        name,
        tMs: startedAt ? Date.now() - startedAt : null,
        host,
        ...(captureContextRef.current || {}),
        ...extra,
      });
    } catch {}
  };

  const emitRecordingOutcome = (outcome, extra = {}) => {
    const session = recorderSession.current;
    const startedAt = session?.startedAt || null;
    const durationMs = startedAt ? Date.now() - startedAt : null;
    const screenState = sessionTrackState.current?.screen || {};
    const cameraState = sessionTrackState.current?.camera || {};
    const chunksPersisted =
      (screenState.durableChunkCount || 0) +
      (cameraState.durableChunkCount || 0);
    const screenServerBytes =
      Number(screenUploader.current?.lastServerOffset) ||
      Number(screenUploader.current?.offset) ||
      0;
    const cameraServerBytes =
      Number(cameraUploader.current?.lastServerOffset) ||
      Number(cameraUploader.current?.offset) ||
      0;
    const serverBytesConfirmed = screenServerBytes + cameraServerBytes;
    // Peak queue depth and backpressure drops ride the outcome event: it's
    // the only fleet-wide read on whether the steady cap fits hardware we
    // can't test. Tagged by track, since a hardware screen encoder and a
    // software camera encoder queue very differently.
    const screenStats = screenRecorder.current?.getEncodeStats?.() || null;
    const cameraStats = cameraRecorder.current?.getEncodeStats?.() || null;
    const encodeStats = screenStats
      ? { ...screenStats, track: "screen" }
      : cameraStats
      ? { ...cameraStats, track: "camera" }
      : null;
    void emitUploadTelemetry("recording_outcome", {
      outcome,
      durationMs,
      chunksPersisted,
      serverBytesConfirmed,
      uploaderType: "cloud_recorder",
      encodeStats,
      // recording_outcome always lands, unlike upload_track_stalled itself.
      trackSweepTicks: trackSweepTicks.current,
      ...extra,
    });
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

  // Capture counters for the stuck-state report. Written to storage rather
  // than answered over messaging, which is the suspect part when the UI hangs.
  const liveProgressAt = useRef(0);
  const writeLiveProgress = () => {
    const ts = Date.now();
    if (ts - liveProgressAt.current < 2000) return;
    liveProgressAt.current = ts;
    const tracks = sessionTrackState.current || {};
    const total = (key) =>
      (tracks.screen?.[key] || 0) +
      (tracks.camera?.[key] || 0) +
      (tracks.audio?.[key] || 0);
    chrome.storage.local
      .set({
        recorderLiveProgress: {
          ts,
          chunks: total("chunkCount"),
          bytes: total("bytesRecorded"),
        },
      })
      .catch(() => {});
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
    writeLiveProgress();
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
    } catch {}
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
    } catch {}
    const next = crypto.randomUUID();
    try {
      await chrome.storage.local.set({
        sceneId: next,
        sceneIdStatus: "recording",
      });
    } catch {}
    return next;
  };

  const markSceneComplete = async (sceneId) => {
    if (!sceneId) return;
    try {
      await chrome.storage.local.set({
        sceneIdStatus: "completed",
        lastCompletedSceneId: sceneId,
      });
    } catch {}
  };

  const upsertPendingScene = async (sceneId, payload) => {
    if (!sceneId) return;
    const indexKey = "pendingSceneIndex";
    const sceneKey = `pendingScene:${sceneId}`;
    const raw = await chrome.storage.local.get([indexKey]);
    // Destructure default doesn't trigger when the stored value is
    // explicitly null (vs. undefined); a previous teardown path could
    // have set it to null and the next .includes() throws. Coerce
    // defensively.
    const pendingSceneIndex = Array.isArray(raw?.[indexKey])
      ? raw[indexKey]
      : [];
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
    const raw = await chrome.storage.local.get([indexKey]);
    const pendingSceneIndex = Array.isArray(raw?.[indexKey])
      ? raw[indexKey]
      : [];
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
    const { screenityToken } = await chrome.storage.local.get([
      "screenityToken",
    ]);
    await fetch(`${API_BASE}/media/${mediaId}/scene/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(screenityToken
          ? { Authorization: `Bearer ${screenityToken}` }
          : {}),
      },
      body: JSON.stringify({ projectId, sceneId }),
    });
  };

  const confirmLinkedMedia = async (projectId, sceneId, mediaIds = []) => {
    const filtered = mediaIds.filter(Boolean);
    if (!projectId || !sceneId || filtered.length === 0) return;
    const { screenityToken } = await chrome.storage.local.get([
      "screenityToken",
    ]);
    await fetch(`${API_BASE}/media/confirm-linked/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(screenityToken
          ? { Authorization: `Bearer ${screenityToken}` }
          : {}),
      },
      body: JSON.stringify({ mediaIds: filtered, projectId, sceneId }),
    });
  };

  const ensureMediaLinked = async ({ projectId, sceneId, mediaIds }) => {
    const filtered = (mediaIds || []).filter(Boolean);
    if (!projectId || !sceneId || filtered.length === 0) return;
    await Promise.allSettled(
      filtered.map((mediaId) => linkMediaToScene(projectId, sceneId, mediaId))
    );
    await confirmLinkedMedia(projectId, sceneId, filtered);
  };

  const recoverScene = async ({
    projectId,
    sceneId,
    screenMediaId,
    cameraMediaId,
    audioMediaId,
    audioLayout = null,
    durations = null,
    dimensions = null,
  }) => {
    if (!projectId || !sceneId) return { ok: false, error: "missing-ids" };
    const mediaIds = [screenMediaId, cameraMediaId, audioMediaId].filter(
      Boolean
    );
    const { screenityToken } = await chrome.storage.local.get([
      "screenityToken",
    ]);
    const res = await fetch(`${API_BASE}/videos/${projectId}/recover-scene/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(screenityToken
          ? { Authorization: `Bearer ${screenityToken}` }
          : {}),
      },
      body: JSON.stringify({
        sceneId,
        mediaIds,
        screenMediaId: screenMediaId || null,
        cameraMediaId: cameraMediaId || null,
        audioMediaId: audioMediaId || null,
        ...(audioLayout ? { audioLayout } : {}),
        // Server stamps these onto media docs so scenes land with the
        // real length instead of waiting for Bunny's encoded webhook.
        durations: durations || undefined,
        dimensions: dimensions || undefined,
      }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      return { ok: false, error: errorText || "recover-scene-failed" };
    }
    return { ok: true };
  };

  // Tab keep-alive: Chrome throttles/freezes background tabs after ~5 minutes
  // of inactivity. Multi-layered signals (silent audio, web lock, mediaSession)
  // are needed because throttling stacks them.
  const startTabKeepAlive = () => {
    if (IS_OFFSCREEN_HOST) return;

    // The pinned cloudrecorder tab isn't visible while recording the source
    // tab, so without keepalive the renderer backgrounds and the encode loop
    // lags into VFR. Layers live in utils/tabKeepalive.js.
    if (!keepAliveHandle.current) {
      keepAliveHandle.current = startTabKeepalive();
    }

    chrome.runtime.sendMessage({
      type: "set-tab-auto-discardable",
      discardable: false,
    });
    chrome.runtime
      .sendMessage({ type: "start-recorder-keepalive-alarm" })
      .catch(() => {});
  };

  const stopTabKeepAlive = () => {
    try {
      if (keepAliveHandle.current) {
        stopTabKeepalive(keepAliveHandle.current);
        keepAliveHandle.current = null;
      }

      chrome.runtime.sendMessage({
        type: "set-tab-auto-discardable",
        discardable: true,
      });
      chrome.runtime
        .sendMessage({ type: "stop-recorder-keepalive-alarm" })
        .catch((err) => {
          // Surface failures: a leftover alarm can outlive the recording and re-wake the SW.
          console.warn(
            "[CloudRecorder] stop-recorder-keepalive-alarm failed",
            err
          );
        });

      chrome.runtime
        .sendMessage({ type: "cancel-first-chunk-watchdog" })
        .catch((err) => {
          console.warn(
            "[CloudRecorder] cancel-first-chunk-watchdog failed",
            err
          );
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
    screenTrackMutedSinceRef.current = null;
    screenTrackMuteReportedRef.current = false;
    // Capture identity from the bound track (fires on every acquisition path).
    // Enums and booleans only, no track.label/title/URL.
    try {
      const trackSettings = track.getSettings?.() || {};
      captureContextRef.current = {
        recordingType: recordingType.current || null,
        displaySurface: trackSettings.displaySurface || null,
        screenSurface: trackSettings.displaySurface || null,
        isTab: !!isTab.current,
        region: Boolean(regionRef.current),
      };
      logForensicEvent("capture-context");
    } catch {}
    logScreenTrackEvent("track-start", track);

    track.onended = () => {
      screenTrackLostRef.current = true;
      logScreenTrackEvent("track-ended", track);
      const label = track?.label || null;

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

      // Forward to remote, redacting the window/tab label the local diag keeps.
      logForensicEvent("screen-track-ended", {
        readyState: track?.readyState || null,
        hasChunks: hasChunks.current,
      });

      chrome.storage.local.set({
        screenTrackLost: true,
        lastTrackEndedEvent: diagnosticInfo,
        lastTrackEnded: diagnosticInfo,
      });

      // Track end means we'd record frozen/black video silently; stop instead.
      if (!isFinishing.current && !sentLast.current) {
        console.warn("⚠️ Screen track ended - stopping recording");
        stopRecording(true, "screen-track-ended");
      }
    };

    track.onmute = () => {
      screenTrackLostRef.current = true;
      logScreenTrackEvent("track-muted", track);
      logForensicEvent("screen-track-muted");
    };
    track.onunmute = () => {
      screenTrackLostRef.current = false;
      logScreenTrackEvent("track-unmuted", track);
      logForensicEvent("screen-track-unmuted");
    };

    startScreenTrackMonitor();
  };

  // Camera-track lifecycle listener. Unlike bindScreenTrack, a camera
  // unplug doesn't tear down the recording: screen + audio are still
  // healthy, so we only log diag and surface a non-fatal toast.
  const bindCameraTrack = (track) => {
    if (!track) return;
    try {
      // onmute only fires on a transition. A camera held by another app hands
      // back a live-but-muted track that delivers no frames and never fires it.
      if (track.muted === true || track.readyState !== "live") {
        try {
          chrome.runtime.sendMessage({
            type: "diag-forward",
            event: "cloudrecorder-camera-track-dead-at-bind",
            data: {
              label: track?.label || null,
              readyState: track?.readyState || null,
              muted: Boolean(track.muted),
              enabled: Boolean(track.enabled),
              ts: Date.now(),
            },
          });
        } catch {}
      }
      track.onended = () => {
        const diag = {
          reason: "camera-track-ended",
          label: track?.label || null,
          readyState: track?.readyState || null,
          ts: Date.now(),
          hasChunks: hasChunks.current,
          recorderState: cameraRecorder.current?.state || null,
        };
        console.warn(
          "🔴 Camera track ended unexpectedly (e.g. USB unplug)",
          diag
        );
        try {
          chrome.runtime.sendMessage({
            type: "diag-forward",
            event: "cloudrecorder-camera-track-ended",
            data: diag,
          });
        } catch {}
      };
      track.onmute = () => {
        try {
          chrome.runtime.sendMessage({
            type: "diag-forward",
            event: "cloudrecorder-camera-track-muted",
            data: { label: track?.label || null },
          });
        } catch {}
      };
    } catch {}
  };

  const startScreenTrackMonitor = () => {
    if (screenTrackMonitor.current) clearInterval(screenTrackMonitor.current);
    screenTrackMonitor.current = setInterval(() => {
      const track = screenStream.current?.getVideoTracks?.()[0] || null;
      if (!track) return;
      if (track.readyState === "ended" && !screenTrackLostRef.current) {
        screenTrackLostRef.current = true;
        logScreenTrackEvent("monitor-ended", track);

        if (!isFinishing.current && !sentLast.current) {
          console.warn(
            "⚠️ Screen track monitor detected ended track - stopping recording"
          );
          stopRecording(true, "screen-track-monitor-ended");
        }
        return;
      }

      // `muted` with readyState still "live" delivers nothing, but the
      // static-frame fallback keeps re-encoding the last frame so every other
      // guard sees a healthy recording. Observe-only: mute fires transiently
      // (crbug 40200910), so stopping here would kill recoverable sessions.
      const muted = track.muted === true;
      if (muted && !screenTrackMutedSinceRef.current) {
        screenTrackMutedSinceRef.current = Date.now();
      } else if (!muted && screenTrackMutedSinceRef.current) {
        logForensicEvent("screen-track-mute-cleared", {
          mutedMs: Date.now() - screenTrackMutedSinceRef.current,
        });
        screenTrackMutedSinceRef.current = null;
        screenTrackMuteReportedRef.current = false;
      }
      if (
        muted &&
        screenTrackMutedSinceRef.current &&
        !screenTrackMuteReportedRef.current &&
        Date.now() - screenTrackMutedSinceRef.current >= 10000
      ) {
        // Once per sustained mute, not every 5s tick.
        screenTrackMuteReportedRef.current = true;
        logScreenTrackEvent("monitor-muted-sustained", track);
        logForensicEvent("screen-track-muted-sustained", {
          mutedMs: Date.now() - screenTrackMutedSinceRef.current,
        });
      }
    }, 5000);
  };

  const ensureChunkStoreReady = async () => {
    if (idbReadyRef.current) return true;
    const sessionId = ensureRecordingSessionId();
    storageOpfsSessionId = sessionId;
    try {
      const result = await chooseChunksStore({ sessionId, track: "screen" });
      chunksStore = result.store;
      storageBackends.screen = result.backend;
      if (result.backend === "idb") {
        // chooseChunksStore returned IDB without probing it; verify writability
        // here so the failure path matches the previous behaviour.
        await chunksStore.setItem("__probe", { ts: Date.now() });
        await chunksStore.removeItem("__probe");
      }
      idbReadyRef.current = true;
      void emitUploadTelemetry("upload_local_backup_enabled", {
        backupType: "screen",
        storageBackend: result.backend,
        storageInitMs: result.initMs,
      });
      return true;
    } catch (err) {
      fatalErrorRef.current = true;
      void emitUploadTelemetry("upload_local_backup_unavailable", {
        backupType: "screen",
        storageBackend: storageBackends.screen,
        error: err?.message || String(err),
      });
      sendRecordingError("Local storage is blocked. Recording cannot start.");
      return false;
    }
  };

  const ensureAudioChunkStoreReady = async () => {
    if (audioChunkStoreReadyRef.current) return true;
    const sessionId = ensureRecordingSessionId();
    storageOpfsSessionId = sessionId;
    try {
      const result = await chooseChunksStore({ sessionId, track: "audio" });
      audioChunksStore = result.store;
      storageBackends.audio = result.backend;
      if (result.backend === "idb") {
        await audioChunksStore.setItem("__probe", { ts: Date.now() });
        await audioChunksStore.removeItem("__probe");
      }
      audioChunkStoreReadyRef.current = true;
      void emitUploadTelemetry("upload_local_backup_enabled", {
        backupType: "audio",
        storageBackend: result.backend,
        storageInitMs: result.initMs,
      });
      return true;
    } catch (err) {
      audioChunkStoreReadyRef.current = false;
      void emitUploadTelemetry("upload_local_backup_degraded", {
        backupType: "audio",
        storageBackend: storageBackends.audio,
        error: err?.message || String(err),
      });
      return false;
    }
  };

  const clearAudioChunkStore = async (reason = "unknown") => {
    audioChunkIndexRef.current = 0;
    // Clear unconditionally: if IDB degraded mid-session the ready flag is false,
    // but partial chunks written before degradation must still be cleared.
    try {
      await audioChunksStore.clear();
      console.info("[CloudRecorder] clearAudioChunkStore:", reason);
    } catch (err) {
      console.warn("Failed to clear audio chunk store:", err);
    }
  };

  const ensureCameraChunkStoreReady = async () => {
    if (cameraChunkStoreReadyRef.current) return true;
    const sessionId = ensureRecordingSessionId();
    storageOpfsSessionId = sessionId;
    try {
      const result = await chooseChunksStore({ sessionId, track: "camera" });
      cameraChunksStore = result.store;
      storageBackends.camera = result.backend;
      if (result.backend === "idb") {
        await cameraChunksStore.setItem("__probe", { ts: Date.now() });
        await cameraChunksStore.removeItem("__probe");
      }
      cameraChunkStoreReadyRef.current = true;
      void emitUploadTelemetry("upload_local_backup_enabled", {
        backupType: "camera",
        storageBackend: result.backend,
        storageInitMs: result.initMs,
      });
      return true;
    } catch (err) {
      cameraChunkStoreReadyRef.current = false;
      void emitUploadTelemetry("upload_local_backup_degraded", {
        backupType: "camera",
        storageBackend: storageBackends.camera,
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

  const currentPrefixBudget = () =>
    resolvePrefixBudget({
      headroom: storagePressureRef.current.headroom,
      transportCapBytes: LOCAL_SCREEN_PLAYBACK_MAX_BYTES,
      comfortBytes: CHUNK_PURGE_COMFORT_HEADROOM_BYTES,
      lowBytes: STORAGE_LOW_HEADROOM_BYTES,
    });

  const currentPurgeMode = () =>
    resolvePurgeMode({
      headroom: storagePressureRef.current.headroom,
      lowBytes: STORAGE_LOW_HEADROOM_BYTES,
    });

  // chunk_0 stays: it's the init segment the crash-recovery and Download
  // paths need. Unconfirmed chunks stay too, see selectPrefixChunksToDrop.
  const dropRetainedPrefix = async (
    store,
    keyPrefix,
    uploader,
    rangesRef,
    confirmedOffset = null,
    markIndex = Infinity
  ) => {
    const prefix = screenRetainedPrefixRef.current;
    const selected = selectPrefixChunksToDrop({
      prefix,
      lastServerOffset:
        confirmedOffset ?? (Number(uploader?.lastServerOffset) || 0),
      safetyWindowBytes: CHUNK_PURGE_SAFETY_WINDOW_BYTES,
    });
    const keptUnconfirmed = selected.keptUnconfirmed;
    const drop = selected.drop.filter((i) => i <= markIndex);
    // Stop offering local playback either way: the opening is about to be
    // partly gone, so an offer built from it would not decode.
    screenRetainedPrefixRef.current = {
      chunks: 0,
      bytes: 0,
      dropped: true,
      endBytes: [],
    };
    if (!drop.length) return;

    const endBytes = prefix.endBytes || [];
    let removed = 0;
    let freedBytes = 0;
    for (const i of drop) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await store.removeItem(`${keyPrefix}${i}`);
      } catch (err) {
        console.warn(
          `[CloudRecorder] purge retained prefix chunk_${i} failed`,
          err
        );
        break;
      }
      removed += 1;
      freedBytes += (endBytes[i] || 0) - (endBytes[i - 1] || 0);
    }
    if (removed > 0) {
      // The trailing pass below still sees these entries otherwise and bills
      // the same bytes a second time.
      const dropped = new Set(drop.slice(0, removed));
      const tracked = rangesRef?.current;
      if (Array.isArray(tracked)) {
        for (let i = tracked.length - 1; i >= 0; i -= 1) {
          if (dropped.has(tracked[i]?.index)) tracked.splice(i, 1);
        }
      }
      chunksPurgedDuringRecordingRef.current = true;
      screenChunksPurgedCountRef.current += removed;
      // Only what actually left disk, or the heartbeat reports reclaimed
      // space that is still occupied.
      chunksPurgedBytesRef.current += freedBytes;
      console.info(
        "[CloudRecorder] Dropped retained playback prefix under storage pressure",
        {
          removed,
          freedBytes,
          keptUnconfirmed,
          headroom: storagePressureRef.current.headroom,
        }
      );
    }
  };

  // Where a track's chunks on disk pick up after the purged gap. Resume can't
  // place the bytes that follow a gap without it.
  const persistPurgeMark = (track, entry) => {
    // Screen and camera share one key, so writes run one at a time or one
    // track can put back the other's older mark after its chunks are gone.
    const run = purgeMarkChainRef.current.then(() =>
      writePurgeMark(track, entry)
    );
    purgeMarkChainRef.current = run.catch(() => false);
    return run;
  };

  const writePurgeMark = async (track, entry) => {
    const sessionId = recorderSession.current?.id;
    if (!sessionId) return false;
    if ((purgeMarksRef.current[track]?.index ?? -1) >= entry.index) return true;
    const key = `chunkPurgeMarks:${sessionId}`;
    const next = {
      ...purgeMarksRef.current,
      [track]: { index: entry.index, endByte: entry.endByte },
    };
    try {
      await chrome.storage.local.set({ [key]: next });
      // The offscreen storage proxy swallows a failed write, so only a read
      // back proves the mark exists before anything is deleted.
      const { [key]: stored } = await chrome.storage.local.get([key]);
      if (stored?.[track]?.index !== entry.index) return false;
    } catch {
      return false;
    }
    purgeMarksRef.current = next;
    return true;
  };

  // Purge IDB chunks Bunny has confirmed. chunk_0 (webm init segment) is preserved.
  const purgeConfirmedChunks = async (
    store,
    rangesRef,
    uploader,
    keyPrefix,
    trackLabel
  ) => {
    if (!uploader || !rangesRef.current.length) return;
    const mode = currentPurgeMode();
    purgeModeRef.current = mode;
    if (purgeInFlightRef.current[trackLabel]) return;
    purgeInFlightRef.current[trackLabel] = true;
    try {
      await runPurgePass(
        store,
        rangesRef,
        uploader,
        keyPrefix,
        trackLabel,
        mode
      );
    } finally {
      purgeInFlightRef.current[trackLabel] = false;
    }
  };

  const runPurgePass = async (
    store,
    rangesRef,
    uploader,
    keyPrefix,
    trackLabel,
    mode
  ) => {
    const isScreen = trackLabel === "screen";
    // One reading per pass. A PATCH landing mid-pass would otherwise widen the
    // deletes past the mark just saved.
    const confirmedOffset = Number(uploader.lastServerOffset) || 0;
    const { untrack: confirmed } = selectChunksToPurge({
      ranges: rangesRef.current,
      lastServerOffset: confirmedOffset,
      safetyWindowBytes: CHUNK_PURGE_SAFETY_WINDOW_BYTES,
      prefixChunks: 0,
    });
    // Written before anything leaves disk, so a crash can't leave a gap
    // resume has no position for.
    const lastConfirmed = confirmed[confirmed.length - 1];
    if (lastConfirmed && !(await persistPurgeMark(trackLabel, lastConfirmed))) {
      return;
    }
    const markIndex = purgeMarksRef.current[trackLabel]?.index ?? -1;
    if (isScreen && mode === "all") {
      await dropRetainedPrefix(
        store,
        keyPrefix,
        uploader,
        rangesRef,
        confirmedOffset,
        markIndex
      );
    }
    const ranges = rangesRef.current;
    const { untrack, purge } = selectChunksToPurge({
      ranges,
      lastServerOffset: confirmedOffset,
      safetyWindowBytes: CHUNK_PURGE_SAFETY_WINDOW_BYTES,
      prefixChunks: isScreen ? screenRetainedPrefixRef.current.chunks : 0,
    });
    if (!untrack.length) return;
    let purgedCount = 0;
    let purgedBytes = 0;
    for (const entry of purge) {
      if (entry.index > markIndex) break;
      try {
        // eslint-disable-next-line no-await-in-loop
        await store.removeItem(`${keyPrefix}${entry.index}`);
      } catch (err) {
        console.warn(
          `[CloudRecorder] purge ${trackLabel} chunk_${entry.index} failed`,
          err
        );
        break;
      }
      purgedCount++;
      purgedBytes += entry.size || 0;
    }
    // Stop at the first chunk whose delete failed so it's retried next pass.
    // Retained chunks leave the tracking list even though their files stay.
    const consumed =
      purgedCount === purge.length
        ? untrack.length
        : untrack.indexOf(purge[purgedCount]);
    // splice, not reassignment: this runs un-awaited while ondataavailable
    // pushes new ranges onto the tail.
    ranges.splice(0, Math.max(0, consumed));
    if (purgedCount > 0) {
      chunksPurgedDuringRecordingRef.current = true;
      chunksPurgedBytesRef.current += purgedBytes;
      if (trackLabel === "screen") {
        screenChunksPurgedCountRef.current += purgedCount;
      } else if (trackLabel === "camera") {
        cameraChunksPurgedCountRef.current += purgedCount;
      }
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
        console.info("[CloudRecorder] Cleared local screen playback offer", {
          reason,
          offerId: existingOffer?.offerId || null,
        });
      }
    } catch (err) {
      console.warn(
        "[CloudRecorder] Failed to clear local screen playback offer",
        {
          reason,
          error: err?.message || err,
        }
      );
    }
  };

  // BG turns this into a /log/upload-event. chrome.storage.local alone told
  // us nothing about whether local playback actually worked.
  const reportLocalPlaybackOutcome = (outcome, detail = {}) => {
    try {
      chrome.runtime
        .sendMessage({
          type: "cloud-local-playback-report",
          outcome,
          recordingSessionId:
            recorderSession.current?.id || recordingSessionId.current || null,
          ...detail,
        })
        .catch(() => {});
    } catch {}
  };

  const registerLocalScreenPlaybackOffer = async ({
    projectId,
    sceneId,
    uploadMeta,
  }) => {
    if (!projectId || !sceneId) {
      return null;
    }

    let storeChunkCount = 0;
    try {
      storeChunkCount = await chunksStore.length();
    } catch {
      storeChunkCount = 0;
    }
    if (!storeChunkCount) {
      console.info(
        "[CloudRecorder] Local-first screen offer unavailable: no local chunks",
        {
          projectId,
          sceneId,
        }
      );
      reportLocalPlaybackOutcome("skipped", {
        projectId,
        sceneId,
        reason: "no-local-chunks",
      });
      return null;
    }

    const totalBytes =
      screenUploader.current?.offset ||
      sessionTrackState.current?.screen?.bytesRecorded ||
      0;
    if (!totalBytes || totalBytes <= 0) {
      console.info(
        "[CloudRecorder] Local-first screen offer unavailable: no byte estimate",
        {
          projectId,
          sceneId,
          chunkCount: storeChunkCount,
        }
      );
      reportLocalPlaybackOutcome("skipped", {
        projectId,
        sceneId,
        reason: "no-byte-estimate",
        chunkCount: storeChunkCount,
      });
      return null;
    }

    const plan = resolveLocalPlaybackPlan({
      // The camera purge sets the shared flag too, which marked a fully
      // retained screen source partial and sent the editor to a 404.
      purged: screenChunksPurgedCountRef.current > 0,
      prefix: screenRetainedPrefixRef.current,
      totalBytes,
      storeChunkCount,
      maxBytes: LOCAL_SCREEN_PLAYBACK_MAX_BYTES,
    });
    if (!plan.chunkCount || !plan.availableBytes) {
      console.info("[CloudRecorder] Local-first screen offer skipped", {
        projectId,
        sceneId,
        reason: plan.reason,
        totalBytes,
        storeChunkCount,
        purgedScreenChunks: screenChunksPurgedCountRef.current,
        purgedBytes: chunksPurgedBytesRef.current,
      });
      reportLocalPlaybackOutcome("skipped", {
        projectId,
        sceneId,
        reason: plan.reason,
        totalBytes,
        chunkCount: storeChunkCount,
        purgeMode: purgeModeRef.current,
      });
      return null;
    }

    const chunkCount = plan.chunkCount;
    const estimatedBytes = plan.availableBytes;

    const now = Date.now();
    const screenBackend = storageBackends.screen || "idb";
    const offerOpfsSessionId =
      screenBackend === "opfs"
        ? storageOpfsSessionId ||
          recorderSession.current?.opfsSessionId ||
          recorderSession.current?.id ||
          null
        : null;
    const screenContainer = trackContainers.screen || "video/webm";
    const nextOffer = {
      offerId: crypto.randomUUID(),
      projectId,
      sceneId,
      recordingSessionId:
        recorderSession.current?.id || recordingSessionId.current || null,
      trackType: "screen",
      chunkCount,
      estimatedBytes,
      // partial = the offer covers only the opening of the recording, so the
      // editor falls back to the remote URL at the end.
      partial: plan.partial,
      availableBytes: estimatedBytes,
      totalBytes,
      mediaId: uploadMeta?.screen?.mediaId || null,
      bunnyVideoId: uploadMeta?.screen?.videoId || null,
      createdAt: now,
      expiresAt: now + LOCAL_SCREEN_PLAYBACK_TTL_MS,
      status: "available",
      source:
        screenBackend === "opfs"
          ? "opfs-screen-chunks"
          : "indexeddb-screen-chunks",
      storageBackend: screenBackend,
      opfsSessionId: offerOpfsSessionId,
      // Container drives the mimeType the editor uses for `<video>`. WebM
      // for the legacy MediaRecorder path, MP4 for the WebCodecs path.
      container: screenContainer,
      encoderKind: encoderKinds.screen || "mediarecorder",
    };

    try {
      const result = await chrome.runtime.sendMessage({
        type: "cloud-local-playback-register",
        offer: nextOffer,
      });
      if (result?.ok && result.offer) {
        localScreenPlaybackOfferRef.current = result.offer;
        console.info("[CloudRecorder] Local-first screen offer registered", {
          projectId,
          sceneId,
          offerId: result.offer.offerId,
          chunkCount: result.offer.chunkCount,
          estimatedBytes: result.offer.estimatedBytes,
          partial: result.offer.partial,
          totalBytes,
          expiresAt: result.offer.expiresAt,
        });
        return result.offer;
      }
      reportLocalPlaybackOutcome("skipped", {
        projectId,
        sceneId,
        reason: result?.error || "register-rejected",
        chunkCount,
        availableBytes: estimatedBytes,
        totalBytes,
        partial: plan.partial,
        purgeMode: purgeModeRef.current,
      });
    } catch (err) {
      console.warn(
        "[CloudRecorder] Failed to register local-first screen offer",
        {
          projectId,
          sceneId,
          error: err?.message || err,
        }
      );
      reportLocalPlaybackOutcome("skipped", {
        projectId,
        sceneId,
        reason: "register-failed",
        chunkCount,
        availableBytes: estimatedBytes,
        totalBytes,
        partial: plan.partial,
      });
    }

    return null;
  };

  // Mislabelling mp4 chunks as webm breaks decodeAudioData (and so the
  // silence check) plus the recovery download's extension.
  const audioBlobType = () =>
    trackContainers.audio === "audio/mp4" ? "audio/mp4" : "audio/webm";

  const buildAudioBlobFromDurableStore = async () => {
    // Try IDB even if audioChunkStoreReadyRef is false: partial pre-degradation
    // data is more complete than the 8-chunk memory window.
    try {
      const recovered = [];
      await audioChunksStore.iterate((value) => {
        if (value?.chunk) {
          recovered.push(value);
        }
      });
      recovered.sort((a, b) => (a.index || 0) - (b.index || 0));
      if (recovered.length > 0) {
        console.info(
          "[CloudRecorder] buildAudioBlobFromDurableStore: using IDB",
          {
            chunks: recovered.length,
            storeWasReady: audioChunkStoreReadyRef.current,
          }
        );
        return createBlobFromChunks(
          recovered.map((entry) => entry.chunk),
          audioBlobType()
        );
      }
      console.info(
        "[CloudRecorder] buildAudioBlobFromDurableStore: IDB empty, using memory",
        {
          memoryChunks: audioChunks.current.length,
          storeWasReady: audioChunkStoreReadyRef.current,
        }
      );
    } catch (err) {
      console.warn(
        "[CloudRecorder] buildAudioBlobFromDurableStore: IDB read failed, falling back to memory",
        {
          error: err?.message || String(err),
          memoryChunks: audioChunks.current.length,
          storeWasReady: audioChunkStoreReadyRef.current,
        }
      );
      void emitUploadTelemetry("upload_local_backup_degraded", {
        backupType: "audio",
        reason: "audio-idb-read-failed-at-finalize",
        error: err?.message || String(err),
      });
    }
    return createBlobFromChunks(audioChunks.current, audioBlobType());
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
      // Tracks which backend each track wrote to so restore / Download.jsx /
      // cloud-local-playback handlers can route reads to the same backend.
      // opfsSessionId is the directory key under cloud-chunks/ for OPFS
      // tracks; safe to keep null when all tracks are IDB.
      storageBackends: { ...storageBackends },
      opfsSessionId:
        storageOpfsSessionId || recorderSession.current?.id || null,
      // Encoder + container per track so Download.jsx writes the right
      // file extension on recovery and cloud-local-playback returns the
      // right mimeType to the editor.
      encoderKinds: { ...encoderKinds },
      trackContainers: { ...trackContainers },
      trackCodecs: { ...trackCodecs },
      encoderHwSlots,
      // Resume holds a separated mic's chunks on this. The container can't tell.
      separatedAudio: separatedAudio.current,
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
        const existing = await chrome.storage.local.get([
          SESSION_STATE_INDEX_KEY,
        ]);
        const index = Array.isArray(existing?.[SESSION_STATE_INDEX_KEY])
          ? existing[SESSION_STATE_INDEX_KEY]
          : [];
        payload[SESSION_STATE_INDEX_KEY] = index.includes(
          recorderSession.current.id
        )
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
      storageBackends: { ...storageBackends },
      opfsSessionId: storageOpfsSessionId || sessionId || null,
      encoderKinds: { ...encoderKinds },
      trackContainers: { ...trackContainers },
      trackCodecs: { ...trackCodecs },
      encoderHwSlots,
      separatedAudio: separatedAudio.current,
      diag: captureSessionDiag(),
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
            "Another Screenity recorder is already running. Please close it and try again."
        );
        return false;
      }
    } catch (err) {
      console.warn(
        "Failed to register recording session with background:",
        err
      );
    }
    return true;
  };

  // Read the mixed bus for a moment after start. A silent bus with a live
  // mic is the signature that costs the user their voice for the whole take.
  const measureBusWarmup = async () => {
    const analyser = busTap.current;
    if (!analyser || busWarmupRef.current.ran) return;
    busWarmupRef.current.ran = true;
    const buf = new Float32Array(analyser.fftSize);
    let peak = 0;
    for (let i = 0; i < 6; i++) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (isFinishing.current) return;
      try {
        analyser.getFloatTimeDomainData(buf);
      } catch {
        return;
      }
      let sum = 0;
      for (let j = 0; j < buf.length; j++) sum += buf[j] * buf[j];
      peak = Math.max(peak, Math.sqrt(sum / buf.length));
    }
    busWarmupRef.current.rms = peak;
    const micTrack = rawMicStream.current?.getAudioTracks?.()[0] || null;
    const fault = isBusSilentFault({
      rms: peak,
      micIntended: busSources.current.mic,
      hasLiveMicTrack: Boolean(micTrack && micTrack.readyState === "live"),
    });
    busWarmupRef.current.silentFault = fault;
    if (!fault) return;
    // Backstop for anything that suspends the graph after start. Safe while
    // unpaused, and never touches the gain the user muted deliberately.
    if (
      aCtx.current &&
      needsContextResume({
        state: aCtx.current.state,
        paused: pausedStateRef.current,
      })
    ) {
      try {
        await aCtx.current.resume();
      } catch {}
    }
    diagForward("audio-bus-silent-at-start", {
      rms: peak,
      ctxState: aCtx.current?.state ?? null,
      ctxStateAtStart: busWarmupRef.current.ctxStateAtStart,
      ctxResumedAtStart: busWarmupRef.current.ctxResumedAtStart,
      busHasMic: busSources.current.mic,
      busHasSystem: busSources.current.system,
      micGain: audioInputGain.current?.gain?.value ?? null,
      trackMuted: micTrack ? Boolean(micTrack.muted) : null,
      trackEnabled: micTrack ? Boolean(micTrack.enabled) : null,
    });
  };

  // MediaRecorder has no getDiagSnapshot(), so assemble the equivalent from
  // sessionTrackState plus the live mic track. Null only when the mic wasn't
  // part of the recording; zero bytes still returns a snapshot.
  const getAudioDiagSnapshot = () => {
    try {
      const micChosen = audioIntent.current?.micActive === true;
      const hasUploader = Boolean(audioUploader.current);
      const hasRecorder = Boolean(audioRecorder.current);
      // System-audio-only sessions have no mic/uploader/recorder but still carry
      // audio via the screen (or camera, camera-only mode) WebCodecs recorder;
      // null there means the MediaRecorder fallback.
      const muxAudioDiag =
        screenRecorder.current?.getAudioDiag?.() ||
        cameraRecorder.current?.getAudioDiag?.() ||
        null;
      if (!micChosen && !hasUploader && !hasRecorder && !muxAudioDiag) {
        return null;
      }

      const track = rawMicStream.current?.getAudioTracks?.()[0] || null;
      const audioState = sessionTrackState.current?.audio || {};
      const uploaderMeta = audioUploader.current?.getMeta?.() || null;
      return {
        // Authoritative user intent, the disambiguator that keeps a
        // user-disabled mic from ever being read as a failure.
        micChosen,
        encoderKind: encoderKinds.audio || null,
        recorderState: audioRecorder.current?.state || null,
        // Live mic-track health. A missing/ended/system-muted track with
        // micChosen=true is the genuine fault signature.
        trackCount: rawMicStream.current?.getAudioTracks?.().length || 0,
        trackReadyState: track?.readyState || null,
        trackMuted: track ? Boolean(track.muted) : null,
        trackEnabled: track ? Boolean(track.enabled) : null,
        // Data flow. chunksOut === 0 with micChosen=true === empty audio.
        chunksOut: audioState.chunkCount || 0,
        bytesRecorded: audioState.bytesRecorded || 0,
        durableChunkCount: audioState.durableChunkCount || 0,
        lastChunkAt: audioState.lastChunkAt || null,
        captureDegraded: Boolean(audioCaptureDegradedRef.current),
        uploaderStatus: uploaderMeta?.status || null,
        uploaderOffset:
          typeof uploaderMeta?.offset === "number" ? uploaderMeta.offset : null,
        // Throttling context: a backgrounded tab starves MediaRecorder.
        documentHidden:
          typeof document !== "undefined" ? document.hidden : null,
        visibilityState:
          typeof document !== "undefined" ? document.visibilityState : null,
        // What the mux actually got. micChosen true with busHasMic false is
        // the separated take, and both false with a silent bus is the fault.
        busHasMic: Boolean(busSources.current.mic),
        busHasSystem: Boolean(busSources.current.system),
        // Warm-up level on the mixed bus. Zero here with a live mic track is
        // the full length silent AAC signature, readable without the file.
        busRmsAtStart:
          typeof busWarmupRef.current.rms === "number"
            ? busWarmupRef.current.rms
            : null,
        busSilentAtStart: Boolean(busWarmupRef.current.silentFault),
        ctxStateAtStart: busWarmupRef.current.ctxStateAtStart,
        ctxResumedAtStart: Boolean(busWarmupRef.current.ctxResumedAtStart),
        // AudioContext interruption cause-signal: an OS "interrupted" state
        // feeds the destination silence, so chunksOut===0 here with
        // sawInterrupted distinguishes a silent gap from a dead mic track.
        audioContextState: aCtx.current?.state ?? null,
        audioInterruptedCount: audioHealthRef.current?.interruptedCount ?? 0,
        audioInterruptedMs: audioHealthRef.current?.interruptedTotalMs ?? 0,
        audioSawInterrupted: audioHealthRef.current?.sawInterrupted ?? false,
        // Loss-stage discriminator: ctxTime lagging wall = mix-bus underrun.
        // ctxTime tracking wall while receivedMs lags = reader loss after the bus.
        audioCtxTimeMs: aCtx.current
          ? Math.round((aCtx.current.currentTime || 0) * 1000)
          : null,
        audioCtxWallMs: aCtxCreatedAtRef.current
          ? Date.now() - aCtxCreatedAtRef.current
          : null,
        ...(muxAudioDiag || {}),
      };
    } catch {
      return null;
    }
  };

  const finalizeRecorderSession = async (
    status = "completed",
    { keepOpfsSession = false } = {}
  ) => {
    if (!recorderSession.current) return;
    const sessionId = recorderSession.current.id;
    // Final snapshot before the recorders get cleared, emitted even on
    // cancel/failed so a recording that never finalizes is still
    // observable. The lifecycle bundle attaches only on suspected
    // failures to keep healthy payloads small.
    try {
      const screenDiag = screenRecorder.current?.getDiagSnapshot?.() || null;
      const cameraDiag = cameraRecorder.current?.getDiagSnapshot?.() || null;
      const audioDiag = getAudioDiagSnapshot();
      if (screenDiag || cameraDiag || audioDiag) {
        // Silent-audio failure: mic chosen, zero audio bytes, another track
        // fine. Reads from sessionTrackState not the WebCodecs diags, so it
        // still fires on MediaRecorder, and skips fully-failed recordings.
        const otherTrackRecorded =
          (sessionTrackState.current.screen?.bytesRecorded || 0) > 0 ||
          (sessionTrackState.current.camera?.bytesRecorded || 0) > 0;
        const audioEmptyDespiteIntent =
          audioDiag &&
          audioDiag.micChosen === true &&
          audioDiag.chunksOut === 0 &&
          otherTrackRecorded;
        const suspectedFailed =
          status !== "completed" ||
          (screenDiag && screenDiag.chunksOut === 0) ||
          (cameraDiag && cameraDiag.chunksOut === 0) ||
          audioEmptyDespiteIntent;
        const eventType = suspectedFailed
          ? "recording_failed_bundle"
          : "recording_stop_diag";
        let lifecycleBundle = null;
        if (suspectedFailed) {
          try {
            lifecycleBundle = await getCompressedLifecycleLog();
          } catch {}
        }
        // The server accepts encodeStats on any event type, so attach it here too.
        const screenStats = screenRecorder.current?.getEncodeStats?.() || null;
        const cameraStats = cameraRecorder.current?.getEncodeStats?.() || null;
        void emitUploadTelemetry(eventType, {
          status,
          screenDiag,
          cameraDiag,
          audioDiag,
          lifecycleBundle,
          encodeStats: screenStats
            ? { ...screenStats, track: "screen" }
            : cameraStats
            ? { ...cameraStats, track: "camera" }
            : null,
        });
      }
    } catch {}
    const opfsSessionId =
      recorderSession.current.opfsSessionId ||
      storageOpfsSessionId ||
      sessionId;
    const usedOpfs = Object.values(
      recorderSession.current.storageBackends || storageBackends || {}
    ).some((b) => b === "opfs");
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
      if (!RECOVERABLE_SESSION_STATUSES.has(status)) {
        chrome.storage.local
          .remove([`chunkPurgeMarks:${sessionId}`, "cloudRecorderHostBusy"])
          .catch(() => {});
      }
      purgeMarksRef.current = {};
      recorderSession.current = null;
      recordingSessionId.current = null;
      sessionStateIndexedRef.current = false;
      resetSessionTrackState();
      // Force the next recording on this component instance to re-probe and
      // re-bind chunksStore/audioChunksStore/cameraChunksStore so they don't
      // keep pointing at the previous session's OPFS directory.
      idbReadyRef.current = false;
      audioChunkStoreReadyRef.current = false;
      cameraChunkStoreReadyRef.current = false;
      // Left set, the next take skips its own chunk clear and keeps its OPFS
      // dir alive for a debt belonging to the previous one.
      micRecoveryPending.current = false;
      chunksStore = localforage.createInstance({ name: "chunks" });
      audioChunksStore = localforage.createInstance({ name: "audioChunks" });
      cameraChunksStore = localforage.createInstance({ name: "cameraChunks" });
      storageBackends = { screen: "idb", audio: "idb", camera: "idb" };
      storageOpfsSessionId = null;
      encoderKinds = {
        screen: "mediarecorder",
        audio: "mediarecorder",
        camera: "mediarecorder",
      };
      encoderReasons = { screen: null, audio: null, camera: null };
      encoderSticky = { disabled: null, reason: null };
      trackContainers = {
        screen: "video/webm",
        audio: "video/webm",
        camera: "video/webm",
      };
      trackCodecs = { screen: "vp9", audio: "opus", camera: "vp9" };
      encoderHwSlots = null;
      // Re-probe HW slots + sticky-disabled state on the next recording
      // (encoders chosen per session, not per component-mount).
      resetEncoderProbeCache();
      // Reap the OPFS session dir; awaited because window.close()
      // follows and fire-and-forget delete races teardown. Skipped
      // when a local-playback offer is still holding chunks (editor
      // clears via cloud-local-playback-clear; TTL alarm is the safety).
      if (usedOpfs && opfsSessionId && !keepOpfsSession) {
        try {
          await destroySessionDir(opfsSessionId);
        } catch {}
      }
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

  // A paused uploader drops every chunk. The bytes still reach the durable store
  // for gap re-send, but the skip itself was silent.
  const pausedDropsRef = useRef({ screen: 0, camera: 0, audio: 0 });

  const notePausedDrop = (track, blob) => {
    const next = (pausedDropsRef.current[track] || 0) + 1;
    pausedDropsRef.current[track] = next;
    patchTrackState(track, { droppedWhilePaused: next });
    // First drop only: the rest ride track state and the finalize diag.
    if (next === 1) {
      console.warn(`[CloudRecorder] ${track} uploader paused, dropping chunks`);
      void emitUploadTelemetry("upload_chunks_dropped_while_paused", {
        trackType: track,
        reason: `paused-drop-${track}`,
        bytes: blob?.size || 0,
      });
    }
  };

  const resendUploadGap = async (
    track,
    uploaderRef,
    store,
    keyPrefix,
    rangesRef
  ) => {
    const uploader = uploaderRef?.current;
    if (!uploader || !store || typeof uploader.getServerOffset !== "function") {
      return;
    }
    try {
      // The plan is built from this HEAD, so the queue has to stop moving
      // before it is read or the rewind lands under a live PATCH.
      if (typeof uploader.waitForInFlightChunk === "function") {
        await uploader.waitForInFlightChunk();
      }
      const serverOffset = await uploader.getServerOffset();
      if (serverOffset === null) return;
      const clientBytes = Number(uploader.totalBytes) || 0;
      const plan = planGapResend({
        ranges: rangesRef.current,
        serverOffset,
        clientBytes,
      });
      if (!plan.covered) {
        if (plan.gapBytes > 0) {
          console.warn(
            `[CloudRecorder] ${track} upload gap unrecoverable`,
            plan
          );
          void emitUploadTelemetry("upload_gap_unrecoverable", {
            trackType: track,
            gapBytes: plan.gapBytes,
            reason: `${plan.reason}-gap-${plan.gapBytes}`,
            serverOffset,
            clientBytes,
          });
        }
        return;
      }
      if (!uploader.prepareGapResend(serverOffset)) return;
      void emitUploadTelemetry("upload_gap_resend_started", {
        trackType: track,
        gapBytes: plan.gapBytes,
        chunks: plan.plan.length,
        serverOffset,
        clientBytes,
      });
      let sentBytes = 0;
      for (const step of plan.plan) {
        if (gapResendAbortRef.current) {
          void emitUploadTelemetry("upload_gap_resend_aborted", {
            trackType: track,
            reason: `budget-expired-after-${sentBytes}-of-${plan.gapBytes}`,
            sentBytes,
            gapBytes: plan.gapBytes,
          });
          return;
        }
        const entry = await store.getItem(`${keyPrefix}${step.index}`);
        if (!entry?.chunk) {
          // Stopping here is safe: everything sent so far was contiguous from
          // the server's offset, so the file is short, not holed.
          void emitUploadTelemetry("upload_gap_resend_incomplete", {
            trackType: track,
            missingIndex: step.index,
            sentBytes,
            gapBytes: plan.gapBytes,
          });
          break;
        }
        const blob =
          step.skipBytes > 0 ? entry.chunk.slice(step.skipBytes) : entry.chunk;
        await uploader.write(blob);
        sentBytes += step.sendBytes;
      }
      await uploader.waitForPendingUploads?.().catch(() => {});
      const afterOffset = await uploader.getServerOffset();
      void emitUploadTelemetry("upload_gap_resend_completed", {
        trackType: track,
        reason: `sent-${sentBytes}-of-${plan.gapBytes}`,
        gapBytes: plan.gapBytes,
        sentBytes,
        serverOffsetAfter: afterOffset,
        recovered: afterOffset !== null && afterOffset > serverOffset,
      });
    } catch (err) {
      console.warn(`[CloudRecorder] ${track} gap resend failed:`, err);
      void emitUploadTelemetry("upload_gap_resend_failed", {
        trackType: track,
        error: err?.message || String(err),
      });
    }
  };

  // A camera held by another app records nothing while screen keeps going, and
  // 4 chunk periods is long enough that a healthy camera has always delivered.
  const CAMERA_SILENCE_CHECK_MS = 8000;
  const cameraSilenceTimer = useRef(null);

  const scheduleCameraSilenceCheck = () => {
    if (cameraSilenceTimer.current) clearTimeout(cameraSilenceTimer.current);
    cameraSilenceTimer.current = setTimeout(() => {
      cameraSilenceTimer.current = null;
      try {
        if (isFinishing.current || sentLast.current) return;
        const cameraBytes =
          sessionTrackState.current.camera?.bytesRecorded || 0;
        if (cameraBytes > 0) return;
        const otherTrackRecording =
          (sessionTrackState.current.screen?.bytesRecorded || 0) > 0 ||
          (sessionTrackState.current.audio?.bytesRecorded || 0) > 0;
        if (!otherTrackRecording) return;
        const track = cameraStream.current?.getVideoTracks?.()[0] || null;
        const diag = {
          reason: "camera-silent-after-start",
          readyState: track?.readyState || null,
          muted: track ? Boolean(track.muted) : null,
          enabled: track ? Boolean(track.enabled) : null,
          label: track?.label || null,
          recorderState: cameraRecorder.current?.state || null,
          encoderKind: encoderKinds.camera || null,
          cameraDiag: cameraRecorder.current?.getDiagSnapshot?.() || null,
        };
        console.warn("🔴 Camera recorded nothing after start", diag);
        void emitUploadTelemetry("recording_camera_silent", {
          trackType: "camera",
          ...diag,
        });
        chrome.runtime.sendMessage({
          type: "show-toast",
          message: chrome.i18n.getMessage("cameraUnavailableToast"),
        });
      } catch (err) {
        console.warn("[CloudRecorder] camera silence check failed:", err);
      }
    }, CAMERA_SILENCE_CHECK_MS);
  };

  // The session-wide stall check below ORs the tracks together, so a healthy
  // screen masks a camera frozen at its first byte.
  const trackStallState = useRef(createTrackStallState());

  const uploaderFailureCounters = {
    screen: consecutiveScreenFailures,
    camera: consecutiveCameraFailures,
    audio: consecutiveAudioFailures,
  };

  const sweepStalledTracks = (now) => {
    const uploaders = {
      screen: screenUploader.current,
      camera: cameraUploader.current,
      audio: audioUploader.current,
    };
    const stalls = sweepTrackStalls({
      state: trackStallState.current,
      uploaders,
      now,
    });
    // Proves the sweep ran at all. upload_track_stalled has never fired in
    // prod, and a silent detector and a healthy fleet look identical.
    trackSweepTicks.current += 1;

    for (const stall of stalls) {
      const { track, uploader } = stall;
      void emitUploadTelemetry("upload_track_stalled", {
        trackType: track,
        // The mapping reads `offset`, not `offsetBytes`.
        offset: stall.offset,
        reason: `${stall.stuckAtInit ? "stuck-at-init" : "stalled"}-${track}${
          stall.siblingProgressing ? "-sibling-progressing" : ""
        }`,
        totalBytes: Number(uploader.totalBytes) || 0,
        queuedBytes: Number(uploader.queuedBytes) || 0,
        stallMs: stall.stallMs,
        stuckAtInit: stall.stuckAtInit,
        siblingProgressing: stall.siblingProgressing,
        uploaderStatus: uploader.status || null,
        errorCode: uploader.lastErrorCode || null,
        isPaused: Boolean(uploader.isPaused),
        isFinalizing: Boolean(uploader.isFinalizing),
      });
      // Same action the online handler takes. resume() restarts processQueue
      // and, on a recoverable error, the heartbeat that HEAD-resyncs.
      if (RESUMABLE_UPLOADER_STATUSES.has(uploader.status)) {
        try {
          uploader.resume();
        } catch (err) {
          console.warn(
            `[CloudRecorder] resume ${track} after stall failed:`,
            err
          );
        }
        // Without this the write path re-pauses on the next single failure,
        // and every later chunk is dropped at the isPaused check.
        const counter = uploaderFailureCounters[track];
        if (counter) counter.current = 0;
      }
    }
  };

  const startUploadHeartbeat = () => {
    if (uploadHeartbeatTimer.current)
      clearInterval(uploadHeartbeatTimer.current);
    uploadHeartbeatTimer.current = setInterval(() => {
      const now = Date.now();
      const screenOffset = screenUploader.current?.offset || 0;
      const cameraOffset = cameraUploader.current?.offset || 0;
      sweepStalledTracks(now);
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
    if (cameraSilenceTimer.current) {
      clearTimeout(cameraSilenceTimer.current);
      cameraSilenceTimer.current = null;
    }
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
    } catch {}

    // offscreen has no visible recovery UI; surface a modal in content. keep
    // offscreen:true so the retry/export commands route back to this doc.
    if (IS_OFFSCREEN_HOST) {
      try {
        await chrome.storage.local.set({ offscreen: true });
      } catch {}
      chrome.runtime
        .sendMessage({
          type: "finalize-failure",
          reason: diagnostics?.reason || "finalize-failed",
        })
        .catch(() => {});
    }
  };
  const exportLocalRecovery = async (reason = "upload failed") => {
    try {
      let blob = null;
      let fromMemoryWindow = false;
      const recovered = [];
      await chunksStore.iterate((value) => {
        recovered.push(value);
      });
      recovered.sort((a, b) => a.index - b.index);
      if (recovered.length > 0) {
        blob = createBlobFromChunks(
          recovered.map((c) => c.chunk),
          "video/webm"
        );
      }
      if (!blob) {
        blob =
          createBlobFromChunks(screenChunks.current, "video/webm") ||
          createBlobFromChunks(cameraChunks.current, "video/webm");
        fromMemoryWindow = Boolean(blob);
      }
      if (!blob) return false;
      // Purge drops Bunny-confirmed chunks mid-recording and the memory window
      // holds only the last 8, so either source can be missing the middle.
      const partial =
        fromMemoryWindow || chunksPurgedDuringRecordingRef.current === true;
      const objectUrl = URL.createObjectURL(blob);
      try {
        await chrome.downloads.download({
          url: objectUrl,
          filename: `Screenity-${
            partial ? "Partial" : "Recovery"
          }-${new Date().toISOString()}-${reason}.webm`,
          saveAs: false,
        });
        chrome.runtime.sendMessage({
          type: "show-toast",
          message: "Upload stalled. A recovery file was saved locally.",
        });
        // reason carries the partial flag because the server sanitizer keeps
        // it. The booleans below need allowlisting before they show up.
        void emitUploadTelemetry("upload_local_backup_degraded", {
          backupType: "recovery-export",
          reason: partial
            ? `recovery-export-partial-${reason}`
            : `recovery-export-${reason}`,
          partial,
          fromMemoryWindow,
          chunkCount: recovered.length,
          purgedScreenChunks: screenChunksPurgedCountRef.current,
          purgedBytes: chunksPurgedBytesRef.current,
        });
        return true;
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (err) {
      console.warn("Failed to export local recovery:", err);
      return false;
    }
  };

  // Background resume owns a crashed take (resumeJournal.js), cleanup included.
  // This host only has to stop the crashed take's scene id being reused.
  const tryRecoverPreviousSession = useCallback(async () => {
    if (recoveryAttempted.current) return;
    recoveryAttempted.current = true;
    try {
      const { recorderSession: storedSession } = await chrome.storage.local.get(
        ["recorderSession"]
      );
      if (
        !storedSession ||
        !RECOVERABLE_SESSION_STATUSES.has(storedSession.status)
      ) {
        return;
      }
      await chrome.storage.local.remove(["sceneId", "sceneIdStatus"]);
      void emitUploadTelemetry("upload_recovery_available", {
        reason: "handed-to-resume",
        recordingSessionId: storedSession.id,
        projectId: storedSession.projectId || null,
      });
    } catch (err) {
      console.warn("Recovery check failed:", err);
    }
  }, []);

  const recoverPendingScenes = useCallback(async () => {
    try {
      const raw = await chrome.storage.local.get(["pendingSceneIndex"]);
      const pendingSceneIndex = Array.isArray(raw?.pendingSceneIndex)
        ? raw.pendingSceneIndex
        : [];
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

  // trackCodecs at start is the requested codec. HW encoders re-derive
  // profile/level from the SPS (e.g. requested High L4.2 yields High L4.0
  // at 1080p), so sync to the actual codec from the first encoded chunk's
  // decoderConfig.
  const syncActualVideoCodec = (track, recorder) => {
    const actual = recorder?.actualVideoCodec;
    if (!actual || trackCodecs[track] === actual) return;
    trackCodecs[track] = actual;
    const uploader =
      track === "screen"
        ? screenUploader.current
        : track === "camera"
        ? cameraUploader.current
        : null;
    uploader?.updateEncoderInfo?.({ codec: actual });
    persistSessionState({});
  };

  // The TUS filetype is fixed at uploader init, which runs before encoder
  // selection. A flip here leaves Bunny's label wrong, so record the truth.
  const syncSelectedContainer = (track, uploaderRef, container) => {
    const uploader = uploaderRef?.current;
    if (!uploader || !container) return;
    const declared = uploader.container || null;
    uploader.updateEncoderInfo?.({ container });
    if (declared && declared !== container) {
      void emitUploadTelemetry("upload_container_mismatch", {
        trackType: track,
        reason: `declared-${declared}-actual-${container}`,
      });
    }
  };

  const checkMaxMemory = () => {
    const now = Date.now();
    if (
      now - storagePressureRef.current.lastEstimateAt <
      STORAGE_CHECK_INTERVAL_MS
    ) {
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
    pendingMicIntent.current = Boolean(result.active);
    // Separated takes have no audioInputGain (nothing is on the bus), so the
    // gain branch below never runs and the mic file records through a mute.
    if (separatedAudio.current && rawMicStream.current) {
      rawMicStream.current.getAudioTracks().forEach((track) => {
        track.enabled = result.active;
      });
      return;
    }
    if (micStream.current && audioInputGain.current) {
      audioInputGain.current.gain.value = result.active ? 1 : 0;

      if (rawMicStream.current) {
        rawMicStream.current.getAudioTracks().forEach((track) => {
          track.enabled = result.active;
        });
      }
      return;
    }

    // Cold-start path: mic was off at recording start; acquire now and
    // wire into the existing graph.
    if (
      result.active &&
      !rawMicStream.current &&
      aCtx.current &&
      destination.current
    ) {
      if (isLazyAcquiringMic.current) return;
      isLazyAcquiringMic.current = true;
      try {
        const deviceId =
          result.defaultAudioInput ||
          (await chrome.storage.local.get(["defaultAudioInput"]))
            .defaultAudioInput;
        const acquired = await startAudioStream(deviceId);
        const acquireFailed = !acquired || !acquired.getAudioTracks().length;
        const tornDown =
          !aCtx.current || !destination.current || isFinishing.current;
        const userCanceled = pendingMicIntent.current === false;
        if (acquireFailed || tornDown || userCanceled) {
          try {
            acquired?.getTracks?.().forEach((t) => t.stop());
          } catch {}
          // See Recorder.jsx setMic for rationale.
          if (acquireFailed && !tornDown && !userCanceled) {
            try {
              chrome.storage.local.set({ micActive: false });
            } catch {}
          }
          return;
        }
        rawMicStream.current = acquired;
        // The separated recorder is built at start, only if a mic existed.
        // A mic turned on later has nothing to record into, so fall back to
        // muxing for the rest of this take. Before the build it still gets a
        // recorder, so flipping there sent the mic to Stream off a mic-less bus.
        if (
          separatedAudio.current &&
          recordersBuilt.current &&
          !micRecordedThisTake.current
        ) {
          separatedAudio.current = false;
          diagForward("separated-fallback-late-mic", {});
        } else if (separatedAudio.current && !recordersBuilt.current) {
          diagForward("separated-fallback-declined-early", {
            micRecordedThisTake: micRecordedThisTake.current,
          });
        }
        if (!separatedAudio.current) {
          audioInputGain.current = aCtx.current.createGain();
          const micSource = aCtx.current.createMediaStreamSource(acquired);
          micSource
            .connect(audioInputGain.current)
            .connect(destination.current);
          if (busTap.current) audioInputGain.current.connect(busTap.current);
          busSources.current.mic = true;
        }
        // Set either way, matching the eager path: later consumers read
        // micStream as the audio bus.
        micStream.current = destination.current.stream;
      } finally {
        isLazyAcquiringMic.current = false;
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

    if (uploadMeta?.audio?.mediaId && uploadMeta?.audio?.videoId) {
      mediaToDelete.push({
        videoId: uploadMeta.audio.videoId,
        mediaId: uploadMeta.audio.mediaId,
        type: "audio",
      });
    }

    const { screenityToken } = await chrome.storage.local.get([
      "screenityToken",
    ]);
    await fetch(`${API_BASE}/videos/${projectId}/delete/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(screenityToken
          ? { Authorization: `Bearer ${screenityToken}` }
          : {}),
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

    console.warn(
      `[Screenity] empty upload cleanup reason=${reason} screenOffset=${screenOffset} cameraOffset=${cameraOffset}`
    );

    await Promise.allSettled([
      screenUploader.current?.abort?.(`empty-cleanup-${reason}`),
      cameraUploader.current?.abort?.(`empty-cleanup-${reason}`),
      audioUploader.current?.abort?.(`empty-cleanup-${reason}`),
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
    console.error(
      `[Screenity][CloudRecorder] sendRecordingError why=${
        typeof why === "string" ? why : JSON.stringify(why)
      } cancel=${cancel}`
    );
    // A failed take never hits markSceneComplete, so getOrCreateSceneId would
    // hand its "recording" id to the next take (the BG clear skips the editor).
    chrome.storage.local.set({ sceneIdStatus: "failed" }).catch(() => {});
    void cleanupIfEmptyUploads("error");
    sendRecordingErrorBase(why, cancel);
  };

  // Written before the uploaders abort, so a browser dying mid-discard or
  // mid-cancel can't have the take resumed back into the user's library.
  const markSessionDiscarded = async () => {
    try {
      const discardedId = recorderSession.current?.id;
      if (!discardedId) return;
      const { discardedRecordingSessionIds: prev } =
        await chrome.storage.local.get(["discardedRecordingSessionIds"]);
      const list = Array.isArray(prev) ? prev : [];
      await chrome.storage.local.set({
        discardedRecordingSessionIds: [
          ...list.filter((id) => id !== discardedId),
          discardedId,
        ].slice(-10),
      });
    } catch {}
  };

  const dismissRecording = async (restarting = false, reason = "dismiss") => {
    clearPendingStart();
    await markSessionDiscarded();
    setInitProject(false);
    await cleanupIfEmptyUploads(restarting ? "restart" : "dismiss");

    stopTabKeepAlive();
    await setRecordingTimingState({
      recording: false,
      paused: false,
      recordingStartTime: null,
      pausedAt: null,
      totalPausedMs: 0,
    });
    pausedStateRef.current = false;
    await clearAudioChunkStore(
      restarting ? "dismiss-restart" : "dismiss-recording"
    );
    await clearCameraChunkStore(
      restarting ? "dismiss-restart" : "dismiss-recording"
    );
    await clearLocalScreenPlaybackOffer(
      restarting ? "dismiss-restart" : "dismiss-recording"
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
        screenUploader.current?.abort?.(`restart-${reason}`),
        cameraUploader.current?.abort?.(`restart-${reason}`),
        audioUploader.current?.abort?.(`restart-${reason}`),
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
      } catch {}
      uploadMetaRef.current = null;
      sentLast.current = false;
      screenUploader.current = null;
      cameraUploader.current = null;
      audioUploader.current = null;
      uploadersInitialized.current = false;
      cleanupTimers();
      return;
    }

    cleanupTimers();
    stopAllIntervals();

    isRestarting.current = true;

    await Promise.allSettled([
      screenUploader.current?.abort?.(`dismiss-${reason}`),
      cameraUploader.current?.abort?.(`dismiss-${reason}`),
      audioUploader.current?.abort?.(`dismiss-${reason}`),
    ]);

    await stopRecording(false, `dismiss-${reason}`);

    const uploadMeta = uploadMetaRef.current;
    if (!uploadMeta) {
      console.warn("No upload metadata available for cleanup");
      return;
    }

    if (multiMode) {
      if (multiSceneCount === 0) {
        if (!recordingToScene) {
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

      return;
    }

    if (projectId && !recordingToScene) {
      try {
        await deleteProject(projectId, uploadMeta);
      } catch (err) {
        console.warn("❌ Failed to delete project:", err);
      }
    } else if (projectId) {
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

    await flushInflightTelemetry();
    if (!IS_IFRAME_CONTEXT) {
      try {
        window.close();
      } catch {}
      return;
    }
    window.location.reload();
  };

  const restartRecording = async () => {
    await setCloudRestartPhase("restart-requested", {
      hasTarget: Boolean(target.current),
      hadRegionMode: Boolean(regionRef.current),
    });
    isRestarting.current = true;
    await dismissRecording(true, "restart");
    await setCloudRestartPhase("restart-dismissed");
    // Keep capture streams; only stop recorder instances.
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
    recordersBuilt.current = false;
    micRecordedThisTake.current = false;
    index.current = 0;
    lastTimecode.current = 0;

    try {
      await chrome.storage.local.set({
        firstChunkAt: null,
        lastChunkAt: null,
        recordingStallLevel: 0,
        tabStreamIdCache: null,
      });
    } catch {}

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
      // Set when a supersampled screen track is lowered for MediaRecorder, so the
      // reported dims don't depend on applyConstraints having landed yet.
      let constrainedScreenDims = null;
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
        (trackType) =>
        (eventName, payload = {}) => {
          void emitUploadTelemetry(eventName, {
            projectId,
            sceneId,
            trackType,
            ...payload,
          });
        };

      const onUploaderStateChange =
        (trackType) =>
        (state = {}) => {
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

      // Stashed init options; all three /api/bunny/videos POSTs fire
      // in parallel below. Partners are discovered by shared sceneId
      // server-side, so camera/audio no longer need screen's mediaId.
      let screenInitOpts = null;
      let cameraInitOpts = null;
      let audioInitOpts = null;

      // Pick encoder/container per track before constructing uploaders.
      // TUS Upload-Metadata filetype is fixed at create time and can't
      // be re-declared on PATCH. Plan is cached.
      const screenSettings =
        screenStream.current?.getVideoTracks?.()?.[0]?.getSettings?.() || {};
      const cameraSettings =
        cameraStream.current?.getVideoTracks?.()?.[0]?.getSettings?.() || {};
      const probeOptions = {
        screenWidth: Number(screenSettings.width) || 1920,
        screenHeight: Number(screenSettings.height) || 1080,
        cameraWidth: Number(cameraSettings.width) || 1280,
        cameraHeight: Number(cameraSettings.height) || 720,
        framerate:
          Number(screenSettings.frameRate) ||
          Number(cameraSettings.frameRate) ||
          30,
      };
      const { inspectTrackPlan } = await import("./encoder/chooseEncoder");
      // Parallel: probeHwSlots inside chooseEncoder is memoized
      // (_hwSlotsPromise) so concurrent calls share the same probe;
      // the three inspectTrackPlan calls don't conflict.
      const [screenPlan, cameraPlan, audioPlan] = await Promise.all([
        inspectTrackPlan({ track: "screen", probeOptions }),
        inspectTrackPlan({ track: "camera", probeOptions }),
        // Same stream the audio recorder gets, so the container reported to TUS
        // survives an MP4 start() that throws.
        inspectTrackPlan({
          track: "audio",
          stream: rawMicStream.current,
          separated: separatedAudio.current,
        }),
      ]);
      encoderKinds.screen = screenPlan.kind;
      encoderKinds.camera = cameraPlan.kind;
      encoderKinds.audio = audioPlan.kind;
      // Constrain here, not at start(): the dims reported below are read off this
      // track, and MediaRecorder has no resize stage. Target the cloud tier, not
      // the WebCodecs 1080p cap, or the fallback silently loses its 1440p.
      if (captureCapRef.current?.oversampled) {
        const screenVideoTrack = screenStream.current?.getVideoTracks?.()[0];
        const before = screenVideoTrack?.getSettings?.() || {};
        let outcome;
        if (encoderKinds.screen === "mediarecorder") {
          const cloudTier = getResolutionForQuality();
          outcome = await constrainTrackDown(
            screenVideoTrack,
            cloudTier.width,
            cloudTier.height
          );
          // Aspect is preserved on the way down, so derive the dims rather than
          // assuming the tier: an ultrawide lands at 2560x1072, not 2560x1440.
          if (outcome === "lowered") {
            const fitted = computeEncodedDimensions({
              width: before.width,
              height: before.height,
              capWidth: cloudTier.width,
              capHeight: cloudTier.height,
            });
            if (fitted.width > 0) constrainedScreenDims = fitted;
          }
        } else {
          outcome = await enforceOversampleRatio(
            screenVideoTrack,
            WEBCODECS_CAP_WIDTH,
            WEBCODECS_CAP_HEIGHT
          );
        }
        chrome.runtime
          .sendMessage({
            type: "diag-forward",
            event: "cloudrecorder-oversample",
            data: {
              outcome,
              kind: encoderKinds.screen,
              trackW: before.width ?? null,
              trackH: before.height ?? null,
            },
          })
          .catch(() => {});
      }
      encoderReasons.screen = screenPlan.reason || null;
      encoderReasons.camera = cameraPlan.reason || null;
      encoderReasons.audio = audioPlan.reason || null;
      // Best-effort: never let this read block recording start.
      try {
        const { getFastRecorderStickyState } = await import(
          "../../media/fastRecorderGate"
        );
        const sticky = await getFastRecorderStickyState();
        encoderSticky = {
          disabled: sticky?.disabled === true,
          reason: sticky?.reason || null,
        };
      } catch {
        encoderSticky = { disabled: null, reason: null };
      }
      trackContainers.screen = screenPlan.container;
      trackContainers.camera = cameraPlan.container;
      trackContainers.audio = audioPlan.container;
      trackCodecs.screen = screenPlan.codec;
      trackCodecs.camera = cameraPlan.codec;
      trackCodecs.audio = audioPlan.codec;
      encoderHwSlots =
        screenPlan.hwSlots || cameraPlan.hwSlots || encoderHwSlots;
      logDebugEvent("encoder-plan", {
        screen: screenPlan,
        camera: cameraPlan,
        audio: audioPlan,
      });

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
          clientSessionId: getClientSessionId(),
          sessionId,
          trackType: "screen",
          container: trackContainers.screen,
          codec: trackCodecs.screen,
          encoderKind: encoderKinds.screen,
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
          // CSS pixels from the resize handle, so half the encoded frame on a 2x
          // display. Known issue: getSettings() after cropTo() reports the
          // uncropped tab size until frames flow, so it is no safer.
          width = regionWidth.current;
          height = regionHeight.current;
        } else if (constrainedScreenDims) {
          width = constrainedScreenDims.width;
          height = constrainedScreenDims.height;
        } else {
          const settings = track.getSettings();
          width = settings.width;
          height = settings.height;
        }
        // WebCodecs caps encoded resolution at 1080p via the resize canvas;
        // record the post-downscale dims on the Media doc + scene so any
        // pixel-math against the encoded video is consistent. MediaRecorder
        // path records at native, so dims pass through unchanged.
        if (encoderKinds.screen === "webcodecs") {
          const downscaled = computeEncodedDimensions({ width, height });
          if (downscaled.width > 0 && downscaled.height > 0) {
            width = downscaled.width;
            height = downscaled.height;
          }
        }
        // Stash options; fire all 3 inits in parallel below.
        screenInitOpts = {
          title: "Screen Recording",
          type: "screen",
          width,
          height,
          sceneId,
          sessionId,
        };
      }

      if (cameraStream.current) {
        cameraUploader.current = new BunnyTusUploader({
          clientSessionId: getClientSessionId(),
          sessionId,
          trackType: "camera",
          container: trackContainers.camera,
          codec: trackCodecs.camera,
          encoderKind: encoderKinds.camera,
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
        let { width, height } = track.getSettings();
        if (encoderKinds.camera === "webcodecs") {
          const downscaled = computeEncodedDimensions({ width, height });
          if (downscaled.width > 0 && downscaled.height > 0) {
            width = downscaled.width;
            height = downscaled.height;
          }
        }
        // Omit linkedMediaId; server groups partners by shared sceneId
        // in usedIn now. Lifts the serial wait on screen's mediaId
        // (~3s dev, 500ms-1s prod).
        cameraInitOpts = {
          title: "Camera Recording",
          type: "camera",
          linkedMediaId: null,
          width,
          height,
          sceneId,
          sessionId,
        };
      }

      const { micActive } = await chrome.storage.local.get(["micActive"]);
      // Only init the audio uploader when mic is actually on; a non-
      // empty getAudioTracks() isn't enough since we attach a muted
      // mic stream for system-audio mixing.
      // A separated mic goes to Storage instead: Stream stamps an audio-only
      // file with duration 1 and no plain URL. See uploadMicToStorage.js.
      if (
        micActive === true &&
        !separatedNow() &&
        rawMicStream.current?.getAudioTracks?.().length
      ) {
        // Audio uploader failures are non-fatal; recording proceeds
        // without an audio track if init fails (mic supplementary).
        try {
          audioUploader.current = new BunnyTusUploader({
            clientSessionId: getClientSessionId(),
            sessionId,
            trackType: "audio",
            container: trackContainers.audio,
            codec: trackCodecs.audio,
            encoderKind: encoderKinds.audio,
            onProgress: ({ offset }) => {
              const now = Date.now();
              patchTrackState("audio", {
                lastUploadOffset: offset,
                uploaderUpdatedAt: now,
              });
            },
            onStall: onStall("audio"),
            onTelemetry: onUploaderTelemetry("audio"),
            onStateChange: onUploaderStateChange("audio"),
          });
          audioInitOpts = {
            title: "Audio Recording",
            type: "audio",
            // See comment above for cameraInitOpts; sceneId-based
            // partner discovery makes linkedMediaId optional and lets
            // this fire in parallel with the screen + camera inits.
            linkedMediaId: null,
            sceneId,
            sessionId,
          };
        } catch (audioErr) {
          console.warn(
            "⚠️ Audio uploader init failed; recording will continue without an audio track:",
            audioErr
          );
          logDebugEvent("audio-uploader-init-failed", {
            error: audioErr?.message || String(audioErr),
          });
          audioUploader.current = null;
        }
      }

      // All 3 TUS inits in parallel. No serial dependency anymore -
      // sceneId-based partner discovery on the server side replaces
      // the old screen.mediaId → linkedMediaId chain.
      const parallelInits = [];
      if (screenUploader.current && screenInitOpts) {
        parallelInits.push(
          screenUploader.current
            .initialize(projectId, screenInitOpts)
            .then(() => {
              logDebugEvent("uploader-ready", {
                type: "screen",
                projectId,
                sceneId,
                mediaId: screenUploader.current?.getMeta()?.mediaId || null,
                videoId: screenUploader.current?.getMeta()?.videoId || null,
              });
            })
        );
      }
      if (cameraUploader.current && cameraInitOpts) {
        parallelInits.push(
          cameraUploader.current
            .initialize(projectId, cameraInitOpts)
            .then(() => {
              logDebugEvent("uploader-ready", {
                type: "camera",
                projectId,
                sceneId,
                mediaId: cameraUploader.current?.getMeta()?.mediaId || null,
                videoId: cameraUploader.current?.getMeta()?.videoId || null,
              });
            })
        );
      }
      if (audioUploader.current && audioInitOpts) {
        parallelInits.push(
          audioUploader.current
            .initialize(projectId, audioInitOpts)
            .then(() => {
              logDebugEvent("uploader-ready", {
                type: "audio",
                projectId,
                sceneId,
                mediaId: audioUploader.current?.getMeta()?.mediaId || null,
                videoId: audioUploader.current?.getMeta()?.videoId || null,
              });
            })
            .catch((audioErr) => {
              console.warn(
                "⚠️ Audio uploader init failed; recording will continue without an audio track:",
                audioErr
              );
              logDebugEvent("audio-uploader-init-failed", {
                error: audioErr?.message || String(audioErr),
              });
              audioUploader.current = null;
            })
        );
      }
      if (parallelInits.length) await Promise.all(parallelInits);

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

  // The codec to drop to when an encoder passes isTypeSupported() but
  // fails at runtime (EncodingError). Returns null when there's nothing
  // safer left to try (already on VP8/webm), in which case we surface the
  // error instead of looping.
  const pickEncodingFallback = (currentMime, trackKind) => {
    const m = String(currentMime || "").toLowerCase();
    if (trackKind === "audio" || m.startsWith("audio/")) {
      // No safer audio container to fall to: webm and mp4 are both floors,
      // and swapping either mislabels the bytes already uploaded.
      return null;
    }
    // Don't fall from MP4 to WebM: the container was already sent as the TUS
    // filetype and drives the editor's <video> type, so WebM bytes here play as
    // a mislabelled MP4. Surface the error instead, like the VP8 floor below.
    if (m.includes("mp4") || m.includes("avc1")) return null;
    if (m.includes("vp8") || m === "video/webm") return null;
    return "video/webm;codecs=vp8,opus";
  };

  const createMediaRecorder = (stream, options, onDataAvailable, trackKind) => {
    try {
      // Pro hardcodes one mimeType per track. On Linux with some GPU
      // drivers + WebCodecs sticky-disabled, construct throws with no
      // user fallback, so probe Free's MIME_TYPES list first.
      let effectiveOptions = options;
      const requested = options?.mimeType;
      if (
        requested &&
        typeof MediaRecorder.isTypeSupported === "function" &&
        !MediaRecorder.isTypeSupported(requested)
      ) {
        // Audio-only streams get audio candidates only: video/webm can't mux a
        // stream with no video track.
        const candidates =
          trackKind === "audio" || requested.startsWith("audio/")
            ? ["audio/webm;codecs=opus", "audio/webm"]
            : [
                "video/webm;codecs=vp9,opus",
                "video/webm;codecs=vp8,opus",
                "video/webm;codecs=h264,opus",
                "video/webm;codecs=avc1,opus",
                "video/webm",
              ];
        const fallback = candidates.find((m) =>
          MediaRecorder.isTypeSupported(m)
        );
        if (fallback) {
          console.warn(
            "[CloudRecorder] requested mimeType unsupported, falling back",
            { requested, fallback }
          );
          effectiveOptions = { ...options, mimeType: fallback };
        }
        // No fallback either: fall through and let construct throw so
        // the outer catch surfaces the real error.
      }
      const recorder = new MediaRecorder(stream, effectiveOptions);
      // Track in-flight write() promises so stopAllRecorders can
      // drain them before finalize(); a late ondataavailable would
      // otherwise race finalize and silently truncate the upload.
      recorder._pendingWrites = new Set();

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          // Marks the recorder as having produced bytes. The EncodingError
          // auto-retry below only fires when NO data was captured yet, so a
          // mid-session encoder failure isn't silently restarted (which
          // would drop already-recorded media).
          recorder._gotData = true;
          try {
            const maybePromise = onDataAvailable(event.data);
            if (maybePromise && typeof maybePromise.then === "function") {
              recorder._pendingWrites.add(maybePromise);
              const settle = () => recorder._pendingWrites.delete(maybePromise);
              maybePromise.then(settle, (err) => {
                settle();
                console.warn("onDataAvailable failed:", err);
              });
            }
          } catch (err) {
            console.warn("onDataAvailable failed:", err);
          }
        }
      };

      recorder.onerror = (event) => {
        const errName = event?.error?.name || "";
        const errMsg = String(event?.error?.message || "").toLowerCase();
        // InvalidStateError / "not in recording state" / "already
        // inactive" are harmless stop()-after-teardown races. Mirrors
        // the Free/Region filter; real errors still hit sendRecordingError.
        const isTransient =
          errName === "InvalidStateError" ||
          errMsg.includes("not in recording state") ||
          errMsg.includes("already inactive");
        if (isTransient) {
          console.warn("[CloudRecorder] transient MR error ignored", {
            name: errName,
            message: event?.error?.message,
          });
          return;
        }

        // Encoder passed isTypeSupported() but failed on real frames (older
        // Android H.264, high-res getDisplayMedia init). With no bytes yet,
        // rebuild on VP8; once data has flowed, stop gracefully and keep it.
        const isEncodingError =
          errName === "EncodingError" ||
          errMsg.includes("video encoding failed") ||
          errMsg.includes("encoder initialization failed") ||
          errMsg.includes("not supported by the encoder");
        const refForTrack =
          trackKind === "audio"
            ? audioRecorder
            : trackKind === "camera"
            ? cameraRecorder
            : trackKind === "screen"
            ? screenRecorder
            : null;
        if (
          isEncodingError &&
          !recorder._fellBack &&
          !recorder._gotData &&
          refForTrack
        ) {
          const fallbackMime = pickEncodingFallback(
            effectiveOptions?.mimeType,
            trackKind
          );
          if (fallbackMime && MediaRecorder.isTypeSupported(fallbackMime)) {
            recorder._fellBack = true;
            logDebugEvent("encoding-error-fallback", {
              trackKind,
              from: effectiveOptions?.mimeType || null,
              to: fallbackMime,
              message: event?.error?.message || null,
            });
            // Tear down the dead recorder without letting its stop fire the
            // normal onstop/finalize path.
            try {
              recorder.ondataavailable = null;
              recorder.onstop = null;
              if (recorder.state !== "inactive") recorder.stop();
            } catch {}
            try {
              const replacement = createMediaRecorder(
                stream,
                { ...effectiveOptions, mimeType: fallbackMime },
                onDataAvailable,
                trackKind
              );
              // One downgrade only; if VP8 also fails it surfaces normally.
              replacement._fellBack = true;
              // Only adopt if the ref still points at the dead recorder; a
              // concurrent teardown may have already moved on.
              if (refForTrack.current === recorder) {
                refForTrack.current = replacement;
                replacement.start(2000); // matches the 2000ms timeslice at the start sites
                return;
              }
            } catch (retryErr) {
              console.error(
                "[CloudRecorder] EncodingError VP8 retry failed:",
                retryErr
              );
              // fall through to surface the original error
            }
          }
        }

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
    // The BG start-fail re-check tears the recorder down after 2.5s unless a
    // stage lands. The free recorders mark, this one never did.
    markStartProgress("preflight-enter");
    setInitProject(false);
    await clearLocalScreenPlaybackOffer("start-recording");
    startTabKeepAlive();

    // Release the prewarm reader so the recorder can claim the track.
    await stopPrewarm(prewarmRef.current);
    prewarmRef.current = null;

    const storageReady = await ensureChunkStoreReady();
    if (!storageReady) return;
    await ensureAudioChunkStoreReady();
    await ensureCameraChunkStoreReady();
    markStartProgress("stores-ready");

    if (!uploadersInitialized.current) {
      sendRecordingError(
        "Uploaders not initialized. Please restart recording."
      );
      return;
    }

    if (!screenStream.current && !cameraStream.current) {
      sendRecordingError("No streams to record");
      logStartFlow("recording_error", { reason: "no-streams" });
      return;
    }

    // Pre-flight OPFS quota; otherwise we start and checkMaxMemory
    // stops us within ~1s of the first chunk.
    try {
      const { quota = 0, usage = 0 } = await navigator.storage.estimate();
      const headroom = Math.max(0, quota - usage);
      const minQuota = 25 * 1024 * 1024;
      if (quota > 0 && quota < minQuota) {
        void emitUploadTelemetry("upload_storage_pressure", {
          severity: "preflight-quota-too-low",
          quota,
          usage,
          headroom,
        });
        sendRecordingError(chrome.i18n.getMessage("storageFullRecordingError"));
        logStartFlow("recording_error", {
          reason: "preflight-low-quota",
          quota,
          headroom,
        });
        return;
      }
      if (headroom > 0 && headroom < STORAGE_CRITICAL_HEADROOM_BYTES) {
        void emitUploadTelemetry("upload_storage_pressure", {
          severity: "preflight-critical-headroom",
          quota,
          usage,
          headroom,
        });
        sendRecordingError(
          chrome.i18n.getMessage("storageLowRecordingWarning")
        );
        logStartFlow("recording_error", {
          reason: "preflight-critical-headroom",
          headroom,
        });
        return;
      }
    } catch (err) {
      // Best-effort: if the API throws, fall through and let the
      // during-recording checkMaxMemory pick it up. Don't block recording
      // on a failed estimate.
      console.warn("[CloudRecorder] preflight storage estimate failed:", err);
    }

    const { projectId } = await chrome.storage.local.get(["projectId"]);

    if (!projectId) {
      // Diagnostic for how we reached startRecording without a project.
      // Most common path: BG recording-error clears projectId, then a
      // retry hits start-recording-tab without re-creating it.
      let danglingState = null;
      try {
        danglingState = await chrome.storage.local.get([
          "sceneId",
          "sceneIdStatus",
          "multiProjectId",
          "multiMode",
          "multiSceneCount",
          "recordingAttemptId",
        ]);
      } catch {}
      void emitUploadTelemetry("project_state_change", {
        source: "startRecording-missing",
        from: null,
        to: null,
        sceneId: danglingState?.sceneId || null,
        sceneIdStatus: danglingState?.sceneIdStatus || null,
        multiProjectId: danglingState?.multiProjectId || null,
        multiMode: Boolean(danglingState?.multiMode),
        multiSceneCount: danglingState?.multiSceneCount || 0,
        recordingAttemptId: danglingState?.recordingAttemptId || null,
        uploadersInitialized: Boolean(uploadersInitialized.current),
        hasScreenUploader: Boolean(screenUploader.current),
        hasCameraUploader: Boolean(cameraUploader.current),
      });
      // Clear dangling scene state so a retry doesn't inherit broken sceneId/status
      // tied to a project that no longer exists. (BG recordingHelpers does the same
      // on its side; this is the cloudrecorder-side backup clear.)
      try {
        await chrome.storage.local.remove([
          "sceneId",
          "sceneIdStatus",
          "pendingSceneIndex",
        ]);
      } catch {}
      sendRecordingError(
        "No project ID found. Please close this tab and start a new recording."
      );
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
          "The tab you selected for recording was closed. Please start again."
        );
        return;
      }
    }

    if (!recorderSession.current) {
      markStartProgress("session-register");
      const registered = await startRecorderSession({
        projectId,
        sessionId: ensureRecordingSessionId(),
      });
      if (!registered) return;
    }
    markStartProgress("session-ready");

    await Promise.allSettled([
      screenUploader.current?.setSessionId?.(
        recorderSession.current?.id || null
      ),
      cameraUploader.current?.setSessionId?.(
        recorderSession.current?.id || null
      ),
      audioUploader.current?.setSessionId?.(
        recorderSession.current?.id || null
      ),
    ]);

    if (!screenUploader.current && !cameraUploader.current) {
      sendRecordingError("Uploaders not ready. Please restart recording.");
      logStartFlow("recording_error", { reason: "uploaders-not-ready" });
      return;
    }

    try {
      markStartProgress("stores-clear");
      // Last chance for an unpaid mic from a previous take: on IDB its chunks
      // live in the one shared store the next line wipes. Budgeted, this holds
      // recording start open.
      await Promise.race([
        runMicRecoveryScan({
          ignoreLiveRecording: true,
          backend: "idb",
        }).catch(() => {}),
        new Promise((r) => setTimeout(r, START_MIC_RECOVERY_BUDGET_MS)),
      ]);
      await chunksStore.clear();
      await clearAudioChunkStore("start-recording");
      await clearCameraChunkStore("start-recording");
      markStartProgress("stores-cleared");
    } catch (err) {
      fatalErrorRef.current = true;
      sendRecordingError(
        "Unable to initialize local buffer (IndexedDB issue)."
      );
      return;
    }
    lastTimecode.current = 0;
    hasChunks.current = false;
    index.current = 0;
    screenChunkByteRangesRef.current = [];
    cameraChunkByteRangesRef.current = [];
    audioChunkByteRangesRef.current = [];
    chunksPurgedDuringRecordingRef.current = false;
    screenChunksPurgedCountRef.current = 0;
    cameraChunksPurgedCountRef.current = 0;
    chunksPurgedBytesRef.current = 0;
    localWriteStatsRef.current = {
      count: 0,
      totalMs: 0,
      maxMs: 0,
      slowCount: 0,
    };
    screenRetainedPrefixRef.current = emptyRetainedPrefix();
    purgeModeRef.current = "none";
    purgeInFlightRef.current = { screen: false, camera: false };
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

    screenChunks.current = [];
    cameraChunks.current = [];
    audioChunks.current = [];

    navigator.storage.persist();

    const screenTrack = screenStream.current?.getVideoTracks?.()[0] ?? null;
    const cameraTrack = cameraStream.current?.getVideoTracks?.()[0] ?? null;

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

    // Runs once a track captures, not per track: declaring the session live is
    // what gives the content UI its toolbar and Stop button.
    let setupTrack = null;
    let liveDeclared = false;
    let liveDeclaring = false;
    const declareRecordingLive = async () => {
      // The first-chunk backstop can land mid-declare. Re-entering would
      // install a second timer interval over the first.
      if (liveDeclared || liveDeclaring) return;
      liveDeclaring = true;
      try {
        let warned = false;
        const MAX_DURATION =
          parseFloat(process.env.MAX_RECORDING_DURATION) || 60 * 60;
        const WARNING_THRESHOLD =
          parseFloat(process.env.RECORDING_WARNING_THRESHOLD) || 60;

        if (screenTimer.current.notificationInterval)
          clearInterval(screenTimer.current.notificationInterval);

        // Seed before the interval runs. Remaining track setup can outlast a
        // tick, and a back-to-back session would otherwise read the old timer.
        const declaredAt = Date.now();
        if (screenStream.current) {
          screenTimer.current.start = declaredAt;
          screenTimer.current.paused = false;
          screenTimer.current.total = 0;
        }
        if (cameraStream.current) {
          cameraTimer.current.start = declaredAt;
          cameraTimer.current.paused = false;
          cameraTimer.current.total = 0;
        }

        const timerInterval = setInterval(() => {
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
        liveDeclared = true;
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
      } finally {
        // Left false on a throw so the first-chunk backstop can retry.
        liveDeclaring = false;
      }
    };

    try {
      logStartFlow("recording_start", {
        recordingType: recordingType.current,
        hasScreen: Boolean(screenStream.current),
        hasCamera: Boolean(cameraStream.current),
        hasMic: Boolean(micStream.current),
      });
      // Pause suspends the graph and restart clears pausedStateRef without
      // resuming, so the next take muxed silence for its whole length.
      const ctxStateAtStart = aCtx.current?.state ?? null;
      busWarmupRef.current.ctxStateAtStart = ctxStateAtStart;
      busWarmupRef.current.ctxResumedAtStart = false;
      busWarmupRef.current.ran = false;
      busWarmupRef.current.rms = null;
      busWarmupRef.current.silentFault = false;
      if (
        aCtx.current &&
        needsContextResume({
          state: ctxStateAtStart,
          paused: pausedStateRef.current,
        })
      ) {
        try {
          await aCtx.current.resume();
          busWarmupRef.current.ctxResumedAtStart = true;
        } catch {}
        diagForward("audio-bus-context-resumed", {
          stateBefore: ctxStateAtStart,
          stateAfter: aCtx.current?.state ?? null,
        });
      }
      if (screenStream.current) {
        setupTrack = "screen";
        // What is wired into the bus, not what was asked for. Intent said
        // "system audio on" with nothing connected, muxing full length silence.
        const screenHasAudio = shouldMuxBusAudio(busSources.current);
        const stream = screenHasAudio
          ? attachMicToStream(screenStream.current, micStream.current)
          : // Strip incidental audio tracks (e.g. residual tab-capture
            // audio). Any audio track in the input causes the muxer to
            // emit a silent AAC stream into /original.
            new MediaStream(screenStream.current.getVideoTracks());

        const screenOptions = {
          mimeType: "video/webm;codecs=vp9,opus",
          videoBitsPerSecond: 16000000,
          audioBitsPerSecond: 128000,
        };

        const screenSettings = screenTrack?.getSettings?.() || {};
        markStartProgress("encoder-probe");
        const screenSelection = await chooseTrackEncoder({
          track: "screen",
          stream,
          mimeType: screenOptions.mimeType,
          videoBitsPerSecond: screenOptions.videoBitsPerSecond,
          audioBitsPerSecond: screenOptions.audioBitsPerSecond,
          audioChannels: audioBusChannels.current,
          enableAudio: screenHasAudio,
          createMediaRecorder,
          onDataAvailable: async (blob) => {
            checkMaxMemory();

            if (!blob || blob.size === 0) {
              console.error("❌ MediaRecorder produced empty chunk!");
              consecutiveScreenFailures.current++;
              if (consecutiveScreenFailures.current > 3) {
                sendRecordingError(
                  "Recording failed - no video data being captured. Please try again."
                );
                sendStopRecording("empty-screen-chunk");
              }
              return;
            }

            screenChunks.current.push(blob);
            const screenDropped = trimChunkBuffer(
              screenChunks,
              SCREEN_CHUNK_MEMORY_WINDOW
            );
            noteTrackChunk("screen", blob, {
              inMemoryChunkCount: screenChunks.current.length,
              droppedInMemoryChunks:
                (sessionTrackState.current.screen?.droppedInMemoryChunks || 0) +
                screenDropped,
            });

            const timestamp = Date.now();

            // No-ops after the codec matches; called outside the hasChunks
            // gate so it still runs if hasChunks was set elsewhere.
            syncActualVideoCodec("screen", screenRecorder.current);
            if (!hasChunks.current) {
              hasChunks.current = true;
              // Bytes on disk are proof the session is live. Recovers the UI
              // if the declare above was skipped or its storage write failed.
              declareRecordingLive().catch(() => {});
              lastTimecode.current = timestamp;
              firstChunkTime.current = timestamp;
              chrome.runtime
                .sendMessage({ type: "cancel-first-chunk-watchdog" })
                .catch(() => {});
              if (!firstChunkLoggedRef.current) {
                firstChunkLoggedRef.current = true;
                logStartFlow("first_chunk", { type: "screen" });
                assertCountdownBeforeFirstChunk(timestamp);
                chrome.storage.local
                  .set({ firstChunkAt: Date.now() })
                  .catch(() => {});
              }
            } else if (timestamp < lastTimecode.current) {
              return;
            } else {
              lastTimecode.current = timestamp;
            }

            chrome.storage.local
              .set({ lastChunkAt: Date.now() })
              .catch(() => {});

            // Claim the slot up front, like camera and audio do. Incrementing
            // at the end let the paused-drop return overwrite the last chunk.
            const chunkIndex = index.current;
            index.current++;

            const writeStartedAt = performance.now();
            await chunksStore
              .setItem(`chunk_${chunkIndex}`, {
                index: chunkIndex,
                chunk: blob,
                timestamp,
              })
              .catch((err) => {
                fatalErrorRef.current = true;
                sendRecordingError(
                  "Could not buffer recording data locally (IndexedDB blocked)."
                );
                sendStopRecording();
                throw err;
              });
            const writeMs = performance.now() - writeStartedAt;
            const writeStats = localWriteStatsRef.current;
            writeStats.count += 1;
            writeStats.totalMs += writeMs;
            if (writeMs > writeStats.maxMs) writeStats.maxMs = writeMs;
            if (writeMs >= 1000) writeStats.slowCount += 1;

            patchTrackState("screen", {
              durableChunkCount: chunkIndex + 1,
              lastPersistedChunkIndex: chunkIndex,
              lastPersistedAt: timestamp,
            });

            persistSessionState({ lastChunkIndex: chunkIndex });

            if (uploadersInitialized.current && screenUploader.current) {
              try {
                if (screenUploader.current?.isPaused) {
                  notePausedDrop("screen", blob);
                  return;
                }
                // No pre-write backpressure gate here: parking before write()
                // lets the next chunk overtake this one into the byte stream.
                await screenUploader.current.write(blob);
                consecutiveScreenFailures.current = 0;
                const endByte = Number(screenUploader.current?.totalBytes) || 0;
                screenChunkByteRangesRef.current.push({
                  index: chunkIndex,
                  endByte,
                  size: blob?.size || 0,
                });
                screenRetainedPrefixRef.current = extendRetainedPrefix(
                  screenRetainedPrefixRef.current,
                  {
                    index: chunkIndex,
                    endByte,
                    budgetBytes: currentPrefixBudget(),
                  }
                );
                void purgeConfirmedChunks(
                  chunksStore,
                  screenChunkByteRangesRef,
                  screenUploader.current,
                  "chunk_",
                  "screen"
                );
              } catch (uploadErr) {
                console.error("Failed to upload chunk to Bunny:", uploadErr);
                consecutiveScreenFailures.current++;
                if (consecutiveScreenFailures.current > 3) {
                  stallNotified.current = true;
                  sendRecordingError(
                    "Screen upload failed repeatedly. Continuing locally; upload will retry on finalize."
                  );
                  screenUploader.current?.pause?.();
                }
              }
            }
          },
          probeOptions: {
            screenWidth: Number(screenSettings.width) || 1920,
            screenHeight: Number(screenSettings.height) || 1080,
            framerate: Number(screenSettings.frameRate) || 30,
          },
        });
        markStartProgress("encoder-probe-done");
        screenRecorder.current = screenSelection.recorder;
        // Only WebCodecsTrackRecorder disposes the prewarm. On the
        // MediaRecorder fallback nothing would, leaving a configured hardware
        // encoder held for the whole recording (the prewarm no longer
        // self-closes after 6 frames). WebM is the same story: the warm
        // encoder is H.264, so that path declines to adopt it.
        if (
          screenSelection.kind !== "webcodecs" ||
          screenSelection.containerKind === "webm"
        ) {
          closeActiveEncoderPrewarm().catch(() => {});
        }
        encoderKinds.screen = screenSelection.kind;
        trackContainers.screen = screenSelection.container;
        trackCodecs.screen = screenSelection.codec;
        syncSelectedContainer(
          "screen",
          screenUploader,
          screenSelection.container
        );
        encoderHwSlots = screenSelection.hwSlots || encoderHwSlots;
        logDebugEvent("encoder-selected", {
          track: "screen",
          kind: screenSelection.kind,
          reason: screenSelection.reason,
          container: screenSelection.container,
          codec: screenSelection.codec,
          hwSlots: screenSelection.hwSlots,
          // Audio that arrived but never reached the bus encodes video-only,
          // and the file alone cannot say which step dropped it.
          enableAudio: screenHasAudio,
          inputAudioTracks: stream.getAudioTracks().length,
        });
        diagForward("screen-encoder-audio", {
          enableAudio: screenHasAudio,
          busHasSystem: Boolean(busSources.current.system),
          busHasMic: Boolean(busSources.current.mic),
          streamAudioTracks: stream.getAudioTracks().length,
          screenStreamAudioTracks:
            screenStream.current?.getAudioTracks?.().length || 0,
        });

        screenRecorder.current.start(2000);
        // Fire and forget: the samples take 1.5s and start latency is budgeted.
        void measureBusWarmup();

        // First-chunk watchdog (8s, chrome.alarms-backed).
        chrome.runtime
          .sendMessage({ type: "start-first-chunk-watchdog" })
          .catch(() => {});

        if (screenTrack) {
          bindScreenTrack(screenTrack);
        }

        // Declaring here means a mic or camera failure below can't strand a
        // live recording with no way to stop it.
        await declareRecordingLive();
      }

      // Audio recorder for transcription, and for the scene's voice when the
      // take is separated.
      diagForward("separated-mic-track", {
        separated: separatedAudio.current,
        micTracks: rawMicStream.current?.getAudioTracks?.().length || 0,
        label:
          String(
            rawMicStream.current?.getAudioTracks?.()[0]?.label || ""
          ).slice(0, 60) || null,
      });
      if (rawMicStream.current?.getAudioTracks?.().length) {
        setupTrack = "audio";
        const audioOptions = {
          mimeType: "audio/webm",
          // A separated mic is the recording, not just a transcription source.
          // 96k is transparent for voice and a quarter less to send after stop.
          audioBitsPerSecond: separatedAudio.current ? 96000 : 128000,
        };

        markStartProgress("audio-encoder-probe");
        const audioSelection = await chooseTrackEncoder({
          track: "audio",
          stream: rawMicStream.current,
          separated: separatedAudio.current,
          mimeType: audioOptions.mimeType,
          audioBitsPerSecond: audioOptions.audioBitsPerSecond,
          enableAudio: true,
          createMediaRecorder,
          onDataAvailable: async (blob) => {
            const timestamp = Date.now();
            // Small in-memory window for UI/quick fallback only.
            audioChunks.current.push(blob);
            const droppedAudio = trimChunkBuffer(
              audioChunks,
              AUDIO_CHUNK_MEMORY_WINDOW
            );
            noteTrackChunk("audio", blob, {
              inMemoryChunkCount: audioChunks.current.length,
              droppedInMemoryChunks:
                (sessionTrackState.current.audio?.droppedInMemoryChunks || 0) +
                droppedAudio,
            });
            let audioPersistedIndex = null;
            if (audioChunkStoreReadyRef.current) {
              const audioChunkIndex = audioChunkIndexRef.current;
              audioChunkIndexRef.current += 1;
              audioPersistedIndex = audioChunkIndex;
              try {
                await audioChunksStore.setItem(
                  `audio_chunk_${audioChunkIndex}`,
                  {
                    index: audioChunkIndex,
                    chunk: blob,
                    timestamp,
                  }
                );
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
                  // On a separated take this store is the only copy (the screen
                  // track has no mic), and the flag never re-arms, so every
                  // later chunk is dropped too.
                  separated: separatedAudio.current || undefined,
                });
                if (separatedAudio.current) {
                  void emitUploadTelemetry("upload_error", {
                    reason: "separated-mic-store-failed",
                    uploaderType: "cloud_recorder",
                  });
                  diagForward("separated-mic-store-failed", {
                    error: String(err?.message || err).slice(0, 120),
                  });
                }
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
              // The mic file stops here, so freeze its clock or it claims the
              // whole session's length.
              if (!audioTimer.current.paused && audioTimer.current.start) {
                audioTimer.current.total +=
                  Date.now() - audioTimer.current.start;
                audioTimer.current.paused = true;
              }
              try {
                if (audioRecorder.current?.state === "recording") {
                  audioRecorder.current.stop();
                }
              } catch (err) {
                console.warn(
                  "Failed to stop audio recorder after degradation:",
                  err
                );
              }
              return;
            }
            if (uploadersInitialized.current && audioUploader.current) {
              try {
                if (audioUploader.current?.isPaused) {
                  notePausedDrop("audio", blob);
                  return;
                }
                if (audioUploader.current.queuedBytes > 5 * 1024 * 1024) {
                  await audioUploader.current
                    .waitForPendingUploads?.()
                    .catch(() => {});
                }
                await audioUploader.current.write(blob);
                consecutiveAudioFailures.current = 0;
                // Byte ranges so a finalize-time gap can be re-sent from the
                // durable store.
                if (audioPersistedIndex !== null) {
                  audioChunkByteRangesRef.current.push({
                    index: audioPersistedIndex,
                    endByte: Number(audioUploader.current?.totalBytes) || 0,
                    size: blob?.size || 0,
                  });
                }
              } catch (uploadErr) {
                console.warn(
                  "Failed to upload audio chunk to Bunny:",
                  uploadErr
                );
                consecutiveAudioFailures.current++;
                if (consecutiveAudioFailures.current > 3) {
                  // Audio is supplementary; pause uploader, keep recording.
                  audioUploader.current?.pause?.();
                }
              }
            }
            if (!firstChunkLoggedRef.current) {
              firstChunkLoggedRef.current = true;
              logStartFlow("first_chunk", { type: "audio" });
              assertCountdownBeforeFirstChunk(Date.now());
            }
          },
        });
        markStartProgress("audio-encoder-probe-done");
        audioRecorder.current = audioSelection.recorder;
        micRecordedThisTake.current = true;
        encoderKinds.audio = audioSelection.kind;
        trackContainers.audio = audioSelection.container;
        trackCodecs.audio = audioSelection.codec;
        syncSelectedContainer("audio", audioUploader, audioSelection.container);
        logDebugEvent("encoder-selected", {
          track: "audio",
          kind: audioSelection.kind,
          reason: audioSelection.reason,
          container: audioSelection.container,
          codec: audioSelection.codec,
        });

        audioRecorder.current.start(2000);
        // Same tick as start(), so the clock covers exactly what the file does.
        audioTimer.current.start = Date.now();
        audioTimer.current.total = 0;
        audioTimer.current.paused = false;
        audioTimer.current.everStarted = true;
      }
      // Past here a late mic really has missed the separated recorder, which
      // is the case the setMic fallback is for.
      recordersBuilt.current = true;

      if (cameraStream.current) {
        setupTrack = "camera";
        let streamToRecord = cameraStream.current;

        // Camera-only carries the mic in-stream. Screen+camera routes audio through the
        // audio uploader so the camera track stays video-only, same bus rule as screen.
        if (
          recordingType.current === "camera" &&
          shouldMuxBusAudio(busSources.current) &&
          micStream.current
        ) {
          streamToRecord = attachMicToStream(
            cameraStream.current,
            micStream.current
          );
        } else {
          // Drop incidental audio tracks; otherwise the muxer emits a
          // silent AAC stream into the camera MP4.
          streamToRecord = new MediaStream(
            cameraStream.current.getVideoTracks()
          );
        }

        const cameraSettings = cameraTrack?.getSettings?.() || {};

        const cameraOptions = {
          mimeType:
            recordingType.current === "camera"
              ? "video/webm;codecs=vp9,opus"
              : "video/webm;codecs=vp9",
          // Priced on the encoded size: WebCodecs resizes a 4K webcam to the
          // 1080p cap first. The MediaRecorder fallback takes no bitrate at all.
          videoBitsPerSecond: computeCameraBitrate(
            computeEncodedDimensions({
              width: Number(cameraSettings.width),
              height: Number(cameraSettings.height),
            })
          ),
          audioBitsPerSecond: 128000,
        };
        const cameraHasAudio =
          recordingType.current === "camera" &&
          (streamToRecord?.getAudioTracks?.()?.length ?? 0) > 0;
        // probeConcurrentHw runs here, and its flush race alone is capped at
        // 2.5s, the same window the BG teardown uses.
        markStartProgress("camera-encoder-probe");
        const cameraSelection = await chooseTrackEncoder({
          track: "camera",
          stream: streamToRecord,
          mimeType: cameraOptions.mimeType,
          videoBitsPerSecond: cameraOptions.videoBitsPerSecond,
          audioBitsPerSecond: cameraOptions.audioBitsPerSecond,
          audioChannels: audioBusChannels.current,
          enableAudio: cameraHasAudio,
          createMediaRecorder,
          probeOptions: {
            cameraWidth: Number(cameraSettings.width) || 1280,
            cameraHeight: Number(cameraSettings.height) || 720,
            framerate: Number(cameraSettings.frameRate) || 30,
          },
          onDataAvailable: async (blob) => {
            if (!blob || blob.size === 0) {
              console.warn("⚠️ Camera MediaRecorder produced empty chunk");
              consecutiveCameraFailures.current++;
              return;
            }

            cameraChunks.current.push(blob);
            const cameraDropped = trimChunkBuffer(
              cameraChunks,
              CAMERA_CHUNK_MEMORY_WINDOW
            );
            noteTrackChunk("camera", blob, {
              inMemoryChunkCount: cameraChunks.current.length,
              droppedInMemoryChunks:
                (sessionTrackState.current.camera?.droppedInMemoryChunks || 0) +
                cameraDropped,
            });
            // firstChunkLoggedRef fires once across screen+camera, so this
            // sits outside that gate. No-ops after the codec matches.
            syncActualVideoCodec("camera", cameraRecorder.current);
            if (!firstChunkLoggedRef.current) {
              firstChunkLoggedRef.current = true;
              logStartFlow("first_chunk", { type: "camera" });
              assertCountdownBeforeFirstChunk(Date.now());
            }

            let cameraPersistedIndex = null;
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
                  }
                );
                cameraPersistedIndex = cameraChunkIndex;
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
                if (cameraUploader.current?.isPaused) {
                  notePausedDrop("camera", blob);
                  return;
                }
                await cameraUploader.current.write(blob);
                consecutiveCameraFailures.current = 0;
                if (cameraPersistedIndex !== null) {
                  const endByte =
                    Number(cameraUploader.current?.totalBytes) || 0;
                  cameraChunkByteRangesRef.current.push({
                    index: cameraPersistedIndex,
                    endByte,
                    size: blob?.size || 0,
                  });
                  void purgeConfirmedChunks(
                    cameraChunksStore,
                    cameraChunkByteRangesRef,
                    cameraUploader.current,
                    "camera_chunk_",
                    "camera"
                  );
                }
              } catch (uploadErr) {
                console.error(
                  "Failed to upload camera chunk to Bunny:",
                  uploadErr
                );
                consecutiveCameraFailures.current++;
                if (consecutiveCameraFailures.current > 3) {
                  console.error(
                    "Camera upload failing repeatedly; pausing camera uploader"
                  );
                  cameraUploader.current?.pause?.();
                }
              }
            }
          },
        });
        markStartProgress("camera-encoder-probe-done");
        cameraRecorder.current = cameraSelection.recorder;
        encoderKinds.camera = cameraSelection.kind;
        trackContainers.camera = cameraSelection.container;
        trackCodecs.camera = cameraSelection.codec;
        syncSelectedContainer(
          "camera",
          cameraUploader,
          cameraSelection.container
        );
        encoderHwSlots = cameraSelection.hwSlots || encoderHwSlots;
        logDebugEvent("encoder-selected", {
          track: "camera",
          kind: cameraSelection.kind,
          reason: cameraSelection.reason,
          container: cameraSelection.container,
          codec: cameraSelection.codec,
          hwSlots: cameraSelection.hwSlots,
        });

        cameraRecorder.current.start(2000);
        // Camera-only muxes the mic too, and the screen call site never runs.
        void measureBusWarmup();
        scheduleCameraSilenceCheck();
      }

      // Camera-only never enters the screen branch, so this is where it goes
      // live.
      await declareRecordingLive();
    } catch (err) {
      const errMsg = String(err?.message || err).slice(0, 200);
      if (liveDeclared) {
        // A secondary track failed with capture already live. Tearing the
        // session down here is what orphaned recordings with no Stop button.
        console.error(
          "[Screenity][CloudRecorder] track setup failed after recording went live",
          err
        );
        logStartFlow("track_setup_failed_after_live", {
          track: setupTrack,
          errMsg,
        });
        // Field names are the server's existing allowlist, so nothing new has
        // to be wired to keep the values.
        void emitUploadTelemetry("recording_track_setup_failed_after_live", {
          trackType: setupTrack,
          reason: "track-setup-failed-after-live",
          errMsg,
        });
      } else {
        sendRecordingError("Recording failed: " + err.message);
      }
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
    // A restart that loses the mic would otherwise report the previous take's
    // measured length.
    if (!audioRecorder.current) {
      audioTimer.current = {
        start: null,
        total: 0,
        paused: false,
        everStarted: false,
      };
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
    // Roll unaccumulated elapsed into `total` before nulling `start`.
    // Without this, paused recordings end up with a truncated
    // screenDuration that bypasses the lastChunk-firstChunk fallback.
    const now = Date.now();
    if (!screenTimer.current.paused && screenTimer.current.start) {
      screenTimer.current.total =
        (screenTimer.current.total || 0) + (now - screenTimer.current.start);
    }
    screenTimer.current.start = null;
    screenTimer.current.paused = false;
    if (!cameraTimer.current.paused && cameraTimer.current.start) {
      cameraTimer.current.total =
        (cameraTimer.current.total || 0) + (now - cameraTimer.current.start);
    }
    cameraTimer.current.start = null;
    cameraTimer.current.paused = false;
    if (!audioTimer.current.paused && audioTimer.current.start) {
      audioTimer.current.total =
        (audioTimer.current.total || 0) + (now - audioTimer.current.start);
    }
    audioTimer.current.start = null;
    audioTimer.current.paused = false;
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
              setTimeout(() => reject(new Error("Stop timeout")), 5000)
            ),
          ]);
        } catch (err) {
          console.error("Error stopping recorder:", err);
        }
        // Drain any write() promises started by ondataavailable. Without
        // this, finalize() can race the final chunk and reject it with
        // "Cannot write during finalization", silently truncating.
        const pending = recorderRef.current?._pendingWrites;
        if (pending && pending.size > 0) {
          try {
            await Promise.race([
              Promise.allSettled(Array.from(pending)),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Drain timeout")), 5000)
              ),
            ]);
          } catch (err) {
            console.warn("Pending writes drain timed out:", err);
          }
        }
      }
    };

    // Freeze the mic clock here, not at cleanupTimers: the drain below waits on
    // onstop and pending writes, and none of that time is in the file.
    if (!audioTimer.current.paused && audioTimer.current.start) {
      audioTimer.current.total += Date.now() - audioTimer.current.start;
      audioTimer.current.paused = true;
    }

    await Promise.all([
      stopRecorder(screenRecorder),
      stopRecorder(cameraRecorder),
      stopRecorder(audioRecorder),
    ]);

    if (stopStreams) {
      // Null the refs or Chrome keeps the tab-capture binding.
      [screenStream, cameraStream, micStream, rawMicStream].forEach((ref) => {
        ref.current?.getTracks().forEach((track) => track.stop());
        ref.current = null;
      });
      tabID.current = null;
      // Close the AudioContext: without this the audio thread keeps
      // ticking and back-to-back Pro multi recordings stack contexts.
      if (aCtx.current) {
        try {
          await aCtx.current.close();
        } catch {}
        aCtx.current = null;
      }
      destination.current = null;
      audioInputGain.current = null;
      audioOutputGain.current = null;
      // The tap belongs to the closed context, and nothing is on the bus
      // any more. Both are rebuilt with the next graph.
      busTap.current = null;
      busSources.current = { mic: false, system: false };
      recordersBuilt.current = false;
      micRecordedThisTake.current = false;
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

      if (timer.start && duration < MIN_DURATION_SECONDS) {
        return MIN_DURATION_SECONDS;
      }

      return duration;
    };

    const screen = getDuration(screenTimer.current);
    const camera = getDuration(cameraTimer.current);
    // Bunny can't measure an audio-only track (reports 1), so this number is
    // the only duration the mic media ever gets. Muxed shapes have no mic
    // recorder and keep the video timer.
    const audio = audioTimer.current.everStarted
      ? getDuration(audioTimer.current)
      : Math.max(screen, camera);

    return {
      screen,
      camera,
      audio,
      fallbackMs:
        firstChunkTime.current && lastTimecode.current
          ? Math.max(0, lastTimecode.current - firstChunkTime.current)
          : null,
    };
  };

  const handleTranscription = async (
    uploadMeta,
    projectId,
    sceneId = uploadMeta.sceneId
  ) => {
    if (!uploadMeta.audio || !uploadMeta.audio.mediaId) return;
    try {
      const transcriptionTarget =
        uploadMeta.screen?.mediaId || uploadMeta.camera?.mediaId;

      if (transcriptionTarget) {
        const dedupeKey = `transcriptionQueued:${sceneId}:${uploadMeta.audio.mediaId}`;
        const dedupe = await chrome.storage.local.get([dedupeKey]);
        if (dedupe?.[dedupeKey]) return;

        const { screenityToken } = await chrome.storage.local.get([
          "screenityToken",
        ]);
        await fetch(`${API_BASE}/transcription/queue`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(screenityToken
              ? { Authorization: `Bearer ${screenityToken}` }
              : {}),
          },
          credentials: "include",
          body: JSON.stringify({
            output: `transcriptions/${uploadMeta.audio.mediaId}.json`,
            videoId: projectId,
            sceneId,
            inputMediaId: uploadMeta.audio.mediaId,
            targetMediaId: transcriptionTarget,
            lang: "en",
            model: "tiny",
          }),
        });
        await chrome.storage.local.set({ [dedupeKey]: true });
        logDebugEvent("transcription-queued", {
          projectId,
          sceneId,
          inputMediaId: uploadMeta.audio.mediaId,
          targetMediaId: transcriptionTarget,
        });
      }
    } catch (err) {
      console.warn("❌ Transcription failed:", err);
      logDebugEvent("transcription-failed", {
        projectId,
        sceneId,
        error: err?.message || String(err),
      });
    }
  };

  useEffect(() => {
    const onHide = (event) => {
      // event.persisted means the page may come back via bfcache; don't finalize then.
      const isActualUnload = !event.persisted;

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
        console.warn("⚠️ Recorder page unloading; finalizing");
        navigator.sendBeacon?.(
          `${API_BASE}/log/recorder-unload`,
          JSON.stringify({ reason: "pagehide", ts: Date.now() })
        );
        stopRecording(true, "pagehide-unload");
      }
    };

    if (IS_OFFSCREEN_HOST) return undefined;

    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  // Prewarm the WebCodecs hw-slot probe on mount so it's resolved by
  // the time inspectTrackPlan runs (saves 300-500ms cold-start).
  useEffect(() => {
    if (IS_OFFSCREEN_HOST) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { inspectTrackPlan } = await import("./encoder/chooseEncoder");
        if (cancelled) return;
        // Default probe options; the real probe is shape-invariant
        // because chooseEncoder caches the first promise it created
        // regardless of probeOptions.
        await inspectTrackPlan({
          track: "screen",
          probeOptions: {
            screenWidth: 1920,
            screenHeight: 1080,
            cameraWidth: 1280,
            cameraHeight: 720,
            framerate: 30,
          },
        });
      } catch {
        // Best-effort prewarm; the real init still runs the probe.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        logForensicEvent("visibility-hidden");
        persistSessionState({
          visibilityState: "hidden",
          visibilityChangedAt: Date.now(),
        });
      } else if (document.visibilityState === "visible") {
        logForensicEvent("visibility-visible");
        // In-tab heartbeat may have been throttled while hidden; force stall-recovery.
        try {
          const now = Date.now();
          const staleThreshold = 10_000;
          [screenUploader.current, cameraUploader.current].forEach((up) => {
            if (!up) return;
            const idle = now - (up.lastProgressAt || 0);
            if (idle > staleThreshold && up.queuedBytes > 0) {
              up.attemptStallRecovery?.(idle).catch(() => {});
            }
          });
        } catch (err) {
          console.warn(
            "[CloudRecorder] visibility-triggered recovery failed:",
            err
          );
        }
        persistSessionState({
          visibilityState: "visible",
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

    if (IS_OFFSCREEN_HOST) return undefined;

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  // Focus/lifecycle timeline (recorder is a pinned tab): window blur/focus and
  // page freeze/resume, to correlate a freeze with the user switching away.
  useEffect(() => {
    if (IS_OFFSCREEN_HOST) return undefined;
    const onWindowBlur = () => logForensicEvent("window-blur");
    const onWindowFocus = () => logForensicEvent("window-focus");
    const onPageFreeze = () => logForensicEvent("page-freeze");
    const onPageResume = () => logForensicEvent("page-resume");
    const onPageShow = () => logForensicEvent("pageshow");

    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("freeze", onPageFreeze);
    document.addEventListener("resume", onPageResume);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("freeze", onPageFreeze);
      document.removeEventListener("resume", onPageResume);
      window.removeEventListener("pageshow", onPageShow);
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
      audioUploader.current?.pause?.();
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
      if (
        audioUploader.current &&
        RESUMABLE_UPLOADER_STATUSES.has(audioUploader.current.status)
      ) {
        audioUploader.current.resume();
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

  // Tells background resume this host still holds a take, including a post-stop
  // drain or open retry modal no pipeline step covers.
  useEffect(() => {
    const beat = () => {
      if (
        !recorderSession.current &&
        !finalizeFailureRef.current &&
        !isInit.current
      ) {
        return;
      }
      chrome.storage.local
        .set({
          cloudRecorderHostBusy: {
            at: Date.now(),
            sessionId: recorderSession.current?.id || null,
          },
        })
        .catch(() => {});
    };
    const id = setInterval(beat, HOST_BUSY_BEAT_MS);
    return () => clearInterval(id);
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
      stopTabKeepAlive();
    };
  }, []);

  useEffect(() => {
    return () => {
      stopAllIntervals();
    };
  }, []);

  // 30s heartbeat snapshots track counters mid-recording so a session
  // that dies before stop (tab kill, sleep, crash) still leaves
  // breadcrumbs at the server. Covers the WebCodecs screen/camera diags
  // and the MediaRecorder audio diag, so a mic that goes silent mid-
  // recording is visible before the final stop-diag.
  useEffect(() => {
    if (!started) return;
    const intervalId = setInterval(() => {
      try {
        if (!recorderSession.current?.id) return;
        const screen = screenRecorder.current?.getDiagSnapshot?.();
        const camera = cameraRecorder.current?.getDiagSnapshot?.();
        const audio = getAudioDiagSnapshot();
        if (!screen && !camera && !audio) return;
        // offsetBytes used to stay 0 all session then jump at finalize, leaving
        // mid-recording upload behaviour unreconstructable.
        const uploadedBytes =
          (Number(screenUploader.current?.offset) || 0) +
          (Number(cameraUploader.current?.offset) || 0) +
          (Number(audioUploader.current?.offset) || 0);
        const trackState = sessionTrackState.current || {};
        const recordedBytes =
          (trackState.screen?.bytesRecorded || 0) +
          (trackState.camera?.bytesRecorded || 0) +
          (trackState.audio?.bytesRecorded || 0);
        const pressure = storagePressureRef.current || {};
        const screenStats = screenRecorder.current?.getEncodeStats?.() || null;
        const cameraStats = cameraRecorder.current?.getEncodeStats?.() || null;
        const writeStats = localWriteStatsRef.current || {};
        void emitUploadTelemetry("recording_heartbeat", {
          screenDiag: screen || null,
          cameraDiag: camera || null,
          audioDiag: audio || null,
          offset: uploadedBytes,
          totalBytes: recordedBytes,
          // Polled, not live: at most STORAGE_CHECK_INTERVAL_MS stale.
          availableBytes:
            typeof pressure.headroom === "number" ? pressure.headroom : null,
          localBytes: Math.max(
            0,
            recordedBytes - (chunksPurgedBytesRef.current || 0)
          ),
          // Quota shrinking across samples means the OS disk itself is filling.
          storageQuotaBytes:
            typeof pressure.quota === "number" ? pressure.quota : null,
          storageUsageBytes:
            typeof pressure.usage === "number" ? pressure.usage : null,
          encodeStats: screenStats
            ? { ...screenStats, track: "screen" }
            : cameraStats
            ? { ...cameraStats, track: "camera" }
            : null,
          localWriteStats: writeStats.count
            ? {
                count: writeStats.count,
                avgMs: Math.round(writeStats.totalMs / writeStats.count),
                maxMs: Math.round(writeStats.maxMs),
                slowCount: writeStats.slowCount,
                // Server enum: opfs|idb|memory|unknown. Never null, or the
                // sanitizer can drop the whole localWriteStats object.
                backend: storageBackends.screen || "unknown",
              }
            : null,
        });
      } catch {}
    }, 30_000);
    return () => clearInterval(intervalId);
  }, [started]);

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
    separatedMic = null
  ) => {
    const {
      projectId,
      clickEvents = [],
      capturedSurface = null,
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
      "capturedSurface",
      "multiMode",
      "multiSceneCount",
      "multiLastSceneId",
      "activeSceneId",
      "recordingToScene",
      "recordedTabDomain",
      "recordingType",
    ]);

    const { cameraFlipped } = await chrome.storage.local.get(["cameraFlipped"]);

    let insertAfterSceneId = null;
    if (multiMode) {
      insertAfterSceneId = multiLastSceneId || activeSceneId;
    } else {
      insertAfterSceneId = activeSceneId;
    }

    if (!uploadMeta.sceneId) {
      throw new Error("Missing sceneId in uploadMeta");
    }

    if (!uploadMeta.screen?.mediaId && !uploadMeta.camera?.mediaId) {
      throw new Error(
        "No valid media uploaded - both screen and camera mediaId are missing"
      );
    }

    const sceneId = uploadMeta.sceneId;
    const existingStatus = await getSceneCreateStatus(sceneId);
    let sceneOutcome = null;
    let shouldIncrementMultiSceneCount = false;
    // The server files a take into an empty target scene under that scene's
    // id and returns it. Everything after the POST must use this id.
    let effectiveSceneId = sceneId;

    if (existingStatus?.status === "created") {
      logDebugEvent("scene-create-skip", {
        projectId,
        sceneId,
      });
      // No ensureMediaLinked call here: /api/bunny/videos already
      // stamped each media's `usedIn` at TUS init time, and the prior
      // /scenes/ POST already cleared `recoveryState`. PATCH was a
      // no-op + a post-stop hang risk in the dying cloudrecorder tab.
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

      // uploadMeta's dims are a pre-encode guess, wrong on 27% of scenes (see
      // encodedDims.js). Scene size, aspect ratio, baseResolution and auto-zoom
      // all key off what we send here, so ask the encoder what it actually wrote.
      const reportedScreenDims = {
        width: uploadMeta.screen?.width || 1920,
        height: uploadMeta.screen?.height || 1080,
      };
      let screenTrackSettings = null;
      try {
        screenTrackSettings =
          screenStream.current?.getVideoTracks?.()[0]?.getSettings?.() || null;
      } catch {}
      const screenEncoded = pickEncodedDims({
        diag: screenRecorder.current?.getDiagSnapshot?.() || null,
        trackSettings: screenTrackSettings,
        fallback: reportedScreenDims,
      });
      // Clicks have to move with the corrected dims, or auto-zoom pans to the
      // wrong place.
      const scaledClickEvents = scaleClickEvents(
        clickEvents,
        reportedScreenDims,
        screenEncoded
      );

      // Snapshot, not the live bus: by here it is zeroed.
      const stopAudio = stopAudioVerdict.current || {
        separated: separatedNow(),
        micRecorded: micRecordedThisTake.current,
        systemAudioOnScreen: Boolean(busSources.current.system),
      };
      const isSeparated = stopAudio.separated;
      const declareSeparated = shouldDeclareSeparated({
        separatedInFact: isSeparated,
        micRecorded: stopAudio.micRecorded,
        micLanded: Boolean(separatedMic?.mediaId),
        systemAudioOnScreen: stopAudio.systemAudioOnScreen,
      });
      const payload = {
        sceneId,
        screenMediaId: uploadMeta.screen?.mediaId || null,
        cameraMediaId: uploadMeta.camera?.mediaId || null,
        screenVideoId: uploadMeta.screen?.videoId || null,
        cameraVideoId: uploadMeta.camera?.videoId || null,
        // Separated: the mic is its own source, not the scene's audio media.
        audioMediaId: isSeparated ? null : uploadMeta.audio?.mediaId || null,
        // The mic id, when its upload beat this POST: the scene is born with
        // its voice instead of gaining one after the editor already read it.
        // Null means the upload lost the race; attach-scene-audio fills it in
        // after, as before.
        audioSourceMediaId: separatedMic?.mediaId || null,
        // Stated, not read off the mic's media doc: no upload means no doc, and
        // a missing one used to read as muxed (a voice the video never had).
        ...(declareSeparated ? { audioLayout: "separated" } : {}),
        recordingSessionId: recorderSession.current?.id || null,
        durations,
        captionSource: uploadMeta.screen ? "screen" : "camera",
        transcriptionSourceMediaId: !isSilent
          ? (isSeparated
              ? separatedMic?.mediaId || null
              : uploadMeta.audio?.mediaId || separatedMic?.mediaId || null)
          : null,
        thumbnail: uploadMeta.screen?.thumbnail || null,
        dimensions: {
          screen: { width: screenEncoded.width, height: screenEncoded.height },
          camera: uploadMeta.camera
            ? {
                width: uploadMeta.camera?.width || 1920,
                height: uploadMeta.camera?.height || 1080,
                flip: cameraFlipped,
              }
            : null,
        },
        clickEvents: scaledClickEvents,
        // Omitted when unknown: the app defaults to monitor, and a
        // guess would be worse than that default.
        ...(capturedSurface ? { surface: capturedSurface } : {}),
        instantMode: instantMode.current,
        newProject: !recordingToScene && (!multiMode || multiSceneCount === 0),
        insertAfterSceneId,
        isTab: isTab.current && !regionRef.current,
        domain: recordedTabDomain || null,
      };

      // Scene-create via BG (POSTs directly, editor-tab proxy fallback).
      // 30s cap because keepalive doesn't keep the JS context alive.
      stopFlowRef.current?.tick?.("scene-create-dispatched", { sceneId });
      const sendOnce = () =>
        new Promise((resolve) => {
          let settled = false;
          const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            resolve({ ok: false, error: "bg-timeout" });
          }, 30_000);
          chrome.runtime
            .sendMessage({ type: "forward-create-scene", projectId, payload })
            .then((reply) => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              resolve(reply || { ok: false, error: "no-bg-response" });
            })
            .catch((err) => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              resolve({ ok: false, error: err?.message || String(err) });
            });
        });
      let swRes = await sendOnce();
      // One retry if BG didn't respond (SW was restarting). Any other
      // error is forwarded as-is; the outer block already has the
      // /recover-scene fallback path that catches it.
      if (
        !swRes?.ok &&
        (swRes?.error === "no-bg-response" || swRes?.error === "bg-timeout")
      ) {
        stopFlowRef.current?.tick?.("scene-create-retry", {
          reason: swRes?.error,
        });
        swRes = await sendOnce();
      }
      stopFlowRef.current?.tick?.("scene-create-replied", {
        ok: !!swRes?.ok,
        status: swRes?.status,
        error: swRes?.error,
      });
      const res = {
        ok: !!swRes?.ok,
        status: swRes?.status ?? 0,
        text: async () => swRes?.text || swRes?.error || "",
        json: async () => swRes?.body ?? null,
      };

      if (!res.ok) {
        const errorText = swRes?.text || swRes?.error || "";
        const recoverResult = await recoverScene({
          projectId,
          sceneId,
          screenMediaId: uploadMeta.screen?.mediaId || null,
          cameraMediaId: uploadMeta.camera?.mediaId || null,
          // Not the mic: a recovered scene carries no micIncluded, so the
          // attach path gives it its voice instead of naming it twice.
          // Separated: that id is a caption copy, and naming it here tells the
          // server the voice is in the video.
          audioMediaId: isSeparated ? null : uploadMeta.audio?.mediaId || null,
          audioLayout: declareSeparated ? "separated" : null,
          // Pass the duration + capture dims so the server can stamp
          // them onto the media docs (and therefore the scene) right
          // away, instead of waiting for the Bunny encoded webhook.
          durations: payload?.durations || null,
          dimensions: payload?.dimensions || null,
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
        // Dispatch editor-ready right after the 201; housekeeping
        // (setSceneCreateStatus / removePendingScene / etc.) runs in
        // parallel below since nothing in the handoff reads it.
        sceneOutcome = "created";
        shouldIncrementMultiSceneCount = true;
        const replySceneId = swRes?.body?.sceneId;
        if (typeof replySceneId === "string" && replySceneId) {
          effectiveSceneId = replySceneId;
        }
        // The BG matches the offer on the scene the editor opens, so it has to
        // follow the remap.
        const offerToRekey = localScreenPlaybackOfferRef.current;
        if (offerToRekey && offerToRekey.sceneId !== effectiveSceneId) {
          try {
            const rekeyed = await chrome.runtime.sendMessage({
              type: "cloud-local-playback-register",
              offer: { ...offerToRekey, sceneId: effectiveSceneId },
            });
            if (rekeyed?.ok && rekeyed.offer) {
              localScreenPlaybackOfferRef.current = rekeyed.offer;
            }
          } catch {}
        }

        if (multiMode && shouldIncrementMultiSceneCount) {
          // Multi needs count + lastSceneId persisted before
          // reopen-popup-multi fires; that handler reads them.
          // reads them. Keep this awaited path for multi.
          await chrome.storage.local.set({
            multiSceneCount: multiSceneCount + 1,
            multiLastSceneId: effectiveSceneId,
          });
          chrome.runtime.sendMessage({
            type: "reopen-popup-multi",
          });
        }

        sendEditorReady({
          projectId,
          sceneId: effectiveSceneId,
          recordingToScene,
          multiMode,
        });

        // Housekeeping in parallel (editor's already moving).
        await setSceneCreateStatus(sceneId, "created");
        Promise.all([
          removePendingScene(sceneId).catch(() => {}),
          markSceneComplete(sceneId).catch(() => {}),
          setPipelineState("scene-created", { projectId, sceneId }).catch(
            () => {}
          ),
          chrome.storage.local.remove("clickEvents").catch(() => {}),
        ]).then(() => {
          logDebugEvent("scene-create-complete", { projectId, sceneId });
        });
        // micIncluded is claimed only here, by the POST that carried the id.
        // A reused scene's earlier POST sent none; a recovered one never sent
        // this payload at all. Both still need the attach.
        return {
          created: true,
          micIncluded: Boolean(separatedMic?.mediaId),
          sceneId: effectiveSceneId,
        };
      }
    }

    if (multiMode && shouldIncrementMultiSceneCount) {
      await chrome.storage.local.set({
        multiSceneCount: multiSceneCount + 1,
        multiLastSceneId: effectiveSceneId,
      });
      chrome.runtime.sendMessage({
        type: "reopen-popup-multi",
      });
    }

    sendEditorReady({
      projectId,
      sceneId: effectiveSceneId,
      recordingToScene,
      multiMode,
    });

    await chrome.storage.local.remove("clickEvents");
    return { [sceneOutcome || "created"]: true, sceneId: effectiveSceneId };
  };

  const isAudioSilent = async (audioBlob, silenceThreshold = 0.01) => {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioCtx = new OfflineAudioContext(1, 44100 * 40, 44100);
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0);
    let total = 0;

    for (let i = 0; i < channelData.length; i++) {
      total += Math.abs(channelData[i]);
    }

    const avg = total / channelData.length;
    return avg < silenceThreshold;
  };

  const stopRecording = async (shouldFinalize = true, reason = "unknown") => {
    if (isFinishing.current || sentLast.current) return;
    // Lock immediately: prevents duplicate stop/finalize races under unload pressure.
    isFinishing.current = true;
    clearPendingStart();

    // Timing trace for stop → scene-create → close. T+0 stop pressed,
    // recorders drained, last TUS chunk, /scenes dispatched,
    // /scenes replied, tab close requested. Same shape as
    // startFlowTrace but for the post-stop pipeline.
    stopFlowRef.current = { startedAt: performance.now(), steps: [] };
    const stopTick = (label, extra = {}) => {
      const t = Math.round(performance.now() - stopFlowRef.current.startedAt);
      if (DEBUG_START_FLOW) {
        console.warn(`[stop-flow T+${t}ms] ${label}`, extra);
      }
      stopFlowRef.current.steps.push({ t, label, extra });
      // Mirror to BG service worker so the timeline survives this
      // tab's window.close(). BG console (chrome://extensions →
      // service worker) keeps the full sequence visible.
      try {
        chrome.runtime.sendMessage({
          type: "stop-flow-tick",
          t,
          label,
          extra,
        });
      } catch {}
    };
    stopFlowRef.current.tick = stopTick;
    stopTick("stop-pressed", { reason, shouldFinalize });
    if (!screenStream.current && !cameraStream.current) {
      void traceStep("stopRequested", {
        stopReason: String(reason).slice(0, 40),
      });
    }

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

    stopTabKeepAlive();

    const { projectId, recordingToScene, multiMode } =
      await chrome.storage.local.get([
        "projectId",
        "recordingToScene",
        "multiMode",
      ]);

    await persistSessionState({ status: "stopping" });

    if (shouldFinalize && reason !== "retry-finalize") {
      // retry-finalize: editor tab is already open from the first attempt; resending
      // would open a duplicate or reload it mid-session.
      if (recordingToScene) {
        chrome.runtime.sendMessage({
          type: "prepare-editor-existing",
          multiMode: multiMode,
        });
      } else if (!multiMode && !recordingToScene && projectId) {
        // /editor/null on cancelled-before-create yields a broken page.
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
    pausedStateRef.current = false;
    stopAllIntervals();

    // Before teardown: willUploadMic and the scene payload both run after it.
    stopAudioVerdict.current = {
      separated: separatedNow(),
      micRecorded: micRecordedThisTake.current,
      systemAudioOnScreen: Boolean(busSources.current.system),
    };
    // Drain recorders before clearing `recording` so the next start
    // gets a free tab-capture binding.
    await stopAllRecorders();
    stopFlowRef.current?.tick?.("recorders-drained");
    await setRecordingTimingState({
      recording: false,
      paused: false,
      recordingStartTime: null,
      pausedAt: null,
      totalPausedMs: 0,
    });
    // `recording` is false from here but the uploaders still hold the video.
    // Also the resume guard's clock, last stamped when recording started.
    await setPipelineState("finalizing", { details: reason });

    const { sceneId } = await chrome.storage.local.get(["sceneId"]);
    const uploadMeta = {
      screen: screenUploader.current?.getMeta() || null,
      camera: cameraUploader.current?.getMeta() || null,
      audio: audioUploader.current?.getMeta() || null,
      sceneId:
        screenUploader.current?.getMeta()?.sceneId ||
        cameraUploader.current?.getMeta()?.sceneId ||
        audioUploader.current?.getMeta()?.sceneId ||
        sceneId,
    };
    uploadMetaRef.current = uploadMeta;
    cleanupTimers();

    if (!shouldFinalize) {
      console.info(
        "[CloudRecorder] stopRecording: skipping uploader finalize",
        {
          reason,
          shouldFinalize,
          screenStatus: uploadMeta.screen?.status || "none",
          cameraStatus: uploadMeta.camera?.status || "none",
        }
      );
      void emitUploadTelemetry("upload_cancelled", {
        reason: reason || "stop-without-finalize",
        uploaderType: "cloud_recorder",
      });
      emitRecordingOutcome("abandoned", {
        reason: reason || "stop-without-finalize",
      });
      try {
        await chrome.storage.local.set({ sceneIdStatus: "cancelled" });
      } catch {}
      await finalizeRecorderSession("cancelled");
      await chunksStore
        .clear()
        .catch((e) =>
          console.warn(
            "[CloudRecorder] chunksStore.clear failed (cancelled-stop):",
            e
          )
        );
      await clearAudioChunkStore("cancelled-stop");
      await clearCameraChunkStore("cancelled-stop");
      await clearLocalScreenPlaybackOffer("cancelled-stop");
      // Releases the resume guard: nothing here is going to be finalized.
      await setPipelineState("cancelled", { details: reason });
      return;
    }

    const durations = calculateDurations();

    await flushPendingChunks();

    let finalizeError = null;
    const finalizeSkipped = [];
    if (uploadMeta.screen && !screenUploader.current) {
      finalizeSkipped.push("screen");
    }
    if (uploadMeta.camera && !cameraUploader.current) {
      finalizeSkipped.push("camera");
    }
    if (finalizeSkipped.length > 0) {
      console.error(
        "[CloudRecorder] finalize skipped: uploader went null before finalize",
        { tracks: finalizeSkipped, reason }
      );
      void emitUploadTelemetry("upload_finalize_skipped", {
        tracks: finalizeSkipped,
        reason,
        uploaderType: "cloud_recorder",
      });
    }
    // Close any server/client byte gap before declaring a length. A track whose
    // PATCHes 2xx'd without landing still has its bytes on disk.
    if (GAP_RESEND_ENABLED) {
      gapResendAbortRef.current = false;
      const budgetTimer = setTimeout(() => {
        gapResendAbortRef.current = true;
      }, GAP_RESEND_BUDGET_MS);
      await Promise.race([
        Promise.allSettled([
          resendUploadGap(
            "screen",
            screenUploader,
            chunksStore,
            "chunk_",
            screenChunkByteRangesRef
          ),
          resendUploadGap(
            "camera",
            cameraUploader,
            cameraChunksStore,
            "camera_chunk_",
            cameraChunkByteRangesRef
          ),
          resendUploadGap(
            "audio",
            audioUploader,
            audioChunksStore,
            "audio_chunk_",
            audioChunkByteRangesRef
          ),
        ]),
        new Promise((r) => setTimeout(r, GAP_RESEND_BUDGET_MS)),
      ]);
      // Stops stragglers at their next step, before finalize declares a length.
      gapResendAbortRef.current = true;
      clearTimeout(budgetTimer);
    }

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
        Promise.reject(new Error("simulated-finalize-failure"))
      );
    }

    const settledResults = await Promise.allSettled(finalizeCalls);
    stopFlowRef.current?.tick?.("video-uploaders-finalized", {
      count: finalizeCalls.length,
      rejected: settledResults.filter((r) => r.status === "rejected").length,
    });
    const rejectedResults = settledResults.filter(
      (result) => result.status === "rejected"
    );

    // Audio is supplementary; a dead mic shouldn't block scene
    // creation. Finalize separately; on failure, clear uploadMeta.audio
    // so the scene isn't wired to a half-uploaded doc.
    if (audioUploader.current) {
      let audioFinalizeOk = true;
      try {
        await audioUploader.current.finalize?.();
      } catch (audioFinalizeErr) {
        audioFinalizeOk = false;
        console.warn(
          "⚠️ Audio uploader finalize failed; scene will be created without audio:",
          audioFinalizeErr
        );
        logDebugEvent("audio-finalize-failed", {
          error: audioFinalizeErr?.message || String(audioFinalizeErr),
        });
      }
      const audioMeta = audioUploader.current?.getMeta?.() || null;
      uploadMeta.audio =
        audioFinalizeOk && audioMeta?.status === "completed" ? audioMeta : null;
    }

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
      emitRecordingOutcome("unrecoverable", {
        reason: "uploader-finalize-incomplete",
      });
      // Nothing uploaded: drop the empty project and stub media, as for any
      // other take that never uploaded.
      if ((screenMeta?.offset || 0) === 0 && (cameraMeta?.offset || 0) === 0) {
        await cleanupIfEmptyUploads("finalize-empty");
      }
      const recoverySaved = await exportLocalRecovery("finalize-error");
      await chunksStore
        .clear()
        .catch((e) =>
          console.warn(
            "[CloudRecorder] chunksStore.clear failed (finalize-error):",
            e
          )
        );
      await finalizeRecorderSession("failed");
      await clearAudioChunkStore("finalize-error");
      await clearCameraChunkStore("finalize-error");
      await clearLocalScreenPlaybackOffer("finalize-error");
      sendRecordingError(
        recoverySaved
          ? "Upload failed to finalize. A recovery copy was downloaded."
          : "Upload failed to finalize."
      );
      return;
    }

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

    const audioDuration = durations.audio || 0;
    const effectiveAudioDuration =
      audioDuration < MIN_DURATION_SECONDS && fallbackSeconds > 0
        ? fallbackSeconds
        : audioDuration;

    const usedDurations = {
      screen: effectiveScreenDuration || screenDuration,
      camera: effectiveCameraDuration || cameraDuration,
      audio: effectiveAudioDuration || audioDuration,
    };
    if (hasValidScreen && effectiveScreenDuration > 5) {
      const screenOffset = uploadMeta.screen?.offset || 0;
      const minExpectedSize = effectiveScreenDuration * 50000;
      if (screenOffset < minExpectedSize) {
        console.warn(
          `⚠️ Screen upload size (${screenOffset} bytes) seems small for ${effectiveScreenDuration}s recording. Expected at least ${minExpectedSize} bytes.`
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
      // Bytes on Bunny but not "completed" status: proceed with a warning.
      if (hasAnyScreenData || hasAnyCameraData) {
        console.warn(
          "Uploads have data but were not marked completed. Proceeding with scene creation.",
          { screenStatus, cameraStatus, screenOffset, cameraOffset }
        );
      } else {
        await cleanupIfEmptyUploads("no-upload");
        await exportLocalRecovery("no-upload");
        await chunksStore
          .clear()
          .catch((e) =>
            console.warn(
              "[CloudRecorder] chunksStore.clear failed (no-upload):",
              e
            )
          );
        // No session and no stream: capture never began (picker dismissed or
        // unanswered), so this is a cancel, not a failed upload.
        const captureNeverStarted =
          !recorderSession.current &&
          !screenStream.current &&
          !cameraStream.current;
        emitRecordingOutcome("abandoned", {
          reason: captureNeverStarted ? "no-stream" : "no-upload",
        });
        await finalizeRecorderSession("failed");
        await clearAudioChunkStore("no-upload");
        await clearCameraChunkStore("no-upload");
        await clearLocalScreenPlaybackOffer("no-upload");
        if (captureNeverStarted) {
          sendRecordingError(
            "Recording cancelled: no capture stream was acquired.",
            true
          );
          return;
        }
        sendRecordingError(
          `No media was successfully uploaded. Screen: ${screenStatus} (${screenOffset} bytes, error: ${screenError}), Camera: ${cameraStatus} (${cameraOffset} bytes, error: ${cameraError})`
        );
        return;
      }
    }

    const audioBlob = await buildAudioBlobFromDurableStore();

    // Starts ahead of the scene POST: the POST releases the editor and
    // nothing refetches the scene after, so a mic attached later only shows
    // up if the user reloads. Sending the media id in the payload avoids that.
    //
    // Not at the drain (chunks are complete by then): the no-upload check
    // above can still abandon the take, and nothing sweeps an unreferenced
    // Bunny Storage upload, so starting earlier would strand a file for a
    // recording that was never saved.
    //
    // Ahead of the silence check on purpose: isAudioSilent decodes the whole
    // track on this thread, so overlapping it with the in-flight POST is
    // free; the other order adds the decode to the wait.
    const stopAudio = stopAudioVerdict.current || {
      separated: separatedNow(),
      micRecorded: micRecordedThisTake.current,
      systemAudioOnScreen: Boolean(busSources.current.system),
    };
    const willUploadMic = Boolean(stopAudio.separated && stopAudio.micRecorded);
    let micUploadPromise = null;
    if (willUploadMic) {
      // Claimed before the scene POST: createSceneOrHandleMultiMode sends
      // editor-ready, and the BG starts discarding this document on arrival,
      // so a flag set afterwards is never seen.
      await chrome.storage.local.set({
        micUploadInFlight: { at: Date.now(), sceneId: uploadMeta.sceneId },
      });
      // Marker first, cleared on success, so a tab dying mid-upload leaves the
      // launch scan something to find. Gated on the recorder, not the store:
      // the store exists on every take, so a mic-off one overwrote real markers.
      await setPendingMicRecovery({
        projectId,
        sceneId: uploadMeta.sceneId,
        duration: usedDurations.audio || null,
        mimeType: trackContainers.audio || "audio/webm",
        // Audio goes to OPFS where supported, so the scan needs both to
        // reopen the same store rather than an empty one.
        sessionId: storageOpfsSessionId,
        backend: storageBackends.audio || "idb",
        // So a recovered mic still queues captions against the right video
        // track, which the scene POST could not name.
        targetMediaId:
          uploadMeta.screen?.mediaId || uploadMeta.camera?.mediaId || null,
      });
      micRecoveryPending.current = true;
      micUploadPromise = (async () => {
        const { screenityToken } = await chrome.storage.local.get([
          "screenityToken",
        ]);
        // The blob above already holds every chunk and uploadMicToStorage
        // re-wraps whatever it's handed, so pass it instead of reading the
        // store again. Empty means the store gave nothing back; fall back to
        // its own read for a memory-only take.
        const chunks =
          audioBlob && audioBlob.size > 0
            ? [audioBlob]
            : await collectMicChunks(audioChunksStore);
        if (!chunks.length) return { ok: false, reason: "no-chunks" };
        return uploadMicToStorage({
          chunks,
          mimeType: trackContainers.audio || "audio/webm",
          sceneId: uploadMeta.sceneId,
          projectId,
          duration: usedDurations.audio || null,
          token: screenityToken,
        });
      })().catch((err) => ({
        ok: false,
        reason: err?.message || String(err),
      }));
    }

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

    if (chunksPurgedDuringRecordingRef.current) {
      void emitUploadTelemetry("upload_local_chunks_purged", {
        screenChunksPurged: screenChunksPurgedCountRef.current,
        cameraChunksPurged: cameraChunksPurgedCountRef.current,
        bytesFreed: chunksPurgedBytesRef.current,
        safetyWindowBytes: CHUNK_PURGE_SAFETY_WINDOW_BYTES,
        reason: purgeModeRef.current,
      });
    }

    localScreenPlaybackOfferRef.current =
      await registerLocalScreenPlaybackOffer({
        projectId,
        sceneId: uploadMeta.sceneId,
        uploadMeta,
      });

    chrome.storage.local.set({ uploadMeta });

    isInit.current = false;

    if (!sentLast.current) {
      sentLast.current = true;
      try {
        diagForward("mic-upload-decision", {
          willUploadMic,
          // Both, on purpose: a take where they disagree is the 4.6.9 bug,
          // readable without the file.
          separated: separatedAudio.current,
          separatedInFact: separatedNow(),
          busHasMic: Boolean(busSources.current.mic),
          // Snapshot: the live bus is zeroed by now.
          busHasSystem: Boolean(stopAudio.systemAudioOnScreen),
          micRecordedThisTake: micRecordedThisTake.current,
          hasAudioRecorder: Boolean(audioRecorder.current),
          audioRecorderState: audioRecorder.current?.state || null,
          rawMicTracks: rawMicStream.current?.getAudioTracks?.().length || 0,
          audioStoreReady: audioChunkStoreReadyRef.current,
        });
        // Gives the upload started before the silence check a short window to
        // land, so the scene can be created holding its own voice. Short
        // because the editor waits on this POST; over budget, the scene goes
        // out without the mic and the attach below fills it in, same as
        // before this change.
        let separatedMic = null;
        if (micUploadPromise) {
          const raced = await Promise.race([
            micUploadPromise,
            new Promise((r) =>
              setTimeout(
                () => r({ ok: false, reason: "pre-scene-budget" }),
                PRE_SCENE_MIC_UPLOAD_BUDGET_MS
              )
            ),
          ]);
          if (raced?.ok && raced.mediaId) {
            separatedMic = { mediaId: raced.mediaId, url: raced.url || null };
          }
          diagForward("separated-mic-pre-scene", {
            won: Boolean(separatedMic),
            reason: raced?.reason || null,
          });
        }

        const sceneResult = await createSceneOrHandleMultiMode(
          uploadMeta,
          usedDurations,
          silent,
          separatedMic
        );
        // The mic upload and marker use the minted id; the attach must name
        // the scene the server actually filed the take under.
        const micSceneId = sceneResult?.sceneId || uploadMeta.sceneId;
        // Not awaited so it doesn't extend the post-stop tail. The fetch
        // dispatches synchronously, so it leaves the page even if window.close
        // fires shortly after. Runs after the POST to use the effective scene id.
        if (!silent && uploadMeta.audio?.mediaId) {
          handleTranscription(uploadMeta, projectId, micSceneId).catch((err) =>
            console.warn("[CloudRecorder] handleTranscription failed:", err)
          );
        }
        if (willUploadMic && micSceneId !== uploadMeta.sceneId) {
          await setPendingMicRecoveryScene(uploadMeta.sceneId, micSceneId);
          diagForward("separated-mic-scene-remapped", {
            from: String(uploadMeta.sceneId).slice(0, 40),
            to: String(micSceneId).slice(0, 40),
          });
        }

        if (!willUploadMic) {
          await chrome.storage.local
            .remove(["micUploadInFlight"])
            .catch(() => {});
        }

        chrome.runtime.sendMessage({ type: "video-ready", uploadMeta });

        // The marker and the upload were both claimed before the POST, so there
        // are only two cases left: the scene already names the mic, or it does
        // not and still needs the attach.
        if (willUploadMic && sceneResult?.micIncluded && separatedMic) {
          micRecoveryPending.current = false;
          await clearPendingMicRecovery(uploadMeta.sceneId);
          await chrome.storage.local
            .remove(["micUploadInFlight"])
            .catch(() => {});
          diagForward("separated-mic-in-scene", {
            mediaId: String(separatedMic.mediaId).slice(0, 40),
          });
          // The POST named the mic as its transcription source, but
          // uploadMeta.audio is still empty on a separated take and
          // handleTranscription reads it.
          if (!silent) {
            uploadMeta.audio = {
              ...(uploadMeta.audio || {}),
              mediaId: separatedMic.mediaId,
              separated: true,
            };
            handleTranscription(uploadMeta, projectId, micSceneId).catch((err) =>
              console.warn(
                "[CloudRecorder] separated handleTranscription failed:",
                err
              )
            );
          }
        } else if (willUploadMic) {
          try {
            const { screenityToken } = await chrome.storage.local.get([
              "screenityToken",
            ]);
            // Budgeted: this sits ahead of pipeline-completed, finalize and
            // window.close, so a stalled several-hundred-MB POST would hold the
            // tab and its capture binding open. Timing out leaves the marker.
            // Waits on the upload already in flight rather than starting a
            // second one.
            const uploaded = await Promise.race([
              micUploadPromise ||
                Promise.resolve({ ok: false, reason: "no-upload-started" }),
              new Promise((r) =>
                setTimeout(
                  () => r({ ok: false, reason: "inline-upload-timeout" }),
                  SEPARATED_MIC_UPLOAD_BUDGET_MS
                )
              ),
            ]);
            // A reused or recovered scene reaches here too, and that is the
            // point: the POST behind it carried no mic id, so this attach is
            // what gives it a voice.
            const result = !uploaded?.ok
              ? { ok: false, reason: `upload-${uploaded?.reason || "unknown"}` }
              : await (async () => {
                  const attached = await attachSceneAudio({
                    projectId,
                    sceneId: micSceneId,
                    audioMediaId: uploaded.mediaId,
                    duration: usedDurations.audio || null,
                    token: screenityToken,
                  });
                  return attached.ok
                    ? {
                        ok: true,
                        mediaId: uploaded.mediaId,
                        attached: attached.attached,
                        reason: attached.reason,
                      }
                    : {
                        ok: false,
                        reason: `attach-${attached.reason}`,
                        mediaId: uploaded.mediaId,
                      };
                })();
            if (result.ok) {
              micRecoveryPending.current = false;
              await clearPendingMicRecovery(uploadMeta.sceneId);
              diagForward("separated-mic-attached", {
                mediaId: String(result.mediaId).slice(0, 40),
                attached: result.attached,
                reason: result.reason || null,
              });
              // The scene POST had no transcription source: the mic media did
              // not exist yet, and this path builds no TUS uploader to fill
              // uploadMeta.audio.
              if (!silent && result.mediaId) {
                uploadMeta.audio = {
                  ...(uploadMeta.audio || {}),
                  mediaId: result.mediaId,
                  separated: true,
                };
                handleTranscription(uploadMeta, projectId, micSceneId).catch(
                  (err) =>
                    console.warn(
                      "[CloudRecorder] separated handleTranscription failed:",
                      err
                    )
                );
              }
            } else {
              // Left for the launch scan. The chunks stay on disk.
              console.warn(
                "[CloudRecorder] separated mic upload/attach failed; left for recovery",
                result
              );
              diagForward("separated-mic-deferred", { reason: result.reason });
              // A separated take that never attaches has no voice anywhere until
              // recovery runs, so it has to reach telemetry.
              void emitUploadTelemetry("upload_error", {
                reason: `separated-mic-${result.reason}`,
                uploaderType: "cloud_recorder",
              });
            }
          } catch (micErr) {
            console.warn("[CloudRecorder] separated mic upload threw:", micErr);
          } finally {
            await chrome.storage.local
              .remove(["micUploadInFlight"])
              .catch(() => {});
          }
        }

        if (localScreenPlaybackOfferRef.current?.offerId) {
          console.info(
            "[CloudRecorder] Retaining local screen chunks for editor local-first playback",
            {
              offerId: localScreenPlaybackOfferRef.current.offerId,
              projectId,
              sceneId: uploadMeta.sceneId,
              chunkCount: localScreenPlaybackOfferRef.current.chunkCount || 0,
            }
          );
        } else {
          await chunksStore.clear().catch(() => {});
        }
        if (micRecoveryPending.current) {
          console.info(
            "[CloudRecorder] retaining mic chunks for recovery; upload did not attach"
          );
        } else {
          await clearAudioChunkStore("success");
        }
        await clearCameraChunkStore("success");
        await setPipelineState("completed", {
          projectId,
          sceneId: uploadMeta.sceneId,
        });
        emitRecordingOutcome("completed", {
          projectId,
          sceneId: uploadMeta.sceneId,
          mediaId:
            uploadMeta.screen?.mediaId || uploadMeta.camera?.mediaId || null,
        });
        await finalizeRecorderSession("completed", {
          // destroySessionDir removes audio/ too, so a pending recovery must hold
          // the session open or its chunks are gone milliseconds later.
          keepOpfsSession:
            Boolean(localScreenPlaybackOfferRef.current?.offerId) ||
            micRecoveryPending.current,
        });
        void emitUploadTelemetry("upload_complete_client", {
          projectId,
          sceneId: uploadMeta.sceneId,
          uploaderType: "cloud_recorder",
          mediaId:
            uploadMeta.screen?.mediaId || uploadMeta.camera?.mediaId || null,
        });

        // Flush any pending telemetry IPCs to BG so events landed by
        // the previous emit calls don't get torn off by window.close()
        // below. 1.5s hard cap.
        await flushInflightTelemetry();
        stopFlowRef.current?.tick?.("tab-closing");

        if (!IS_IFRAME_CONTEXT) {
          try {
            window.close();
          } catch {}
        } else {
          window.location.reload();
        }
      } catch (err) {
        console.error("❌ Failed to create scene:", err);

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
        emitRecordingOutcome("unrecoverable", {
          reason: "scene-create-failed",
          message: err?.message || String(err),
          projectId,
          sceneId: uploadMeta.sceneId,
          mediaId:
            uploadMeta.screen?.mediaId || uploadMeta.camera?.mediaId || null,
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

        // Close anyway to prevent stuck tabs; delay so user sees the error.
        setTimeout(async () => {
          // Same flush as the success path; error telemetry is
          // exactly what we DON'T want to lose, so wait for BG writes.
          await flushInflightTelemetry();
          if (!IS_IFRAME_CONTEXT) {
            try {
              window.close();
            } catch {}
          } else {
            window.location.reload();
          }
        }, 3000);
        await exportLocalRecovery("scene-error");
        await chunksStore
          .clear()
          .catch((e) =>
            console.warn(
              "[CloudRecorder] chunksStore.clear failed (scene-error):",
              e
            )
          );
        try {
          await chrome.storage.local.set({ sceneIdStatus: "failed" });
        } catch {}
        await finalizeRecorderSession("failed");
        await clearAudioChunkStore("scene-error");
        await clearCameraChunkStore("scene-error");
        await clearLocalScreenPlaybackOffer("scene-error");
      }
    }
  };

  const startAudioStream = (id) =>
    acquireMicStream(id, {
      toastOnBlocked: true,
      logger: { warn: console.warn },
    });

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
    // AbortError is NOT a cancel: the spec uses it for "failed to start capture
    // for a reason other than denial", which we were swallowing as cancel-modal.
    return (
      name === "NotAllowedError" ||
      message.includes("cancel") ||
      message.includes("permission denied")
    );
  };

  // Camera is acquired before screen on the dual-track path, so a
  // screen failure leaves the camera LED on until GC. Call before any
  // early-return-after-screen-fail. Free acquires screen first.
  const stopCameraStreamIfAlive = () => {
    const cs = cameraStream.current;
    if (!cs) return;
    try {
      cs.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
    } catch {}
    cameraStream.current = null;
  };

  const startStream = async (
    data,
    id,
    permissions,
    permissions2,
    streamOpts = {}
  ) => {
    const canCaptureSourceAudio = streamOpts.canRequestAudioTrack !== false;
    const useDisplayMedia = !!streamOpts.useDisplayMedia;
    // "announced" means the re-pick toast already said it, so the post-start
    // toast stays quiet.
    let captureAudioDropped = false;
    const reportCaptureAudioUnavailable = (err, path) => {
      console.warn("[CloudRecorder] capture audio source failed", path, err);
      try {
        chrome.runtime.sendMessage({
          type: "diag-forward",
          event: "cloudrecorder-capture-audio-unavailable",
          data: {
            path,
            isTab: Boolean(isTab.current),
            error: String(err?.name || err).slice(0, 80),
            message: String(err?.message || "").slice(0, 120),
          },
        });
      } catch {}
    };
    // How long the picker was up before a failure. Separates an instant reject
    // from one that lands after the user picked.
    const streamStartedAt = Date.now();
    // Only the screen branch supersamples; clear it so a later take can't
    // inherit a previous recording's value.
    captureCapRef.current = null;
    // Same for the reported surface: unknown until this attempt's
    // stream is up, and a camera take never sets one.
    await setCapturedSurface(null);
    const prewarmedStream = streamOpts.prewarmedStream || null;
    const { width = 1920, height = 1080 } = getResolutionForQuality() || {};

    const fps = 30;

    const { instantMode: instant } = await chrome.storage.local.get([
      "instantMode",
    ]);
    instantMode.current = instant || false;

    recordingType.current = data.recordingType || "screen";
    // Snapshot audio intent from BG's startStreaming payload. Reading
    // micActive from storage later races with ContentState's fresh-state
    // auto-default in the content script, which can flip an explicit
    // false back to true. BG reads these before that race window.
    audioIntent.current = {
      micActive: data.micActive === true,
      systemAudio: data.systemAudio === true,
    };

    try {
      const { cameraActive } = await chrome.storage.local.get(["cameraActive"]);
      const shouldUseCamera = cameraActive === true && !instantMode.current;

      if (data.recordingType === "camera") {
        // Honor the user's selected camera (defaultVideoInput); the bare
        // constraints above have no deviceId and would silently grab the
        // system-default camera. Mirrors the region/screen+camera paths.
        const { defaultVideoInput } = await chrome.storage.local.get([
          "defaultVideoInput",
        ]);
        const cameraConstraints = {
          audio: false,
          video: {
            ...(defaultVideoInput && defaultVideoInput !== "none"
              ? { deviceId: { exact: defaultVideoInput } }
              : {}),
            width: { ideal: width },
            height: { ideal: height },
            frameRate: { ideal: fps },
          },
        };
        try {
          cameraStream.current = await getVideoStreamWithFallback(
            cameraConstraints,
            defaultVideoInput
          );
          bindCameraTrack(cameraStream.current?.getVideoTracks?.()[0]);
        } catch (err) {
          console.warn("⚠️ Failed to access camera stream:", err);
          cameraStream.current = null;
        }
      } else if (
        (data.recordingType === "region" || regionRef.current) &&
        IS_IFRAME_CONTEXT
      ) {
        // Key off regionRef.current (set on the crop-target postMessage), not
        // the raceable recordingType, so region uses preferCurrentTab + cropTo.
        try {
          const constraints = {
            preferCurrentTab: true,
            // Crop target is tied to this tab's DOM; surface switching breaks it.
            surfaceSwitching: "exclude",
            video: {
              width: { max: 2560 },
              height: { max: 1440 },
              frameRate: { ideal: fps, max: fps },
            },
            audio: data.systemAudio,
          };
          void traceStep("pickerRequested");
          const stream = await acquireDisplayMediaWithFocusRetry({
            getDisplayMedia: (c) => navigator.mediaDevices.getDisplayMedia(c),
            constraints,
            onReactivate: () =>
              chrome.runtime.sendMessage({ type: "activate-recorder-tab" }),
          });
          screenStream.current = stream;
          regionRef.current = true;
          if (!screenStream.current?.getVideoTracks?.().length) {
            sendRecordingError(
              "Failed to access region stream: no video track."
            );
            return;
          }

          if (isTab.current) {
            const ctx = new AudioContext();
            const src = ctx.createMediaStreamSource(screenStream.current);
            src.connect(ctx.destination);
          }

          // Report what was cropped, not the crop. preferCurrentTab
          // makes this browser unless the user switched panes.
          await setCapturedSurface(
            resolveCaptureSurface(
              screenStream.current.getVideoTracks()[0].getSettings()
                .displaySurface,
              { isTab: isTab.current }
            )
          );

          bindScreenTrack(screenStream.current.getVideoTracks()[0]);
        } catch (err) {
          if (isUserCaptureCancel(err)) {
            sendRecordingError(
              `User cancelled stream selection [region-iframe gDM ${
                err?.name || "?"
              }]`,
              true
            );
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
              defaultVideoInput
            );
            bindCameraTrack(cameraStream.current?.getVideoTracks?.()[0]);
          } catch (err) {
            console.warn(
              "⚠️ Camera permission denied; continuing without camera:",
              err
            );
            cameraStream.current = null;

            await chrome.storage.local.set({ cameraActive: false });

            if (data.recordingType === "camera") {
              sendRecordingError(
                "Camera permission is blocked. Please allow camera access to record."
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
              "No crop target set for region capture. Please select a region."
            );
            return;
          }
        } catch (err) {
          sendRecordingError("Failed to crop region stream: " + err.message);
          return;
        }
      } else {
        // tab capture defaults to 1920x1080 and pillarboxes narrower tabs,
        // so probe the tab's real viewport and lock min/max to its aspect
        // (offscreen host has to proxy via "get-tab-viewport" since it
        // can't call chrome.scripting directly)
        let videoMaxW = null;
        let videoMaxH = null;
        if (isTab.current && recordingTabId.current) {
          let viewport = null;
          try {
            if (IS_OFFSCREEN_HOST) {
              const response = await chrome.runtime
                .sendMessage({
                  type: "get-tab-viewport",
                  tabId: recordingTabId.current,
                })
                .catch(() => null);
              if (response?.ok && response.width > 0 && response.height > 0) {
                viewport = { width: response.width, height: response.height };
              }
            } else {
              const results = await chrome.scripting.executeScript({
                target: { tabId: recordingTabId.current },
                func: () => ({
                  w: Math.round(
                    window.innerWidth * (window.devicePixelRatio || 1)
                  ),
                  h: Math.round(
                    window.innerHeight * (window.devicePixelRatio || 1)
                  ),
                }),
              });
              const r = results?.[0]?.result;
              if (r && r.w > 0 && r.h > 0) {
                viewport = { width: r.w, height: r.h };
              }
            }
          } catch {}
          if (viewport) {
            const tabW = viewport.width;
            const tabH = viewport.height;
            // cap to the quality limit while keeping the tab's aspect ratio.
            // chrome won't upscale, so smaller tabs resolve to native size.
            const fitScale = Math.min(width / tabW, height / tabH, 1);
            videoMaxW = Math.max(2, Math.round(tabW * fitScale));
            videoMaxH = Math.max(2, Math.round(tabH * fitScale));
            if (videoMaxW % 2) videoMaxW -= 1;
            if (videoMaxH % 2) videoMaxH -= 1;
          }
        }

        const videoConstraints = {
          chromeMediaSource: isTab.current ? "tab" : "desktop",
          chromeMediaSourceId: id,
          maxFrameRate: fps,
        };
        if (videoMaxW && videoMaxH) {
          videoConstraints.maxWidth = videoMaxW;
          videoConstraints.maxHeight = videoMaxH;
          videoConstraints.minWidth = videoMaxW;
          videoConstraints.minHeight = videoMaxH;
        } else if (!isTab.current) {
          videoConstraints.maxWidth = width;
          videoConstraints.maxHeight = height;
        }

        const desktopConstraints = {
          audio: canCaptureSourceAudio
            ? {
                mandatory: {
                  chromeMediaSource: isTab.current ? "tab" : "desktop",
                  chromeMediaSourceId: id,
                },
              }
            : false,
          video: {
            mandatory: { ...videoConstraints },
          },
        };

        try {
          if (prewarmedStream) {
            console.log("[CloudRecorder] using prewarmed tab MediaStream", {
              videoTracks: prewarmedStream.getVideoTracks().length,
              audioTracks: prewarmedStream.getAudioTracks().length,
            });
            screenStream.current = prewarmedStream;
            if (typeof window !== "undefined") {
              window.__screenityPrewarmedTabStream = null;
            }
          } else if (useDisplayMedia) {
            // Alias to avoid TDZ with the later `const {width, height}` destructuring.
            const targetFps = fps;
            const targetWidth = width;
            const targetHeight = height;
            const isTabModeRequest =
              data.recordingType === "region" || isTab.current;
            const { disableSurfaceSwitching } = await chrome.storage.local.get([
              "disableSurfaceSwitching",
            ]);
            // Supersample against the fixed 1920x1080 encode size, not the tier.
            // Region is excluded because it crops instead of downscaling. The
            // kill-switch restores the tier, not the encode cap, to keep 1440p.
            const isRegionRequest = data.recordingType === "region";
            const screenCap =
              isRegionRequest || (await isOversampleDisabled())
                ? null
                : computeCaptureCap(WEBCODECS_CAP_WIDTH, WEBCODECS_CAP_HEIGHT);
            const cloudCap = screenCap || {
              width: targetWidth,
              height: targetHeight,
              oversampled: false,
            };
            captureCapRef.current = cloudCap;
            const displayConstraints = {
              audio: data.systemAudio ? true : false,
              video: {
                frameRate: { ideal: targetFps, max: targetFps },
                // Not oversampling (region, or the kill-switch): keep the tier as
                // `ideal` so those requests look exactly like they always did.
                width: cloudCap.oversampled
                  ? { max: cloudCap.width }
                  : { ideal: cloudCap.width, max: cloudCap.width },
                height: cloudCap.oversampled
                  ? { max: cloudCap.height }
                  : { ideal: cloudCap.height, max: cloudCap.height },
                // Open the picker on Entire Screen for screen, Chrome Tab for
                // tab/region. Hint only; the user can still switch panes.
                displaySurface: isTabModeRequest ? "browser" : "monitor",
              },
              // systemAudio:"include" (default may hide the toggle).
              // surfaceSwitching keeps Chrome's "Share this tab instead" button.
              // Screen-only; these throw TypeError w/ preferCurrentTab.
              ...(isTabModeRequest
                ? {}
                : {
                    systemAudio: "include",
                    surfaceSwitching: screenSurfaceSwitching({
                      disableSurfaceSwitching,
                    }),
                    selfBrowserSurface: "exclude",
                  }),
            };
            console.log(
              "[CloudRecorder] offscreen getDisplayMedia constraints",
              displayConstraints
            );
            chrome.runtime
              .sendMessage({
                type: "offscreen-diag",
                source: "getDisplayMedia-attempt",
                payload: displayConstraints,
              })
              .catch(() => {});
            const acquireDisplay = (constraints) =>
              acquireDisplayMediaWithFocusRetry({
                getDisplayMedia: (c) => navigator.mediaDevices.getDisplayMedia(c),
                constraints,
                onReactivate: () =>
                  chrome.runtime.sendMessage({ type: "activate-recorder-tab" }),
              });
            void traceStep("pickerRequested");
            try {
              screenStream.current = await acquireDisplay(displayConstraints);
            } catch (err) {
              // System audio that won't open rejects the video request with it.
              // Retrying without audio costs a second pick but saves the take.
              if (!displayConstraints.audio || !isCaptureAudioSourceError(err)) {
                throw err;
              }
              reportCaptureAudioUnavailable(err, "getDisplayMedia");
              // Warn before the picker reopens, so a second prompt isn't a mystery.
              chrome.runtime
                .sendMessage({
                  type: "show-toast",
                  message: chrome.i18n.getMessage("captureAudioRepickToast"),
                  timeout: 10000,
                })
                .catch(() => {});
              captureAudioDropped = "announced";
              screenStream.current = await acquireDisplay({
                ...displayConstraints,
                audio: false,
              });
            }
            console.log("[CloudRecorder] offscreen getDisplayMedia OK");
          } else {
            if (!id) {
              console.error(
                "[CloudRecorder] gUM path reached with no streamId; dispatch bug",
                {
                  isTab: isTab.current,
                  tabID: tabID.current,
                  IS_OFFSCREEN_HOST,
                  IS_IFRAME_CONTEXT,
                  recordingType: recordingType.current,
                  useDisplayMedia,
                  prewarmedStream: !!prewarmedStream,
                }
              );
              chrome.runtime
                .sendMessage({
                  type: "offscreen-diag",
                  source: "gUM-no-streamId",
                  payload: {
                    isTab: !!isTab.current,
                    tabIDpresent: !!tabID.current,
                    IS_OFFSCREEN_HOST,
                    IS_IFRAME_CONTEXT,
                    recordingType: recordingType.current,
                  },
                })
                .catch(() => {});
              chrome.storage.local
                .set({
                  lastStreamAcquireError: {
                    ts: Date.now(),
                    name: "no-stream-id",
                    message: "gUM path reached with no streamId",
                    api: "getUserMedia",
                    isTab: !!isTab.current,
                    offscreen: IS_OFFSCREEN_HOST,
                    recordingType: recordingType.current || null,
                  },
                })
                .catch(() => {});
              sendRecordingError(
                chrome.i18n.getMessage("screenStreamUnavailableError")
              );
              return;
            }
            console.log("[CloudRecorder] desktop getUserMedia constraints", {
              audioEnabled: !!desktopConstraints.audio,
              videoMandatory: desktopConstraints.video?.mandatory,
              streamIdPrefix: String(id || "").slice(0, 16),
            });
            chrome.runtime
              .sendMessage({
                type: "offscreen-diag",
                source: "desktop-gUM-attempt",
                payload: {
                  audioEnabled: !!desktopConstraints.audio,
                  streamIdPrefix: String(id || "").slice(0, 16),
                  isTab: !!isTab.current,
                },
              })
              .catch(() => {});
            try {
              screenStream.current = await navigator.mediaDevices.getUserMedia(
                desktopConstraints
              );
            } catch (err) {
              // A dead loopback endpoint fails the video too. Video with no
              // audio beats no recording, so drop it and try once more.
              if (
                !desktopConstraints.audio ||
                !isCaptureAudioSourceError(err, { bareNameCounts: true })
              ) {
                throw err;
              }
              reportCaptureAudioUnavailable(err, "desktopCapture");
              captureAudioDropped = true;
              screenStream.current = await navigator.mediaDevices.getUserMedia({
                ...desktopConstraints,
                audio: false,
              });
            }
            console.log("[CloudRecorder] desktop getUserMedia OK");
            diagForward("capture-tracks-acquired", {
              path: "desktopCapture",
              isTab: Boolean(isTab.current),
              audioRequested: Boolean(desktopConstraints.audio),
              videoTracks: screenStream.current?.getVideoTracks?.().length || 0,
              audioTracks: screenStream.current?.getAudioTracks?.().length || 0,
            });
          }
          if (!screenStream.current?.getVideoTracks?.().length) {
            sendRecordingError(
              "Failed to access screen stream: no video track."
            );
            return;
          }
          const track = screenStream.current.getVideoTracks()[0];
          const {
            width: _actualStreamWidth,
            height: _actualStreamHeight,
            displaySurface: surface,
          } = track.getSettings();

          const settings = screenStream.current
            .getVideoTracks()[0]
            .getSettings();

          // warm the OS encoder so the real one hits 30fps from frame 1
          // instead of crawling for the first ~30 frames. mirrors Recorder.jsx.
          try {
            const rawW = Number(settings.width) || 0;
            const rawH = Number(settings.height) || 0;
            // The screen encoder is hard-capped at 1080p (WEBCODECS_CAP) and
            // WCR downscales onto its resize canvas, so warm at the encode
            // size rather than the capture size.
            const hasSize = rawW > 0 && rawH > 0;
            const capFit = hasSize ? Math.min(1920 / rawW, 1080 / rawH, 1) : 1;
            const w = hasSize
              ? Math.max(2, Math.round((rawW * capFit) / 2) * 2)
              : 0;
            const h = hasSize
              ? Math.max(2, Math.round((rawH * capFit) / 2) * 2)
              : 0;
            if (w > 0 && h > 0) {
              const { fastRecorderProbe } = await chrome.storage.local.get([
                "fastRecorderProbe",
              ]);
              const probeConfig =
                fastRecorderProbe?.details?.selectedVideoConfig || null;
              perfMark("CloudRecorder.encoderPrewarm.fired", {
                w,
                h,
                codec: probeConfig?.codec || "avc1.64002A",
                framerate:
                  Number(settings.frameRate) ||
                  Number(probeConfig?.framerate) ||
                  30,
              });
              void startEncoderPrewarm({
                width: w,
                height: h,
                codec: probeConfig?.codec || "avc1.64002A",
                bitrate: Number(probeConfig?.bitrate) || 4_000_000,
                framerate:
                  Number(settings.frameRate) ||
                  Number(probeConfig?.framerate) ||
                  30,
              });
            } else {
              perfMark("CloudRecorder.encoderPrewarm.skipped", {
                reason: "no-size",
              });
            }
          } catch (err) {
            perfMark("CloudRecorder.encoderPrewarm.failed", {
              err: String(err?.message || err).slice(0, 120),
            });
          }

          // tabCapture streams carry no displaySurface, so fall back to
          // isTab. Unknown stays unset and the scene payload omits it.
          const capturedSurface = resolveCaptureSurface(surface, {
            isTab: isTab.current,
          });
          await setCapturedSurface(capturedSurface);

          traceStep("streamAcquired", {
            surface: surface || null,
            capturedSurface,
          });

          setTimeout(() => {
            traceStep("preparingSent");
            chrome.runtime.sendMessage({ type: "preparing-recording" });
          }, 200);

          chrome.runtime.sendMessage(
            { type: "get-monitor-for-window" },
            (response) => {
              if (!response || chrome.runtime.lastError || response.error) {
                console.error(
                  "Failed to get monitor info:",
                  response?.error || chrome.runtime.lastError || "No response"
                );
                return;
              }

              const { monitorId, monitorBounds, displays } = response;

              chrome.storage.local.set({
                surface,
                displays,
                recordedMonitorId: monitorId,
                monitorBounds,
                recordedStreamDimensions: {
                  width: _actualStreamWidth,
                  height: _actualStreamHeight,
                },
              });
            }
          );

          chrome.runtime.sendMessage({
            type: "set-surface",
            surface: surface,
            subscribed: true,
            instantMode: instantMode.current || false,
          });

          // A surface switch swaps the source in place: the track stays live, so
          // nothing above re-runs and anything read from getSettings() goes
          // stale. The cursor overlay maps click coords against `surface`, so a
          // stale one misplaces click effects for the rest of the recording.
          let boundSurface = surface;
          track.addEventListener("configurationchange", () => {
            const next = track.getSettings();
            void setCapturedSurface(
              resolveCaptureSurface(next.displaySurface, {
                isTab: isTab.current,
              })
            );
            chrome.storage.local.set({
              surface: next.displaySurface,
              recordedStreamDimensions: {
                width: next.width,
                height: next.height,
              },
            });
            if (next.displaySurface === boundSurface) return;
            traceStep("surfaceSwitched", {
              from: boundSurface || null,
              to: next.displaySurface || null,
            });
            boundSurface = next.displaySurface;
            chrome.runtime.sendMessage({
              type: "set-surface",
              surface: next.displaySurface,
              subscribed: true,
              instantMode: instantMode.current || false,
            });
          });

          if (isTab.current) {
            const ctx = new AudioContext();
            const src = ctx.createMediaStreamSource(screenStream.current);
            src.connect(ctx.destination);
          }

          bindScreenTrack(screenStream.current.getVideoTracks()[0]);
        } catch (err) {
          console.error("[CloudRecorder] desktop getUserMedia threw", {
            name: err?.name,
            message: err?.message,
            stack: err?.stack,
          });
          chrome.runtime
            .sendMessage({
              type: "offscreen-diag",
              source: "desktop-gUM-error",
              payload: {
                name: err?.name || null,
                message: err?.message || null,
                stack: err?.stack || null,
              },
            })
            .catch(() => {});
          // offscreen-diag is DEBUG_FLOW-gated and console-only, so the reason a
          // start died was unrecoverable from a user's zip.
          chrome.storage.local
            .set({
              lastStreamAcquireError: {
                ts: Date.now(),
                name: err?.name || null,
                message: String(err?.message || "").slice(0, 200),
                api: useDisplayMedia ? "getDisplayMedia" : "getUserMedia",
                isTab: !!isTab.current,
                offscreen: IS_OFFSCREEN_HOST,
                recordingType: recordingType.current || null,
                pickerOpenMs: Date.now() - streamStartedAt,
              },
            })
            .catch(() => {});
          // Offscreen tab-mode: pre-acquired streamId failed; retry with getDisplayMedia.
          // NotReadableError ("device busy", e.g. Zoom/OBS or HW slot
          // contention) is worth a retry, same as Abort/NotAllowed.
          if (
            IS_OFFSCREEN_HOST &&
            isTab.current &&
            id &&
            !useDisplayMedia &&
            (err?.name === "AbortError" ||
              err?.name === "NotAllowedError" ||
              err?.name === "NotReadableError")
          ) {
            console.warn(
              "[CloudRecorder] tab streamId consumption failed - falling back to getDisplayMedia"
            );
            try {
              const displayConstraints = {
                audio: data.systemAudio ? true : false,
                video: {
                  frameRate: { ideal: fps, max: fps },
                  width: { ideal: width, max: width },
                  height: { ideal: height, max: height },
                  displaySurface: "browser",
                },
              };
              screenStream.current =
                await navigator.mediaDevices.getDisplayMedia(
                  displayConstraints
                );
              console.log(
                "[CloudRecorder] getDisplayMedia fallback OK after streamId rejection"
              );
              await setCapturedSurface(
                resolveCaptureSurface(
                  screenStream.current.getVideoTracks()[0].getSettings()
                    .displaySurface,
                  { isTab: isTab.current }
                )
              );
              bindScreenTrack(screenStream.current.getVideoTracks()[0]);
            } catch (fallbackErr) {
              // Stop the pre-acquired camera so the LED doesn't stay on.
              stopCameraStreamIfAlive();
              if (isUserCaptureCancel(fallbackErr)) {
                sendRecordingError(
                  `User cancelled stream selection [offscreen-tab gDM fallback ${
                    fallbackErr?.name || "?"
                  }]`,
                  true
                );
                return;
              }
              sendRecordingError(
                chrome.i18n.getMessage("screenStreamUnavailableError")
              );
              return;
            }
          } else if (isUserCaptureCancel(err)) {
            stopCameraStreamIfAlive();
            sendRecordingError(
              `User cancelled stream selection [${
                useDisplayMedia ? "gDM" : "tab-streamId-consume"
              } ${err?.name || "?"}]`,
              true
            );
            return;
          } else {
            stopCameraStreamIfAlive();
            sendRecordingError(
              chrome.i18n.getMessage("screenStreamUnavailableError")
            );
            return;
          }
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
              defaultVideoInput
            );
            bindCameraTrack(cameraStream.current?.getVideoTracks?.()[0]);
          } catch (err) {
            console.warn(
              "⚠️ Camera permission denied; continuing without camera:",
              err
            );
            cameraStream.current = null;

            await chrome.storage.local.set({ cameraActive: false });

            if (data.recordingType === "camera") {
              sendRecordingError(
                "Camera permission is blocked. Please allow camera access to record."
              );
              return;
            }
          }
        }
      }

      setInitProject(true);

      // Kicked off here so the POST overlaps mic acquisition instead of sitting
      // in front of the countdown. Deliberately after the stream resolves, so a
      // cancelled picker can't mint a project for a recording that never runs.
      let projectCreateMs = null;
      const projectPrefetch = (async () => {
        const { projectId, multiProjectId } = await chrome.storage.local.get([
          "projectId",
          "multiProjectId",
        ]);
        if (projectId || multiProjectId) return null;
        const now = new Date();
        const options = { day: "2-digit", month: "short", year: "numeric" };
        const endCreate = perfSpan("CloudRecorder createVideoProject");
        const startedAt = Date.now();
        try {
          return await createVideoProject({
            title: `Untitled video - ${now.toLocaleString("en-GB", options)}`,
            instantMode: instantMode.current,
          });
        } finally {
          projectCreateMs = Date.now() - startedAt;
          endCreate();
        }
      })();
      // Mark handled; the rejection is re-thrown at the await site below.
      projectPrefetch.catch(() => {});

      // Camera-only and instant both stay muxed; shouldSeparateAudio.js
      // carries why. Only fixable here, before the encoder runs.
      separatedAudio.current = shouldSeparateAudio({
        recordingType: recordingType.current,
        instantMode: instantMode.current,
      });
      diagForward("separated-decision", {
        separated: separatedAudio.current,
        recordingType: recordingType.current || null,
        instantMode: Boolean(instantMode.current),
        micActive: Boolean(data?.micActive),
      });

      // If the user disabled the mic, skip getUserMedia: gain-muting still
      // wakes iPhone Continuity etc. Toggle-on mid-recording goes via setMic().
      if (shouldAcquireMicAtStart(data)) {
        // startAudioStream swallows errors and returns null, so a failed mic
        // looked like no mic requested. offscreen-diag is the only channel that
        // prints into the BG console from here.
        micStream.current = await startAudioStream(data.defaultAudioInput, {
          bluetoothDiag: true,
          logger: {
            debug: () => {},
            warn: (msg, err) =>
              chrome.runtime
                .sendMessage({
                  type: "offscreen-diag",
                  source: "mic-acquire",
                  payload: {
                    msg: String(msg).slice(0, 80),
                    err: String(err?.name || err?.message || err).slice(0, 80),
                  },
                })
                .catch(() => {}),
          },
        });
        rawMicStream.current = micStream.current;
        const micTrack = rawMicStream.current?.getAudioTracks?.()[0] || null;
        chrome.runtime
          .sendMessage({
            type: "offscreen-diag",
            source: "mic-acquire-result",
            payload: {
              acquired: Boolean(rawMicStream.current),
              tracks: rawMicStream.current?.getAudioTracks?.().length || 0,
              label: String(micTrack?.label || "").slice(0, 60) || null,
              readyState: micTrack?.readyState || null,
              muted: micTrack?.muted ?? null,
              requestedId: String(data.defaultAudioInput || "").slice(0, 12),
            },
          })
          .catch(() => {});
      } else {
        micStream.current = null;
        rawMicStream.current = null;
      }

      // Mic track death mid-recording (unplug, OS revoke, BT disconnect): toast only,
      // since Pro recordings often have system audio worth keeping.
      try {
        const rawTrack = rawMicStream.current?.getAudioTracks?.()[0];
        if (rawTrack) {
          rawTrack.addEventListener("ended", () => {
            // The take carries on for system audio, but the mic file stops
            // here, so freeze its clock or it claims the session's length.
            if (!audioTimer.current.paused && audioTimer.current.start) {
              audioTimer.current.total +=
                Date.now() - audioTimer.current.start;
              audioTimer.current.paused = true;
            }
            const startMs = screenTimer.current?.start || null;
            const dur = startMs ? Date.now() - startMs : null;
            const SALVAGE_THRESHOLD_MS = 30000;
            const isShort = !dur || dur < SALVAGE_THRESHOLD_MS;
            const trackLabel = String(rawTrack?.label || "");
            const isLikelyContinuityMic = /\biphone\b/i.test(trackLabel);
            try {
              chrome.runtime.sendMessage({
                type: "diag-forward",
                event: "cloudrecorder-mic-track-ended",
                data: {
                  trackLabel: trackLabel.slice(0, 80),
                  readyState: rawTrack?.readyState || null,
                  recordingDuration: dur,
                  isLikelyContinuityMic,
                  salvageOffered: !isShort,
                  audioContextState: aCtx.current?.state ?? null,
                  docVisibility:
                    typeof document !== "undefined"
                      ? document.visibilityState
                      : null,
                },
              });
            } catch {}
            try {
              chrome.runtime.sendMessage({
                type: "recording-error",
                error: "stream-ended",
                why: chrome.i18n.getMessage(
                  isShort
                    ? "streamErrorModalDescription"
                    : "audioTrackEndedToast"
                ),
              });
            } catch {}
          });
        }
      } catch {}

      // Force 48 kHz: Opus is fixed at 48k, AAC accepts it natively.
      // System default (often 44.1k) makes the encoder mismatch the
      // AudioData stream and throw on first encode.
      try {
        aCtx.current = new AudioContext({ sampleRate: 48000 });
      } catch {
        // Some platforms reject hint sampleRates; fall back to default.
        aCtx.current = new AudioContext();
      }
      aCtxCreatedAtRef.current = Date.now();
      audioHealthRef.current = attachAudioContextWatchdog(
        aCtx.current,
        "CloudRecorder"
      );
      destination.current = aCtx.current.createMediaStreamDestination();
      // Parallel tap so the warm-up check can read the mixed bus. A
      // MediaStreamDestination is a sink and cannot be analysed directly.
      busSources.current = { mic: false, system: false };
      recordersBuilt.current = false;
      micRecordedThisTake.current = false;
      try {
        busTap.current = aCtx.current.createAnalyser();
        busTap.current.fftSize = 2048;
      } catch {
        busTap.current = null;
      }
      // A stereo destination duplicates a mono mic, wasting half the AAC bitrate.
      // System audio only joins at start, so the lazy setMic path stays stereo.
      audioBusChannels.current = null;
      try {
        const micTrack = micStream.current?.getAudioTracks?.()[0] || null;
        const hasSystemAudio = Boolean(
          screenStream.current?.getAudioTracks?.().length
        );
        const micChannels = micTrack?.getSettings?.()?.channelCount || null;
        if (micTrack && !hasSystemAudio && micChannels === 1) {
          destination.current.channelCount = 1;
          audioBusChannels.current = 1;
        }
      } catch {}

      if (micStream.current?.getAudioTracks().length) {
        if (separatedAudio.current) {
          // The mic must not reach the bus, but micStream still points at the
          // destination: five later consumers read it as the (system-only) bus.
          micStream.current = destination.current.stream;
          // No gain node to mute through here. A mic toggled off mid-acquire took
          // setMic's cold-start path and did nothing, so the file recorded a
          // voice the UI showed as muted.
          const { micActive } = await chrome.storage.local.get(["micActive"]);
          if (micActive === false) {
            rawMicStream.current?.getAudioTracks?.().forEach((track) => {
              track.enabled = false;
            });
          }
        } else {
          audioInputGain.current = aCtx.current.createGain();
          const micSource = aCtx.current.createMediaStreamSource(
            micStream.current
          );
          micSource
            .connect(audioInputGain.current)
            .connect(destination.current);
          if (busTap.current) audioInputGain.current.connect(busTap.current);
          busSources.current.mic = true;
          micStream.current = destination.current.stream;

          const { micActive } = await chrome.storage.local.get(["micActive"]);
          if (micActive === false) {
            audioInputGain.current.gain.value = 0;
          }
        }
      }

      if (screenStream.current?.getAudioTracks().length) {
        audioOutputGain.current = aCtx.current.createGain();
        const screenSource = aCtx.current.createMediaStreamSource(
          screenStream.current
        );
        screenSource
          .connect(audioOutputGain.current)
          .connect(destination.current);
        if (busTap.current) audioOutputGain.current.connect(busTap.current);
        busSources.current.system = true;

        // Diagnostic only: system/tab audio can die mid-recording (tab closed,
        // OS mute, BT disconnect). Log it, don't stop; video/mic continue.
        const screenAudioTrack = screenStream.current.getAudioTracks()[0];
        if (screenAudioTrack) {
          screenAudioTrack.addEventListener("ended", () => {
            if (isFinishing.current) return;
            // No track label / identifiers: diagnostics stay free of titles,
            // names, and anything beyond the account ID.
            const info = { reason: "system-audio-track-ended" };
            console.warn("[CloudRecorder] system audio track ended");
            try {
              chrome.runtime.sendMessage({
                type: "diag-forward",
                event: "cloudrecorder-system-audio-track-ended",
                data: info,
              });
            } catch {}
            chrome.storage.local.set({ lastTrackEndEvent: info });
          });
        }

        const { systemAudioVolume } = await chrome.storage.local.get([
          "systemAudioVolume",
        ]);
        if (systemAudioVolume !== undefined) {
          audioOutputGain.current.gain.value = systemAudioVolume;
        }
      }

      // Say it, or they find out in the editor.
      if (captureAudioDropped === true && data.systemAudio) {
        chrome.runtime
          .sendMessage({
            type: "show-toast",
            message: chrome.i18n.getMessage("captureAudioUnavailableToast"),
            timeout: 8000,
          })
          .catch(() => {});
      }

      try {
        const { projectId, multiMode, multiProjectId, multiSceneCount } =
          await chrome.storage.local.get([
            "projectId",
            "multiMode",
            "multiProjectId",
            "multiSceneCount",
          ]);

        let videoId = projectId || multiProjectId;
        const reusedProject = Boolean(videoId);

        if (videoId) {
          // A write landing between the prefetch's read and this one (restart
          // restoring a multi snapshot, back-to-back reuse) routes us here, so
          // settle the prefetch rather than leaving whatever it created adrift.
          const orphan = await projectPrefetch.catch(() => null);
          if (orphan && orphan !== videoId) {
            void emitUploadTelemetry("project_state_change", {
              source: "cloudrecorder-prefetch-orphaned",
              from: orphan,
              to: videoId,
              multiMode: Boolean(multiMode),
            });
          }
          if (multiMode) {
            await chrome.storage.local.set({
              multiSceneCount: multiSceneCount || 0,
            });
          }
        } else {
          // Usually already resolved by the prefetch kicked off before mic
          // acquisition; falls back to a fresh create if the prefetch saw a
          // project in storage that has since been cleared.
          videoId = await projectPrefetch;
          if (!videoId) {
            const now = new Date();
            const options = { day: "2-digit", month: "short", year: "numeric" };
            const startedAt = Date.now();
            videoId = await createVideoProject({
              title: `Untitled video - ${now.toLocaleString("en-GB", options)}`,
              instantMode: instantMode.current,
            });
            projectCreateMs = Date.now() - startedAt;
          }
          if (!videoId) throw new Error("Failed to create video project");

          if (multiMode) {
            await chrome.storage.local.set({
              multiProjectId: videoId,
              multiSceneCount: 0,
            });
          }
        }

        await chrome.storage.local.set({ projectId: videoId });
        // Fresh projects already carry hasRecordingSession, so only
        // reused ones need the hint.
        if (reusedProject) notifyRecordingStarted(videoId);
        traceStep("apiProjectCreated", {
          projectCreateMs,
          projectReused: reusedProject,
        });
        void emitUploadTelemetry("project_state_change", {
          source: reusedProject
            ? "cloudrecorder-reused"
            : "cloudrecorder-created",
          from: projectId || null,
          to: videoId,
          multiMode: Boolean(multiMode),
        });
        await setPipelineState("project-ready", {
          projectId: videoId,
          status: multiMode ? "multi" : "single",
        });
        logDebugEvent("project-ready", {
          projectId: videoId,
          multiMode: Boolean(multiMode),
        });

        // Run countdown + uploader-init in parallel. maybeStartRecording
        // polls uploadersInitialized.current at countdown-end (200ms ×
        // 75). Saves ~2-3s vs awaiting init before the countdown.
        traceStep("resetActiveTabSent");
        chrome.runtime.sendMessage({ type: "reset-active-tab" });

        // Races the countdown; if it loses, capture is delayed in 200ms polls
        // (canBeginRecording).
        const endUploaderInit = perfSpan("CloudRecorder initializeUploaders");
        const uploaderInitStartedAt = Date.now();
        // A take that died before a session registered leaves this set, and the
        // next take on this instance would reuse its id.
        if (!recorderSession.current) recordingSessionId.current = null;
        uploadersInitialized.current = await initializeUploaders({
          forceNewSceneId: true,
        });
        const uploaderInitMs = Date.now() - uploaderInitStartedAt;
        endUploaderInit({ ok: Boolean(uploadersInitialized.current) });
        if (!uploadersInitialized.current) {
          throw new Error("Failed to initialize uploaders");
        }
        traceStep("apiUploadersReady", {
          uploaderInitMs,
          uploaderCreateMs: {
            screen: screenUploader.current?.createPostMs ?? null,
            camera: cameraUploader.current?.createPostMs ?? null,
            audio: audioUploader.current?.createPostMs ?? null,
          },
        });

        setStarted(true);
        setInitProject(false);
        if (screenStream.current) {
          await stopPrewarm(prewarmRef.current);
          prewarmRef.current = startPrewarm(screenStream.current);
          preloadWebCodecsModules();
        }
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
    if (startStreamingInFlight.current) {
      console.warn(
        "[CloudRecorder] startStreaming already in flight, ignoring duplicate"
      );
      return;
    }
    startStreamingInFlight.current = true;
    startTabKeepAlive();

    // Offscreen docs are always visibilityState "hidden" and have no
    // sender.tab, so the handler's tabs.update can't do anything. It only
    // cost a SW round-trip on every cloud start. Tab hosts still need it.
    if (!IS_OFFSCREEN_HOST && document.visibilityState === "hidden") {
      if (globalThis.SCREENITY_VERBOSE_LOGS) {
        console.warn(
          "[CloudRecorder] Tab is hidden at recording start, requesting activation"
        );
      }
      try {
        await chrome.runtime.sendMessage({ type: "activate-recorder-tab" });
      } catch {}
    }

    try {
      // Parallel; they're independent queries against different
      // PermissionDescriptors and each typically takes ~50-100ms.
      const [permissions, permissions2] = await Promise.all([
        navigator.permissions.query({ name: "camera" }),
        navigator.permissions.query({ name: "microphone" }),
      ]);

      // macOS + Chrome 141+ routes screen capture through getDisplayMedia for
      // system audio. See screenCaptureMode.js.
      const { forceDisplayMediaScreen, macSystemAudioCapture } =
        await chrome.storage.local.get([
          "forceDisplayMediaScreen",
          "macSystemAudioCapture",
        ]);
      const screenDisplayMediaMode = shouldUseDisplayMediaForScreen({
        forceDisplayMediaScreen,
        macSystemAudioCapture,
      });

      if (isTab.current) {
        // Wait for getStreamID across all recordingTypes: an earlier guard skipped
        // region tab-captures and started with tabID.current = null.
        let attempts = 0;
        while (!tabID.current && attempts < 20) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, 50));
          attempts += 1;
        }
        if (!tabID.current) {
          sendRecordingError("Failed to prepare tab capture.");
          return;
        }
      }

      const _dispatchPayload = {
        recordingType: data.recordingType,
        isTab: !!isTab.current,
        tabIDpresent: !!tabID.current,
        tabIDprefix: String(tabID.current || "").slice(0, 16),
        IS_OFFSCREEN_HOST,
        IS_IFRAME_CONTEXT,
        tabPreferred: !!tabPreferred.current,
        recordingTabId: recordingTabId.current || null,
      };
      if (DEBUG_START_FLOW) {
        console.warn("[CloudRecorder][start-dispatch]", _dispatchPayload);
        chrome.runtime
          .sendMessage({
            type: "offscreen-diag",
            source: "start-dispatch",
            payload: _dispatchPayload,
          })
          .catch(() => {});
      }
      const _diagBranch = (branch) => {
        chrome.runtime
          .sendMessage({
            type: "offscreen-diag",
            source: "start-dispatch-branch",
            payload: { branch },
          })
          .catch(() => {});
        // offscreen-diag is console-only, so which branch a failed start took
        // was unrecoverable from a zip.
        chrome.storage.local
          .set({
            lastStartDispatchBranch: {
              branch,
              ts: Date.now(),
              recordingType: data?.recordingType || null,
              isTab: !!isTab.current,
              offscreen: IS_OFFSCREEN_HOST,
            },
          })
          .catch(() => {});
      };
      if (data.recordingType === "camera") {
        _diagBranch("camera");
        startStream(data, null, permissions, permissions2);
      } else if (IS_OFFSCREEN_HOST && isTab.current && tabID.current) {
        // Pre-acquired tab streamId from action-icon click; picker fallback in catch.
        _diagBranch("offscreen-pre-acquired-tab");
        console.log(
          "[CloudRecorder][offscreen] using pre-acquired tab streamId"
        );
        startStream(data, tabID.current, permissions, permissions2);
      } else if (IS_OFFSCREEN_HOST) {
        _diagBranch("offscreen-useDisplayMedia");
        startStream(data, null, permissions, permissions2, {
          useDisplayMedia: true,
        });
      } else if (
        !isTab.current &&
        !(IS_IFRAME_CONTEXT && regionRef.current) &&
        (data.recordingType != "region" || tabPreferred.current)
      ) {
        if (screenDisplayMediaMode) {
          // getDisplayMedia path; startStream's useDisplayMedia branch handles it.
          _diagBranch("screen-getDisplayMedia");
          chrome.storage.local.set({ lastScreenCaptureApi: "getDisplayMedia" });
          startStream(data, null, permissions, permissions2, {
            useDisplayMedia: true,
          });
        } else {
          _diagBranch("desktop-picker");
          chrome.storage.local.set({ lastScreenCaptureApi: "desktopCapture" });
          // Desktop picker path: non-tab mode without region, or tabPreferred forced
          // isTab=false (playground) so there's no pre-obtained streamId.
          void traceStep("pickerRequested");
          chrome.desktopCapture.chooseDesktopMedia(
            ["screen", "window", "tab", "audio"],
            null,
            (streamId) => {
              chrome.runtime
                .sendMessage({
                  type: "offscreen-diag",
                  source: "desktop-picker-callback",
                  payload: {
                    streamIdPresent: !!streamId,
                    streamIdPrefix: String(streamId || "").slice(0, 16),
                    lastError: chrome.runtime.lastError?.message || null,
                  },
                })
                .catch(() => {});
              if (!streamId) {
                sendRecordingError(
                  "User cancelled stream selection [desktop-picker null streamId]",
                  true
                );
              } else {
                startStream(data, streamId, permissions, permissions2);
              }
            }
          );
        }
      } else {
        _diagBranch("final-else-tabID");
        startStream(data, tabID.current, permissions, permissions2);
      }
    } catch (err) {
      sendRecordingError("Failed to setup streaming: " + err.message);
    }
  };

  const getStreamID = async (id) => {
    try {
      let streamId;
      if (IS_OFFSCREEN_HOST) {
        // chrome.tabCapture is not callable from offscreen; delegate to SW.
        const response = await chrome.runtime
          .sendMessage({
            type: "offscreen-request-stream",
            mode: "tab",
            targetTabId: id,
          })
          .catch((err) => ({ ok: false, error: String(err) }));
        if (!response?.ok || !response.streamId) {
          throw new Error(response?.error || "offscreen tab stream failed");
        }
        streamId = response.streamId;
      } else {
        streamId = await chrome.tabCapture.getMediaStreamId({
          targetTabId: id,
        });
      }
      tabID.current = streamId;
    } catch (err) {
      sendRecordingError("Failed to get stream ID: " + err.message);
    }
  };

  useEffect(() => {
    if (!IS_IFRAME_CONTEXT) return;

    const sendReady = () => {
      window.parent.postMessage(
        { type: "screenity-region-capture-loaded" },
        "*"
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
        // Legacy: restart is now orchestrated via runtime message.
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

  // Idempotent: the pull response and the push race each other by design.
  const consumeStreamingData = (dataStr) => {
    if (!dataStr) return;
    if (streamingDataReceivedAt.current != null) return;
    streamingDataReceivedAt.current = Date.now();
    startStreaming(JSON.parse(dataStr));
  };

  // Mirrors Recorder.jsx's requestStreamingDataWithRetry, which the cloud path
  // never got. BG answers the pull directly, so no push has to land in time.
  const pullStreamingData = (attempt = 0) => {
    if (streamingDataReceivedAt.current != null) return;
    const backoffMs = [0, 250, 500, 1000, 2000, 3000];
    const delay = backoffMs[Math.min(attempt, backoffMs.length - 1)];
    if (streamingDataRetryTimer.current) {
      clearTimeout(streamingDataRetryTimer.current);
    }
    streamingDataRetryTimer.current = setTimeout(() => {
      streamingDataRetryTimer.current = null;
      if (streamingDataReceivedAt.current != null) return;
      const retryIfNeeded = () => {
        if (
          streamingDataReceivedAt.current == null &&
          attempt + 1 < backoffMs.length
        ) {
          pullStreamingData(attempt + 1);
        }
      };
      try {
        chrome.runtime.sendMessage(
          { type: "get-streaming-data" },
          (response) => {
            if (chrome.runtime.lastError) return retryIfNeeded();
            if (response?.data) return consumeStreamingData(response.data);
            retryIfNeeded();
          }
        );
      } catch {
        retryIfNeeded();
      }
    }, delay);
  };

  const onMessage = useCallback((request, sender, sendResponse) => {
    if (request.type === "loaded") {
      // BG redelivers `loaded` after an SW restart. Skip re-init if it
      // already ran: re-calling getStreamID would invalidate the active
      // tabCapture token (single-use). Just re-pull streaming-data.
      if (isInit.current) {
        pullStreamingData();
        // BG retries `loaded` until something confirms. Without this it can
        // only see the port close, which any extension context produces.
        sendResponse?.({ ok: true, alreadyInit: true });
        return;
      }
      sendResponse?.({ ok: true });
      setInitProject(false);
      // offscreen has no visible Warning; surface system-audio guidance as a toast
      if (IS_OFFSCREEN_HOST && !request.isTab) {
        sendSystemAudioGuidanceToast();
      }
      if (IS_IFRAME_CONTEXT) {
        // Skip payloads targeted at offscreen; otherwise both contexts race for the stream.
        if (request.region && request._targetHost !== "offscreen") {
          isInit.current = true;
          pullStreamingData();
        }
      } else if (!request.region || (IS_OFFSCREEN_HOST && request.isTab)) {
        // Apply tabPreferred synchronously: chrome.storage.local.get races against
        // "loaded" and would set isTab.current incorrectly on the first playground attempt.
        if (typeof request.tabPreferred === "boolean") {
          tabPreferred.current = request.tabPreferred;
          console.info(
            "[CloudRecorder] tabPreferred from loaded message:",
            request.tabPreferred
          );
        }
        if (!tabPreferred.current) {
          isTab.current = request.isTab;
          recordingTabId.current = request.tabID || null;
          if (IS_OFFSCREEN_HOST && request.isTab && request.tabStreamId) {
            tabID.current = request.tabStreamId;
          } else if (request.isTab) {
            // offscreen doc delegates to SW (getStreamID branches on IS_OFFSCREEN_HOST); SW streamId is consumable here now isolation is gone
            getStreamID(request.tabID);
          }
        } else {
          isTab.current = false;
        }
        isInit.current = true;
        pullStreamingData();
      }
    } else if (request.type === "streaming-data") {
      if (!isInit.current) return;
      // Dedup: SW push + tab pull both deliver this by design.
      // Only mark received once we actually take the call, otherwise an
      // ignored delivery in the wrong context blocks the right one.
      const willHandle =
        (IS_IFRAME_CONTEXT && regionRef.current) ||
        (!IS_IFRAME_CONTEXT &&
          (!regionRef.current || (IS_OFFSCREEN_HOST && isTab.current)));
      if (!willHandle) return;
      // Same as `loaded`: BG's push retries until the recorder confirms.
      sendResponse?.({ ok: true });
      consumeStreamingData(request.data);
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
      } else if (!regionRef.current || (IS_OFFSCREEN_HOST && isTab.current)) {
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
    } else if (request.type === "offscreen-shutdown") {
      const timeoutMs = Number(request.timeoutMs) || 20000;
      (async () => {
        try {
          // Only cancel and discard send shouldFinalize:false.
          if (request.shouldFinalize === false) await markSessionDiscarded();
          if (isInit.current) {
            await stopRecording(
              request.shouldFinalize !== false,
              request.reason || "offscreen-shutdown"
            );
          }
          // Don't stop capture tracks here: it raced a slow start (isInit not
          // yet flipped, tracks live) and killed the capture mid-start.
          const drainPromise = Promise.all([
            screenUploader.current?.waitForPendingUploads?.() ??
              Promise.resolve(),
            cameraUploader.current?.waitForPendingUploads?.() ??
              Promise.resolve(),
            audioUploader.current?.waitForPendingUploads?.() ??
              Promise.resolve(),
          ]);
          await Promise.race([
            drainPromise,
            new Promise((resolve) => setTimeout(resolve, timeoutMs)),
          ]);
        } catch (err) {
          console.warn("[CloudRecorder] offscreen-shutdown error", err);
        } finally {
          chrome.runtime
            .sendMessage({ type: "offscreen-shutdown-complete" })
            .catch(() => {});
        }
      })();
      sendResponse?.({ ok: true, accepted: true });
      return true;
    } else if (request.type === "set-mic-active-tab") {
      if (!isInit.current) return;
      setMic(request);
    } else if (request.type === "set-audio-output-volume") {
      if (!isInit.current) return;
      setAudioOutputVolume(request.volume);
    } else if (request.type === "get-video-time") {
      if (!isInit.current) return;
      const videoTime = getActiveVideoTime() / 1000;
      sendResponse({ videoTime });
      return true;
    } else if (request.type === "pause-recording-tab") {
      if (!isInit.current) return;
      if (pausedStateRef.current) return;

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
      // Suspend the audio graph: WebAudio keeps the audio thread
      // ticking otherwise. Paired with resume below.
      if (aCtx.current && aCtx.current.state === "running") {
        aCtx.current.suspend().catch(() => {});
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
      // Gated on the recorder: a pause landing during mic setup is skipped for
      // the mic alone, and the clock has to track the file, not the session.
      if (
        audioRecorder.current?.state === "paused" &&
        !audioTimer.current.paused &&
        audioTimer.current.start
      ) {
        audioTimer.current.total += now - audioTimer.current.start;
        audioTimer.current.paused = true;
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

      if (screenRecorder.current && screenRecorder.current.state === "paused") {
        screenRecorder.current.resume();
      }
      if (cameraRecorder.current && cameraRecorder.current.state === "paused") {
        cameraRecorder.current.resume();
      }
      if (audioRecorder.current && audioRecorder.current.state === "paused") {
        audioRecorder.current.resume();
      }
      // Resume the audio graph (paired with suspend in pause).
      if (aCtx.current && aCtx.current.state === "suspended") {
        aCtx.current.resume().catch(() => {});
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
      if (
        audioTimer.current.paused &&
        audioRecorder.current?.state === "recording"
      ) {
        audioTimer.current.start = now;
        audioTimer.current.paused = false;
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
      const dismissReason = request.reason || "dismiss-recording-msg";
      // Cross-talk guard: a dismiss for a previous recording can
      // reach this recorder via the global recordingTab pointer.
      // Ignore when projectIds disagree; unknown ids are honored.
      const myProjectId = recorderSession.current?.projectId || null;
      const targetProjectId = request.projectId || null;
      if (myProjectId && targetProjectId && myProjectId !== targetProjectId) {
        console.warn(
          "[CloudRecorder] dismiss-recording ignored: project mismatch",
          { myProjectId, targetProjectId, reason: dismissReason }
        );
        void emitUploadTelemetry("dismiss_ignored_project_mismatch", {
          reason: dismissReason,
          targetProjectId,
        });
        return;
      }
      dismissRecording(false, dismissReason);
    } else if (request.type === "retry-finalize") {
      retryFinalize();
      sendResponse?.({ ok: true });
      return true;
    } else if (request.type === "export-finalize-diagnostics") {
      exportFinalizeDiagnostics(finalizeFailureRef.current);
      sendResponse?.({ ok: true });
      return true;
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

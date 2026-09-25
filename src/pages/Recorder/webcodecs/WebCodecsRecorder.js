/*!
 * Screenity WebCodecs Recorder
 * Copyright (c) 2025 Serial Labs Ltd.
 *
 * Licensed under the GNU GPLv3.
 * See the LICENSE file for full details.
 *
 * MP4 recording using WebCodecs + MediaBunny.
 * Handles H.264 video, AAC audio, timestamp safety,
 * canvas resizing, pause/resume, and chunked output.
 */
import { perfMark, perfSpan } from "../../utils/perfMarks";
import { diagForward } from "../../utils/diagForward";
import { computeLetterboxRect } from "./letterbox";
import {
  AAC_SUPPORTED_RATES,
  AVC_MAX_PIXELS,
  VIDEO_DIM_HARD_CAP,
  computeAvcCappedDimensions,
  computeEffectiveQueueCap,
  computeStartupQueueCap,
  applyEncoderConfigOverrides,
  computeSteadyQueueCap,
  isAacRateInSpec,
  isReclaimErrorMessage,
  shouldFailZeroChunksAtStop,
  shouldResetReclaimCounter,
  shouldThrottleReclaimRebuild,
  shouldTriggerSleepRecovery,
  STARTUP_CAUGHT_UP_QUEUE,
  STARTUP_CAUGHT_UP_RUN,
  STARTUP_HARD_FRAME_LIMIT,
  STARTUP_HARD_MS,
  STARTUP_QUEUE_CAP,
} from "./recorderLogic";
import { getStartupFlags } from "./startupFlags";
import { orientBoxToSource } from "../recorderConfig";
import { claimPrewarmedEncoder } from "../encoderPrewarm";
// Lazy-load Mp4MuxerWrapper so its ~3MB mediabunny static import doesn't
// drag into recorder.bundle.js cold start (dominates click-record latency).
let _mp4MuxerWrapperPromise = null;
const loadMp4MuxerWrapper = () => {
  if (!_mp4MuxerWrapperPromise) {
    _mp4MuxerWrapperPromise = import("./Mp4MuxerWrapper").then(
      (m) => m.Mp4MuxerWrapper,
    );
  }
  return _mp4MuxerWrapperPromise;
};

let _mkvMuxerWrapperPromise = null;
const loadMkvMuxerWrapper = () => {
  if (!_mkvMuxerWrapperPromise) {
    _mkvMuxerWrapperPromise = import("./MkvMuxerWrapper").then(
      (m) => m.MkvMuxerWrapper,
    );
  }
  return _mkvMuxerWrapperPromise;
};

// Warm the mediabunny muxer chunk before start() so its first import doesn't
// add latency between the countdown ending and the recorder firing.
export function preloadWebCodecsModules() {
  loadMp4MuxerWrapper().catch(() => {});
  loadMkvMuxerWrapper().catch(() => {});
}

export class WebCodecsRecorder {
  constructor(stream, options) {
    this.stream = stream;
    this.options = options;
    this.containerKind = options.containerKind === "webm" ? "webm" : "mp4";

    this.debug = options.debug ?? false;
    this.log = (...args) => this.debug && console.log(...args);
    this.warn = (...args) => this.debug && console.warn(...args);
    this.err = (...args) => this.debug && console.error(...args);

    this.videoTrack = null;
    this.audioTrack = null;

    this.videoProcessor = null;
    this.audioProcessor = null;

    this.videoReader = null;
    this.audioReader = null;

    this.videoEncoder = null;
    this.audioEncoder = null;

    this.muxer = null;

    this.running = false;

    this.actualWidth = 0;
    this.actualHeight = 0;

    this.targetWidth = 0;
    this.targetHeight = 0;

    this.videoTimestampOffsetUs = null;
    this.videoFallbackStartMs = null;
    this.selectedVideoCodec = null;
    this.actualVideoCodec = null;
    this.firstVideoFrame = undefined;
    this.frameCount = 0;
    this._videoFrameIndex = 0;
    this._videoStartUs = null;
    this._frameDurationUs = null;
    this._lastKeyFrameIndex = 0;
    this._keyFrameIntervalFrames = 60;

    this.audioSamplesWritten = 0;
    this.audioSampleRate = null;
    this.audioChannelCount = null;
    this._firstAudioFrameSampleRate = null;
    // µs written before the last stamp-rate change (folded in encodeAudioData).
    this._audioTimeBaseUs = 0;
    this._audioStampRate = null;
    // Wall-clock reconciliation state. See reconcileAudioClock in readAudioLoop.
    this._audioClockAnchorUs = null;
    this._audioDriftWindowStartUs = null;
    this._audioDriftWindowMinUs = Infinity;
    this._injectedCatchUpSilenceEvents = 0;
    this._injectedCatchUpSilenceUs = 0;
    this._injectedCatchUpSettleUs = 0;
    // Heartbeat audioDiag counters. See getAudioDiag.
    this._audioDataReceived = 0;
    this._audioDataEncoded = 0;
    this._audioReceivedUs = 0;
    this._paddedSilenceCount = 0;
    this._audioClockAnchorInitialUs = null;
    this._lastAudioLagUs = null;

    this.resizeCanvas = null;
    this.resizeCtx = null;
    this._loggedLetterbox = false;

    this.justResumed = false;
    this.paused = false;
    this.pauseStartUs = null;
    this.totalPausedDurationUs = 0;

    this._startPromise = null;
    this._startResolve = null;

    this._prebufferedAudio = [];
    this._audioReady = false;

    this._stopping = false;
    this._videoLoopPromise = null;
    this._audioLoopPromise = null;

    // Zero-frame recordings must error, not ship a header-only file.
    // _failureReported dedupes the zero-frame and first-chunk-watchdog
    // races.
    this._failureReported = false;
    this._videoLoopError = null;
    this._firstChunkSeen = false;
    this._firstChunkWatchdog = null;
    this._hiddenRearmCount = 0;
    // Matches FIRST_CHUNK_WATCHDOG_MAX_REARMS in the background watchdog;
    // ~48s of hidden, output-free recording at the 12s default.
    this._maxHiddenRearms = 3;
    // 12s covers NVENC / VideoToolbox cold-start (5-7s on first encode).
    // Shorter values false-fired into the MediaRecorder fallback.
    this._firstChunkWatchdogMs = Number.isFinite(options.firstChunkWatchdogMs)
      ? options.firstChunkWatchdogMs
      : Number.isFinite(
            /** @type {any} */ (globalThis)
              .__screenityFirstChunkWatchdogMsForTests,
          )
        ? /** @type {any} */ (globalThis)
            .__screenityFirstChunkWatchdogMsForTests
        : 12000;

    // Mid-stream watchdog: encoder goes silent after producing chunks
    // (HW reclaim, hang). Triggers graceful finalize on the partial.
    this._lastChunkAt = null;
    this._muxerAudioClosed = false;
    this._muxErrorReported = false;
    this._midStreamWatchdog = null;
    this._midStreamWatchdogMs = Number.isFinite(options.midStreamWatchdogMs)
      ? options.midStreamWatchdogMs
      : Number.isFinite(
            /** @type {any} */ (globalThis)
              .__screenityMidStreamWatchdogMsForTests,
          )
        ? /** @type {any} */ (globalThis)
            .__screenityMidStreamWatchdogMsForTests
        : 15000;

    // Last structured failure code that fired via _reportFailure; passed
    // to onFinalized so the consumer can distinguish a clean stop, a
    // mid-stream stall salvage, and other failure shapes.
    this._lastFailureCode = null;

    // Backpressure: feeding faster than the encoder drains grows the
    // queue unbounded and chunks stop emitting (28-byte failure).
    // Past threshold, drop the next frame and force a keyframe.
    //
    // 16, not 4: a ~170ms hiccup walks the queue 0->4 in ~5 frames and the
    // drop lands before encode(), costing 2-4 frames mid-recording. 12 still
    // dropped occasionally; 24 was no better and twice the memory.
    // start() lowers it per-resolution: ~130MB at 1080p, ~530MB at 4K.
    this._encoderMaxQueueSizeExplicit =
      Number.isFinite(options.encoderMaxQueueSize) ||
      Number.isFinite(
        /** @type {any} */ (globalThis).__screenityEncoderMaxQueueSizeForTests,
      );
    this._encoderMaxQueueSize = Number.isFinite(options.encoderMaxQueueSize)
      ? options.encoderMaxQueueSize
      : Number.isFinite(
            /** @type {any} */ (globalThis)
              .__screenityEncoderMaxQueueSizeForTests,
          )
        ? /** @type {any} */ (globalThis)
            .__screenityEncoderMaxQueueSizeForTests
        : 16;
    // Cold-start grace: a fresh HW encoder spikes the queue for under a second
    // while its session comes up. Buffer that, then latch back to the steady cap.
    this._startupMaxQueueSize = Number.isFinite(options.startupMaxQueueSize)
      ? options.startupMaxQueueSize
      : STARTUP_QUEUE_CAP;
    this._startupWindowClosed = false;
    this._startupCaughtUpRun = 0;
    this._startupFirstFrameAt = null;
    this._startupFramesSeen = 0;
    this._startupBufferEngaged = false;
    this._framesBufferedAtStart = 0;
    // How long the elastic cap stays available. Overridable without a rebuild,
    // same pattern as the watchdog test knobs above.
    this._startupHardMs = Number.isFinite(options.startupHardMs)
      ? options.startupHardMs
      : Number.isFinite(
            /** @type {any} */ (globalThis).__screenityStartupWindowMsForTests,
          )
        ? /** @type {any} */ (globalThis).__screenityStartupWindowMsForTests
        : STARTUP_HARD_MS;
    this._startupHardFrameLimit = Number.isFinite(options.startupHardFrameLimit)
      ? options.startupHardFrameLimit
      : Number.isFinite(
            /** @type {any} */ (globalThis)
              .__screenityStartupWindowFramesForTests,
          )
        ? /** @type {any} */ (globalThis)
            .__screenityStartupWindowFramesForTests
        : STARTUP_HARD_FRAME_LIMIT;
    this._adoptedPrewarmEncoder = false;
    this._adoptedDecoderConfig = null;
    this._forceNextKeyframe = false;
    this._droppedForBackpressureCount = 0;
    // 100, not 10. At ~10-25ms per chunk, 10 was ~100-200ms of headroom against
    // video's ~530ms, so any hiccup past ~200ms destroyed audio. ~1s, under 500KB.
    this._audioEncoderMaxQueueSize = Number.isFinite(options.audioEncoderMaxQueueSize)
      ? options.audioEncoderMaxQueueSize
      : 100;
    this._droppedAudioForBackpressureCount = 0;
    // Peak queue depth; leading indicator for backpressure tuning.
    // Drops tell us when the encoder failed; this tells us when it
    // almost did.
    this._peakVideoEncodeQueueSize = 0;
    this._peakAudioEncodeQueueSize = 0;

    // Encoder reclaim recovery. Chrome reclaims idle HW slots; we
    // rebuild with the same config. Cap 5 plus throttle is ~10s of retries.
    this._maxEncoderReclaims = Number.isFinite(options.maxEncoderReclaims)
      ? options.maxEncoderReclaims
      : 5;
    // Throttle so the encode loop can't burn the cap on every frame
    // while the HW slot is still held by another app.
    this._reclaimRebuildThrottleMs = Number.isFinite(
      options.reclaimRebuildThrottleMs,
    )
      ? options.reclaimRebuildThrottleMs
      : Number.isFinite(
            /** @type {any} */ (globalThis)
              .__screenityReclaimRebuildThrottleMsForTests,
          )
        ? /** @type {any} */ (globalThis)
            .__screenityReclaimRebuildThrottleMsForTests
        : 2000;
    this._lastVideoReclaimRebuildAt = null;
    this._lastAudioReclaimRebuildAt = null;
    this._encoderReclaimCount = 0;
    this._audioEncoderReclaimCount = 0;
    this._midStreamStallRebuilds = 0;
    // Reset the per-encoder reclaim counter after a healthy stretch.
    this._lastVideoReclaimAt = null;
    this._lastAudioReclaimAt = null;
    this._reclaimResetAfterMs = Number.isFinite(options.reclaimResetAfterMs)
      ? options.reclaimResetAfterMs
      : Number.isFinite(
            /** @type {any} */ (globalThis)
              .__screenityReclaimResetAfterMsForTests,
          )
        ? /** @type {any} */ (globalThis).__screenityReclaimResetAfterMsForTests
        : 30000;
    // Pause closes encoders to release the HW slot before Chrome's
    // inactivity-reclaim fires. Flag swallows the racing reclaim error.
    this._encodersClosedForPause = false;
    // Serialize pause/resume so a rapid toggle doesn't race close/rebuild.
    this._pauseResumeChain = Promise.resolve();
    // Rebuild AudioEncoder when the mic sample rate changes mid-
    // recording (BT unplug, default device switch). Capped to catch flaps.
    this._audioDeviceChangePending = false;
    this._audioSampleRateMismatchRebuilds = 0;
    this._maxAudioSampleRateRebuilds = Number.isFinite(
      options.maxAudioSampleRateRebuilds,
    )
      ? options.maxAudioSampleRateRebuilds
      : 3;
    // Sleep / wake: a long frame-arrival gap means lid-close or OS
    // preemption. Force a keyframe and reset the stall watchdog.
    this._lastFrameArrivalAt = null;
    this._postSleepRecoveries = 0;
    this._sleepGapMs = Number.isFinite(options.sleepGapMs)
      ? options.sleepGapMs
      : 5000;
    // Active configs preserved for rebuild after reclaim. Updated when
    // a SW fallback rebuilds the encoder so the next reclaim uses the
    // config that actually worked, not the originally-attempted HW one.
    this._activeVideoConfig = null;
    this._activeVideoCodecLabel = null;
    this._activeAudioConfig = null;
    // Handlers preserved so rebuild reuses the closures that wire
    // output → muxer, first-chunk watchdog, decoderConfig surfacing.
    this._videoEncoderOutputHandler = null;
    this._videoEncoderErrorHandler = null;
    this._audioEncoderOutputHandler = null;
    this._audioEncoderErrorHandler = null;

    // Visibility-change tracking so _reportFailure can correlate
    // encoder reclaims with recent backgrounding. Counts only; the
    // engine doesn't pause/resume on visibility.
    this._visibilityChangeCount = 0;
    this._lastVisibilityChangeAt = null;
    this._lastVisibilityState = null;
    this._visibilityChangeListener = null;

    // devicechange tracking so _reportFailure captures BT/USB unplugs
    // and default-mic switches (the common cause of audio sample-rate
    // mismatches). Engine doesn't rebuild; consumer decides policy.
    this._deviceChangeCount = 0;
    this._lastDeviceChangeAt = null;
    this._deviceChangeListener = null;

    // One-shot: surfaces SPS+PPS bytes once for OPFS persistence so a
    // tab-kill recovery can reconstruct MP4 without the muxer.
    this._decoderConfigEmitted = false;

    // Diagnostic counters. The framesFromMSTP vs framesFed gap points to
    // MSTP-side issues; framesFed vs chunksOut catches the silent
    // no-output encoder bug.
    this._framesFed = 0;
    this._chunksOut = 0;
    this._framesFromMSTP = 0;
    this._staticFrameSyntheticCount = 0;
    // Ahead-of-clock drops are real source frames; gap skips are timeline
    // slots, not frames. Tells a quiet source from a loop discarding frames.
    this._framesDroppedAheadOfClock = 0;
    this._framesSkippedForGap = 0;
    // Black placeholder frames synthesized before the first real frame to
    // bridge macOS static-screen first-frame starvation (see readVideoLoop).
    this._syntheticFirstFrameCount = 0;
    // In-flight reads, hoisted so a fallback timeout cannot orphan them.
    this._pendingVideoRead = null;
    this._pendingAudioRead = null;
    this._firstChunkAt = null;
    this._encoderConstructCount = 0;
    this._videoEncoderStateAtStop = null;
    this._videoCodecConfigsTried = [];
    this._displaySurface = null;
    this._frameRateRequested = Number.isFinite(options?.fps) ? options.fps : null;
    this._frameRateActual = null;
    this._frameWidthActual = null;
    this._frameHeightActual = null;
  }

  async _probeRealResolution() {
    // E2E hook: synthetic probe dims so tests can drive the AVC
    // pixel-area cap without a real 4K source.
    const _g = /** @type {any} */ (globalThis);
    if (
      _g.__screenityForceProbeResolution &&
      typeof _g.__screenityForceProbeResolution === "object"
    ) {
      const { width, height } = _g.__screenityForceProbeResolution;
      if (Number.isFinite(width) && Number.isFinite(height)) {
        this.log("[WCR] Resolution from test override:", width, "x", height);
        if (this.options) {
          this.options.width = undefined;
          this.options.height = undefined;
        }
        return { width, height };
      }
    }
    // Prefer track settings: on macOS getDisplayMedia, the first frame from
    // MediaStreamTrackProcessor can be delayed several seconds by VideoToolbox
    // capture cold-start, which would block start() and freeze the toolbar.
    try {
      const settings =
        typeof this.videoTrack.getSettings === "function"
          ? this.videoTrack.getSettings()
          : null;
      const w = settings && Number(settings.width);
      const h = settings && Number(settings.height);
      if (settings) {
        if (typeof settings.displaySurface === "string") {
          this._displaySurface = settings.displaySurface;
        }
        const fr = Number(settings.frameRate);
        if (Number.isFinite(fr) && fr > 0) this._frameRateActual = fr;
        if (Number.isFinite(w) && w > 0) this._frameWidthActual = w;
        if (Number.isFinite(h) && h > 0) this._frameHeightActual = h;
      }
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
        this.log("[WCR] Resolution from track settings:", w, "x", h);
        return { width: w, height: h };
      }
    } catch (err) {
      this.warn("[WCR] getSettings() failed; falling back to frame probe", err);
    }

    const processor = new MediaStreamTrackProcessor({ track: this.videoTrack });
    const reader = processor.readable.getReader();

    // getSettings() already missed above, so a frozen/backgrounded source
    // (minimized window capture, backgrounded tab compositor) never delivers
    // a frame here; uncapped, this is telemetry's largest single
    // start-progress stall bucket. Time out so start()'s catch falls back
    // to MediaRecorder.
    const FRAME_PROBE_TIMEOUT_MS = 5000;
    let timeoutTimer;
    let frame;
    try {
      const result = await Promise.race([
        reader.read(),
        new Promise((_, reject) => {
          timeoutTimer = setTimeout(
            () => reject(new Error("probe-frame-timeout")),
            FRAME_PROBE_TIMEOUT_MS,
          );
        }),
      ]);
      frame = result.value;
    } catch (err) {
      reader.cancel().catch(() => {});
      throw err;
    } finally {
      clearTimeout(timeoutTimer);
    }
    if (!frame) throw new Error("Cannot probe frame resolution");

    const width = frame.codedWidth;
    const height = frame.codedHeight;

    this.log("[WCR] Probed resolution:", width, "x", height);
    frame.close();
    reader.releaseLock();

    return { width, height };
  }

  async start() {
    this.videoTimestampOffsetUs = null;
    this.firstVideoFrame = undefined;
    this._stopping = false;
    this._failureReported = false;
    this._videoLoopError = null;
    this._firstChunkSeen = false;
    // no-first-chunk SW salvage is one-shot (guarded by _didSwRetry); reset so a
    // reused instance can salvage again on a second recording.
    this._didSwRetry = false;
    this._swRetryReason = null;
    this._hiddenRearmCount = 0;
    this._lastChunkAt = null;
    // A reused instance gets a fresh muxer, so neither latch may carry over.
    this._muxerAudioClosed = false;
    this._muxErrorReported = false;
    this._lastFailureCode = null;
    this._forceNextKeyframe = false;
    this._startupWindowClosed = false;
    this._startupCaughtUpRun = 0;
    this._startupFirstFrameAt = null;
    this._startupFramesSeen = 0;
    this._startupBufferEngaged = false;
    this._framesBufferedAtStart = 0;
    this._adoptedPrewarmEncoder = false;
    this._adoptedDecoderConfig = null;
    // A read hoisted by the previous recording is bound to a cancelled reader:
    // left set, the next readVideoLoop resolves {done:true} on its first
    // iteration and records nothing.
    this._pendingVideoRead = null;
    this._pendingAudioRead = null;
    this._framesDroppedAheadOfClock = 0;
    this._framesSkippedForGap = 0;
    this._droppedForBackpressureCount = 0;
    this._droppedAudioForBackpressureCount = 0;
    this._peakVideoEncodeQueueSize = 0;
    this._peakAudioEncodeQueueSize = 0;
    this._encoderReclaimCount = 0;
    this._audioEncoderReclaimCount = 0;
    this._midStreamStallRebuilds = 0;
    this._lastVideoReclaimAt = null;
    this._lastAudioReclaimAt = null;
    this._lastVideoReclaimRebuildAt = null;
    this._lastAudioReclaimRebuildAt = null;
    this._encodersClosedForPause = false;
    this._finalizeRan = false;
    this._finalizeOnFatalRan = false;
    this._finalizingFromFatal = false;
    this._audioDeviceChangePending = false;
    this._audioSampleRateMismatchRebuilds = 0;
    this._audioRebuildUnsupportedRates = null;
    this._lastFrameArrivalAt = null;
    this._postSleepRecoveries = 0;
    this._activeVideoConfig = null;
    this._activeVideoCodecLabel = null;
    this._activeAudioConfig = null;
    this._visibilityChangeCount = 0;
    this._lastVisibilityChangeAt = null;
    this._lastVisibilityState =
      typeof document !== "undefined" ? document.visibilityState : null;
    this._deviceChangeCount = 0;
    this._lastDeviceChangeAt = null;
    this._attachVisibilityListener();
    this._attachDeviceChangeListener();
    this._decoderConfigEmitted = false;
    this._videoFrameIndex = 0;
    this._videoStartUs = null;
    this._frameDurationUs = null;
    this._lastKeyFrameIndex = 0;
    this.audioSamplesWritten = 0;
    this._audioTimeBaseUs = 0;
    this._audioStampRate = null;
    this._audioClockAnchorUs = null;
    this._audioDriftWindowStartUs = null;
    this._audioDriftWindowMinUs = Infinity;
    this._injectedCatchUpSilenceEvents = 0;
    this._injectedCatchUpSilenceUs = 0;
    this._injectedCatchUpSettleUs = 0;
    this._audioDataReceived = 0;
    this._audioDataEncoded = 0;
    this._audioReceivedUs = 0;
    this._paddedSilenceCount = 0;
    this._audioClockAnchorInitialUs = null;
    this._lastAudioLagUs = null;

    if (this.running) return this._startPromise;

    this._startPromise = new Promise((resolve) => {
      this._startResolve = resolve;
    });

    this.running = true;
    try {
      this.videoTrack = this.stream.getVideoTracks()[0] || null;
      this.audioTrack = this.stream.getAudioTracks()[0] || null;

      this.log(
        "[WCR] videoTrack",
        this.videoTrack,
        "state=",
        this.videoTrack?.readyState
      );
      this.log(
        "[WCR] audioTrack",
        this.audioTrack,
        "state=",
        this.audioTrack?.readyState
      );

      if (!this.videoTrack) {
        const err = new Error("WebCodecsRecorder: No video track");
        this.options.onError?.(err);
        this.running = false;

        if (this._startResolve) {
          this._startResolve(false);
          this._startResolve = null;
        }

        this._startPromise = null;
        return false;
      }

      try {
        perfMark("WCR.start.enter");
        const endProbe = perfSpan("WCR.probeResolution");
        const { width, height } = await this._probeRealResolution();
        endProbe({ width, height });
        this.actualWidth = width;
        this.actualHeight = height;

        // Oriented to the source so a portrait crop doesn't bind on height
        // (see orientBoxToSource); the pixel-area cap below is the encoder limit.
        const cap = orientBoxToSource(
          width,
          height,
          this.options?.width,
          this.options?.height,
        );
        // Apply user/hard cap, even-rounding, and AVC pixel-area cap.
        const dimResult = computeAvcCappedDimensions({
          sourceWidth: width,
          sourceHeight: height,
          userMaxWidth: cap.width,
          userMaxHeight: cap.height,
        });
        if (dimResult.capped.area) {
          this.warn("[WCR] target clamped to AVC max pixel area", {
            sourceWidth: width,
            sourceHeight: height,
            toWidth: dimResult.width,
            toHeight: dimResult.height,
            avcMaxPixels: AVC_MAX_PIXELS,
          });
        }
        this.targetWidth = dimResult.width;
        this.targetHeight = dimResult.height;

        this.log("[WCR] Target:", this.targetWidth, "x", this.targetHeight);

        // Now that dims are known, bound the steady cap by bytes: 16 frames is
        // ~130MB at 1080p but ~530MB at 4K, and this one never reverts. 1080p
        // keeps the measured 16, 4K falls back toward the historical 4.
        if (!this._encoderMaxQueueSizeExplicit) {
          this._encoderMaxQueueSize = computeSteadyQueueCap({
            width: this.targetWidth,
            height: this.targetHeight,
          });
        }
        if (!Number.isFinite(this.options.startupMaxQueueSize)) {
          this._startupMaxQueueSize = computeStartupQueueCap({
            width: this.targetWidth,
            height: this.targetHeight,
            steadyCap: this._encoderMaxQueueSize,
          });
        }

        const fps = this.options.fps || 30;
        this._frameDurationUs = Math.round(1_000_000 / fps);
        this._keyFrameIntervalFrames = Math.max(30, Math.round(fps * 2));
        const safeBitrate = this.options.videoBitrate || 10_000_000;

        const overrideConfig =
          this.options.videoEncoderConfig && typeof this.options.videoEncoderConfig === "object"
            ? this.options.videoEncoderConfig
            : null;

        let videoConfig = null;
        if (overrideConfig) {
          // Rate settings come from the caller, not the probe; an unsupported
          // combination just falls through to chooseVideoEncoderConfig below.
          const config = applyEncoderConfigOverrides(overrideConfig, {
            width: this.targetWidth,
            height: this.targetHeight,
            bitrate: safeBitrate,
            framerate: fps,
          });
          this.log("[WCR] Using override encoder config", config);
          try {
            const support = await VideoEncoder.isConfigSupported(config);
            if (support?.supported) {
              const effectiveCodec =
                (support.config || config).codec || overrideConfig.codec || "";
              let cc;
              if (/^vp09|^vp9/i.test(effectiveCodec)) cc = "vp9";
              else if (/^vp08|^vp8/i.test(effectiveCodec)) cc = "vp8";
              else if (/^av01|^av1/i.test(effectiveCodec)) cc = "av1";
              else cc = "avc";
              videoConfig = {
                config: support.config || config,
                codec: effectiveCodec,
                containerCodec: cc,
              };
            }
          } catch (err) {
            this.warn("[WCR] Override config unsupported", err);
          }
        }

        if (!videoConfig) {
          const endChoose = perfSpan("WCR.chooseVideoEncoderConfig");
          videoConfig = await this.chooseVideoEncoderConfig({
            width: this.targetWidth,
            height: this.targetHeight,
            fps,
            bitrate: safeBitrate,
          });
          endChoose({ codec: videoConfig?.codec });
        }
        this.selectedVideoCodec = videoConfig.codec;

        const endAudioCfg = perfSpan("WCR.prepareAudioEncoderConfig");
        const audioConfig = await this.prepareAudioEncoderConfig();
        endAudioCfg({ ok: Boolean(audioConfig) });
        this._pendingAudioConfig = audioConfig;

        this.log("[WCR] Audio config:", audioConfig);

        if (!audioConfig) {
          this.warn("[WCR] No audio available");
          this.options.audioBitrate = undefined;
          this.options.enableAudio = false;
          this._audioReady = false;
        }

        if (audioConfig && this.audioTrack) {
          this.audioProcessor = new MediaStreamTrackProcessor({
            track: this.audioTrack,
          });
          this.audioReader = this.audioProcessor.readable.getReader();
        }

        // Init audio first so _audioReady=true when both loops launch
        // together, avoiding audio prebuffer before video starts.
        if (this._pendingAudioConfig) {
          const endAudioInit = perfSpan("WCR.initAudioEncoder");
          await this.initAudioEncoder(this._pendingAudioConfig);
          this._audioReady = true;
          endAudioInit();
        }

        this.videoProcessor = new MediaStreamTrackProcessor({
          track: this.videoTrack,
        });
        this.videoReader = this.videoProcessor.readable.getReader();

        this.log("[WCR] creating muxer...", this.containerKind);
        const muxerAudioCodec = this.options.enableAudio
          ? this.containerKind === "webm"
            ? "opus"
            : "aac"
          : undefined;
        if (this.containerKind === "webm") {
          const endLoadMuxer = perfSpan("WCR.loadMkvMuxerWrapper");
          const MkvMuxerWrapper = await loadMkvMuxerWrapper();
          endLoadMuxer();
          this.muxer = new MkvMuxerWrapper({
            width: this.targetWidth,
            height: this.targetHeight,
            fps,
            videoBitrate: this.options.videoBitrate,
            audioBitrate: this.options.audioBitrate,
            videoCodec: videoConfig.containerCodec,
            audioCodec: muxerAudioCodec,
            onChunk: this.options.onChunk,
            onMuxError: (err, kind) => this._handleMuxError(err, kind),
          });
        } else {
          const endLoadMuxer = perfSpan("WCR.loadMp4MuxerWrapper");
          const Mp4MuxerWrapper = await loadMp4MuxerWrapper();
          endLoadMuxer();
          this.muxer = new Mp4MuxerWrapper({
            width: this.targetWidth,
            height: this.targetHeight,
            fps,
            videoBitrate: this.options.videoBitrate,
            audioBitrate: this.options.audioBitrate,
            videoCodec: videoConfig.containerCodec,
            audioCodec: muxerAudioCodec,
            onChunk: this.options.onChunk,
            onMuxError: (err, kind) => this._handleMuxError(err, kind),
          });
        }

        if (this.options.enableAudio) {
          this.muxer.enableAudio();
        }

        const endMuxerStart = perfSpan("WCR.muxer.start");
        await this.muxer.start();
        endMuxerStart();
        this.log("[WCR] muxer started");

        const endVidInit = perfSpan("WCR.initVideoEncoder");
        await this.initVideoEncoder(videoConfig.config, videoConfig.codec);
        endVidInit();

        await Promise.resolve();

        this._startAlignTimer = setTimeout(() => {
          this._startAlignTimer = null;
          if (!this.running) return;

          // E2E hook: simulate runtime encoder failure for the
          // in-session MediaRecorder swap test path.
          if (globalThis.__screenityForceWebCodecsError) {
            if (this._startResolve) {
              this._startResolve(true);
              this._startResolve = null;
            }
            setTimeout(() => {
              this.options.onError?.(
                new Error("e2e-forced-webcodecs-error"),
              );
            }, 0);
            return;
          }

          // E2E hook: fire `ended` on the video track mid-recording
          // (simulates monitor unplug / Stop-sharing click).
          const endAfterMs = Number(
            (globalThis).__screenityForceTrackEndAfterMs,
          );
          if (
            this.videoTrack &&
            Number.isFinite(endAfterMs) &&
            endAfterMs > 0
          ) {
            this._forcedTrackEndTimer = setTimeout(() => {
              try {
                this.videoTrack.dispatchEvent(new Event("ended"));
              } catch (err) {
                this.warn("[WCR] forced track end dispatch failed", err);
              }
            }, endAfterMs);
          }

          // Launch loops together so t=0 aligns.
          this._videoLoopPromise = this.readVideoLoop();
          if (this.audioReader && this.options.enableAudio) {
            this.log("[WCR] start audio loop (aligned with video)");
            this._audioLoopPromise = this.readAudioLoop();
          }

          // No-first-chunk watchdog. Surfaces the silent encoder
          // stall so the caller can swap to MediaRecorder.
          this._armFirstChunkWatchdog();

          if (this._startResolve) {
            this._startResolve(true);
            this._startResolve = null;
          }
        }, 30);

        this.log("[WCR] start() done");
      } catch (err) {
        this.err("[WCR] start() failed:", err);
        this.options.onError?.(err);
        this.running = false;
        // Await the async cleanup; fire-and-forget would let an immediate retry
        // hit an in-flight reader with InvalidStateError.
        await this.cleanup();

        if (this._startResolve) {
          this._startResolve(false);
          this._startResolve = null;
        }
      }
    } catch (err) {
      this.err("[WCR] start() outer error:", err);
      this.options.onError?.(err);
      this.running = false;
      await this.cleanup();

      if (this._startResolve) {
        this._startResolve(false);
        this._startResolve = null;
      }
    }

    return this._startPromise;
  }

  // Lets the background watchdog tell "fed but not emitting yet" (cold start,
  // 5-7s on NVENC / VideoToolbox) from "no frames arriving at all".
  getProgressStats() {
    let muxerEmits = null;
    let muxerBytes = null;
    try {
      const s = this.muxer?.getStats?.();
      muxerEmits = s?.emitCount ?? null;
      muxerBytes = s?.totalEmittedBytes ?? null;
    } catch {}
    return {
      frameCount: this.frameCount,
      framesFromMSTP: this._framesFromMSTP,
      chunksOut: this._chunksOut,
      firstChunkSeen: this._firstChunkSeen,
      muxerEmits,
      muxerBytes,
    };
  }

  async stop() {
    this.log("[WCR] stop()", this.frameCount);
    perfMark("WCR.stop.enter", { frameCount: this.frameCount });

    if (this._stopping) {
      this.log("[WCR] stop() already in progress");
      return;
    }
    this._stopping = true;

    // Not `!running`: a source track ending (stopped screen share) clears it in
    // readVideoLoop, and stop() then returned without flushing or finalizing.
    if (this._finalizeRan || (!this.running && this.frameCount === 0)) {
      this.log("[WCR] stop() called but nothing left to finalize", {
        finalizeRan: this._finalizeRan,
        running: this.running,
        frameCount: this.frameCount,
      });
      this._stopping = false;
      return;
    }
    // Claim the finalize before any await so a second stop() (the fatal path
    // calls this too) can't run it twice.
    this._finalizeRan = true;

    if (this._startAlignTimer) {
      clearTimeout(this._startAlignTimer);
      this._startAlignTimer = null;
    }
    if (this._forcedTrackEndTimer) {
      clearTimeout(this._forcedTrackEndTimer);
      this._forcedTrackEndTimer = null;
    }
    this._clearFirstChunkWatchdog();
    this._clearMidStreamStallWatchdog();

    // Soft stop: let loops finish current work.
    this.running = false;
    this.paused = true;

    try {
      const loopPromises = [];
      if (this._videoLoopPromise) loopPromises.push(this._videoLoopPromise);
      if (this._audioLoopPromise) loopPromises.push(this._audioLoopPromise);

      if (loopPromises.length) {
        this.log("[WCR] Waiting for read loops to finish before flush...");
        await Promise.race([
          Promise.allSettled(loopPromises),
          new Promise((res) => setTimeout(res, 500)),
        ]);
      }
    } catch (err) {
      this.err("[WCR] Error while waiting for loops:", err);
    }

    // Drain queued a/v so audioSamplesWritten is reliable for the
    // final track duration. 15s cap (webcodecs#723: flush can take
    // 5-10s, HW glitches hang indefinitely); muxer has its own.
    const flushBounded = async (encoder, kind) => {
      if (!encoder || encoder.state === "closed") return;
      const endSpan = perfSpan(`WCR.stop.${kind}.flush`);
      const startedAt = performance.now();
      let timed = null;
      try {
        await Promise.race([
          encoder.flush(),
          new Promise((_, reject) => {
            timed = setTimeout(
              () => reject(new Error(`${kind}-flush-timeout`)),
              15000,
            );
          }),
        ]);
      } finally {
        if (timed) clearTimeout(timed);
      }
      const ms = Math.round(performance.now() - startedAt);
      if (kind === "video") this._videoFlushMs = ms;
      else this._audioFlushMs = ms;
      endSpan({ ms });
    };
    try {
      // E2E seam: stand in for a slow flush. Must sit after the loops have
      // stopped, or the writer keeps appending and the file never goes static.
      const forcedFinalizeDelayMs =
        Number(
          /** @type {any} */ (globalThis).__screenityForceFinalizeDelayMs,
        ) || 0;
      if (forcedFinalizeDelayMs > 0) {
        await new Promise((r) => setTimeout(r, forcedFinalizeDelayMs));
      }
      await flushBounded(this.videoEncoder, "video");
      await flushBounded(this.audioEncoder, "audio");
    } catch (err) {
      this.err("[WCR] flush error:", err);
      this.options.onError?.(err);
    }

    // Trailing hold frames so audio doesn't outlast video and render
    // a black tail. Multiple short frames, not one long one: encoders
    // can drop VideoFrame.duration on the output chunk.
    if (
      this.videoEncoder &&
      this.videoEncoder.state !== "closed" &&
      this.resizeCanvas &&
      this._videoFrameIndex > 0 &&
      this._frameDurationUs
    ) {
      try {
        const audioEndUs = this._audioWrittenUs();
        const holdStartUs = this._videoFrameIndex * this._frameDurationUs;
        // Cushion for audio drain lag + muxer rounding; 150ms is imperceptible.
        const cushionUs = 150_000;
        const targetEndUs = Math.max(
          holdStartUs + this._frameDurationUs,
          audioEndUs + cushionUs,
        );
        const framesNeeded = Math.max(
          1,
          Math.ceil((targetEndUs - holdStartUs) / this._frameDurationUs),
        );
        for (let k = 0; k < framesNeeded; k += 1) {
          const tsUs = this._videoFrameIndex * this._frameDurationUs;
          const hold = new VideoFrame(this.resizeCanvas, {
            timestamp: tsUs,
            duration: this._frameDurationUs,
          });
          // try/finally so an encode() throw doesn't leak the
          // VideoFrame's GPU buffer.
          try {
            this.videoEncoder.encode(hold, {
              timestamp: tsUs,
              keyFrame: false,
            });
            this._framesFed += 1;
          } finally {
            hold.close();
          }
          this._videoFrameIndex += 1;
        }
        // 5s cap on trailing-hold flush; some Windows drivers never
        // resolve flush(). Muxer finalize still ships mdat'd chunks.
        let holdTimed = null;
        try {
          await Promise.race([
            this.videoEncoder.flush(),
            new Promise((_, reject) => {
              holdTimed = setTimeout(
                () => reject(new Error("trailing-hold-flush-timeout")),
                5000,
              );
            }),
          ]);
        } finally {
          if (holdTimed) clearTimeout(holdTimed);
        }
        this.log("[WCR] trailing hold frames encoded", {
          holdStartUs,
          audioEndUs,
          framesNeeded,
        });
      } catch (err) {
        this.warn("[WCR] trailing hold frames failed:", err);
      }
    }

    // Snapshot encoder state before finalize closes it.
    try {
      this._videoEncoderStateAtStop = this.videoEncoder?.state || "destroyed";
    } catch {
      this._videoEncoderStateAtStop = "unknown";
    }

    // Zero chunks: don't ship a header-only file. Skips muxer.finalize
    // below and the err is NOT tagged finalized (nothing to salvage).
    if (shouldFailZeroChunksAtStop(this._firstChunkSeen, this.frameCount)) {
      this.warn("[WCR] stop() reached finalize with zero chunks", {
        firstChunkSeen: this._firstChunkSeen,
        frameCount: this.frameCount,
      });
      if (!this._failureReported) {
        const zeroChunkErr =
          this._videoLoopError ||
          new Error(
            "WebCodecs encoder produced zero chunks before stop; flush succeeded without output",
          );
        // Callers gate the salvage branch on err.finalized === true.
        zeroChunkErr.finalized = false;
        this._reportFailure("webcodecs-zero-frames-at-stop", zeroChunkErr);
      }
    }

    // Hard timeout on finalize: abrupt stream end can hang it. Most
    // of the file is already in chunksStore (fragmented MP4);
    // flushPending() preserves the rest.
    let muxerFinalizeOk = false;
    let ranFlushPending = false;
    if (this.muxer && !this._failureReported) {
      const endFinalize = perfSpan("WCR.stop.muxer.finalize");
      const finalizeStartedAt = performance.now();
      try {
        await Promise.race([
          this.muxer.finalize().then(() => {
            muxerFinalizeOk = true;
          }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("muxer-finalize-timeout")),
              5000,
            ),
          ),
        ]);
        endFinalize({ ok: true });
        diagForward("recorder-muxer-finalize-ok", {
          ms: Math.round(performance.now() - finalizeStartedAt),
          chunksOut: this._chunksOut,
          frameCount: this.frameCount,
        });
      } catch (err) {
        endFinalize({ ok: false, err: String(err?.message || err).slice(0, 80) });
        this.err("[WCR] muxer.finalize:", err);
        this.options.onError?.(err);
        try {
          await this.muxer.flushPending();
          ranFlushPending = true;
        } catch {}
        // finalize() timed out or threw: moov trailer may be missing, file could
        // be a header-only fragment. Record whether we force-flushed for salvage.
        diagForward("recorder-muxer-finalize-fail", {
          ms: Math.round(performance.now() - finalizeStartedAt),
          err: String(err?.message || err).slice(0, 120),
          ranFlushPending,
          chunksOut: this._chunksOut,
          frameCount: this.frameCount,
        });
      }
    }

    // Capture-to-disk breadcrumb at stop: splits "encoder produced nothing"
    // (muxerBytes ~= header) from "bytes lost after the muxer" (big muxerBytes,
    // tiny file). ALWAYS_FLUSH survives SW teardown.
    try {
      const muxerStats = this.muxer?.getStats?.() || null;
      diagForward("recorder-finalize-summary", {
        frameCount: this.frameCount,
        chunksOut: this._chunksOut,
        firstChunkSeen: this._firstChunkSeen,
        framesFromMSTP: this._framesFromMSTP,
        syntheticFirstFrameCount: this._syntheticFirstFrameCount,
        // Last-frame repeats from the static-frame fallback. High here against
        // a near-zero framesFromMSTP means a frozen recording.
        staticFrameSyntheticCount: this._staticFrameSyntheticCount,
        muxerBytes: muxerStats?.totalEmittedBytes ?? null,
        muxerEmits: muxerStats?.emitCount ?? null,
        muxerFinalizeOk,
        ranFlushPending,
        videoEncoderStateAtStop: this._videoEncoderStateAtStop,
        failureReported: this._failureReported,
        lastFailureCode: this._lastFailureCode || null,
      });
    } catch {}

    // Always invoke onFinalized: skipping on finalize-fail caused the
    // stuck-at-90% bug on stream-end. Recorder layer decides next steps
    // (validate chunks, mark failed, send video-ready).
    if (this.options.onFinalized) {
      const endOnFinalized = perfSpan("WCR.stop.onFinalized.callback");
      try {
        // Integrity signal: muxerFinalizeOk says whether moov was
        // written, framesEncoded confirms real content,
        // lastFailureCode names the cause on salvaged partials.
        await this.options.onFinalized({
          muxerFinalizeOk,
          framesEncoded: this.frameCount,
          firstChunkSeen: this._firstChunkSeen,
          droppedForBackpressure: {
            video: this._droppedForBackpressureCount,
            audio: this._droppedAudioForBackpressureCount,
          },
          peakEncodeQueueSize: {
            video: this._peakVideoEncodeQueueSize,
            audio: this._peakAudioEncodeQueueSize,
          },
          startupBuffer: {
            engaged: this._startupBufferEngaged,
            framesBuffered: this._framesBufferedAtStart,
            adoptedWarmEncoder: this._adoptedPrewarmEncoder === true,
          },
          flushMs: {
            video: this._videoFlushMs ?? null,
            audio: this._audioFlushMs ?? null,
          },
          swRetry: this._didSwRetry
            ? { reason: this._swRetryReason || null }
            : null,
          lastFailureCode: this._lastFailureCode,
          diag: this.getDiagSnapshot(),
        });
        endOnFinalized({ ok: true });
      } catch (err) {
        endOnFinalized({ ok: false, err: String(err?.message || err).slice(0, 80) });
        this.err("[WCR] onFinalized threw:", err);
      }
    }

    // Salvage marker: the recording survived only via a recovery workaround
    // (synthesized frames, stall rebuild, encoder fallback, partial finalize).
    // The review prompt reads this to skip asking after a rough recording.
    try {
      const hadContent = this._firstChunkSeen && this.frameCount > 0;
      let salvageReason = null;
      if (hadContent) {
        if (this._finalizeOnFatalRan || this._finalizingFromFatal) {
          salvageReason = "finalize-on-fatal";
        } else if (this.muxer && !muxerFinalizeOk && !this._failureReported) {
          salvageReason = "partial-finalize";
        } else if (this._syntheticFirstFrameCount > 0) {
          salvageReason = "no-first-frame-recovery";
        } else if (this._midStreamStallRebuilds > 0) {
          salvageReason = "midstream-stall-recovery";
        } else if (this._didSwRetry) {
          salvageReason = "encoder-fallback";
        }
      }
      if (
        salvageReason &&
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        chrome.storage.local.set({
          lastRecordingSalvaged: { at: Date.now(), reason: salvageReason },
        });
      }
    } catch {
      // best effort
    }

    perfMark("WCR.stop.exit");
    // Await cleanup so reader-drain completes before onStop. Bounded by the
    // 500ms per-reader cancel timeout, so it can't block stop() pathologically.
    await this.cleanup();

    if (this.options.onStop) {
      await this.options.onStop();
    }

    this._stopping = false;
  }

  // cleanup() nulls _videoStartUs, so this reads null once it has run. The
  // finalize-time capture in WebCodecsTrackRecorder lands before that.
  _effectiveOutputFps() {
    if (this._videoStartUs == null || !(this.frameCount > 0)) return null;
    let pausedUs = this.totalPausedDurationUs || 0;
    if (this.paused && this.pauseStartUs != null) {
      pausedUs += performance.now() * 1000 - this.pauseStartUs;
    }
    const elapsedUs = performance.now() * 1000 - this._videoStartUs - pausedUs;
    if (!(elapsedUs > 0)) return null;
    return Math.round((this.frameCount / (elapsedUs / 1e6)) * 100) / 100;
  }

  // Readable at any time: stop() early-returns once the recorder isn't
  // running, so onFinalized is missing on exactly the sessions worth
  // explaining (zero-frame exit, spent stall budget, failed start).
  getEncodeStats() {
    return {
      peakEncodeQueueVideo: this._peakVideoEncodeQueueSize ?? null,
      peakEncodeQueueAudio: this._peakAudioEncodeQueueSize ?? null,
      droppedForBackpressureVideo: this._droppedForBackpressureCount ?? null,
      droppedForBackpressureAudio:
        this._droppedAudioForBackpressureCount ?? null,
      // Steady-state catch-up silence after upstream AudioData loss.
      // Nonzero = this recording would have drifted without reconciliation.
      injectedCatchUpSilenceMs: Math.round(
        (this._injectedCatchUpSilenceUs || 0) / 1000,
      ),
      injectedCatchUpSilenceEvents: this._injectedCatchUpSilenceEvents ?? 0,
      // First 10s only. 0-150ms of settle jank is normal on healthy
      // sessions, so it stays out of the alarm signal above.
      injectedCatchUpSettleMs: Math.round(
        (this._injectedCatchUpSettleUs || 0) / 1000,
      ),
      // Submissions to encode(), not muxer output (that's chunksOut).
      framesEncoded: this.frameCount ?? null,
      // framesEncoded over elapsed capture time, pause excluded so a paused
      // session doesn't read as a slow encoder.
      effectiveOutputFps: this._effectiveOutputFps(),
      chunksOut: this._chunksOut ?? null,
      steadyQueueCap: this._encoderMaxQueueSize ?? null,
      // Drops inside the startup window were judged against this, not the
      // steady cap; without it droppedForBackpressureVideo can't be read.
      startupQueueCap: this._startupMaxQueueSize ?? null,
      startupBufferEngaged: this._startupBufferEngaged ?? null,
      framesBufferedAtStart: this._framesBufferedAtStart ?? null,
      adoptedWarmEncoder: this._adoptedPrewarmEncoder === true,
    };
  }

  // Audio mirror of screenDiag's framesFed/framesFromMSTP. audioLagMs is signed
  // vs the first-packet epoch: growing positive = drift bug, negative = benign.
  getAudioDiag() {
    if (
      !this.audioTrack &&
      this._audioDataReceived === 0 &&
      this._audioDataEncoded === 0
    ) {
      return null;
    }
    let lagMs = null;
    if (this.running && this._audioClockAnchorInitialUs != null) {
      let pausedUs = this.totalPausedDurationUs || 0;
      if (this.paused && this.pauseStartUs != null) {
        pausedUs += performance.now() * 1000 - this.pauseStartUs;
      }
      lagMs = Math.round(
        (performance.now() * 1000 -
          pausedUs -
          this._audioClockAnchorInitialUs -
          this._audioWrittenUs()) /
          1000,
      );
    } else if (this._lastAudioLagUs != null) {
      lagMs = Math.round(this._lastAudioLagUs / 1000);
    }
    return {
      audioDataReceived: this._audioDataReceived,
      audioDataEncoded: this._audioDataEncoded,
      // Real delivered audio only (no pads, no catch-up silence). Against
      // audioCtxTimeMs it places loss before or after the mix bus.
      audioReceivedMs: Math.round(this._audioReceivedUs / 1000),
      audioWrittenMs: Math.round(this._audioWrittenUs() / 1000),
      audioLagMs: lagMs,
      paddedSilenceCount: this._paddedSilenceCount,
      droppedAudioForBackpressure: this._droppedAudioForBackpressureCount,
    };
  }

  // Chrome's frame counts for this track. Missing in some builds, so absent
  // reads as null, not zero.
  _readTrackStats() {
    try {
      const st = this.videoTrack?.stats;
      if (!st) return null;
      const num = (v) => (Number.isFinite(v) ? v : null);
      return {
        totalFrames: num(st.totalFrames),
        deliveredFrames: num(st.deliveredFrames),
        discardedFrames: num(st.discardedFrames),
      };
    } catch {
      return null;
    }
  }

  getDiagSnapshot() {
    let firstChunkLatencyMs = null;
    if (this._firstChunkAt != null && this._videoStartUs != null) {
      firstChunkLatencyMs = Math.round(
        this._firstChunkAt - this._videoStartUs / 1000,
      );
    }
    return {
      videoCodecString: this.actualVideoCodec || null,
      hardwareAccelerationActual:
        this._activeVideoConfig?.hardwareAcceleration || "no-preference",
      videoCodecConfigsTried: this._videoCodecConfigsTried.slice(0, 8),
      displaySurface: this._displaySurface,
      frameRateRequested: this._frameRateRequested,
      frameRateActual: this._frameRateActual,
      frameWidthActual: this._frameWidthActual,
      frameHeightActual: this._frameHeightActual,
      // What we actually encoded, after the cap and resize canvas; the source
      // dims above are what arrived, these are what any pixel math must use.
      encodeWidth: this.targetWidth ?? null,
      encodeHeight: this.targetHeight ?? null,
      framesFed: this._framesFed,
      chunksOut: this._chunksOut,
      framesFromMSTP: this._framesFromMSTP,
      staticFrameSyntheticCount: this._staticFrameSyntheticCount,
      framesDroppedAheadOfClock: this._framesDroppedAheadOfClock,
      framesSkippedForGap: this._framesSkippedForGap,
      trackStats: this._readTrackStats(),
      firstChunkLatencyMs,
      videoEncoderStateAtStop: this._videoEncoderStateAtStop,
      encoderConstructCount: this._encoderConstructCount,
      lastWebCodecsFailureCode: this._lastFailureCode || null,
    };
  }

  pause() {
    this._pauseResumeChain = this._pauseResumeChain
      .catch(() => {})
      .then(() => this._pauseImpl());
    return this._pauseResumeChain;
  }

  resume() {
    this._pauseResumeChain = this._pauseResumeChain
      .catch(() => {})
      .then(() => this._resumeImpl());
    return this._pauseResumeChain;
  }

  async _pauseImpl() {
    // Bail if stop() landed while we were queued. Closing on a stopped
    // recorder leaks encoder instances.
    if (!this.running || this._stopping || this.paused) return;
    this.paused = true;
    this.pauseStartUs = performance.now() * 1000;

    // Drop in-flight reads: the loop short-circuits while paused, so one
    // pending from before would deliver a stale frame on resume.
    const staleVideoRead = this._pendingVideoRead;
    const staleAudioRead = this._pendingAudioRead;
    this._pendingVideoRead = null;
    this._pendingAudioRead = null;
    for (const stale of [staleVideoRead, staleAudioRead]) {
      if (!stale) continue;
      stale
        .then((r) => {
          try {
            r?.value?.close?.();
          } catch {}
        })
        .catch(() => {});
    }

    // Release the HW slot up front so long pauses don't burn the
    // reclaim cap. Chrome reclaims at ~60s, w3c/webcodecs#363.
    this._encodersClosedForPause = true;
    try {
      this.videoEncoder?.close();
    } catch {}
    try {
      this.audioEncoder?.close();
    } catch {}
  }

  async _resumeImpl() {
    // Same stop-race bail as _pauseImpl.
    if (!this.running || this._stopping || !this.paused) return;

    const nowUs = performance.now() * 1000;
    this.totalPausedDurationUs += nowUs - this.pauseStartUs;

    // Rebuild encoders pause() closed; loop surfaces any failure.
    if (this._encodersClosedForPause) {
      // Clear before rebuild so a fresh reclaim on the new encoder
      // isn't swallowed by the pause guard.
      this._encodersClosedForPause = false;
      if (this._activeVideoConfig) {
        this._rebuildVideoEncoder(this._activeVideoConfig);
      }
      if (this._activeAudioConfig) {
        this._rebuildAudioEncoder(this._activeAudioConfig);
      }
      // Force a keyframe so the decoder doesn't reference pre-pause frames.
      this._forceNextKeyframe = true;
      // The rebuilt encoder is cold and ramps like it did at start, so reopen
      // the grace window. Floored on pause length: without it, a user tapping
      // pause/resume holds the startup cap (and its memory) all session.
      const pausedMs = (nowUs - this.pauseStartUs) / 1000;
      if (pausedMs >= 1000) {
        this._startupWindowClosed = false;
        this._startupCaughtUpRun = 0;
        this._startupFirstFrameAt = null;
        this._startupFramesSeen = 0;
      }
    }

    this.paused = false;
    this.justResumed = true;
    this.muxer?.setPausedOffset(this.totalPausedDurationUs);
    // Reset the mid-stream watchdog's last-chunk timestamp so it doesn't
    // fire on the stale pre-pause value before chunks resume flowing.
    this._lastChunkAt = performance.now();
  }

  async cleanup() {
    this.log("[WCR] cleanup");

    this._clearFirstChunkWatchdog();
    this._clearMidStreamStallWatchdog();
    this._detachVisibilityListener();
    this._detachDeviceChangeListener();

    // Drain readers before closing encoders: releaseLock doesn't cancel the in-flight
    // read, so a frame can hit the encoder after close() (CVE-2026-5890 race). 500ms cap.
    const cancelWithTimeout = async (reader) => {
      if (!reader) return;
      try {
        await Promise.race([
          reader.cancel(),
          new Promise((resolve) => setTimeout(resolve, 500)),
        ]);
      } catch {}
      try { reader.releaseLock(); } catch {}
    };
    await Promise.all([
      cancelWithTimeout(this.videoReader),
      cancelWithTimeout(this.audioReader),
    ]);

    // cancel() settles any hoisted read; close the frame it yields so the last
    // one isn't leaked.
    const drainPendingRead = async (pending) => {
      if (!pending) return;
      try {
        const r = await Promise.race([
          pending,
          new Promise((resolve) => setTimeout(() => resolve(null), 500)),
        ]);
        try {
          r?.value?.close?.();
        } catch {}
      } catch {}
    };
    await Promise.all([
      drainPendingRead(this._pendingVideoRead),
      drainPendingRead(this._pendingAudioRead),
    ]);
    this._pendingVideoRead = null;
    this._pendingAudioRead = null;

    try {
      this.videoEncoder?.close();
    } catch {}
    try {
      this.audioEncoder?.close();
    } catch {}

    // Release pre-encoder-ready AudioData; if encoder init failed,
    // readAudioLoop never drains the buffer and these would leak.
    for (const item of this._prebufferedAudio) {
      try { item.close?.(); } catch {}
    }
    this._prebufferedAudio = [];

    this.videoProcessor = null;
    this.audioProcessor = null;
    this.videoReader = null;
    this.audioReader = null;
    this.videoEncoder = null;
    this.audioEncoder = null;
    this.videoTrack = null;
    this.audioTrack = null;

    this.videoTimestampOffsetUs = null;
    this.videoFallbackStartMs = null;
    this.firstVideoFrame = undefined;
    this.selectedVideoCodec = null;
    this.actualVideoCodec = null;
    this._videoFrameIndex = 0;
    this._videoStartUs = null;
    this._frameDurationUs = null;
    this._lastKeyFrameIndex = 0;
    // Fold before zeroing keeps audioWrittenMs readable post-stop. The nulled
    // anchor below makes getAudioDiag fall back to the last in-loop lag.
    this._audioTimeBaseUs = this._audioWrittenUs();
    this.audioSamplesWritten = 0;
    this.audioSampleRate = null;
    this.audioChannelCount = null;
    this._firstAudioFrameSampleRate = null;
    this._audioStampRate = null;
    this._audioClockAnchorUs = null;
    this._audioClockAnchorInitialUs = null;
    this._audioDriftWindowStartUs = null;
    this._audioDriftWindowMinUs = Infinity;

    this.resizeCanvas = null;
    this.resizeCtx = null;
    this._startPromise = null;
    this._startResolve = null;
    this._firstChunkSeen = false;
    this._videoLoopError = null;
    this._lastChunkAt = null;
    this._lastFailureCode = null;

    this._videoLoopPromise = null;
    this._audioLoopPromise = null;
  }

  // Fire onError exactly once for a detected recorder failure. The
  // zero-frame loop exit and the first-chunk watchdog can both race to
  // report the same stall; the guard keeps the caller's swap handler
  // from running twice.
  _reportFailure(code, originalError) {
    if (this._failureReported) return;
    this._failureReported = true;
    const err =
      originalError instanceof Error
        ? originalError
        : new Error(String(originalError || code));
    if (!err.code) err.code = code;
    this._lastFailureCode = err.code;
    // Diagnostic detail (no PII): distinguishes an encoder that was fed
    // frames but emitted nothing (firstChunkSeen false, framesEncoded > 0)
    // from a capture track that delivered no frames at all
    // (framesEncoded 0). This is the signal that pins encoder vs track.
    if (!err.detail) {
      err.detail = {
        framesEncoded: this.frameCount,
        firstChunkSeen: this._firstChunkSeen,
        // Real frames read off the track vs black placeholders synthesized to
        // bridge static-screen first-frame starvation. framesFromMSTP === 0
        // pins capture-track starvation (transient) over an encoder defect.
        framesFromMSTP: this._framesFromMSTP,
        syntheticFirstFrameCount: this._syntheticFirstFrameCount,
        droppedForBackpressure: {
          video: this._droppedForBackpressureCount,
          audio: this._droppedAudioForBackpressureCount,
        },
        peakEncodeQueueSize: {
          video: this._peakVideoEncodeQueueSize,
          audio: this._peakAudioEncodeQueueSize,
        },
        startupBuffer: {
          engaged: this._startupBufferEngaged,
          framesBuffered: this._framesBufferedAtStart,
          adoptedWarmEncoder: this._adoptedPrewarmEncoder === true,
        },
        flushMs: {
          video: this._videoFlushMs ?? null,
          audio: this._audioFlushMs ?? null,
        },
        swRetry: this._didSwRetry
          ? { reason: this._swRetryReason || null }
          : null,
        videoLoopError: this._videoLoopError
          ? String(this._videoLoopError?.message || this._videoLoopError)
          : null,
        // Visibility transitions during the recording. Reclaim errors
        // Failures often correlate with the tab being backgrounded.
        visibility: {
          changes: this._visibilityChangeCount,
          lastChangeAt: this._lastVisibilityChangeAt,
          lastState: this._lastVisibilityState,
          stateNow:
            typeof document !== "undefined" ? document.visibilityState : null,
        },
        reclaims: {
          video: this._encoderReclaimCount,
          audio: this._audioEncoderReclaimCount,
        },
        deviceChanges: this._deviceChangeCount || 0,
      };
    }
    // breadcrumb at the failure instant; onError alone doesn't land in the
    // diag session log.
    diagForward("recorder-webcodecs-failure", {
      code: err.code || code || null,
      framesEncoded: this.frameCount,
      firstChunkSeen: this._firstChunkSeen,
      swRetry: this._didSwRetry ? this._swRetryReason || true : false,
      reclaims: this._encoderReclaimCount + this._audioEncoderReclaimCount,
      visibilityChanges: this._visibilityChangeCount,
    });
    try {
      this.options.onError?.(err);
    } catch (cbErr) {
      this.err("[WCR] onError callback threw:", cbErr);
    }
  }

  _attachVisibilityListener() {
    if (typeof document === "undefined" || this._visibilityChangeListener) {
      return;
    }
    this._visibilityChangeListener = () => {
      this._visibilityChangeCount += 1;
      this._lastVisibilityChangeAt = Date.now();
      this._lastVisibilityState = document.visibilityState;
      this.log("[WCR] visibilitychange", {
        state: document.visibilityState,
        count: this._visibilityChangeCount,
      });
      // tab came back to focus before we saw a first chunk; reset the
      // watchdog so the encoder gets a fresh full window post-throttle.
      if (
        document.visibilityState === "visible" &&
        this.running &&
        !this._stopping &&
        !this._firstChunkSeen
      ) {
        // back in the foreground, so throttling no longer explains the silence
        this._hiddenRearmCount = 0;
        this._armFirstChunkWatchdog();
      }
    };
    try {
      document.addEventListener(
        "visibilitychange",
        this._visibilityChangeListener,
      );
    } catch {
      this._visibilityChangeListener = null;
    }
  }

  _detachVisibilityListener() {
    if (typeof document === "undefined" || !this._visibilityChangeListener) {
      return;
    }
    try {
      document.removeEventListener(
        "visibilitychange",
        this._visibilityChangeListener,
      );
    } catch {}
    this._visibilityChangeListener = null;
  }

  _attachDeviceChangeListener() {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.addEventListener !== "function" ||
      this._deviceChangeListener
    ) {
      return;
    }
    this._deviceChangeListener = () => {
      this._deviceChangeCount += 1;
      this._lastDeviceChangeAt = Date.now();
      // Diag-only flag; audio loop checks per-frame.
      this._audioDeviceChangePending = true;
      this.log("[WCR] devicechange", { count: this._deviceChangeCount });
    };
    try {
      navigator.mediaDevices.addEventListener(
        "devicechange",
        this._deviceChangeListener,
      );
    } catch {
      this._deviceChangeListener = null;
    }
  }

  _detachDeviceChangeListener() {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !this._deviceChangeListener
    ) {
      return;
    }
    try {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        this._deviceChangeListener,
      );
    } catch {}
    this._deviceChangeListener = null;
  }

  _armFirstChunkWatchdog() {
    this._clearFirstChunkWatchdog();
    if (this._firstChunkSeen) return;
    this._firstChunkWatchdog = setTimeout(() => {
      this._firstChunkWatchdog = null;
      if (!this.running || this._stopping || this._firstChunkSeen) return;
      // tab is hidden so the encoder may be throttled; re-arm and let the
      // visibilitychange handler restart the clock on return. Bounded: the
      // region recorder is an injected iframe that stays hidden for the whole
      // recording, so an unbounded re-arm never fires. Resets on visible.
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden" &&
        this._hiddenRearmCount < this._maxHiddenRearms
      ) {
        this._hiddenRearmCount += 1;
        this.warn("[WCR] first-chunk watchdog re-armed while hidden", {
          attempt: this._hiddenRearmCount,
          max: this._maxHiddenRearms,
          frameCount: this.frameCount,
        });
        this._armFirstChunkWatchdog();
        return;
      }
      // HW encoder can configure() fine yet emit no chunk: screen+camera both on
      // HW WebCodecs contend for macOS VideoToolbox sessions, yielding a 28-byte
      // ftyp-only file. Nothing throws, so rebuild prefer-software once first.
      const cfg = this._activeVideoConfig;
      const isHwConfig =
        cfg &&
        (cfg.hardwareAcceleration === "prefer-hardware" ||
          !cfg.hardwareAcceleration);
      if (
        this.running &&
        !this._stopping &&
        isHwConfig &&
        !this._didSwRetry &&
        this._encoderReclaimCount < this._maxEncoderReclaims
      ) {
        this._encoderReclaimCount += 1;
        this.warn(
          "[WCR] no first chunk on hardware encoder; rebuilding prefer-software",
          { withinMs: this._firstChunkWatchdogMs, attempt: this._encoderReclaimCount },
        );
        try {
          diagForward("recorder-no-first-chunk-sw-rebuild", {
            withinMs: this._firstChunkWatchdogMs,
            attempt: this._encoderReclaimCount,
          });
        } catch {}
        const swConfig = {
          ...cfg,
          hardwareAcceleration: "prefer-software",
        };
        if (this._rebuildVideoEncoder(swConfig)) {
          this._didSwRetry = true;
          this._swRetryReason = this._swRetryReason || "no-first-chunk";
          this._forceNextKeyframe = true;
          this._armFirstChunkWatchdog();
          return;
        }
      }
      this.warn(
        `[WCR] no encoded video chunk within ${this._firstChunkWatchdogMs}ms`,
      );
      this._reportFailure(
        "webcodecs-no-first-chunk",
        new Error(
          `WebCodecs produced no encoded video within ${this._firstChunkWatchdogMs}ms`,
        ),
      );
    }, this._firstChunkWatchdogMs);
  }

  _clearFirstChunkWatchdog() {
    if (this._firstChunkWatchdog) {
      clearTimeout(this._firstChunkWatchdog);
      this._firstChunkWatchdog = null;
    }
  }

  // Mid-stream stall watchdog. On a silent stall (no error) rebuild the
  // encoder in-session (prefer-software); give up only when budget runs out.
  _armMidStreamStallWatchdog() {
    this._clearMidStreamStallWatchdog();
    this._lastChunkAt = performance.now();
    const tickMs = Math.max(2000, Math.floor(this._midStreamWatchdogMs / 3));
    this._midStreamWatchdog = setInterval(() => {
      if (
        !this.running ||
        this._stopping ||
        this.paused ||
        this._failureReported ||
        this._lastChunkAt == null
      ) {
        return;
      }
      const sinceLastChunkMs = performance.now() - this._lastChunkAt;
      if (sinceLastChunkMs > this._midStreamWatchdogMs) {
        this.warn(
          `[WCR] no encoded video chunk for ${Math.round(sinceLastChunkMs)}ms mid-recording`,
        );
        // Silent stall fires no error, so the error-driven rebuild never runs.
        // Rebuild here (prefer-software) and keep recording. Shares the budget.
        if (
          this.running &&
          !this._stopping &&
          this._activeVideoConfig &&
          this._encoderReclaimCount < this._maxEncoderReclaims
        ) {
          this._encoderReclaimCount += 1;
          this._midStreamStallRebuilds += 1;
          this._lastVideoReclaimAt = performance.now();
          this._lastVideoReclaimRebuildAt = performance.now();
          this.warn("[WCR] mid-stream stall; rebuilding encoder prefer-software", {
            attempt: this._encoderReclaimCount,
          });
          try {
            diagForward("recorder-midstream-stall-rebuild", {
              sinceLastChunkMs: Math.round(sinceLastChunkMs),
              attempt: this._encoderReclaimCount,
            });
          } catch {}
          const swConfig = {
            ...this._activeVideoConfig,
            hardwareAcceleration: "prefer-software",
          };
          if (this._rebuildVideoEncoder(swConfig)) {
            this._didSwRetry = true;
            this._swRetryReason = this._swRetryReason || "midstream-stall";
            this._forceNextKeyframe = true;
            this._lastChunkAt = performance.now();
            return;
          }
        }
        this._reportFailure(
          "webcodecs-mid-stream-stall",
          new Error(
            `WebCodecs produced no chunks for ${Math.round(sinceLastChunkMs)}ms after frame ${this.frameCount}`,
          ),
        );
        // Budget exhausted or rebuild failed: exit the run-loop so the normal
        // finalize path packages whatever was encoded into a playable file.
        this.running = false;
        this._clearMidStreamStallWatchdog();
      }
    }, tickMs);
  }

  _clearMidStreamStallWatchdog() {
    if (this._midStreamWatchdog) {
      clearInterval(this._midStreamWatchdog);
      this._midStreamWatchdog = null;
    }
  }

  async initVideoEncoder(config, codecLabel) {
    this.log("[WCR] initVideoEncoder()", codecLabel);

    // H.264 needs even dimensions; defend at the encoder boundary in
    // case a caller skips the normalization.
    if (typeof config?.width === "number" && config.width % 2 !== 0) {
      this.warn("[WCR] forcing video width to even", {
        from: config.width,
        to: config.width - 1,
      });
      config = { ...config, width: config.width - 1 };
    }
    if (typeof config?.height === "number" && config.height % 2 !== 0) {
      this.warn("[WCR] forcing video height to even", {
        from: config.height,
        to: config.height - 1,
      });
      config = { ...config, height: config.height - 1 };
    }

    // Extract output/error callbacks so the prefer-software retry below
    // can rebuild the VideoEncoder with the same handlers.
    const videoEncoderOutput = (chunk, meta) => {
        // An adopted encoder already emitted its decoderConfig to the prewarm's
        // discard sink, and Chrome only re-emits when the reported config
        // changes. Without a replay of the one captured at warmup the muxer
        // throws ("must include a decoder configuration") on a header-only file.
        if (!meta?.decoderConfig && this._adoptedDecoderConfig) {
          meta = { ...(meta || {}), decoderConfig: this._adoptedDecoderConfig };
        }
        // E2E hook: drop the first N chunks to drive the no-first-chunk
        // watchdog in tests.
        const _g = /** @type {any} */ (globalThis);
        if (
          typeof _g.__screenitySuppressFirstChunks === "number" &&
          _g.__screenitySuppressFirstChunks > 0
        ) {
          _g.__screenitySuppressFirstChunks -= 1;
          return;
        }
        // E2E hook: drop chunks mid-stream (after the first) to simulate a
        // silent encoder stall and drive the mid-stream rebuild path.
        if (_g.__screenitySuppressChunks === true && this._firstChunkSeen) {
          return;
        }
        // First encoded video chunk: the recording is producing real
        // bytes, so disarm the no-first-chunk watchdog and arm the
        // mid-stream stall watchdog instead.
        this._chunksOut += 1;
        if (!this._firstChunkSeen) {
          this._firstChunkSeen = true;
          this._firstChunkAt = performance.now();
          this._clearFirstChunkWatchdog();
          this._armMidStreamStallWatchdog();
        }
        // Refresh the mid-stream watchdog's timestamp on every chunk so
        // it only fires when output genuinely stops.
        this._lastChunkAt = performance.now();
        // Reset the reclaim counter after a healthy stretch.
        if (
          shouldResetReclaimCounter(
            this._lastChunkAt,
            this._lastVideoReclaimAt,
            this._reclaimResetAfterMs,
            this._encoderReclaimCount,
          )
        ) {
          this._encoderReclaimCount = 0;
          this._lastVideoReclaimAt = null;
        }
        // decoderConfig.codec can overstate level vs SPS; parse from
        // avcC ([1]=profile, [2]=compat, [3]=level) when possible.
        if (!this.actualVideoCodec) {
          const desc = meta?.decoderConfig?.description;
          const reported = meta?.decoderConfig?.codec;
          let parsed = null;
          if (desc instanceof Uint8Array || desc instanceof ArrayBuffer) {
            const view = new Uint8Array(
              desc instanceof ArrayBuffer ? desc : desc.buffer,
              desc instanceof ArrayBuffer ? 0 : desc.byteOffset,
              desc instanceof ArrayBuffer ? desc.byteLength : desc.byteLength,
            );
            if (view[0] === 1 && view.length >= 4) {
              const hex = (n) => n.toString(16).padStart(2, "0").toUpperCase();
              parsed = `avc1.${hex(view[1])}${hex(view[2])}${hex(view[3])}`;
            }
          }
          if (parsed) {
            this.actualVideoCodec = parsed;
          } else if (typeof reported === "string" && reported.length > 0) {
            this.actualVideoCodec = reported;
          }
        }

        // Chrome WebCodecs bug: AVCDecoderConfigurationRecord can have
        // bit 0/1 set in constraint_set_flags, which some decoders
        // reject. Zero the byte in place (AVC only).
        // ref: github.com/WebAV-Tech/WebAV/issues/203
        const codecForFix = this.actualVideoCodec || meta?.decoderConfig?.codec;
        const descForFix = meta?.decoderConfig?.description;
        if (
          descForFix &&
          typeof codecForFix === "string" &&
          codecForFix.startsWith("avc")
        ) {
          const u8 = descForFix instanceof Uint8Array
            ? descForFix
            : new Uint8Array(
                descForFix instanceof ArrayBuffer
                  ? descForFix
                  : descForFix.buffer,
                descForFix instanceof ArrayBuffer ? 0 : descForFix.byteOffset,
                descForFix.byteLength,
              );
          if (u8.length >= 3 && (u8[2] & 0x03) !== 0) {
            u8[2] = 0;
          }
        }

        // Surface the decoder config once. Persisting it alongside
        // OPFS chunks unlocks chunks-only recovery when the muxer
        // never finalizes (tab killed mid-recording).
        if (
          !this._decoderConfigEmitted &&
          typeof this.options.onDecoderConfig === "function"
        ) {
          const desc = meta?.decoderConfig?.description;
          const codec = this.actualVideoCodec || meta?.decoderConfig?.codec;
          if (desc && codec) {
            this._decoderConfigEmitted = true;
            try {
              this.options.onDecoderConfig({
                description: desc,
                codec,
                container: this.containerKind,
                width: this.targetWidth,
                height: this.targetHeight,
              });
            } catch (cbErr) {
              this.warn("[WCR] onDecoderConfig callback threw:", cbErr);
            }
          }
        }

        this.muxer.addVideoChunk(chunk, meta);
    };
    const videoEncoderError = (err) => {
      this._handleVideoEncoderError(err);
    };
    this._videoEncoderOutputHandler = videoEncoderOutput;
    // Raw handler kept for the test hook and per-instance rebuild.
    this._videoEncoderErrorHandler = videoEncoderError;
    this._activeVideoCodecLabel = codecLabel;

    // E2E hook: fire a synthetic reclaim error so tests can drive the
    // recovery + finalize-on-fatal paths without the 60s real timer.
    if (typeof globalThis !== "undefined") {
      const g = /** @type {any} */ (globalThis);
      g.__screenityFireVideoEncoderError = (customMsg) => {
        const synthetic = new Error(
          customMsg || "Codec reclaimed due to inactivity",
        );
        synthetic.name = "QuotaExceededError";
        try {
          videoEncoderError(synthetic);
        } catch (e) {
          this.err("[WCR] __screenityFireVideoEncoderError threw:", e);
          return false;
        }
        return true;
      };
      g.__screenityGetReclaimSnapshot = () => ({
        video: this._encoderReclaimCount,
        audio: this._audioEncoderReclaimCount,
        firstChunkSeen: this._firstChunkSeen,
        encodersClosedForPause: this._encodersClosedForPause,
        running: this.running,
        paused: this.paused,
        stopping: this._stopping,
        audioSampleRate: this.audioSampleRate,
        audioSampleRateMismatchRebuilds:
          this._audioSampleRateMismatchRebuilds,
        audioDeviceChangePending: this._audioDeviceChangePending,
        postSleepRecoveries: this._postSleepRecoveries,
        midStreamStallRebuilds: this._midStreamStallRebuilds,
        firstChunkWatchdogMs: this._firstChunkWatchdogMs,
        maxEncoderReclaims: this._maxEncoderReclaims,
        reclaimRebuildThrottleMs: this._reclaimRebuildThrottleMs,
        targetWidth: this.targetWidth,
        targetHeight: this.targetHeight,
        actualWidth: this.actualWidth,
        actualHeight: this.actualHeight,
        audioRebuildUnsupportedRates: this._audioRebuildUnsupportedRates
          ? Array.from(this._audioRebuildUnsupportedRates)
          : [],
      });
    }
    // Adopt-or-create: a prewarmed encoder has already paid the session ramp
    // that costs the opening frames, so take it over instead of opening a cold
    // one. A claim that can't hand it over disposes it, freeing the HW slot.
    let adopted = null;
    try {
      // Adoption skips the configure() path below, so tests forcing a
      // configure failure there need a fresh encoder.
      const gHooks = /** @type {any} */ (globalThis);
      const forcedConfigureTest =
        gHooks.__screenityForceConfigureHwQuotaError === true ||
        gHooks.__screenityForceConfigureSwQuotaError === true;
      // Guarded like _rebuildVideoEncoder's replacement: once this encoder
      // isn't the active one (rebuild, pause, stop) its late errors must not
      // burn the reclaim budget or fail a healthy recording.
      const adoptedErrorHandler = (err) => {
        if (this.videoEncoder !== adopted?.encoder) return;
        videoEncoderError(err);
      };
      adopted = claimPrewarmedEncoder(config, videoEncoderOutput, adoptedErrorHandler, {
        allowAdopt: this.options.allowPrewarmAdopt !== false && !forcedConfigureTest,
        preferSoftware: this.options.preferSoftware === true,
      });
    } catch (adoptErr) {
      this.warn("[WCR] prewarm adopt threw; using a fresh encoder", adoptErr);
      adopted = null;
    }
    if (adopted?.encoder) {
      this.videoEncoder = adopted.encoder;
      this._adoptedPrewarmEncoder = true;
      this._adoptedDecoderConfig = adopted.decoderConfigFallback || null;
      this._activeVideoConfig = config;
      // configure() always runs at adoption; the flag says whether the config
      // differed, not whether a reconfigure happened.
      this.log("[WCR] adopted prewarmed VideoEncoder", {
        configChanged: adopted.reconfigured,
        codec: codecLabel,
      });
      perfMark("WCR.videoEncoder.adopted", {
        configChanged: adopted.reconfigured,
      });
      return;
    }

    this.videoEncoder = new VideoEncoder({
      output: videoEncoderOutput,
      error: videoEncoderError,
    });
    this._encoderConstructCount += 1;

    // configure() can throw sync. retry hardware→software on quota/contention
    // (Teams/Zoom, NVIDIA 3-encoder cap); if SW also contends, cooldown and
    // retry HW once (slot releases in a sec or two). HW → SW → cooldown → HW.
    const tryConfigureWith = (cfg) => {
      // E2E hook: force one HW configure() to throw QuotaExceededError so
      // tests can exercise the prefer-software retry path. One-shot.
      const hwPref =
        cfg.hardwareAcceleration === "prefer-hardware" ||
        !cfg.hardwareAcceleration;
      const swPref = cfg.hardwareAcceleration === "prefer-software";
      const g = /** @type {any} */ (globalThis);
      if (
        hwPref &&
        g.__screenityForceConfigureHwQuotaError &&
        !g.__screenityForceConfigureHwQuotaError_fired
      ) {
        g.__screenityForceConfigureHwQuotaError_fired = true;
        const forced = new Error(
          "Forced HW configure quota error for testing",
        );
        forced.name = "QuotaExceededError";
        throw forced;
      }
      // Companion E2E hook so a test can simulate "both HW and SW are
      // contended" and exercise the cooldown retry path.
      if (
        swPref &&
        g.__screenityForceConfigureSwQuotaError &&
        !g.__screenityForceConfigureSwQuotaError_fired
      ) {
        g.__screenityForceConfigureSwQuotaError_fired = true;
        const forced = new Error(
          "Forced SW configure quota error for testing",
        );
        forced.name = "QuotaExceededError";
        throw forced;
      }
      this.videoEncoder.configure(cfg);
    };
    const rebuildEncoder = () => {
      try {
        this.videoEncoder.close();
      } catch {}
      this.videoEncoder = new VideoEncoder({
        output: videoEncoderOutput,
        error: videoEncoderError,
      });
      this._encoderConstructCount += 1;
    };
    const isContention = (err) => {
      const msg = String(err?.message || err || "");
      return (
        err?.name === "QuotaExceededError" ||
        /quota|too many|in use|already|reclaimed/i.test(msg)
      );
    };
    const buildBusyError = (cause, codecLabel) => {
      // the raw DOMException ("Codec reclaimed due to inactivity") is opaque;
      // give a user-facing message. errorCodes.js still maps to REC_START_CODEC.
      const tagged = new Error(
        "Another app appears to be using the video encoder. Close apps like Zoom, Teams or OBS and try again.",
      );
      tagged.cause = cause;
      tagged.codec = codecLabel;
      tagged.code = "video-encoder-busy";
      tagged.swRetryReason = this._swRetryReason || null;
      tagged.cooldownRetried = Boolean(this._didCooldownRetry);
      return tagged;
    };
    try {
      tryConfigureWith(config);
    } catch (err) {
      const isHwPreferred =
        config.hardwareAcceleration === "prefer-hardware" ||
        !config.hardwareAcceleration;
      const errMsg = String(err?.message || err || "");
      const isContentionError = isContention(err);
      if (isHwPreferred && !this._didSwRetry) {
        this._didSwRetry = true;
        this._swRetryReason = isContentionError
          ? "encoder-quota"
          : "configure-failed";
        this.warn(
          "[WCR] HW VideoEncoder.configure failed, retrying prefer-software",
          { reason: this._swRetryReason, codec: codecLabel, message: errMsg },
        );
        rebuildEncoder();
        const swConfig = { ...config, hardwareAcceleration: "prefer-software" };
        try {
          tryConfigureWith(swConfig);
          this.log("[WCR] VideoEncoder configured (prefer-software fallback)");
          this._activeVideoConfig = swConfig;
          return;
        } catch (swErr) {
          // both HW and SW threw contention: the OS slot is likely held
          // transiently, so one pause + retry recovers on the Windows traces.
          if (
            isContention(swErr) &&
            isContentionError &&
            !this._didCooldownRetry
          ) {
            this._didCooldownRetry = true;
            const cooldownMs = Number.isFinite(
              this.options.encoderConfigureCooldownMs,
            )
              ? this.options.encoderConfigureCooldownMs
              : 1500;
            this.warn(
              "[WCR] both HW and SW configure threw contention; cooling down before retry",
              {
                codec: codecLabel,
                cooldownMs,
                hwMessage: errMsg,
                swMessage: String(swErr?.message || swErr || ""),
              },
            );
            await new Promise((r) => setTimeout(r, cooldownMs));
            rebuildEncoder();
            try {
              tryConfigureWith(config);
              this.log(
                "[WCR] VideoEncoder configured after cooldown retry",
                { codec: codecLabel },
              );
              this._activeVideoConfig = config;
              return;
            } catch (retryErr) {
              this.warn(
                "[WCR] cooldown HW retry failed; trying SW once more",
                {
                  codec: codecLabel,
                  message: String(retryErr?.message || retryErr || ""),
                },
              );
              rebuildEncoder();
              try {
                tryConfigureWith(swConfig);
                this.log(
                  "[WCR] VideoEncoder configured (SW after cooldown)",
                  { codec: codecLabel },
                );
                this._activeVideoConfig = swConfig;
                return;
              } catch (finalErr) {
                throw buildBusyError(finalErr, codecLabel);
              }
            }
          }
          const tagged = new Error(
            `VideoEncoder.configure failed for ${codecLabel} on both HW and SW: ${swErr?.message || swErr}`,
          );
          tagged.cause = swErr;
          tagged.codec = codecLabel;
          tagged.code = "video-encoder-configure-failed";
          tagged.swRetryReason = this._swRetryReason;
          throw tagged;
        }
      }
      const tagged = new Error(
        `VideoEncoder.configure failed for ${codecLabel}: ${errMsg}`,
      );
      tagged.cause = err;
      tagged.codec = codecLabel;
      tagged.code = "video-encoder-configure-failed";
      throw tagged;
    }
    this._activeVideoConfig = config;
    this.log("[WCR] VideoEncoder configured");
  }

  async initAudioEncoder(config) {
    if (!config) return;

    const audioEncoderOutput = (chunk, meta) => {
      if (this.debug) this.log("[WCR] AUDIO");
      // Chrome occasionally emits AAC chunks with a broken
      // AudioSpecificConfig (under 2 bytes or audioObjectType=0).
      // Synthesize a correct 2-byte ASC when invalid.
      const fixed = this._maybeFixAacDescription(meta);
      this.muxer.addAudioChunk(chunk, fixed || meta);
      // Reset audio reclaim counter after a healthy stretch.
      if (
        shouldResetReclaimCounter(
          performance.now(),
          this._lastAudioReclaimAt,
          this._reclaimResetAfterMs,
          this._audioEncoderReclaimCount,
        )
      ) {
        this._audioEncoderReclaimCount = 0;
        this._lastAudioReclaimAt = null;
      }
    };
    const audioEncoderError = (err) => {
      this._handleAudioEncoderError(err);
    };
    this._audioEncoderOutputHandler = audioEncoderOutput;
    this._audioEncoderErrorHandler = audioEncoderError;
    this.audioEncoder = new AudioEncoder({
      output: audioEncoderOutput,
      error: audioEncoderError,
    });

    try {
      this.audioEncoder.configure(config);
    } catch (err) {
      const tagged = new Error(
        `AudioEncoder.configure failed: ${err?.message || err}`,
      );
      tagged.cause = err;
      tagged.code = "audio-encoder-configure-failed";
      throw tagged;
    }
    this._activeAudioConfig = config;
  }

  // Patch AAC meta when description is missing/short/audioObjectType=0.
  // Returns null when no fix is needed. First-chunk only in practice.
  _maybeFixAacDescription(meta) {
    const dc = meta?.decoderConfig;
    if (!dc) return null;
    const codec = dc.codec || this._activeAudioConfig?.codec || "";
    if (typeof codec !== "string" || !/^mp4a\.40\./.test(codec)) return null;
    const desc = dc.description;
    let invalid = false;
    let u8 = null;
    if (!desc) {
      invalid = true;
    } else {
      u8 =
        desc instanceof Uint8Array
          ? desc
          : new Uint8Array(
              desc instanceof ArrayBuffer ? desc : desc.buffer,
              desc instanceof ArrayBuffer ? 0 : desc.byteOffset,
              desc.byteLength,
            );
      if (u8.byteLength < 2) {
        invalid = true;
      } else {
        const objectType = (u8[0] >> 3) & 0x1f;
        if (objectType === 0) invalid = true;
      }
    }
    if (!invalid) return null;

    const objectTypeFromCodec = Number(codec.split(".")[2]);
    const sampleRate =
      dc.sampleRate ||
      this._activeAudioConfig?.sampleRate ||
      this.audioSampleRate ||
      48000;
    const channels =
      dc.numberOfChannels ||
      this._activeAudioConfig?.numberOfChannels ||
      this.audioChannelCount ||
      2;
    const synthesized = this._synthesizeAacDescription(
      Number.isFinite(objectTypeFromCodec) && objectTypeFromCodec > 0
        ? objectTypeFromCodec
        : 2,
      sampleRate,
      channels,
    );
    this.warn("[WCR] rewrote invalid AAC AudioSpecificConfig", {
      had: u8 ? Array.from(u8).map((b) => b.toString(16)) : null,
      synthesized: Array.from(synthesized).map((b) => b.toString(16)),
    });
    return { ...meta, decoderConfig: { ...dc, description: synthesized } };
  }

  // Pack an AAC ASC: 5b objectType + 4b sampleRateIdx + 4b channels
  // + 3b pad = 2 bytes. Common case only (objectType < 32, standard
  // sample rates). AAC-LC 48k stereo = [0x11, 0x90].
  _synthesizeAacDescription(objectType, sampleRate, numberOfChannels) {
    const AAC_SAMPLE_RATES = [
      96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000,
      11025, 8000, 7350,
    ];
    let freqIndex = AAC_SAMPLE_RATES.indexOf(sampleRate);
    if (freqIndex === -1) freqIndex = 3; // 48000
    const channelConfig = numberOfChannels === 8 ? 7 : numberOfChannels;
    const byte0 =
      ((objectType & 0x1f) << 3) | ((freqIndex >> 1) & 0x07);
    const byte1 = ((freqIndex & 0x01) << 7) | ((channelConfig & 0x0f) << 3);
    return new Uint8Array([byte0, byte1]);
  }

  // A track never returns from "ended", so latching this is safe.
  _closeMuxerAudio(reason) {
    if (this._muxerAudioClosed) return;
    this._muxerAudioClosed = true;
    this.log("[WCR] closing muxer audio", reason);
    try {
      this.muxer?.closeAudio?.();
    } catch (err) {
      this.warn("[WCR] closeAudio threw", err);
    }
  }

  // Dropped packets otherwise finalize as a valid but empty recording.
  _handleMuxError(err, kind) {
    if (this._muxErrorReported) return;
    this._muxErrorReported = true;
    this.warn("[WCR] muxer add failed", kind, err);
    const wrapped = new Error(
      `muxer ${kind} add failed: ${String(err?.message || err).slice(0, 200)}`,
    );
    wrapped.code = "webcodecs-mux-add-failed";
    wrapped.detail = { kind };
    this.options.onError?.(wrapped);
  }

  // Handle VideoEncoder.error: rebuild on HW reclaim (capped by
  // _maxEncoderReclaims), or one HW→SW rebuild for pre-first-chunk
  // async errors. Otherwise surface to onError.
  _handleVideoEncoderError(err, forceReclaim = false) {
    const msg = String(err?.message || err || "");
    // forceReclaim is set only when encode() routes a non-full-queue
    // QuotaExceededError here (reclaim, not backpressure).
    const isReclaim = forceReclaim || isReclaimErrorMessage(msg);

    // Re-entry guard: stop()'s flush during _finalizeOnFatal can fire
    // a second error from the same encoder.
    if (this._finalizingFromFatal) {
      return;
    }

    // Pause closed the encoder. Swallow the racing reclaim error;
    // resume() rebuilds from _activeVideoConfig.
    if (this._encodersClosedForPause && isReclaim) {
      return;
    }

    const canRecover =
      this.running &&
      !this._stopping &&
      this._activeVideoConfig &&
      this._videoEncoderOutputHandler &&
      this._videoEncoderErrorHandler;

    if (
      isReclaim &&
      canRecover &&
      this._encoderReclaimCount < this._maxEncoderReclaims
    ) {
      // Throttle: while the HW slot is held, encoder.error fires every
      // frame and would burn the cap in ms.
      const nowMs = performance.now();
      if (
        shouldThrottleReclaimRebuild(
          nowMs,
          this._lastVideoReclaimRebuildAt,
          this._reclaimRebuildThrottleMs,
        )
      ) {
        return;
      }
      this._encoderReclaimCount += 1;
      this._lastVideoReclaimAt = nowMs;
      this._lastVideoReclaimRebuildAt = nowMs;
      this.warn("[WCR] VideoEncoder reclaimed, rebuilding", {
        attempt: this._encoderReclaimCount,
        max: this._maxEncoderReclaims,
        codec: this._activeVideoCodecLabel,
        message: msg,
      });
      if (this._rebuildVideoEncoder(this._activeVideoConfig)) {
        this._forceNextKeyframe = true;
        return;
      }
    }

    const preFirstChunk = !this._firstChunkSeen;
    const isHwPreferred =
      this._activeVideoConfig &&
      (this._activeVideoConfig.hardwareAcceleration === "prefer-hardware" ||
        !this._activeVideoConfig.hardwareAcceleration);
    if (preFirstChunk && canRecover && isHwPreferred && !this._didSwRetry) {
      this._didSwRetry = true;
      this._swRetryReason = "encoder-error-pre-first-chunk";
      this.warn(
        "[WCR] VideoEncoder errored before first chunk, retrying prefer-software",
        { codec: this._activeVideoCodecLabel, message: msg },
      );
      const swConfig = {
        ...this._activeVideoConfig,
        hardwareAcceleration: "prefer-software",
      };
      if (this._rebuildVideoEncoder(swConfig)) {
        this._forceNextKeyframe = true;
        return;
      }
    }

    this.err("[WCR] VideoEncoder error:", err);

    // Fatal mid-recording with chunks on disk. Run stop() so the muxer
    // writes moov, then surface the error tagged finalized for salvage.
    if (
      this._firstChunkSeen &&
      this.running &&
      !this._stopping &&
      !this._finalizeOnFatalRan
    ) {
      this._finalizeOnFatalRan = true;
      try {
        err.finalized = true;
      } catch {}
      this._finalizeOnFatal(err);
      return;
    }

    this.options.onError?.(err);
  }

  // Runs stop() then re-fires the original error so the caller takes
  // the salvage branch. Flag blocks re-entry during stop()'s flush.
  async _finalizeOnFatal(originalErr) {
    this._finalizingFromFatal = true;
    try {
      await this.stop();
    } catch (stopErr) {
      this.err("[WCR] _finalizeOnFatal stop() threw:", stopErr);
    }
    try {
      this.options.onError?.(originalErr);
    } catch (cbErr) {
      this.err("[WCR] _finalizeOnFatal onError callback threw:", cbErr);
    }
  }

  // Audio reclaim recovery. Less critical than video (audio glitches are
  // usually preferable to losing the recording) but the same pattern
  // applies; Chrome can reclaim the AudioEncoder slot too. No keyframe
  // concept for audio; rebuild and continue.
  _handleAudioEncoderError(err) {
    // Same reentry guard as the video handler: encoder.flush() during
    // _finalizeOnFatal can fire audio errors too.
    if (this._finalizingFromFatal) {
      return;
    }
    const msg = String(err?.message || err || "");
    const isReclaim = isReclaimErrorMessage(msg);
    if (
      isReclaim &&
      this.running &&
      !this._stopping &&
      this._activeAudioConfig &&
      this._audioEncoderOutputHandler &&
      this._audioEncoderErrorHandler &&
      this._audioEncoderReclaimCount < this._maxEncoderReclaims
    ) {
      const nowMs = performance.now();
      if (
        shouldThrottleReclaimRebuild(
          nowMs,
          this._lastAudioReclaimRebuildAt,
          this._reclaimRebuildThrottleMs,
        )
      ) {
        return;
      }
      this._audioEncoderReclaimCount += 1;
      this._lastAudioReclaimAt = nowMs;
      this._lastAudioReclaimRebuildAt = nowMs;
      this.warn("[WCR] AudioEncoder reclaimed, rebuilding", {
        attempt: this._audioEncoderReclaimCount,
        max: this._maxEncoderReclaims,
        message: msg,
      });
      if (this._rebuildAudioEncoder(this._activeAudioConfig)) {
        return;
      }
    }

    this.err("[WCR] AudioEncoder error:", err);
    this.options.onError?.(err);
  }

  // Fresh construct/configure with the same handlers. Error handler is
  // wrapped per-instance to drop late errors from the closed predecessor.
  _rebuildVideoEncoder(config) {
    try {
      this.videoEncoder?.close();
    } catch {}
    try {
      let nextEncoder = null;
      nextEncoder = new VideoEncoder({
        output: this._videoEncoderOutputHandler,
        error: (err) => {
          if (this.videoEncoder !== nextEncoder) return;
          this._videoEncoderErrorHandler(err);
        },
      });
      this._encoderConstructCount += 1;
      nextEncoder.configure(config);
      this.videoEncoder = nextEncoder;
      this._activeVideoConfig = config;
      return true;
    } catch (rebuildErr) {
      this.err("[WCR] VideoEncoder rebuild failed:", rebuildErr);
      return false;
    }
  }

  _rebuildAudioEncoder(config) {
    // Snapshot the prior config so we can restore it if configure()
    // fails (BT switching to HFP narrowband is the usual cause).
    const priorConfig = this._activeAudioConfig;
    try {
      this.audioEncoder?.close();
    } catch {}
    try {
      let nextEncoder = null;
      nextEncoder = new AudioEncoder({
        output: this._audioEncoderOutputHandler,
        error: (err) => {
          if (this.audioEncoder !== nextEncoder) return;
          this._audioEncoderErrorHandler(err);
        },
      });
      nextEncoder.configure(config);
      this.audioEncoder = nextEncoder;
      this._activeAudioConfig = config;
      return true;
    } catch (rebuildErr) {
      this.err("[WCR] AudioEncoder rebuild failed:", rebuildErr);
      // Restore the prior encoder so audio keeps flowing at the old
      // rate. A small pitch shift beats a dead audio path.
      if (priorConfig) {
        try {
          let restoreEncoder = null;
          restoreEncoder = new AudioEncoder({
            output: this._audioEncoderOutputHandler,
            error: (err) => {
              if (this.audioEncoder !== restoreEncoder) return;
              this._audioEncoderErrorHandler(err);
            },
          });
          restoreEncoder.configure(priorConfig);
          this.audioEncoder = restoreEncoder;
          this._activeAudioConfig = priorConfig;
        } catch (restoreErr) {
          this.err(
            "[WCR] AudioEncoder restore after failed rebuild also failed:",
            restoreErr,
          );
        }
      }
      return false;
    }
  }

  async prepareAudioEncoderConfig() {
    if (!this.audioTrack) return null;

    const settings = this.audioTrack.getSettings();
    const sampleRate = settings.sampleRate || 48000;
    // options.audioChannels wins: getSettings() reports 2 while the node mixes
    // mono (measured), and a stereo encoder rejects mono AudioData.
    const numberOfChannels =
      this.options.audioChannels || settings.channelCount || 2;

    try {
      chrome.storage.local.set({
        lastRecordingAudioSnapshot: {
          at: Date.now(),
          trackSettings: {
            sampleRate: settings.sampleRate ?? null,
            channelCount: settings.channelCount ?? null,
            deviceId: settings.deviceId ?? null,
            autoGainControl: settings.autoGainControl ?? null,
            echoCancellation: settings.echoCancellation ?? null,
            noiseSuppression: settings.noiseSuppression ?? null,
          },
          encoderSampleRate: sampleRate,
          encoderChannelCount: numberOfChannels,
        },
      });
    } catch {}

    const candidateConfig = {
      codec: this.containerKind === "webm" ? "opus" : "mp4a.40.2",
      sampleRate,
      numberOfChannels,
      bitrate: this.options.audioBitrate || 128000,
    };

    try {
      const support = await AudioEncoder.isConfigSupported(candidateConfig);
      if (!support.supported) {
        this.warn("[WCR] audio codec unsupported", candidateConfig.codec);
        return null;
      }
      this.audioSampleRate = support.config?.sampleRate || candidateConfig.sampleRate;
      this.audioChannelCount = support.config?.numberOfChannels || numberOfChannels;
      return support.config || candidateConfig;
    } catch {
      this.warn("[WCR] audio probe failed", candidateConfig.codec);
      return null;
    }
  }

  async chooseVideoEncoderConfig({ width, height, fps, bitrate }) {
    const base = {
      width,
      height,
      framerate: fps,
      bitrate,
      bitrateMode: "constant",
      latencyMode: "realtime",
    };

    // Bias to software when the caller asks (cloud camera on macOS:
    // VideoToolbox serializes h264 encoders per-process and a second
    // prefer-hardware silently falls back at unpredictable fps).
    // Forcing SW gives a reliable 30fps instead of contended 5fps.
    const preferSoftware = Boolean(this.options?.preferSoftware);
    const candidates =
      this.containerKind === "webm"
        ? preferSoftware
          ? [
              { codec: "vp09.00.10.08", containerCodec: "vp9", hw: "prefer-software" },
              { codec: "vp8", containerCodec: "vp8", hw: "prefer-software" },
              { codec: "vp09.00.10.08", containerCodec: "vp9", hw: "prefer-hardware" },
            ]
          : [
              { codec: "vp09.00.10.08", containerCodec: "vp9", hw: "prefer-hardware" },
              { codec: "vp09.00.10.08", containerCodec: "vp9", hw: "prefer-software" },
              { codec: "vp8", containerCodec: "vp8", hw: "prefer-software" },
            ]
        : preferSoftware
          ? [
              // Main (avc1.4D...) excluded: silent-no-output bug on Chromium's
              // Windows MFT wrapper (encode() accepts, no chunks emit).
              { codec: "avc1.64002A", containerCodec: "avc", hw: "prefer-software" },
              { codec: "avc1.42E028", containerCodec: "avc", hw: "prefer-software" },
              { codec: "avc1.64002A", containerCodec: "avc", hw: "no-preference" },
              { codec: "avc1.64002A", containerCodec: "avc", hw: "prefer-hardware" },
              { codec: "avc1.42E028", containerCodec: "avc", hw: "prefer-hardware" },
            ]
          : [
              // no-preference rung between High-HW and Baseline: on NVENC slot
              // exhaustion (OBS/Zoom/Discord open) it keeps High over Baseline.
              { codec: "avc1.64002A", containerCodec: "avc", hw: "prefer-hardware" },
              { codec: "avc1.64002A", containerCodec: "avc", hw: "no-preference" },
              { codec: "avc1.42E028", containerCodec: "avc", hw: "prefer-hardware" },
              { codec: "avc1.64002A", containerCodec: "avc", hw: "prefer-software" },
              { codec: "avc1.42E028", containerCodec: "avc", hw: "prefer-software" },
            ];

    for (const c of candidates) {
      const config = { ...base, codec: c.codec, hardwareAcceleration: c.hw };
      // Use the normalized config from isConfigSupported so a clamp
      // Chrome would have applied doesn't trigger a SW fallback later.
      let supported = null;
      try {
        supported = await VideoEncoder.isConfigSupported(config);
      } catch {}
      const resolvedConfig =
        supported?.supported && supported.config ? supported.config : config;
      const test = new VideoEncoder({ output() {}, error() {} });
      try {
        test.configure(resolvedConfig);
        this._videoCodecConfigsTried.push({
          codec: c.codec,
          hw: c.hw,
          succeeded: true,
        });
        this.log("[WCR] Selected encoder:", c.codec, c.hw);
        try {
          chrome.storage.local.set({
            fastRecorderSelectedEncoder: {
              codec: c.codec,
              hw: c.hw,
              containerCodec: c.containerCodec,
              width,
              height,
              fps,
              bitrate,
              at: Date.now(),
            },
          });
        } catch {}
        return {
          config: resolvedConfig,
          codec: c.codec,
          containerCodec: c.containerCodec,
        };
      } catch (e) {
        this._videoCodecConfigsTried.push({
          codec: c.codec,
          hw: c.hw,
          succeeded: false,
        });
      } finally {
        try { test.close(); } catch {}
      }
    }
    throw new Error("WebCodecsRecorder: No supported H.264 encoder");
  }

  // Geometry lives in letterbox.js; this just paints it.
  drawFrameToResizeCanvas(frame) {
    const tw = this.targetWidth;
    const th = this.targetHeight;
    const rect = computeLetterboxRect({
      sw: frame.codedWidth,
      sh: frame.codedHeight,
      tw,
      th,
    });

    if (rect.fills) {
      this.resizeCtx.drawImage(frame, 0, 0, tw, th);
      return;
    }

    if (!this._loggedLetterbox) {
      this._loggedLetterbox = true;
      this.log(
        `[WCR] surface aspect changed; letterboxing ${frame.codedWidth}x${frame.codedHeight} into ${tw}x${th}`,
      );
    }

    // A fitted draw doesn't cover every pixel; without this the previous surface
    // stays frozen in the bars around the new one.
    this.resizeCtx.fillStyle = "#000";
    this.resizeCtx.fillRect(0, 0, tw, th);
    this.resizeCtx.drawImage(frame, rect.x, rect.y, rect.w, rect.h);
  }

  async readVideoLoop() {
    this.log("[WCR] video loop start");
    if (!this.videoReader || !this.videoEncoder) return;

    const ensureResizeCanvas = () => {
      if (!this.resizeCanvas) {
        this.resizeCanvas = document.createElement("canvas");
        this.resizeCanvas.width = this.targetWidth;
        this.resizeCanvas.height = this.targetHeight;
        this.resizeCtx = this.resizeCanvas.getContext("2d");
        this.log("[WCR] resize canvas created");
      }
    };

    try {
      while (this.running) {
        // E2E hook: simulate a silent stall (zero encoded frames, no
        // throw). Thrown-error hooks don't cover this failure mode.
        if (globalThis.__screenityForceZeroFrames) break;

        if (this.paused) {
          // Long pause isn't sleep. Reset so resume skips recovery.
          this._lastFrameArrivalAt = null;
          await new Promise((r) => setTimeout(r, 10));
          continue;
        }

        // Sleep / wake recovery: a long inter-frame gap means lid-close
        // or OS preemption. Reset the watchdog and force a keyframe.
        const _nowLoopTick = performance.now();
        const g = /** @type {any} */ (globalThis);
        const forcedGap =
          typeof g.__screenityForceSleepGapMs === "number"
            ? g.__screenityForceSleepGapMs
            : 0;
        if (forcedGap > 0) {
          g.__screenityForceSleepGapMs = 0;
          this._lastFrameArrivalAt = _nowLoopTick - forcedGap;
        }
        if (
          shouldTriggerSleepRecovery(
            _nowLoopTick,
            this._lastFrameArrivalAt,
            this._sleepGapMs,
            this._firstChunkSeen,
            this.running,
            this._stopping,
          )
        ) {
          this._postSleepRecoveries += 1;
          this.warn("[WCR] post-sleep gap detected; resetting watchdog", {
            gapMs: Math.round(_nowLoopTick - this._lastFrameArrivalAt),
            recoveries: this._postSleepRecoveries,
          });
          // Sleep can invalidate the VideoToolbox session (crbug 477895).
          // Backdate _lastChunkAt to give the stall watchdog 8s grace, not 15s:
          // clears HW cold-start yet rebuilds a dead session promptly.
          const POST_SLEEP_GRACE_MS = 8000;
          this._lastChunkAt =
            this._midStreamWatchdogMs > POST_SLEEP_GRACE_MS
              ? _nowLoopTick - (this._midStreamWatchdogMs - POST_SLEEP_GRACE_MS)
              : _nowLoopTick;
          this._forceNextKeyframe = true;
          try {
            diagForward("recorder-sleep-detected", {
              gapMs: Math.round(_nowLoopTick - this._lastFrameArrivalAt),
              recoveries: this._postSleepRecoveries,
            });
          } catch {}
          this._lastFrameArrivalAt = _nowLoopTick;
        }

        // Static-frame fallback. macOS ScreenCaptureKit throttles to
        // frames-on-change on a static screen, so the track stops
        // emitting and the stall watchdog would misfire. Reuse the
        // last canvas on timeout to keep chunks flowing.
        const STATIC_FRAME_FALLBACK_MS = 1500;
        // Hoisted, not re-issued per iteration. A read that loses the race
        // isn't cancelled: it stays queued and later eats a frame nobody
        // encodes or closes, so on a static screen every timeout costs the
        // next real frame.
        if (!this._pendingVideoRead) {
          this._pendingVideoRead = this.videoReader
            .read()
            .then((v) => ({ ...v, isSyntheticTimeout: false }))
            .catch(() => ({
              done: true,
              value: null,
              isSyntheticTimeout: false,
            }));
        }
        let fallbackTimer = null;
        const readResult = await Promise.race([
          this._pendingVideoRead,
          new Promise((resolve) => {
            fallbackTimer = setTimeout(
              () =>
                resolve({
                  done: false,
                  value: null,
                  isSyntheticTimeout: true,
                }),
              STATIC_FRAME_FALLBACK_MS,
            );
          }),
        ]);
        if (!readResult.isSyntheticTimeout) {
          // Consumed: clear before any early continue below.
          this._pendingVideoRead = null;
          if (fallbackTimer) clearTimeout(fallbackTimer);
        }

        let isSynthetic = false;
        let frame = null;
        if (readResult.isSyntheticTimeout) {
          if (!this._firstChunkSeen) {
            // No real frame has arrived yet. macOS ScreenCaptureKit can
            // withhold the very first frame on a fully static screen, which
            // starves the encoder and trips the no-first-chunk watchdog even
            // though capture is healthy. While the track is live, prime the
            // stream with a black placeholder so the encoder starts and the
            // watchdog disarms; the first real frame replaces it the moment
            // the screen changes. If the track is gone (ended / muted / not
            // ready) leave it to the watchdog to surface the real failure.
            const trackLive =
              this.videoTrack &&
              this.videoTrack.readyState === "live" &&
              this.videoTrack.muted !== true;
            if (!trackLive || !this.targetWidth || !this.targetHeight) {
              continue;
            }
            ensureResizeCanvas();
            if (this._videoStartUs == null) {
              this._videoStartUs = performance.now() * 1000;
            }
            isSynthetic = true;
            this._syntheticFirstFrameCount += 1;
          } else {
            // Track stalled mid-stream; reuse the last drawn frame so chunks
            // keep flowing through the static stretch.
            if (!this.resizeCanvas) {
              continue;
            }
            isSynthetic = true;
            this._staticFrameSyntheticCount += 1;
          }
        } else {
          // E2E seam: exit the loop as if the source track ended, which is what
          // stopping the screen share does.
          if (/** @type {any} */ (globalThis).__screenityForceVideoTrackEnd) {
            try { readResult.value?.close?.(); } catch {}
            break;
          }
          if (readResult.done || !readResult.value) break;
          frame = readResult.value;
          this._framesFromMSTP += 1;
          // Drives the sleep-gap detection above.
          this._lastFrameArrivalAt = performance.now();

          if (frame.codedWidth === 0 || frame.codedHeight === 0) {
            // A zero-size frame can't be drawn or encoded. Skip it
            // instead of feeding a 0x0 frame into the encoder. If
            // every frame is zero-size, no chunk ever lands and the
            // first-chunk watchdog surfaces the failure.
            this.warn("[WCR] zero-size frame, skipping");
            frame.close();
            continue;
          }

          ensureResizeCanvas();

          this.drawFrameToResizeCanvas(frame);

          if (!this._videoStartUs) {
            this._videoStartUs = performance.now() * 1000;
            perfMark("WCR.firstSourceFrame", {
              w: frame.codedWidth,
              h: frame.codedHeight,
            });
          }
        }

        const nowUs = performance.now() * 1000;
        const elapsedUs = Math.max(
          0,
          nowUs - this._videoStartUs - (this.totalPausedDurationUs || 0)
        );
        const frameDurationUs = this._frameDurationUs || Math.round(1_000_000 / 30);
        const targetIndex = Math.max(0, Math.floor(elapsedUs / frameDurationUs));

        // Drop frames ahead of wall-clock.
        if (targetIndex < this._videoFrameIndex) {
          if (frame) this._framesDroppedAheadOfClock += 1;
          frame?.close();
          continue;
        }

        // Hidden tab / heavy load can leave us many frames behind wall-clock.
        // Filling the gap synchronously would overflow the encoder queue, so
        // skip ahead to at most MAX_GAP_FRAMES behind. Skipped indices
        // advance _videoFrameIndex to prevent repeated catch-up attempts.
        const MAX_GAP_FRAMES = 8;
        const gap = targetIndex - this._videoFrameIndex;
        if (gap > MAX_GAP_FRAMES) {
          this.warn(`[WCR] skipping ${gap - MAX_GAP_FRAMES} frames (tab gap)`);
          this._framesSkippedForGap += gap - MAX_GAP_FRAMES;
          this._videoFrameIndex = targetIndex - MAX_GAP_FRAMES;
        }

        const startIndex = this._videoFrameIndex;
        const endIndex = targetIndex;
        for (let i = startIndex; i <= endIndex; i += 1) {
          const tsUs = i * frameDurationUs;

          // Track the peak observed queue depth as a leading indicator
          //; useful for tuning the threshold from real telemetry.
          // Closed-encoder pause race: treat as drained.
          let vQueueSize = 0;
          try {
            vQueueSize = this.videoEncoder?.encodeQueueSize ?? 0;
          } catch {
            vQueueSize = 0;
          }
          if (vQueueSize > this._peakVideoEncodeQueueSize) {
            this._peakVideoEncodeQueueSize = vQueueSize;
          }

          // Startup grace window: while the encoder ramps, buffer instead of
          // dropping. Frames carry wall-clock PTS, so they encode late but the
          // file stays complete. Latches to the steady cap once it closes.
          let effectiveQueueCap = this._encoderMaxQueueSize;
          if (!this._startupWindowClosed) {
            if (this._startupFirstFrameAt === null) {
              this._startupFirstFrameAt = performance.now();
            }
            this._startupFramesSeen += 1;
            if (vQueueSize <= STARTUP_CAUGHT_UP_QUEUE) {
              this._startupCaughtUpRun += 1;
            } else {
              this._startupCaughtUpRun = 0;
            }
            effectiveQueueCap = computeEffectiveQueueCap({
              framesSinceStart: this._startupFramesSeen,
              elapsedMs: performance.now() - this._startupFirstFrameAt,
              caughtUp: this._startupCaughtUpRun >= STARTUP_CAUGHT_UP_RUN,
              steadyCap: this._encoderMaxQueueSize,
              startupCap: this._startupMaxQueueSize,
              hardFrameLimit: this._startupHardFrameLimit,
              hardMs: this._startupHardMs,
              disabled: getStartupFlags().startupBufferDisabled,
            });
            if (effectiveQueueCap <= this._encoderMaxQueueSize) {
              this._startupWindowClosed = true;
              effectiveQueueCap = this._encoderMaxQueueSize;
            } else if (
              vQueueSize > this._encoderMaxQueueSize &&
              vQueueSize <= effectiveQueueCap
            ) {
              // Counts only frames the wider cap actually saves (above the
              // steady cap, still inside the grace cap). Counting ones that
              // drop anyway would overstate the fix in telemetry.
              this._startupBufferEngaged = true;
              this._framesBufferedAtStart += 1;
            }
          }

          // Backpressure: drop the frame and force a keyframe next so
          // the stream stays decodable. An unbounded queue can stop
          // emitting chunks entirely.
          if (vQueueSize > effectiveQueueCap) {
            this._droppedForBackpressureCount += 1;
            this._forceNextKeyframe = true;
            this._videoFrameIndex = i + 1;
            continue;
          }

          const resized = new VideoFrame(this.resizeCanvas, {
            timestamp: tsUs,
            duration: frameDurationUs,
          });

          const keyFrame =
            i === 0 ||
            (this.justResumed && i === startIndex) ||
            this._forceNextKeyframe === true ||
            i - this._lastKeyFrameIndex >= this._keyFrameIntervalFrames;
          if (keyFrame) {
            this._lastKeyFrameIndex = i;
            this._forceNextKeyframe = false;
          }
          if (this.justResumed && i === startIndex) {
            this.justResumed = false;
          }

          // pause() can close the encoder between the top-of-loop check
          // and here. Drop the frame instead of bubbling a sync throw.
          if (
            this.paused ||
            !this.videoEncoder ||
            this.videoEncoder.state === "closed"
          ) {
            resized.close();
            this._videoFrameIndex = i + 1;
            this._forceNextKeyframe = true;
            continue;
          }
          // try/finally so resized's GPU buffer closes on every exit
          // (pause-race continue, rethrown encoder error, success).
          try {
            try {
              this.videoEncoder.encode(resized, {
                timestamp: tsUs,
                keyFrame,
              });
              this._framesFed += 1;
            } catch (encErr) {
              // Same race after the check. Only swallow when paused
              // so real encoder errors still surface.
              if (
                this.paused ||
                this.videoEncoder?.state === "closed"
              ) {
                this.warn("[WCR] encode() race during pause; dropping frame");
                this._videoFrameIndex = i + 1;
                this._forceNextKeyframe = true;
                continue;
              }
              // QuotaExceededError means a full queue (Chrome 140+ backpressure,
              // drop the frame) or a reclaimed encoder (near-empty queue). Route
              // the reclaim case to a rebuild, not a drop into a dead encoder.
              if (encErr?.name === "QuotaExceededError") {
                const q = this.videoEncoder?.encodeQueueSize ?? 0;
                // A near-empty queue only meant reclaim while the cap was 4;
                // at 16 a real reclaim looks like backpressure and silently
                // skips the rebuild. Chrome names reclaims in the message.
                if (isReclaimErrorMessage(encErr) || q <= 5) {
                  this._videoFrameIndex = i + 1;
                  this._forceNextKeyframe = true;
                  this.warn(
                    "[WCR] encode() QuotaExceededError with near-empty queue; treating as encoder reclaim, rebuilding",
                    { queue: q },
                  );
                  this._handleVideoEncoderError(encErr, true);
                  continue;
                }
                this._droppedForBackpressureCount += 1;
                this._forceNextKeyframe = true;
                this._videoFrameIndex = i + 1;
                this.warn(
                  "[WCR] encode() QuotaExceededError; dropping frame as backpressure",
                );
                continue;
              }
              throw encErr;
            }
            if (
              this.debug &&
              (this.frameCount < 5 || this.frameCount % 300 === 0)
            ) {
              this.log("[WCR] video pts", {
                frame: this.frameCount,
                tsUs,
                durUs: frameDurationUs,
                targetIndex,
              });
            }
            // Diag snapshot every 30 frames. encodeQueueSize > 10 means
            // the encoder can't keep up.
            if (this.frameCount > 0 && this.frameCount % 30 === 0) {
              perfMark("WCR.frame.progress", {
                frame: this.frameCount,
                videoQ: this.videoEncoder?.encodeQueueSize ?? -1,
                audioQ: this.audioEncoder?.encodeQueueSize ?? -1,
              });
            }
            this.frameCount++;
            this._videoFrameIndex = i + 1;
          } finally {
            resized.close();
          }
        }

        // Only close a real source frame; the synthetic path reuses
        // the existing resize-canvas content and has no incoming frame.
        if (frame) frame.close();
      }
    } catch (err) {
      this.err("[WCR] video loop error:", err);
      // Keep the error so the zero-frame branch below can attach the
      // real cause (e.g. a synchronous encode() throw) to onError.
      this._videoLoopError = err;
    }

    this.log("[WCR] video loop exit", this.frameCount, "running=", this.running);
    // Loop exited while running; stop audio so it doesn't outlast video.
    if (this.running) {
      this.running = false;
      if (this.frameCount === 0) {
        // Zero frames encoded means there is no recording; only the
        // muxer header would reach the uploader (the "28-byte ftyp"
        // stall). This is NOT a valid partial recording: surface it so
        // the caller swaps to MediaRecorder.
        this.warn("[WCR] video loop exited with zero frames encoded");
        this._reportFailure(
          "webcodecs-zero-frames",
          this._videoLoopError ||
            new Error("WebCodecs video loop produced zero frames"),
        );
      } else {
        // Some frames encoded: a real, if short, partial recording
        // exists. Keep it; finalize() ships what we have.
        this.warn(
          "[WCR] video loop exited early while running; partial recording kept",
        );
      }
    }
  }

  _audioWrittenUs() {
    const rate = this._audioStampRate || this.audioSampleRate || 48000;
    return (
      this._audioTimeBaseUs +
      Math.round((this.audioSamplesWritten * 1_000_000) / rate)
    );
  }

  async readAudioLoop() {
    while (this.paused && this.running) {
      await new Promise((r) => setTimeout(r, 10));
    }
    if (!this.audioReader) return;
    this.log("[WCR] audio loop start");

    const encodeAudioData = (audioData, isCatchUpSilence = false) => {
      // E2E hook: override the perceived rate for one frame to drive
      // mismatch-rebuild in tests. Timestamps still use the real rate.
      const _g = /** @type {any} */ (globalThis);
      const overrideRate = _g.__screenityForceAudioSampleRateOverride || 0;
      if (overrideRate > 0) {
        _g.__screenityForceAudioSampleRateOverride = 0;
      }
      const realSampleRate = audioData.sampleRate || null;
      const incomingSampleRate = overrideRate || realSampleRate;

      // Mic switched mid-recording: rebuild at the new rate. Pre-check
      // AAC's allowed rates so configure() can't brick the encoder.
      const codec = this._activeAudioConfig?.codec || "mp4a.40.2";
      const isAac = codec.startsWith("mp4a") || codec === "aac";
      if (
        isAac &&
        incomingSampleRate &&
        this.audioSampleRate &&
        incomingSampleRate !== this.audioSampleRate &&
        !isAacRateInSpec(incomingSampleRate)
      ) {
        if (!this._audioRebuildUnsupportedRates) {
          this._audioRebuildUnsupportedRates = new Set();
        }
        if (!this._audioRebuildUnsupportedRates.has(incomingSampleRate)) {
          this._audioRebuildUnsupportedRates.add(incomingSampleRate);
          try {
            diagForward("recorder-audio-rebuild-unsupported", {
              rate: incomingSampleRate,
              keptRate: this.audioSampleRate,
              codec,
              reason: "codec-rate-not-supported",
            });
          } catch {}
        }
      }
      const rateUnsupported =
        incomingSampleRate &&
        this._audioRebuildUnsupportedRates &&
        this._audioRebuildUnsupportedRates.has(incomingSampleRate);
      if (
        incomingSampleRate &&
        this.audioSampleRate &&
        incomingSampleRate !== this.audioSampleRate &&
        !rateUnsupported &&
        this._audioSampleRateMismatchRebuilds <
          this._maxAudioSampleRateRebuilds
      ) {
        const oldRate = this.audioSampleRate;
        this.warn("[WCR] audio sample rate changed mid-recording", {
          from: oldRate,
          to: incomingSampleRate,
          rebuilds: this._audioSampleRateMismatchRebuilds + 1,
        });
        const newConfig = this._activeAudioConfig
          ? { ...this._activeAudioConfig, sampleRate: incomingSampleRate }
          : null;
        if (newConfig && this._rebuildAudioEncoder(newConfig)) {
          this.audioSampleRate = incomingSampleRate;
          this._audioSampleRateMismatchRebuilds += 1;
          // Drop this frame so the next one starts at the new rate.
          try {
            audioData.close?.();
          } catch {}
          this._audioDeviceChangePending = false;
          try {
            diagForward("recorder-audio-encoder-rebuilt", {
              reason: "sample-rate-mismatch",
              from: oldRate,
              to: incomingSampleRate,
              rebuilds: this._audioSampleRateMismatchRebuilds,
            });
          } catch {}
          return;
        }
        // Rebuild failed: mark as unsupported (encoder already restored).
        if (!this._audioRebuildUnsupportedRates) {
          this._audioRebuildUnsupportedRates = new Set();
        }
        this._audioRebuildUnsupportedRates.add(incomingSampleRate);
        try {
          diagForward("recorder-audio-rebuild-unsupported", {
            rate: incomingSampleRate,
            keptRate: this.audioSampleRate,
            codec:
              (this._activeAudioConfig && this._activeAudioConfig.codec) ||
              null,
          });
        } catch {}
      }

      // Timestamps use the real rate; the override is test-only.
      const sampleRate =
        realSampleRate || this.audioSampleRate || 48000;
      const frames =
        typeof audioData.numberOfFrames === "number"
          ? audioData.numberOfFrames
          : 0;

      // Stamp rate changed (mic switch): fold the counter at the OLD rate
      // first, else the whole past timeline gets rescaled to the new one.
      if (this._audioStampRate && sampleRate !== this._audioStampRate) {
        this._audioTimeBaseUs += Math.round(
          (this.audioSamplesWritten * 1_000_000) / this._audioStampRate,
        );
        this.audioSamplesWritten = 0;
      }
      this._audioStampRate = sampleRate;

      // Before stamping, so injected catch-up silence lands ahead of this packet.
      if (!isCatchUpSilence) {
        reconcileAudioClock(sampleRate, frames);
      }

      const tsUs = this._audioWrittenUs();
      const durUs = Math.round((frames * 1_000_000) / sampleRate);

      // Track peak audio encode-queue depth (leading indicator).
      const aQueueSize = this.audioEncoder.encodeQueueSize;
      if (aQueueSize > this._peakAudioEncodeQueueSize) {
        this._peakAudioEncodeQueueSize = aQueueSize;
      }

      // E2E seam: force the real backpressure branch for N ms of audio, the
      // encoder-side counterpart to __screenityForceAudioDrop above.
      const forcedBpMs =
        Number(
          /** @type {any} */ (globalThis).__screenityForceAudioBackpressure,
        ) || 0;
      if (forcedBpMs > 0 && !isCatchUpSilence) {
        /** @type {any} */ (globalThis).__screenityForceAudioBackpressure =
          Math.max(0, forcedBpMs - (frames * 1000) / sampleRate);
      }

      // The muxer builds the audio timeline from encoded durations, so a drop
      // shifts later audio earlier. Leave the counter for the reconciler.
      if (forcedBpMs > 0 || aQueueSize > this._audioEncoderMaxQueueSize) {
        if (isCatchUpSilence) return false;
        this._droppedAudioForBackpressureCount += 1;
        return false;
      }

      try {
        this.audioEncoder.encode(audioData, {
          timestamp: tsUs,
        });
      } catch (encErr) {
        if (encErr?.name === "QuotaExceededError") {
          if (isCatchUpSilence) return false;
          this._droppedAudioForBackpressureCount += 1;
          this.warn(
            "[WCR] audio encode() QuotaExceededError; dropping audio data",
          );
          return false;
        }
        throw encErr;
      }
      this.audioSamplesWritten += frames;
      this._audioDataEncoded += 1;

      if (this.debug && (this.audioSamplesWritten === frames || this.audioSamplesWritten % (sampleRate * 10) < frames)) {
        this.log("[WCR] audio pts", {
          samples: this.audioSamplesWritten,
          tsUs,
          durUs,
          sampleRate,
        });
      }
      return true;
    };

    // Windows WASAPI loopback stops yielding on silent system audio,
    // leaving audioReader.read() pending. Pad with silence.
    const SILENCE_TIMEOUT_MS = 500;
    const SILENCE_CHUNK_MS = 500;

    const makeSilentAudioData = (durationMs) => {
      const sampleRate = this.audioSampleRate || 48000;
      const channels = this.audioChannelCount || 2;
      const frames = Math.max(
        1,
        Math.round((sampleRate * durationMs) / 1000),
      );
      const data = new Float32Array(frames * channels);
      return new AudioData({
        format: "f32-planar",
        sampleRate,
        numberOfFrames: frames,
        numberOfChannels: channels,
        timestamp: this._audioWrittenUs(),
        data,
      });
    };

    // Lost AudioData (MSTP overflow under load) shortens the track with
    // contiguous PTS, so everything after the loss plays early.
    const AUDIO_DRIFT_WINDOW_US = 2_000_000;
    const AUDIO_DRIFT_MIN_INJECT_US = 50_000;
    // Injections this early are one-time settle jank, measured at 50-134ms
    // within the first ~7s of healthy runs. Bucketed apart from the alarm.
    const AUDIO_CATCHUP_SETTLE_WINDOW_US = 10_000_000;
    // Caps one catch-up event at 60s (e.g. a wall-clock jump across system
    // sleep). The remainder is picked up by the next window.
    const MAX_CATCHUP_CHUNKS_PER_EVENT = 120;

    const injectCatchUpSilence = (deficitUs) => {
      const inSettleWindow =
        this._audioWrittenUs() < AUDIO_CATCHUP_SETTLE_WINDOW_US;
      let remainingUs = deficitUs;
      let chunks = 0;
      while (
        remainingUs >= AUDIO_DRIFT_MIN_INJECT_US &&
        chunks < MAX_CATCHUP_CHUNKS_PER_EVENT
      ) {
        chunks += 1;
        const chunkMs = Math.min(SILENCE_CHUNK_MS, remainingUs / 1000);
        const silent = makeSilentAudioData(chunkMs);
        const silentUs = Math.round(
          (silent.numberOfFrames * 1_000_000) / silent.sampleRate,
        );
        // No await here, so encodeQueueSize only grows and past the cap every
        // chunk is refused. Stop and leave the residual for the next window.
        let encoded = false;
        try {
          encoded = encodeAudioData(silent, true) === true;
        } finally {
          try { silent.close?.(); } catch {}
        }
        if (!encoded) break;
        remainingUs -= silentUs;
        if (inSettleWindow) {
          this._injectedCatchUpSettleUs += silentUs;
        } else {
          this._injectedCatchUpSilenceUs += silentUs;
        }
      }
      const injectedUs = deficitUs - remainingUs;
      if (injectedUs <= 0) return 0;
      if (!inSettleWindow) {
        this._injectedCatchUpSilenceEvents += 1;
      }
      this.warn("[WCR] audio behind wall clock; injected catch-up silence", {
        deficitMs: Math.round(deficitUs / 1000),
        injectedMs: Math.round(injectedUs / 1000),
        settle: inSettleWindow,
        events: this._injectedCatchUpSilenceEvents,
      });
      try {
        diagForward("recorder-audio-clock-reconciled", {
          deficitMs: Math.round(deficitUs / 1000),
          settle: inSettleWindow,
          totalInjectedMs: Math.round(
            (this._injectedCatchUpSilenceUs + this._injectedCatchUpSettleUs) /
              1000,
          ),
          events: this._injectedCatchUpSilenceEvents,
        });
      } catch {}
      return injectedUs;
    };

    // Anchor = global min of (elapsed - written), injection = windowed min lag.
    // A windowed anchor hides accumulated loss, an unwindowed one pads mere delay.
    const reconcileAudioClock = (sampleRate, incomingFrames) => {
      // Pause cancels out: the counter freezes while paused and effNow
      // subtracts the same span, so resume reads no deficit.
      const effNowUs =
        performance.now() * 1000 - (this.totalPausedDurationUs || 0);
      // Counts the incoming packet: healthy delivery then reconciles to ~0 lag,
      // so packet-arrival jitter never crosses the injection threshold.
      const posUs =
        this._audioWrittenUs() +
        Math.round((incomingFrames * 1_000_000) / sampleRate);
      const anchorCandidate = effNowUs - posUs;
      if (
        this._audioClockAnchorUs == null ||
        anchorCandidate < this._audioClockAnchorUs
      ) {
        if (this._audioClockAnchorUs == null) {
          this._audioClockAnchorInitialUs = anchorCandidate;
        }
        this._audioClockAnchorUs = anchorCandidate;
      }
      const lagUs = effNowUs - this._audioClockAnchorUs - posUs;
      // Diagnostic only, against the fixed first-packet epoch. The ratcheting
      // anchor above clamps to >= 0 and would hide audio running ahead.
      this._lastAudioLagUs =
        effNowUs - this._audioClockAnchorInitialUs - posUs;

      if (this._audioDriftWindowStartUs == null) {
        this._audioDriftWindowStartUs = effNowUs;
        this._audioDriftWindowMinUs = lagUs;
        return;
      }
      if (lagUs < this._audioDriftWindowMinUs) {
        this._audioDriftWindowMinUs = lagUs;
      }
      if (effNowUs - this._audioDriftWindowStartUs < AUDIO_DRIFT_WINDOW_US) {
        return;
      }
      const deficitUs = this._audioDriftWindowMinUs;
      this._audioDriftWindowStartUs = effNowUs;
      this._audioDriftWindowMinUs = lagUs;
      if (deficitUs >= AUDIO_DRIFT_MIN_INJECT_US) {
        const injectedUs = injectCatchUpSilence(deficitUs);
        // Post-injection lag, not the stale pre-injection value, which
        // would double-inject on a slow next packet.
        this._audioDriftWindowMinUs = Math.max(0, lagUs - injectedUs);
      }
    };

    try {
      while (this.running) {
        // Hoisted for the same reason as the video read: a losing read
        // isn't cancelled and would eat the next packet.
        if (!this._pendingAudioRead) {
          this._pendingAudioRead = this.audioReader
            .read()
            .then((v) => ({ ...v, timedOut: false }))
            .catch(() => ({ done: true, timedOut: false }));
        }
        let audioFallbackTimer = null;
        const readResult = await Promise.race([
          this._pendingAudioRead,
          new Promise((r) => {
            audioFallbackTimer = setTimeout(
              () => r({ value: null, done: false, timedOut: true }),
              SILENCE_TIMEOUT_MS,
            );
          }),
        ]);
        if (!readResult.timedOut) {
          this._pendingAudioRead = null;
          if (audioFallbackTimer) clearTimeout(audioFallbackTimer);
        }

        if (readResult.timedOut) {
          const trackEnded =
            !this.audioTrack || this.audioTrack.readyState === "ended";
          if (trackEnded) this._closeMuxerAudio("track-ended");
          if (
            !this._audioReady ||
            this.paused ||
            trackEnded ||
            !this.audioEncoder ||
            this.audioEncoder.state === "closed"
          ) {
            continue;
          }
          try {
            const silent = makeSilentAudioData(SILENCE_CHUNK_MS);
            try {
              encodeAudioData(silent);
            } finally {
              silent.close?.();
            }
            this._paddedSilenceCount += 1;
            if (
              this._paddedSilenceCount === 1 ||
              this._paddedSilenceCount % 20 === 0
            ) {
              this.log(
                "[WCR] audio source quiet, padding silence",
                this._paddedSilenceCount,
              );
            }
          } catch (err) {
            // Encoder unhealthy; break to avoid spinning on every timeout.
            this.warn("[WCR] silence padding failed", err);
            break;
          }
          continue;
        }

        const { value: audioData, done } = readResult;
        if (done || !audioData) break;
        // E2E seam: drop delivered AudioData (value = ms to drop) ahead of every
        // counter, so it reads exactly like upstream MSTP loss.
        const forcedDropMs =
          Number(
            /** @type {any} */ (globalThis).__screenityForceAudioDrop,
          ) || 0;
        if (forcedDropMs > 0 && audioData.sampleRate) {
          const chunkMs =
            ((audioData.numberOfFrames || 0) * 1000) / audioData.sampleRate;
          /** @type {any} */ (globalThis).__screenityForceAudioDrop = Math.max(
            0,
            forcedDropMs - chunkMs,
          );
          audioData.close?.();
          continue;
        }
        // Not while paused: the mic keeps delivering but those packets are
        // dropped below, which read as heavy loss against audioDataEncoded.
        if (!this.paused) {
          this._audioDataReceived += 1;
          if (
            typeof audioData.numberOfFrames === "number" &&
            audioData.sampleRate
          ) {
            this._audioReceivedUs += Math.round(
              (audioData.numberOfFrames * 1_000_000) / audioData.sampleRate,
            );
          }
        }
        if (!this.audioTrack || this.audioTrack.readyState === "ended") {
          this.warn("[WCR] audio lost");
          this._closeMuxerAudio("audio-lost");
          this.options.onError?.({ type: "audio-lost" });
          break;
        }

        if (
          this._firstAudioFrameSampleRate == null &&
          typeof audioData.sampleRate === "number"
        ) {
          this._firstAudioFrameSampleRate = audioData.sampleRate;
          try {
            chrome.storage.local.get(
              ["lastRecordingAudioSnapshot"],
              (res) => {
                const prev = res?.lastRecordingAudioSnapshot || {};
                chrome.storage.local.set({
                  lastRecordingAudioSnapshot: {
                    ...prev,
                    firstFrameSampleRate: audioData.sampleRate,
                    firstFrameChannels:
                      audioData.numberOfChannels ?? null,
                    firstFrameFormat: audioData.format ?? null,
                    firstFrameAt: Date.now(),
                  },
                });
              },
            );
          } catch {}
        }

        if (!this._audioReady) {
          this._prebufferedAudio.push(audioData);
          continue;
        }

        // Drop audio while paused; sample counter doesn't advance so
        // timestamps resume from the correct position, keeping audio/video
        // aligned across pause/resume cycles.
        if (this.paused) {
          audioData.close?.();
          continue;
        }

        try {
          if (this._prebufferedAudio.length) {
            while (this._prebufferedAudio.length) {
              const buffered = this._prebufferedAudio.shift();
              try {
                encodeAudioData(buffered);
              } finally {
                buffered.close?.();
              }
            }
          }
          encodeAudioData(audioData);
        } catch (err) {
          audioData.close?.();
          this.options.onError?.(err);
          break;
        }

        audioData.close?.();
      }
    } catch (err) {
      this.err("[WCR] audio loop error:", err);
    }

    if (
      this._paddedSilenceCount > 0 ||
      this._injectedCatchUpSilenceEvents > 0 ||
      this._injectedCatchUpSettleUs > 0
    ) {
      this.log(
        "[WCR] audio loop exit, silence chunks padded:",
        this._paddedSilenceCount,
        "catch-up ms:",
        Math.round(
          (this._injectedCatchUpSilenceUs + this._injectedCatchUpSettleUs) /
            1000,
        ),
      );
      try {
        const paddedSilenceCount = this._paddedSilenceCount;
        const catchUpSilenceMs = Math.round(
          this._injectedCatchUpSilenceUs / 1000,
        );
        const catchUpSilenceEvents = this._injectedCatchUpSilenceEvents;
        const catchUpSettleMs = Math.round(
          this._injectedCatchUpSettleUs / 1000,
        );
        chrome.storage.local.get(["lastRecordingAudioSnapshot"], (res) => {
          const prev = res?.lastRecordingAudioSnapshot || {};
          chrome.storage.local.set({
            lastRecordingAudioSnapshot: {
              ...prev,
              paddedSilenceCount,
              catchUpSilenceMs,
              catchUpSilenceEvents,
              catchUpSettleMs,
            },
          });
        });
      } catch {}
    } else {
      this.log("[WCR] audio loop exit");
    }
  }
}

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
import {
  AAC_SUPPORTED_RATES,
  AVC_MAX_PIXELS,
  VIDEO_DIM_HARD_CAP,
  computeAvcCappedDimensions,
  isAacRateInSpec,
  isReclaimErrorMessage,
  shouldFailZeroChunksAtStop,
  shouldResetReclaimCounter,
  shouldThrottleReclaimRebuild,
  shouldTriggerSleepRecovery,
} from "./recorderLogic";
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

    this.resizeCanvas = null;
    this.resizeCtx = null;

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
    this._encoderMaxQueueSize = Number.isFinite(options.encoderMaxQueueSize)
      ? options.encoderMaxQueueSize
      : 4;
    this._forceNextKeyframe = false;
    this._droppedForBackpressureCount = 0;
    // Audio: same pattern, deeper queue. Frames are smaller / more
    // frequent (~10-25ms vs 33ms video at 30fps).
    this._audioEncoderMaxQueueSize = Number.isFinite(options.audioEncoderMaxQueueSize)
      ? options.audioEncoderMaxQueueSize
      : 10;
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

    const { value: frame } = await reader.read();
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
    this._lastChunkAt = null;
    this._lastFailureCode = null;
    this._forceNextKeyframe = false;
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

        // Apply user/hard cap, even-rounding, and AVC pixel-area cap.
        const dimResult = computeAvcCappedDimensions({
          sourceWidth: width,
          sourceHeight: height,
          userMaxWidth: this.options?.width,
          userMaxHeight: this.options?.height,
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
          const config = {
            ...overrideConfig,
            width: this.targetWidth,
            height: this.targetHeight,
          };
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

  async stop() {
    this.log("[WCR] stop()", this.frameCount);
    perfMark("WCR.stop.enter", { frameCount: this.frameCount });

    if (this._stopping) {
      this.log("[WCR] stop() already in progress");
      return;
    }
    this._stopping = true;

    if (!this.running) {
      this.log("[WCR] stop() called but recorder not running");
      this._stopping = false;
      return;
    }

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
        const sampleRate = this.audioSampleRate || 48000;
        const audioEndUs =
          this.audioSamplesWritten > 0
            ? Math.round((this.audioSamplesWritten * 1_000_000) / sampleRate)
            : 0;
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
    if (this.muxer && !this._failureReported) {
      const endFinalize = perfSpan("WCR.stop.muxer.finalize");
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
      } catch (err) {
        endFinalize({ ok: false, err: String(err?.message || err).slice(0, 80) });
        this.err("[WCR] muxer.finalize:", err);
        this.options.onError?.(err);
        try {
          await this.muxer.flushPending();
        } catch {}
      }
    }

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

    perfMark("WCR.stop.exit");
    // Await cleanup so reader-drain completes before onStop. Bounded by the
    // 500ms per-reader cancel timeout, so it can't block stop() pathologically.
    await this.cleanup();

    if (this.options.onStop) {
      await this.options.onStop();
    }

    this._stopping = false;
  }

  // Read-only snapshot of the diagnostic counters and encoder choice.
  // Safe to call mid-recording and at stop; never throws.
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
      framesFed: this._framesFed,
      chunksOut: this._chunksOut,
      framesFromMSTP: this._framesFromMSTP,
      staticFrameSyntheticCount: this._staticFrameSyntheticCount,
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
    this.audioSamplesWritten = 0;
    this.audioSampleRate = null;
    this.audioChannelCount = null;
    this._firstAudioFrameSampleRate = null;

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
        droppedForBackpressure: {
          video: this._droppedForBackpressureCount,
          audio: this._droppedAudioForBackpressureCount,
        },
        peakEncodeQueueSize: {
          video: this._peakVideoEncodeQueueSize,
          audio: this._peakAudioEncodeQueueSize,
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
      // visibilitychange handler restart the clock on return.
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        this._armFirstChunkWatchdog();
        return;
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

  // Handle VideoEncoder.error: rebuild on HW reclaim (capped by
  // _maxEncoderReclaims), or one HW→SW rebuild for pre-first-chunk
  // async errors. Otherwise surface to onError.
  _handleVideoEncoderError(err) {
    const msg = String(err?.message || err || "");
    const isReclaim = isReclaimErrorMessage(msg);

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
    const numberOfChannels = settings.channelCount || 2;

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
          this._lastChunkAt = _nowLoopTick;
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
        const readResult = await Promise.race([
          this.videoReader
            .read()
            .then((v) => ({ ...v, isSyntheticTimeout: false }))
            .catch(() => ({
              done: true,
              value: null,
              isSyntheticTimeout: false,
            })),
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  done: false,
                  value: null,
                  isSyntheticTimeout: true,
                }),
              STATIC_FRAME_FALLBACK_MS,
            ),
          ),
        ]);

        let isSynthetic = false;
        let frame = null;
        if (readResult.isSyntheticTimeout) {
          // Track stalled; only synthesize if we've drawn a frame
          // already (else first-chunk watchdog handles no-frames).
          if (!this._firstChunkSeen || !this.resizeCanvas) {
            continue;
          }
          isSynthetic = true;
          this._staticFrameSyntheticCount += 1;
        } else {
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

          this.resizeCtx.drawImage(
            frame,
            0,
            0,
            this.targetWidth,
            this.targetHeight,
          );

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

          // Backpressure: drop the frame and force a keyframe next so
          // the stream stays decodable. An unbounded queue can stop
          // emitting chunks entirely.
          if (vQueueSize > this._encoderMaxQueueSize) {
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
              // Chrome 140+ caps the encode queue at 30 frames, throwing QuotaExceededError
              // synchronously. Drop as backpressure so an oversubscribed recording survives.
              if (encErr?.name === "QuotaExceededError") {
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

  async readAudioLoop() {
    while (this.paused && this.running) {
      await new Promise((r) => setTimeout(r, 10));
    }
    if (!this.audioReader) return;
    this.log("[WCR] audio loop start");

    const encodeAudioData = (audioData) => {
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
      const tsUs = Math.round(
        (this.audioSamplesWritten * 1_000_000) / sampleRate
      );
      const durUs = Math.round((frames * 1_000_000) / sampleRate);

      // Track peak audio encode-queue depth (leading indicator).
      const aQueueSize = this.audioEncoder.encodeQueueSize;
      if (aQueueSize > this._peakAudioEncodeQueueSize) {
        this._peakAudioEncodeQueueSize = aQueueSize;
      }

      // Backpressure mirror of the video path. Advance the sample
      // counter even on a drop so subsequent timestamps stay aligned
      // (brief silence gap, beats audio drifting out of sync).
      if (aQueueSize > this._audioEncoderMaxQueueSize) {
        this._droppedAudioForBackpressureCount += 1;
        this.audioSamplesWritten += frames;
        return;
      }

      try {
        this.audioEncoder.encode(audioData, {
          timestamp: tsUs,
        });
      } catch (encErr) {
        // Audio encode-queue overflow: drop as backpressure (mirrors video) and
        // advance the sample counter so timestamps stay aligned.
        if (encErr?.name === "QuotaExceededError") {
          this._droppedAudioForBackpressureCount += 1;
          this.audioSamplesWritten += frames;
          this.warn(
            "[WCR] audio encode() QuotaExceededError; dropping audio data",
          );
          return;
        }
        throw encErr;
      }
      this.audioSamplesWritten += frames;

      if (this.debug && (this.audioSamplesWritten === frames || this.audioSamplesWritten % (sampleRate * 10) < frames)) {
        this.log("[WCR] audio pts", {
          samples: this.audioSamplesWritten,
          tsUs,
          durUs,
          sampleRate,
        });
      }
    };

    // Windows WASAPI loopback stops yielding on silent system audio,
    // leaving audioReader.read() pending. Pad with silence.
    const SILENCE_TIMEOUT_MS = 500;
    const SILENCE_CHUNK_MS = 500;
    let paddedSilenceCount = 0;

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
        timestamp: Math.round(
          (this.audioSamplesWritten * 1_000_000) / sampleRate,
        ),
        data,
      });
    };

    try {
      while (this.running) {
        const readResult = await Promise.race([
          this.audioReader
            .read()
            .then((v) => ({ ...v, timedOut: false }))
            .catch(() => ({ done: true, timedOut: false })),
          new Promise((r) =>
            setTimeout(
              () => r({ value: null, done: false, timedOut: true }),
              SILENCE_TIMEOUT_MS,
            ),
          ),
        ]);

        if (readResult.timedOut) {
          const trackEnded =
            !this.audioTrack || this.audioTrack.readyState === "ended";
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
            paddedSilenceCount += 1;
            if (paddedSilenceCount === 1 || paddedSilenceCount % 20 === 0) {
              this.log(
                "[WCR] audio source quiet, padding silence",
                paddedSilenceCount,
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
        if (!this.audioTrack || this.audioTrack.readyState === "ended") {
          this.warn("[WCR] audio lost");
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

    if (paddedSilenceCount > 0) {
      this.log(
        "[WCR] audio loop exit, total silence chunks padded:",
        paddedSilenceCount,
      );
      try {
        chrome.storage.local.get(["lastRecordingAudioSnapshot"], (res) => {
          const prev = res?.lastRecordingAudioSnapshot || {};
          chrome.storage.local.set({
            lastRecordingAudioSnapshot: {
              ...prev,
              paddedSilenceCount,
            },
          });
        });
      } catch {}
    } else {
      this.log("[WCR] audio loop exit");
    }
  }
}

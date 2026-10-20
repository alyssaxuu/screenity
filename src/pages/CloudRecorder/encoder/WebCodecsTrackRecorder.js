// MediaRecorder-shaped wrapper around WebCodecsRecorder so Cloud's
// existing lifecycle drives WebCodecs without a refactor. fMP4
// fragments come out as Blobs via ondataavailable.

import { WebCodecsRecorder } from "../../Recorder/webcodecs/WebCodecsRecorder";
import { closeActiveEncoderPrewarm } from "../../Recorder/encoderPrewarm";
import { isWarmAdoptEnabled } from "../../Recorder/webcodecs/startupFlags";

const dispatchError = (cb, err) => {
  if (typeof cb !== "function") return;
  try {
    // Mirror MediaRecorder's onerror event shape just enough for callers
    // that read event.error.
    cb({ error: err instanceof Error ? err : new Error(String(err)) });
  } catch {}
};

export class WebCodecsTrackRecorder {
  constructor(stream, options = {}) {
    this.stream = stream;
    this.mimeType = options.mimeType || "video/mp4";
    // WebM is the no-AAC fallback (Linux), carrying VP9 + Opus.
    this.containerKind = options.containerKind === "webm" ? "webm" : "mp4";
    this.videoBitsPerSecond =
      options.videoBitsPerSecond || 16_000_000;
    this.audioBitsPerSecond = options.audioBitsPerSecond || 128_000;
    // getSettings() can report 2 channels while the bus mixes mono, and a stereo
    // encoder rejects mono AudioData (see WebCodecsRecorder).
    this.audioChannels = options.audioChannels || null;
    this.enableAudio = options.enableAudio !== false; // default true
    // Used by cloud's camera path on macOS to force a software h264
    // encoder, sidestepping VideoToolbox's per-process HW-slot serialization.
    this.preferSoftware = Boolean(options.preferSoftware);
    // Larger caps come from cloudEncodeCap.js. WCR fits the source inside, never upscales.
    this.maxWidth = Number(options.maxWidth) > 0 ? Number(options.maxWidth) : 1920;
    this.maxHeight = Number(options.maxHeight) > 0 ? Number(options.maxHeight) : 1080;
    // Frame rate the capture really delivers. Without it WebCodecsRecorder
    // encodes on a 30 fps clock and drops the frames in between, so a 60 fps
    // capture would come out at 30 with no error. Null keeps that 30 default.
    this.fps = Number(options.fps) > 0 ? Number(options.fps) : null;
    // Namespaces the decoderConfig sidecar so dual-track keys don't collide.
    this.trackKind = options.trackKind || "default";
    this.encodeStats = null;
    this.audioDiag = null;
    // MediaRecorder-shape fields used by callers.
    this._state = "inactive";
    this.ondataavailable = null;
    this.onerror = null;
    this.onstop = null;
    // Cloud's stopAllRecorders awaits this set before finalize, so
    // late ondataavailable handlers can't race the upload finalize.
    this._pendingWrites = new Set();

    this._recorder = null;
    this._stopPromise = null;
    this._finalizedResolved = false;
    // Set when the recorder fully finalizes (all bytes flushed). stop()
    // resolves on this and then fires onstop.
    this._onFinalizedResolve = null;
    this._onFinalizedPromise = new Promise((resolve) => {
      this._onFinalizedResolve = resolve;
    });
  }

  get state() {
    return this._state;
  }

  // Codec string (e.g. "avc1.640028") parsed from the first encoded chunk's
  // decoderConfig. Can differ from the requested codec when HW encoders
  // re-derive profile/level. Null until the first chunk emits.
  get actualVideoCodec() {
    return this._recorder?.actualVideoCodec || null;
  }

  // Falls back to the live recorder so a session that never finalized (stall,
  // zero frames, failed start) still reports its counters.
  getEncodeStats() {
    try {
      return this.encodeStats || this._recorder?.getEncodeStats?.() || null;
    } catch {
      return this.encodeStats || null;
    }
  }

  getAudioDiag() {
    try {
      return this.audioDiag || this._recorder?.getAudioDiag?.() || null;
    } catch {
      return this.audioDiag || null;
    }
  }

  // Diagnostic counters; safe to poll mid-recording and after stop.
  // Returns null before the inner recorder is constructed.
  getDiagSnapshot() {
    try {
      return this._recorder?.getDiagSnapshot?.() || null;
    } catch {
      return null;
    }
  }

  getPerfSnapshot() {
    try {
      return this._recorder?.getPerfSnapshot?.() || null;
    } catch {
      return null;
    }
  }

  // startOptions.startEpochMs: shared take start on this page's performance.now()
  // clock (see startLeadIn.js). Without it the file starts at its first frame.
  start(_timeslice, startOptions = {}) {
    // timeslice is a no-op: Mp4MuxerWrapper emits on its own ~1s cadence.
    if (this._state !== "inactive") {
      throw new Error(
        `WebCodecsTrackRecorder: cannot start in state ${this._state}`,
      );
    }

    const handleChunk = (uint8) => {
      if (!uint8 || uint8.byteLength === 0) return;
      const blob = new Blob([uint8], { type: this.mimeType });
      if (typeof this.ondataavailable !== "function") return;
      try {
        const maybe = this.ondataavailable({ data: blob });
        if (maybe && typeof maybe.then === "function") {
          this._pendingWrites.add(maybe);
          const settle = () => this._pendingWrites.delete(maybe);
          maybe.then(settle, (err) => {
            settle();
            console.warn("[WCTrackRecorder] ondataavailable failed:", err);
          });
        }
      } catch (err) {
        console.warn("[WCTrackRecorder] ondataavailable threw:", err);
      }
    };

    const handleFinalized = (payload) => {
      // Keep the encoder's own numbers. onFinalized was called for its side
      // effect and the payload dropped, so every prod session recorded
      // encodeStats: null.
      try {
        this.encodeStats = this._recorder?.getEncodeStats?.() || null;
      } catch {}
      try {
        this.audioDiag = this._recorder?.getAudioDiag?.() || null;
      } catch {}
      if (this._finalizedResolved) return;
      this._finalizedResolved = true;
      this._state = "inactive";
      this._onFinalizedResolve?.();
      try {
        this.onstop?.();
      } catch {}
    };

    const handleError = (err) => {
      // Sticky-disable handling for non-transient WebCodecs failures lives
      // outside this class (see chooseEncoder.js + CloudRecorder.jsx).
      // Preserves err.finalized so callers can skip sticky-disable on salvage.
      dispatchError(this.onerror, err);
    };

    // Per-track sidecar (screen/camera/audio) so a future orphan-recovery
    // path can rebuild moov from chunks. No reader exists yet; mediabunny's
    // fragmented fastStart writes moov upfront, so this is reserved.
    const handleDecoderConfig = (cfg) => {
      try {
        const desc = cfg?.description;
        let descBase64 = null;
        if (desc instanceof Uint8Array || desc instanceof ArrayBuffer) {
          const u8 = desc instanceof ArrayBuffer ? new Uint8Array(desc) : desc;
          let binary = "";
          for (let i = 0; i < u8.length; i++) {
            binary += String.fromCharCode(u8[i]);
          }
          descBase64 = btoa(binary);
        }
        chrome.storage.local.get(["cloudRecorderDecoderConfig"]).then((r) => {
          const merged = {
            ...(r?.cloudRecorderDecoderConfig || {}),
            [this.trackKind]: {
              codec: cfg?.codec || null,
              container: cfg?.container || null,
              width: cfg?.width || null,
              height: cfg?.height || null,
              description: descBase64,
              at: Date.now(),
            },
          };
          chrome.storage.local.set({ cloudRecorderDecoderConfig: merged });
        });
      } catch {}
    };

    // Screen only: camera is often forced to software. The warm encoder is
    // H.264 and claimPrewarmedEncoder doesn't check codec, so WebM/VP9 can't adopt.
    const adoptPrewarm =
      isWarmAdoptEnabled() &&
      this.trackKind === "screen" &&
      !this.preferSoftware &&
      this.containerKind !== "webm";

    this._recorder = new WebCodecsRecorder(this.stream, {
      allowPrewarmAdopt: adoptPrewarm,
      containerKind: this.containerKind,
      onChunk: handleChunk,
      onFinalized: handleFinalized,
      onError: handleError,
      onDecoderConfig: handleDecoderConfig,
      enableAudio: this.enableAudio,
      videoBitrate: this.videoBitsPerSecond,
      audioBitrate: this.audioBitsPerSecond,
      audioChannels: this.audioChannels,
      preferSoftware: this.preferSoftware,
      // 1080p default: a retina capture at L4.2 (~2.2MP) throws on the first
      // frame and leaves Bunny with the 28-byte init. Larger caps (cloudEncodeCap)
      // make WCR raise the AVC level.
      width: this.maxWidth,
      height: this.maxHeight,
      ...(this.fps ? { fps: this.fps } : {}),
      startEpochMs: startOptions?.startEpochMs,
    });
    this._state = "recording";

    // MediaRecorder.start() is sync to callers; dispatch and route errors
    // via onerror. Release the prewarm HW slot first or VideoToolbox
    // contends, unless this track adopts it. Camera never disposes it: that
    // would race the screen track's claim.
    const releasePrewarm = () => {
      if (adoptPrewarm || this.trackKind !== "screen") return null;
      return closeActiveEncoderPrewarm().catch(() => {});
    };
    Promise.resolve()
      .then(releasePrewarm)
      .then(() => this._recorder.start())
      .catch((err) => handleError(err));
  }

  // For a track whose epoch was resolved after start(). No-op before start().
  setStartEpoch(epochMs) {
    try {
      this._recorder?.setStartEpoch?.(epochMs);
    } catch {}
  }

  pause() {
    if (this._state !== "recording") return;
    try {
      this._recorder?.pause?.();
    } catch (err) {
      dispatchError(this.onerror, err);
      return;
    }
    this._state = "paused";
  }

  resume() {
    if (this._state !== "paused") return;
    try {
      this._recorder?.resume?.();
    } catch (err) {
      dispatchError(this.onerror, err);
      return;
    }
    this._state = "recording";
  }

  // Mirror MediaRecorder.stop(): return undefined; callers await onstop.
  stop() {
    if (this._state === "inactive") return;
    this._state = "inactive";
    if (!this._stopPromise) {
      this._stopPromise = (async () => {
        try {
          await this._recorder?.stop?.();
        } catch (err) {
          dispatchError(this.onerror, err);
        }
        // Force the stop callback if onFinalized never fires, so the caller's
        // drain doesn't deadlock on a hung muxer.
        if (!this._finalizedResolved) {
          this._finalizedResolved = true;
          this._onFinalizedResolve?.();
          try {
            this.onstop?.();
          } catch {}
        }
      })();
    }
  }

  // Used by CloudRecorder when the underlying stream's display track ends
  // (e.g. user clicked the OS-level "Stop sharing" chip). Same teardown
  // path as stop(), exposed for clarity.
  destroy() {
    if (this._state !== "inactive") this.stop();
  }
}

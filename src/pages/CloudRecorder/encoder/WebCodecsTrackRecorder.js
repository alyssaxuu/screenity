// MediaRecorder-shaped wrapper around WebCodecsRecorder so Cloud's
// existing lifecycle drives WebCodecs without a refactor. fMP4
// fragments come out as Blobs via ondataavailable.

import { WebCodecsRecorder } from "../../Recorder/webcodecs/WebCodecsRecorder";
import { closeActiveEncoderPrewarm } from "../../Recorder/encoderPrewarm";

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
    this.videoBitsPerSecond =
      options.videoBitsPerSecond || 16_000_000;
    this.audioBitsPerSecond = options.audioBitsPerSecond || 128_000;
    this.enableAudio = options.enableAudio !== false; // default true
    // Used by cloud's camera path on macOS to force a software h264
    // encoder, sidestepping VideoToolbox's per-process HW-slot serialization.
    this.preferSoftware = Boolean(options.preferSoftware);
    // Namespaces the decoderConfig sidecar so dual-track keys don't collide.
    this.trackKind = options.trackKind || "default";
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

  // Diagnostic counters; safe to poll mid-recording and after stop.
  // Returns null before the inner recorder is constructed.
  getDiagSnapshot() {
    try {
      return this._recorder?.getDiagSnapshot?.() || null;
    } catch {
      return null;
    }
  }

  start(_timeslice) {
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

    const handleFinalized = () => {
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

    this._recorder = new WebCodecsRecorder(this.stream, {
      onChunk: handleChunk,
      onFinalized: handleFinalized,
      onError: handleError,
      onDecoderConfig: handleDecoderConfig,
      enableAudio: this.enableAudio,
      videoBitrate: this.videoBitsPerSecond,
      audioBitrate: this.audioBitsPerSecond,
      preferSoftware: this.preferSoftware,
      // Cap at 1080p; retina captures exceed AVC L4.2 (~2.2MP) and
      // throw on first frame, leaving Bunny with the 28-byte init.
      // Bunny tier caps at 1080p anyway. WCR downscales via canvas.
      width: 1920,
      height: 1080,
    });
    this._state = "recording";

    // MediaRecorder.start() is sync to callers; dispatch and route errors
    // via onerror. Release the prewarm HW slot first or VideoToolbox contends.
    Promise.resolve()
      .then(() => closeActiveEncoderPrewarm().catch(() => {}))
      .then(() => this._recorder.start())
      .catch((err) => handleError(err));
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

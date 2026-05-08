// MediaRecorder-shaped wrapper around WebCodecsRecorder so Cloud's
// existing recorder lifecycle (start/stop/pause/resume, ondataavailable,
// _pendingWrites drain) drives WebCodecs without a refactor. Muxer
// fragments come out as fMP4 Blobs through ondataavailable; uploader
// just sees Blobs. `state` mirrors the MediaRecorder string so existing
// comparisons in CloudRecorder.jsx still work.

import { WebCodecsRecorder } from "../../Recorder/webcodecs/WebCodecsRecorder";

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

  start(_timeslice) {
    // The timeslice arg is a no-op here; Mp4MuxerWrapper emits fragments
    // on its own ~1s cadence, which is comparable to the 2000ms timeslice
    // cloud uses with MediaRecorder. Timing differs slightly but the
    // chunk-write contract (Blob events) is the same.
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
      // Surface to the caller via the MediaRecorder-shape onerror.
      dispatchError(this.onerror, err);
    };

    this._recorder = new WebCodecsRecorder(this.stream, {
      onChunk: handleChunk,
      onFinalized: handleFinalized,
      onError: handleError,
      enableAudio: this.enableAudio,
      videoBitrate: this.videoBitsPerSecond,
      audioBitrate: this.audioBitsPerSecond,
      // Cap encoded resolution at 1080p. Without this, retina screen
      // captures (often 2200x1440 or higher) exceed the AVC Level 4.2
      // max coded area (~2.2 MP) and the encoder throws NotSupportedError
      // on the first frame, leaving Bunny with only the 28-byte ftyp init.
      // 1080p matches Bunny Stream's tier ceiling, so users can't play
      // back at higher than 1080p anyway. WebCodecsRecorder downscales
      // via its resize canvas; aspect ratio is preserved.
      width: 1920,
      height: 1080,
    });
    this._state = "recording";

    // underlying recorder.start() is async; dispatch and don't block,
    // since MediaRecorder.start() is sync to the caller and startup
    // errors flow through onerror.
    Promise.resolve(this._recorder.start()).catch((err) => {
      handleError(err);
    });
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

  // MediaRecorder.stop() is sync and queues a finalize that fires onstop
  // on completion. mirror that shape: return undefined, callers await
  // onstop. WebCodecsRecorder.stop() is async and resolves after finalize;
  // we hook onFinalized to fire onstop at the right time.
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
        // if onFinalized never fires (rare: muxer hung past internal
        // timeout), force the stop callback so the caller's drain doesn't
        // deadlock. WebCodecsRecorder already has a 5s finalize timeout +
        // flushPending fallback that emits chunks.
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

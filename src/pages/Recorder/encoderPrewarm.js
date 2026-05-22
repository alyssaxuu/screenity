// Encoder pre-warm. OS encode services (VTDecoderXPCService etc) need
// a few frames before the HW pipeline locks in; diag showed real
// recordings' first ~30 frames running at 6-9fps before settling at
// 30fps. Opens a VideoEncoder with the real config, bursts synthetic
// frames, closes. Fire-and-forget; failure no-ops.

import { perfMark, perfSpan } from "../utils/perfMarks";

let _activeWarmer = null;

const computeFramerate = (config) => {
  const fps = Number(config?.framerate);
  if (!Number.isFinite(fps) || fps <= 0 || fps > 240) return 30;
  return Math.round(fps);
};

const synthesizeAndEncode = (encoder, canvas, ctx, index, framerate, keyFrame) => {
  // Vary content per frame so the encoder exercises the pipeline
  // instead of emitting empty deltas.
  const hue = (index * 17) % 360;
  ctx.fillStyle = `hsl(${hue}, 50%, 35%)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = `hsl(${(hue + 180) % 360}, 50%, 60%)`;
  ctx.fillRect(
    (index % 8) * (canvas.width / 8),
    (index % 6) * (canvas.height / 6),
    canvas.width / 8,
    canvas.height / 6,
  );
  const tsUs = Math.round((index * 1_000_000) / framerate);
  const frame = new VideoFrame(canvas, {
    timestamp: tsUs,
    duration: Math.round(1_000_000 / framerate),
  });
  try {
    encoder.encode(frame, { keyFrame });
  } finally {
    frame.close();
  }
};

/**
 * Start a prewarm encoder that opens, encodes a few frames, and
 * stays open. Returns a handle with .close(). Idempotent: a second
 * call while one is active returns the active handle.
 *
 * @param {object} cfg
 * @param {number} cfg.width
 * @param {number} cfg.height
 * @param {string} cfg.codec  e.g. "avc1.64002A"
 * @param {number} [cfg.bitrate]
 * @param {number} [cfg.framerate]
 * @returns {Promise<{close: () => Promise<void>, ms: number, chunks: number, ok: boolean}>}
 */
export const startEncoderPrewarm = async (cfg) => {
  if (_activeWarmer) return _activeWarmer.handle;
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined" || typeof OffscreenCanvas === "undefined") {
    perfMark("Recorder.encoderPrewarm.skipped", { reason: "no-webcodecs" });
    return null;
  }
  if (!cfg || !cfg.width || !cfg.height || !cfg.codec) {
    perfMark("Recorder.encoderPrewarm.skipped", { reason: "no-config" });
    return null;
  }

  const endStart = perfSpan("Recorder.encoderPrewarm.start", {
    w: cfg.width,
    h: cfg.height,
    codec: cfg.codec,
  });

  const state = {
    chunks: 0,
    encoder: null,
    canvas: null,
    ctx: null,
    closed: false,
    framerate: computeFramerate(cfg),
    keepAliveTimer: null,
    keepAliveIndex: 0,
  };
  _activeWarmer = state;

  const handle = {
    /** Close the prewarm encoder. Safe to call multiple times. */
    close: async () => {
      if (state.closed) return;
      state.closed = true;
      if (state.keepAliveTimer) {
        clearInterval(state.keepAliveTimer);
        state.keepAliveTimer = null;
      }
      if (state.encoder) {
        try {
          // No flush; the goal was OS-side warmup, not the chunks.
          state.encoder.close();
        } catch {}
      }
      _activeWarmer = null;
      perfMark("Recorder.encoderPrewarm.closed", { chunks: state.chunks });
    },
    get chunks() {
      return state.chunks;
    },
    get ok() {
      return state.encoder != null && state.chunks > 0;
    },
  };
  state.handle = handle;

  try {
    state.encoder = new VideoEncoder({
      output: () => {
        state.chunks += 1;
      },
      error: (err) => {
        perfMark("Recorder.encoderPrewarm.encoderError", {
          msg: String(err?.message || err).slice(0, 120),
        });
      },
    });
    state.encoder.configure({
      codec: cfg.codec,
      width: cfg.width,
      height: cfg.height,
      bitrate: Math.max(500_000, Number(cfg.bitrate) || 4_000_000),
      framerate: state.framerate,
      bitrateMode: "constant",
      latencyMode: "realtime",
      hardwareAcceleration: "prefer-hardware",
    });
    state.canvas = new OffscreenCanvas(cfg.width, cfg.height);
    state.ctx = state.canvas.getContext("2d");
    if (!state.ctx) {
      throw new Error("no-canvas-2d-context");
    }

    // Burst 6 frames (1 keyframe + 5 deltas) then close. No
    // keep-alive ticker: an 800ms timer on the background tab
    // triggers Chrome's intensive throttling, which makes storage
    // IPCs take 11-19s and wedges start. OS encode service stays
    // warm for a few seconds, covers most countdown windows.
    const BURST_COUNT = 6;
    for (let i = 0; i < BURST_COUNT; i++) {
      if (state.closed) return handle;
      synthesizeAndEncode(state.encoder, state.canvas, state.ctx, i, state.framerate, i === 0);
    }
    // Flush + close fire-and-forget so the caller isn't blocked.
    try {
      state.encoder.flush().catch(() => {});
    } catch {}
    try {
      state.encoder.close();
    } catch {}
    state.encoder = null;
    state.closed = true;
    _activeWarmer = null;

    endStart({ chunks: state.chunks, ok: true });
    perfMark("Recorder.encoderPrewarm.closed", { chunks: state.chunks });
    perfMark("Recorder.encoderPrewarm.ready", {
      framerate: state.framerate,
      width: cfg.width,
      height: cfg.height,
    });
  } catch (err) {
    endStart({ ok: false, error: String(err?.message || err).slice(0, 100) });
    perfMark("Recorder.encoderPrewarm.failed", {
      msg: String(err?.message || err).slice(0, 120),
    });
    if (state.encoder) {
      try {
        state.encoder.close();
      } catch {}
      state.encoder = null;
    }
    _activeWarmer = null;
    return null;
  }

  return handle;
};

/** Returns the active prewarm handle if one exists, else null. */
export const getActiveEncoderPrewarm = () => _activeWarmer?.handle || null;

/** Synchronously close any active prewarm. Safe at any time. */
export const closeActiveEncoderPrewarm = async () => {
  const h = getActiveEncoderPrewarm();
  if (h) {
    try {
      await h.close();
    } catch {}
  }
};

// Probes HW H.264 slot availability via isConfigSupported. Screen +
// camera each want a slot; returned separately so chooseEncoder can
// fall camera back to MediaRecorder/VP9 when only one slot is free.

// 4 Mbps baseline; real encoder uses the configured bitrate later.
const PROBE_BITRATE = 4_000_000;

// 64002A = High L4.2, 42E028 = Baseline L4.0 (Main 4D... omitted: silent-no-output
// bug on Chromium's Windows MFT wrapper, accepts encode() but emits no chunks).
const CODEC_CANDIDATES = [
  "avc1.64002A",
  "avc1.42E028",
];

const HW_OPTIONS = ["prefer-hardware", "no-preference"];

const buildVideoConfig = ({ codec, width, height, framerate, hwOption }) => ({
  codec,
  width,
  height,
  bitrate: PROBE_BITRATE,
  framerate,
  bitrateMode: "constant",
  latencyMode: "realtime",
  hardwareAcceleration: hwOption,
});

// Try codec × hw-option until one reports supported. SW-only H.264
// still gets WebCodecs (more reliable than MediaRecorder VP9, also SW).
// "all-mr" triggers only when every combo fails.
const probeOne = async (label, { width, height, framerate }) => {
  if (typeof VideoEncoder === "undefined") {
    return { label, supported: false, reason: "VideoEncoder unavailable" };
  }
  const attempts = [];
  for (const codec of CODEC_CANDIDATES) {
    for (const hwOption of HW_OPTIONS) {
      const config = buildVideoConfig({
        codec,
        width,
        height,
        framerate,
        hwOption,
      });
      try {
        const result = await VideoEncoder.isConfigSupported(config);
        attempts.push({
          codec,
          hwOption,
          supported: Boolean(result?.supported),
        });
        if (result?.supported) {
          return {
            label,
            supported: true,
            configResolved: result.config || config,
            attempts,
          };
        }
      } catch (err) {
        attempts.push({
          codec,
          hwOption,
          supported: false,
          error: String(err?.message || err),
        });
      }
    }
  }
  return { label, supported: false, attempts };
};

// Two-encoder concurrency probe. isConfigSupported reports each
// encoder independently; both can return supported on a one-slot HW
// (macOS especially), where the second silently falls back to
// software and runs at ~4fps. Open two real encoders and check both
// emit at rate; if the second is >2x slower, force camera onto
// MediaRecorder. 30 frames (~1s) because 8 missed it (keyframe
// buffering hides asymmetry until ~500ms in). 2s cap, memoized.
const CONCURRENT_FRAME_COUNT = 30;
const CONCURRENT_TIMEOUT_MS = 2500;
// Windows D3D11 HW encoder (crbug 1504122) crashes when frames pile into
// encode() without awaiting. Cap queue depth and yield so it can drain.
const CONCURRENT_QUEUE_YIELD_EVERY = 5;
const CONCURRENT_MAX_QUEUE_DEPTH = 16;

const probeConcurrentHw = async ({ codec, framerate }) => {
  if (
    typeof VideoEncoder === "undefined" ||
    typeof VideoFrame === "undefined" ||
    typeof OffscreenCanvas === "undefined"
  ) {
    return { ran: false, reason: "no-webcodecs" };
  }
  const width = 1280;
  const height = 720;
  const config = {
    codec,
    width,
    height,
    bitrate: PROBE_BITRATE,
    framerate,
    bitrateMode: "constant",
    latencyMode: "realtime",
    hardwareAcceleration: "prefer-hardware",
  };
  const makeEncoder = () => {
    let chunks = 0;
    let error = null;
    const encoder = new VideoEncoder({
      output: () => {
        chunks += 1;
      },
      error: (err) => {
        error = String(err?.message || err);
      },
    });
    try {
      encoder.configure(config);
    } catch (err) {
      try {
        encoder.close();
      } catch {}
      return null;
    }
    return {
      encoder,
      getChunks: () => chunks,
      getError: () => error,
      close: () => {
        try {
          encoder.close();
        } catch {}
      },
    };
  };

  const a = makeEncoder();
  const b = makeEncoder();
  if (!a || !b) {
    a?.close();
    b?.close();
    return { ran: false, reason: "configure-failed" };
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    a.close();
    b.close();
    return { ran: false, reason: "no-2d-context" };
  }
  const started =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  let queueOverflow = false;
  let framesSubmitted = 0;
  for (let i = 0; i < CONCURRENT_FRAME_COUNT; i++) {
    ctx.fillStyle = `hsl(${(i * 31) % 360}, 50%, 40%)`;
    ctx.fillRect(0, 0, width, height);
    const ts = Math.round((i * 1_000_000) / framerate);
    const dur = Math.round(1_000_000 / framerate);
    try {
      const frameA = new VideoFrame(canvas, {
        timestamp: ts,
        duration: dur,
      });
      a.encoder.encode(frameA, { keyFrame: i === 0 });
      frameA.close();
    } catch {}
    try {
      const frameB = new VideoFrame(canvas, {
        timestamp: ts,
        duration: dur,
      });
      b.encoder.encode(frameB, { keyFrame: i === 0 });
      frameB.close();
    } catch {}
    framesSubmitted = i + 1;

    // Yield every N frames so the encoder can drain. If either queue runs past
    // the cap, HW is starved: bail and let the caller treat it as not-concurrent.
    if (i % CONCURRENT_QUEUE_YIELD_EVERY === CONCURRENT_QUEUE_YIELD_EVERY - 1) {
      await new Promise((r) => setTimeout(r, 0));
      let qa = 0;
      let qb = 0;
      try {
        qa = a.encoder?.encodeQueueSize ?? 0;
        qb = b.encoder?.encodeQueueSize ?? 0;
      } catch {}
      if (
        qa > CONCURRENT_MAX_QUEUE_DEPTH ||
        qb > CONCURRENT_MAX_QUEUE_DEPTH
      ) {
        queueOverflow = true;
        break;
      }
    }
  }
  try {
    await Promise.race([
      Promise.allSettled([a.encoder.flush(), b.encoder.flush()]),
      new Promise((r) => setTimeout(r, CONCURRENT_TIMEOUT_MS)),
    ]);
  } catch {}
  const elapsed =
    (typeof performance !== "undefined" ? performance.now() : Date.now()) -
    started;
  const aChunks = a.getChunks();
  const bChunks = b.getChunks();
  a.close();
  b.close();
  // Healthy dual-HW: both encoders emit close to the input frame count.
  // We require at least 4 chunks from each (allowing for encoder
  // buffering of the last keyframe close-out). A 2x ratio is the
  // tripwire: anything worse means the second encoder is starved.
  // Queue overflow is itself a not-concurrent signal: HW couldn't drain.
  const minPerEncoder = 4;
  const concurrent =
    !queueOverflow &&
    aChunks >= minPerEncoder &&
    bChunks >= minPerEncoder &&
    Math.max(aChunks, bChunks) / Math.max(1, Math.min(aChunks, bChunks)) < 2;
  return {
    ran: true,
    concurrent,
    aChunks,
    bChunks,
    framesSubmitted,
    queueOverflow,
    elapsedMs: Math.round(elapsed),
  };
};

// MP4 carries AAC audio. probeOne only verifies the H.264 *video* encoder, so
// a build that encodes H.264 but not AAC (some Chromium builds without
// proprietary codecs) would pick the WebCodecs MP4 path and then silently drop
// audio. AAC support is device-global, so probe it once; when missing,
// chooseEncoder routes video tracks to MediaRecorder (VP9-WebM), which records
// audio natively. isConfigSupported-only, matching the video probe's style.
const AAC_PROBE_CONFIG = {
  codec: "mp4a.40.2",
  sampleRate: 48000,
  numberOfChannels: 2,
  bitrate: 128000,
};

const probeAacSupported = async () => {
  if (typeof AudioEncoder === "undefined") return false;
  try {
    const support = await AudioEncoder.isConfigSupported(AAC_PROBE_CONFIG);
    return Boolean(support?.supported);
  } catch {
    return false;
  }
};

export const probeHwSlots = async ({
  framerate = 30,
} = {}) => {
  // Probe at 720p baseline; modern HW that encodes 720p H.264 handles
  // anything we'd capture. Probing at the real resolution is flaky:
  // getSettings() lies during track warmup, and headless Chromium
  // rejects 1080p that the real encoder accepts once started.
  const screenProbe = await probeOne("screen", {
    width: 1280,
    height: 720,
    framerate,
  });
  const cameraProbe = await probeOne("camera", {
    width: 1280,
    height: 720,
    framerate,
  });

  // Second stage: both probes can claim supported while only one HW
  // slot exists per process (macOS especially). Diag showed camera
  // at 4fps SW fallback in this case.
  let concurrentProbe = null;
  if (screenProbe.supported && cameraProbe.supported) {
    const codec =
      screenProbe.configResolved?.codec ||
      cameraProbe.configResolved?.codec ||
      CODEC_CANDIDATES[0];
    try {
      concurrentProbe = await probeConcurrentHw({ codec, framerate });
    } catch {
      concurrentProbe = { ran: false, reason: "exception" };
    }
  }

  // macOS VideoToolbox h264 serializes per process; a second concurrent
  // prefer-hardware silently falls back to SW at unpredictable fps.
  // Route camera to explicit SW (below) to avoid contending the slot.
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMacUA = /Mac OS X|Macintosh/i.test(ua);

  // cameraHw=false still records via WebCodecs SW (same h264 MP4).
  // Only flip to MediaRecorder when isConfigSupported itself fails.
  const cameraHwAvailable =
    cameraProbe.supported &&
    (!concurrentProbe || !concurrentProbe.ran || concurrentProbe.concurrent);

  // Force SW h264 for camera on macOS or when the concurrent probe
  // showed HW starvation. Same h264 MP4 output, just SW backend.
  const cameraPreferSoftware =
    isMacUA ||
    Boolean(concurrentProbe?.ran && concurrentProbe.concurrent === false);

  // cameraHw is "viable for WebCodecs encoding". Software h264 still
  // counts; server only cares about the bitstream, not the backend.
  // The only way cameraHw becomes false is if isConfigSupported itself
  // rejected every codec candidate at the individual probe step.
  const cameraHwViable = cameraProbe.supported;

  const aacSupported = await probeAacSupported();

  return {
    screen: screenProbe,
    camera: cameraProbe,
    concurrentProbe,
    summary: {
      screenHw: screenProbe.supported,
      cameraHw: cameraHwViable,
      aacSupported,
      cameraHwAvailable,
      cameraHwAdvertised: cameraProbe.supported,
      cameraPreferSoftware,
      concurrent: concurrentProbe?.concurrent ?? null,
      concurrentRan: Boolean(concurrentProbe?.ran),
      isMacUA,
      // - dual-hw                    → both encoders WebCodecs, both HW
      // - dual-webcodecs-camera-sw   → both encoders WebCodecs, camera SW
      //                                (Mac or HW-contended hardware)
      // - screen-hw-camera-mr        → only screen can use h264; camera
      //                                falls back to MediaRecorder VP9
      // - all-mr                     → no WebCodecs h264 support at all
      mode: screenProbe.supported
        ? cameraHwViable
          ? cameraPreferSoftware
            ? "dual-webcodecs-camera-sw"
            : "dual-hw"
          : "screen-hw-camera-mr"
        : "all-mr",
    },
  };
};

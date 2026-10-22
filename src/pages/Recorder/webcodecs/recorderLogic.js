// Pure helpers split out from WebCodecsRecorder so the decision logic
// is unit-testable in Node without mocking VideoEncoder/MSTP.
// Tests: tests/unit/recorderLogic.test.mjs

// AVC Level 5.1 max encoded frame area (~4K). Outer safety net: our
// preferred codec strings declare lower levels (4.2 ~2.07M, 3.0 ~414K)
// but Chrome usually clamps the level silently during HW renegotiation.
// This stops the pathological 6K+ case across NVENC/VT/VAAPI.
export const AVC_MAX_PIXELS = 9_437_184;

// Per-dimension cap before area cap runs. 3840 covers all 4K configs.
export const VIDEO_DIM_HARD_CAP = 3840;

// AAC-LC valid sample rates per ISO/IEC 14496-3. Necessary but not
// sufficient: implementations may still reject rate/bitrate combos
// (e.g. BT HFP narrowband lands at rates the encoder claims to support
// but chokes on at typical bitrates).
export const AAC_SUPPORTED_RATES = Object.freeze(
  new Set([
    8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000, 64000,
    88200, 96000,
  ]),
);

// Chrome reports reclaim via message text, not a structured code.
const RECLAIM_MESSAGE_RE = /codec\s+reclaimed|reclaimed\s+due\s+to\s+inactivity/i;

export function isReclaimErrorMessage(errOrMessage) {
  if (!errOrMessage) return false;
  const msg =
    typeof errOrMessage === "string"
      ? errOrMessage
      : String(errOrMessage?.message || errOrMessage || "");
  return RECLAIM_MESSAGE_RE.test(msg);
}

// Desktop Linux Chrome has no hardware VideoEncoder by default and treats prefer-hardware
// as required: configure() passes, then it errors or emits nothing for ~12s until the
// watchdog rebuilds in software. ChromeOS and Android have hardware encode.
export function isLinuxDesktopUserAgent(ua) {
  if (typeof ua !== "string") return false;
  return /\bLinux\b/.test(ua) && !/\b(Android|CrOS)\b/.test(ua);
}

export function isAacRateInSpec(rate) {
  return Number.isFinite(rate) && AAC_SUPPORTED_RATES.has(rate);
}

// The probe's config carries its own bitrate/framerate from probing at
// 1280x720; reused verbatim it pinned every recording to the probe's 4 Mbps.
// Codec from the probe, rate settings from the caller.
export function applyEncoderConfigOverrides(
  probeConfig,
  { width, height, bitrate, framerate },
) {
  const config = { ...probeConfig, width, height };
  if (Number.isFinite(bitrate) && bitrate > 0) config.bitrate = bitrate;
  if (Number.isFinite(framerate) && framerate > 0) config.framerate = framerate;
  return config;
}

// Cap each dim by min(userMax, hardCap), preserve aspect, round even
// (H.264 requirement) with min 32, then scale down if total pixels
// still exceed avcMaxPixels.
export function computeAvcCappedDimensions({
  sourceWidth,
  sourceHeight,
  userMaxWidth = null,
  userMaxHeight = null,
  hardCap = VIDEO_DIM_HARD_CAP,
  avcMaxPixels = AVC_MAX_PIXELS,
}) {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0
  ) {
    throw new Error("computeAvcCappedDimensions: invalid source dimensions");
  }
  const userW = Number.isFinite(userMaxWidth) ? userMaxWidth : hardCap;
  const userH = Number.isFinite(userMaxHeight) ? userMaxHeight : hardCap;
  const effectiveCapW = Math.min(userW, hardCap);
  const effectiveCapH = Math.min(userH, hardCap);

  let width = Math.min(sourceWidth, effectiveCapW);
  let height = Math.round((sourceHeight / sourceWidth) * width);
  if (height > effectiveCapH) {
    height = effectiveCapH;
    width = Math.round((sourceWidth / sourceHeight) * height);
  }
  const perDimCapped = width < sourceWidth || height < sourceHeight;

  width = Math.max(32, width - (width % 2));
  height = Math.max(32, height - (height % 2));

  let areaCapped = false;
  if (width * height > avcMaxPixels) {
    areaCapped = true;
    const scale = Math.sqrt(avcMaxPixels / (width * height));
    width = Math.max(32, Math.floor((width * scale) / 2) * 2);
    height = Math.max(32, Math.floor((height * scale) / 2) * 2);
  }

  return { width, height, capped: { perDim: perDimCapped, area: areaCapped } };
}

// Backpressure ate ~67% of the opening frames at 1080p while a cold encoder
// ramped. Buffered frames keep wall-clock PTS, so they encode late but land.
export const STARTUP_QUEUE_CAP = 60;
// Whichever hits first ends the grace window.
export const STARTUP_HARD_FRAME_LIMIT = 90;
export const STARTUP_HARD_MS = 3000;
// Drained depth, and how many frames must hold there to count as caught up.
export const STARTUP_CAUGHT_UP_QUEUE = 2;
export const STARTUP_CAUGHT_UP_RUN = 10;

// 4, not NV12's 1.5: canvas-backed frames stay RGBA until the encoder converts
// them, so NV12 undercounts the queue by ~2.7x.
export const FRAME_BYTES_PER_PIXEL = 4;

// The startup window is transient (~1s) so it can borrow more; the steady
// depth is held all recording, and 16 frames at 4K would cost ~530MB.
export const STARTUP_QUEUE_BYTE_BUDGET = 384 * 1024 * 1024;
export const STEADY_QUEUE_BYTE_BUDGET = 160 * 1024 * 1024;
export const STEADY_QUEUE_CAP = 16;
export const STEADY_QUEUE_MIN = 4;

export function computeStartupQueueCap({
  width,
  height,
  maxFrames = STARTUP_QUEUE_CAP,
  byteBudget = STARTUP_QUEUE_BYTE_BUDGET,
  steadyCap = 4,
} = {}) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return maxFrames;
  }
  const frameBytes = width * height * FRAME_BYTES_PER_PIXEL;
  const byFrames = Math.floor(byteBudget / frameBytes);
  return Math.max(steadyCap, Math.min(maxFrames, byFrames));
}

// Steady-state backpressure cap, bounded by the same byte budget. Unlike the
// startup window this depth is a sustained memory cost, not a transient one.
export function computeSteadyQueueCap({
  width,
  height,
  maxFrames = STEADY_QUEUE_CAP,
  byteBudget = STEADY_QUEUE_BYTE_BUDGET,
  minFrames = STEADY_QUEUE_MIN,
} = {}) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return maxFrames;
  }
  const frameBytes = width * height * FRAME_BYTES_PER_PIXEL;
  const byFrames = Math.floor(byteBudget / frameBytes);
  return Math.max(minFrames, Math.min(maxFrames, byFrames));
}

// Cap for the frame about to be encoded. Returns the steady cap once the
// encoder catches up or the window expires; the caller latches that answer
// so the window never reopens.
export function computeEffectiveQueueCap({
  framesSinceStart = 0,
  elapsedMs = 0,
  caughtUp = false,
  steadyCap = 4,
  startupCap = STARTUP_QUEUE_CAP,
  hardFrameLimit = STARTUP_HARD_FRAME_LIMIT,
  hardMs = STARTUP_HARD_MS,
  disabled = false,
} = {}) {
  const steady = Number.isFinite(steadyCap) ? steadyCap : 4;
  if (disabled) return steady;
  if (caughtUp) return steady;
  if (Number.isFinite(hardFrameLimit) && framesSinceStart > hardFrameLimit) {
    return steady;
  }
  if (Number.isFinite(hardMs) && elapsedMs > hardMs) return steady;
  const startup = Number.isFinite(startupCap) ? startupCap : steady;
  return Math.max(steady, startup);
}

// Early-exit bar for the warm loop, bounded by frames/ms so a stuck warm
// gives up. The bar for counting as warm is PREWARM_MIN_WARM_CHUNKS.
export const PREWARM_READY_CHUNKS = 30;
export const PREWARM_MAX_FRAMES = 150;
export const PREWARM_MAX_MS = 4000;
// 1, not a real count: a slow cold encoder emits only a handful in the warm
// window and is still warm (measured: 4 chunks, then 0 drops at queue 0).
export const PREWARM_MIN_WARM_CHUNKS = 1;
// An unclaimed warm encoder holds a HW slot. If nothing adopts it in this
// window the recording took another path; close it.
export const PREWARM_UNCLAIMED_MAX_MS = 20000;

// Warm-until-ready predicate: enough chunks out AND the queue drained, or a
// bound was hit (ready=false, done=true means give up and stop feeding).
export function evaluatePrewarmProgress({
  chunksOut = 0,
  queueSize = 0,
  framesFed = 0,
  elapsedMs = 0,
  minChunks = PREWARM_READY_CHUNKS,
  maxFrames = PREWARM_MAX_FRAMES,
  maxMs = PREWARM_MAX_MS,
} = {}) {
  if (chunksOut >= minChunks && queueSize === 0) {
    return { ready: true, done: true, reason: "warm" };
  }
  if (framesFed >= maxFrames) {
    return { ready: false, done: true, reason: "frame-limit" };
  }
  if (elapsedMs >= maxMs) {
    return { ready: false, done: true, reason: "time-limit" };
  }
  return { ready: false, done: false, reason: "feeding" };
}

// The warm encoder was configured at the ceiling; the recording may run at
// smaller dims. Reconfiguring a drained encoder is free but pointless when
// nothing the session cares about differs.
export function shouldReconfigureAdoptedEncoder(warmConfig, finalConfig) {
  if (!warmConfig || !finalConfig) return true;
  const keys = [
    "codec",
    "width",
    "height",
    "bitrate",
    "framerate",
    "bitrateMode",
    "latencyMode",
    "hardwareAcceleration",
  ];
  return keys.some((k) => {
    const a = warmConfig[k];
    const b = finalConfig[k];
    if (a === undefined && b === undefined) return false;
    return a !== b;
  });
}

// Only what the SPS describes invalidates the captured decoderConfig: codec
// and coded dims. Bitrate/framerate/latencyMode don't, and nulling the replay
// for those loses the header-only-file safety net for no reason.
export function shouldInvalidateDecoderConfig(warmConfig, finalConfig) {
  if (!warmConfig || !finalConfig) return true;
  return ["codec", "width", "height"].some(
    (k) => warmConfig[k] !== finalConfig[k],
  );
}

// Adoption gate. The warm encoder is hardware-preferred, so a session that
// asked for software must build its own.
export function canAdoptPrewarmedEncoder({
  hasWarmer = false,
  warm = false,
  claimed = false,
  closed = false,
  encoderState = null,
  disabled = false,
  allowAdopt = true,
  preferSoftware = false,
} = {}) {
  if (disabled || !allowAdopt || preferSoftware) return false;
  if (!hasWarmer || !warm || claimed || closed) return false;
  return encoderState === "configured";
}

// Skip a rebuild if the last one was within the throttle window;
// otherwise encoder.error fires per frame and burns the cap in ms.
export function shouldThrottleReclaimRebuild(
  nowMs,
  lastRebuildAtMs,
  throttleMs,
) {
  if (lastRebuildAtMs === null || lastRebuildAtMs === undefined) return false;
  if (!Number.isFinite(throttleMs) || throttleMs <= 0) return false;
  return nowMs - lastRebuildAtMs < throttleMs;
}

// After resetAfterMs of clean chunks since the last reclaim, restore
// the full rebuild budget for a future intermittent reclaim.
export function shouldResetReclaimCounter(
  lastChunkAtMs,
  lastReclaimAtMs,
  resetAfterMs,
  currentCount,
) {
  if (currentCount <= 0) return false;
  if (lastReclaimAtMs === null || lastReclaimAtMs === undefined) return false;
  return lastChunkAtMs - lastReclaimAtMs >= resetAfterMs;
}

// Frame-arrival gap above sleepGapMs is treated as wake-from-sleep. Gated
// on running/!stopping to suppress spurious detections after stop().
export function shouldTriggerSleepRecovery(
  nowMs,
  lastFrameArrivalAtMs,
  sleepGapMs,
  firstChunkSeen,
  running = true,
  stopping = false,
) {
  if (!running || stopping) return false;
  if (!firstChunkSeen) return false;
  if (lastFrameArrivalAtMs === null || lastFrameArrivalAtMs === undefined) {
    return false;
  }
  if (!Number.isFinite(sleepGapMs) || sleepGapMs <= 0) return false;
  return nowMs - lastFrameArrivalAtMs > sleepGapMs;
}

// Flush resolved but no chunks were emitted: a header-only file plays
// silently as a corrupt blob. Caller swaps to MediaRecorder.
export function shouldFailZeroChunksAtStop(firstChunkSeen, frameCount) {
  return !firstChunkSeen || frameCount === 0;
}

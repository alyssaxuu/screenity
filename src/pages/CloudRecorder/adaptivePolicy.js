// Adaptive quality policy for weak machines (design.md Q3). Pure: no timers,
// chrome.*, or DOM, so it is unit tested on its own like screenFps.js. The
// caller feeds one sample every TICK_MS and applies the action that comes back.
// Tests: tests/unit/adaptivePolicy.test.mjs
//
// Gated by a server flag, default OFF. Flag off, or config missing, unreachable
// or malformed: every entry point is inert, start rung is R0, the take is never
// changed.
//
// Server config: /api/auth/verify user.flags, { adaptivePolicy: true,
// adaptivePolicyThresholds: {...} } (keys in SERVER_KEYS, plus useCpuPressure).
// Every key is optional; invalid or out of range falls back to the default. The
// flag must be the literal boolean true.

// Caller contract. Every TICK_MS the caller passes one sample:
//   t              active take ms (paused time excluded), strictly increasing
//   elapsedMs      ms this sample covers; capped here at t minus the last t, so a
//                  clock that kept running through a pause cannot stretch it
//   longTaskMs     long-task ms since the last sample
//   chunkIntervalsMs  intervals between recorder chunks that ended since the
//                  last sample; msSinceChunk the open interval right now
// Call pause() when the take pauses and resume() when it continues; the first
// sample after resume() has its chunk data dropped, since a gap across the
// pause is not load. A caller that forgets resume() just gets no actions.
// tick() never throws; a bad sample is ignored.

// The caller ticks at this rate, whatever the config says.
export const TICK_MS = 2000;

// Frame rate steps, index 0 is the best.
export const SCREEN_FPS_STEPS = [30, 24, 20, 15];
export const CAMERA_FPS_STEPS = [30, 24, 15];
const FULL_SCREEN_FPS = SCREEN_FPS_STEPS[0];

// Start rungs (R4 is mid-take only). screen/camera are step indexes. size is
// the capture size cap: "user" keeps her quality setting, "720p" caps it.
export const RUNGS = [
  {
    id: "R0",
    screen: 0,
    camera: 0,
    size: "user",
    cameraMaxHeight: null,
    bitrateCap: null,
  },
  {
    id: "R1",
    screen: 0,
    camera: 1,
    size: "user",
    cameraMaxHeight: 720,
    bitrateCap: null,
  },
  {
    id: "R2",
    screen: 1,
    camera: 2,
    size: "user",
    cameraMaxHeight: 480,
    bitrateCap: null,
  },
  {
    id: "R3",
    screen: 1,
    camera: 2,
    size: "720p",
    cameraMaxHeight: 480,
    bitrateCap: 8_000_000,
  },
];
export const MAX_START_RUNG = RUNGS.length - 1;
const LAST_FPS_RUNG = 2;

// Her quality settings (VIDEO_QUALITIES keys in recorderConfig.js). Anything
// else is recorded as null.
export const QUALITY_VALUES = [
  "4k",
  "1080p",
  "720p",
  "480p",
  "360p",
  "240p",
  "default",
];
const qualityOrNull = (q) => (QUALITY_VALUES.includes(q) ? q : null);
// Capture height her setting asks for; null when it has no fixed height.
const QUALITY_HEIGHT = {
  "4k": 2160,
  "1080p": 1080,
  "720p": 720,
  "480p": 480,
  "360p": 360,
  "240p": 240,
};
const heightOf = (q) => QUALITY_HEIGHT[q] ?? null;

// Accepts the raw server flags or resolveConfig's output. Passing one where the
// other was expected used to turn the policy off silently.
const asConfig = (c) =>
  c && typeof c === "object" && typeof c.enabled === "boolean" && c.thresholds
    ? c
    : resolveConfig(c);

export const DEFAULT_THRESHOLDS = Object.freeze({
  tickMs: TICK_MS,
  windowMs: 10_000,
  lagSeriousMs: 200,
  lagCriticalMs: 1000,
  longTaskSeriousShare: 0.3,
  longTaskCriticalShare: 0.6,
  chunkMedianSeriousMs: 2600,
  chunkCriticalMs: 6000,
  micGapMinMs: 100,
  micGapSeriousCount: 5,
  heapCriticalFrac: 0.85,
  // CPU pressure has no threshold in the design, so it only counts when the
  // server turns it on.
  useCpuPressure: false,
  criticalToCameraStopMs: 30_000,
  nominalBeforeUpMs: 60_000,
  maxDownBeforeNoUp: 3,
  historyTakes: 3,
});

// Share of the window that must be over a threshold for a per-sample signal
// (lag, heap, CPU pressure) to count. One bad tick in five does not.
const MOSTLY = 0.6;

// Accepted range per threshold (server key in the comment). Out of range means
// the default, never a clamp. The floors sit above the values that would degrade
// every machine (a 2 s timeslice already makes a 2 s chunk interval normal).
export const BOUNDS = {
  windowMs: [3 * TICK_MS, 60_000], // windowMs
  lagSeriousMs: [100, 5000], // serious.lagP90Ms
  lagCriticalMs: [300, 30_000], // critical.lagP90Ms
  longTaskSeriousShare: [0.1, 0.95], // serious.longTaskShare
  longTaskCriticalShare: [0.2, 1], // critical.longTaskShare
  chunkMedianSeriousMs: [2500, 20_000], // serious.chunkIntervalMedianMs
  chunkCriticalMs: [4000, 60_000], // critical.chunkIntervalMaxMs
  micGapMinMs: [50, 2000], // serious.micGapMs
  micGapSeriousCount: [1, 100], // serious.micGapCount
  heapCriticalFrac: [0.7, 0.99], // critical.heapShare
  criticalToCameraStopMs: [10_000, 300_000], // r4CriticalMs
  nominalBeforeUpMs: [10_000, 600_000], // upNominalMs
  maxDownBeforeNoUp: [1, 10], // maxDownSteps
  historyTakes: [1, 5], // historyTakes
};

// Counts: a fraction is invalid, not rounded.
const INTEGER_KEYS = new Set([
  "maxDownBeforeNoUp",
  "historyTakes",
  "micGapSeriousCount",
]);

// Server key (flat or nested under serious/critical) -> internal key.
const SERVER_KEYS = [
  [["windowMs"], "windowMs"],
  [["r4CriticalMs"], "criticalToCameraStopMs"],
  [["upNominalMs"], "nominalBeforeUpMs"],
  [["maxDownSteps"], "maxDownBeforeNoUp"],
  [["historyTakes"], "historyTakes"],
  [["serious", "lagP90Ms"], "lagSeriousMs"],
  [["serious", "longTaskShare"], "longTaskSeriousShare"],
  [["serious", "chunkIntervalMedianMs"], "chunkMedianSeriousMs"],
  [["serious", "micGapCount"], "micGapSeriousCount"],
  [["serious", "micGapMs"], "micGapMinMs"],
  [["critical", "lagP90Ms"], "lagCriticalMs"],
  [["critical", "longTaskShare"], "longTaskCriticalShare"],
  [["critical", "chunkIntervalMaxMs"], "chunkCriticalMs"],
  [["critical", "heapShare"], "heapCriticalFrac"],
];

// Raw server flags in ({ adaptivePolicy, adaptivePolicyThresholds }), a complete
// config out. Anything but a literal true is off. Never throws.
export const resolveConfig = (raw) => {
  const out = { enabled: false, thresholds: { ...DEFAULT_THRESHOLDS } };
  try {
    if (!raw || typeof raw !== "object") return out;
    out.enabled = raw.adaptivePolicy === true;
    const t = raw.adaptivePolicyThresholds;
    if (t && typeof t === "object") {
      for (const [path, key] of SERVER_KEYS) {
        const v = path.length === 1 ? t[path[0]] : t[path[0]]?.[path[1]];
        const [lo, hi] = BOUNDS[key];
        if (
          typeof v === "number" &&
          Number.isFinite(v) &&
          v >= lo &&
          v <= hi &&
          (!INTEGER_KEYS.has(key) || Number.isInteger(v))
        ) {
          out.thresholds[key] = v;
        }
      }
      if (t.useCpuPressure === true) out.thresholds.useCpuPressure = true;
    }
    // Critical must stay above serious, whatever the server sent. A pair that
    // crosses goes back to the defaults together (raise both keys to move them).
    const th = out.thresholds;
    if (th.lagCriticalMs <= th.lagSeriousMs) {
      th.lagCriticalMs = DEFAULT_THRESHOLDS.lagCriticalMs;
      th.lagSeriousMs = DEFAULT_THRESHOLDS.lagSeriousMs;
    }
    if (th.longTaskCriticalShare <= th.longTaskSeriousShare) {
      th.longTaskCriticalShare = DEFAULT_THRESHOLDS.longTaskCriticalShare;
      th.longTaskSeriousShare = DEFAULT_THRESHOLDS.longTaskSeriousShare;
    }
    if (th.chunkCriticalMs <= th.chunkMedianSeriousMs) {
      th.chunkCriticalMs = DEFAULT_THRESHOLDS.chunkCriticalMs;
      th.chunkMedianSeriousMs = DEFAULT_THRESHOLDS.chunkMedianSeriousMs;
    }
  } catch {
    return { enabled: false, thresholds: { ...DEFAULT_THRESHOLDS } };
  }
  return out;
};

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const nonNeg = (v) => (finite(v) && v >= 0 ? v : null);

const median = (values) => {
  if (!values.length) return null;
  const s = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// Share of the window (total samples) whose value is over a limit, or null with
// no values. A sample that carries no value is not over, so one lag reading
// among silent ticks is one vote out of the window, not 100%.
const shareOver = (values, limit, total) =>
  values.length
    ? values.filter((v) => v > limit).length / Math.max(total, values.length)
    : null;

const hasSignal = (s) =>
  nonNeg(s?.lagP90Ms) !== null ||
  nonNeg(s?.longTaskMs) !== null ||
  nonNeg(s?.msSinceChunk) !== null ||
  (Array.isArray(s?.chunkIntervalsMs) && s.chunkIntervalsMs.length > 0);

// Verdict for a set of samples: nominal, serious, critical, or unknown when no
// sample carries a signal (silence is not calm). Exported for the calibration run.
export const judgeWindow = (samples, th = DEFAULT_THRESHOLDS) => {
  const serious = [];
  const critical = [];
  if (!samples.some(hasSignal))
    return { level: "unknown", serious, critical, metrics: {} };

  const total = samples.length;
  const lags = samples.map((s) => s.lagP90Ms).filter((v) => nonNeg(v) !== null);
  const lagCritShare = shareOver(lags, th.lagCriticalMs, total);
  const lagSeriousShare = shareOver(lags, th.lagSeriousMs, total);
  if (lagCritShare !== null && lagCritShare >= MOSTLY) critical.push("lag");
  else if (lagSeriousShare !== null && lagSeriousShare >= MOSTLY)
    serious.push("lag");

  // Long-task share of the time the window spans. Negative inputs are ignored.
  let taskMs = 0;
  let spanMs = 0;
  for (const s of samples) {
    const el = nonNeg(s.elapsedMs);
    const span = el !== null && el > 0 ? el : th.tickMs;
    spanMs += span;
    taskMs += Math.min(nonNeg(s.longTaskMs) ?? 0, span);
  }
  const taskShare = spanMs > 0 ? Math.min(1, taskMs / spanMs) : 0;
  if (taskShare > th.longTaskCriticalShare) critical.push("long-tasks");
  else if (taskShare > th.longTaskSeriousShare) serious.push("long-tasks");

  // Chunk cadence: finished intervals plus the open one (no chunk yet), so a
  // stall that has not ended still counts.
  const intervals = [];
  for (const s of samples) {
    if (Array.isArray(s.chunkIntervalsMs)) {
      for (const v of s.chunkIntervalsMs)
        if (nonNeg(v) !== null) intervals.push(v);
    }
  }
  const open = nonNeg(samples[samples.length - 1].msSinceChunk);
  const all = open !== null ? [...intervals, open] : intervals;
  const chunkMedian = median(intervals);
  let chunkMax = null;
  for (const v of all) if (chunkMax === null || v > chunkMax) chunkMax = v;
  if (chunkMax !== null && chunkMax > th.chunkCriticalMs)
    critical.push("chunk-gap");
  else if (chunkMedian !== null && chunkMedian > th.chunkMedianSeriousMs)
    serious.push("chunk-cadence");

  let micGaps = 0;
  for (const s of samples) {
    if (Array.isArray(s.micGapsMs)) {
      micGaps += s.micGapsMs.filter(
        (g) => finite(g) && g >= th.micGapMinMs
      ).length;
    }
  }
  if (micGaps >= th.micGapSeriousCount) serious.push("mic-gaps");

  const heaps = samples
    .filter((s) => finite(s.heapUsed) && finite(s.heapLimit) && s.heapLimit > 0)
    .map((s) => s.heapUsed / s.heapLimit);
  const heapShare = shareOver(heaps, th.heapCriticalFrac, total);
  if (heapShare !== null && heapShare >= MOSTLY) critical.push("heap");

  if (th.useCpuPressure) {
    const ps = samples
      .map((s) => s.pressure)
      .filter((p) => typeof p === "string");
    if (ps.length) {
      const denom = Math.max(total, ps.length);
      const crit = ps.filter((p) => p === "critical").length / denom;
      const ser =
        ps.filter((p) => p === "serious" || p === "critical").length / denom;
      if (crit >= MOSTLY) critical.push("cpu-pressure");
      else if (ser >= MOSTLY) serious.push("cpu-pressure");
    }
  }

  const level = critical.length
    ? "critical"
    : serious.length
    ? "serious"
    : "nominal";
  return {
    level,
    serious,
    critical,
    metrics: {
      lagP90Ms: lags.length ? lags[lags.length - 1] : null,
      longTaskShare: Math.round(taskShare * 1000) / 1000,
      chunkMedianMs: chunkMedian,
      chunkMaxMs: chunkMax,
      micGaps,
      heapFrac: heaps.length
        ? Math.round(heaps[heaps.length - 1] * 1000) / 1000
        : null,
    },
  };
};

// What a take that went badly looks like in the device history. One entry per
// finished take, newest last: { hostLost, startFail, micEndedUnderLoad,
// heavyLoad } as booleans.
export const historyTakeIsBad = (take) =>
  Boolean(
    take &&
      typeof take === "object" &&
      (take.hostLost ||
        take.startFail ||
        take.micEndedUnderLoad ||
        take.heavyLoad)
  );

// Smaller of her capture height and the rung's cap (720 for R3). Her setting is
// a ceiling on size, never a reason to step down the ladder.
export const capHeightForRung = (userHeight, rung) => {
  const r = RUNGS[rung] || RUNGS[0];
  if (!finite(userHeight) || userHeight <= 0) return null;
  return r.size === "720p" ? Math.min(userHeight, 720) : userHeight;
};

const OFF_START = Object.freeze({
  rung: 0,
  id: "R0",
  enabled: false,
  inputs: null,
});

// Start rung at click. Reads cached data only: must never run the
// sustained-encode test (that runs at idle). Inputs:
//   sustained: cached test result { ok1080p30, ok1080p20, ok720p30 } booleans;
//     anything else is unknown and never lowers the rung.
//   history: finished takes, newest last. Any bad take in the last historyTakes
//     starts one rung lower; that many clean takes in a row clear it.
//   ceilingQuality: her quality setting, a size ceiling. A take at 720p or less
//     is judged on the 720p30 result only, since a 1080p result is about a size
//     she never runs.
// Flag off: R0, nothing else. Never throws; bad input counts as unknown.
export const chooseStartRung = (input, configIn) => {
  try {
    const config = asConfig(configIn);
    if (!config || config.enabled !== true) return OFF_START;
    const { sustained, history, ceilingQuality = null } = input || {};
    const th = config.thresholds || DEFAULT_THRESHOLDS;
    const s = sustained && typeof sustained === "object" ? sustained : {};
    const userHeight = heightOf(ceilingQuality);
    const small = userHeight !== null && userHeight <= 720;
    let rung = 0;
    if (small) {
      // 720p30 failed: R2 (the 720p rung would change nothing for her).
      if (s.ok720p30 === false) rung = 2;
    } else if (s.ok1080p30 === false || s.ok720p30 === false) {
      // 24 fps (R2) was never measured, but 30 failing and 20 not failing puts
      // it between; the loop corrects within 10 s if wrong. A measured failure
      // at 20 too goes to the 720p rung.
      rung = s.ok1080p20 === false ? 3 : 2;
    }
    const recent = Array.isArray(history)
      ? history.slice(-th.historyTakes)
      : [];
    const penalty = recent.some(historyTakeIsBad) ? 1 : 0;
    const final = Math.min(MAX_START_RUNG, rung + penalty);
    const relevant = small ? s.ok720p30 : s.ok1080p30;
    return {
      rung: final,
      id: RUNGS[final].id,
      enabled: true,
      inputs: {
        deviceHistoryRungDrop: penalty,
        sustainedEncodeOk: typeof relevant === "boolean" ? relevant : null,
        ceilingQuality: qualityOrNull(ceilingQuality),
      },
    };
  } catch {
    return OFF_START;
  }
};

const INERT_STATE = Object.freeze({
  screenFps: null,
  cameraFps: null,
  cameraStopped: false,
});

const inertController = () =>
  Object.freeze({
    enabled: false,
    tick: () => null,
    pause: () => {},
    resume: () => {},
    state: () => INERT_STATE,
    undoLast: () => false,
    cameraGone: () => {},
    record: () => null,
    editorFacts: () => null,
  });

const pickInputs = (i) => ({
  deviceHistoryRungDrop: i?.deviceHistoryRungDrop === 1 ? 1 : 0,
  sustainedEncodeOk:
    typeof i?.sustainedEncodeOk === "boolean" ? i.sustainedEncodeOk : null,
  ceilingQuality: qualityOrNull(i?.ceilingQuality),
});

// The controller for one take. `startRung` and `startInputs` come from
// chooseStartRung. Mid-take actions:
//   { type: "fps", screenFps, cameraFps, level, trigger }  applyConstraints
//   { type: "camera-stop", trigger }                        R4 emergency
// pause() and resume() bracket a pause; ticks in between are ignored and the
// window starts fresh.
export const createPolicyController = ({
  config,
  startRung = 0,
  startInputs = null,
  cameraOn: cameraOnIn = false,
} = {}) => {
  const cfg = asConfig(config);
  if (!cfg.enabled) return inertController();
  const th = cfg.thresholds;
  const tick = th.tickMs;
  // Out of range is a caller bug: start at full quality rather than guess.
  const startN =
    Number.isInteger(startRung) && startRung >= 0 && startRung <= MAX_START_RUNG
      ? startRung
      : 0;
  const start = { ...RUNGS[startN], n: startN };
  const inputs = pickInputs(startInputs);
  // The camera can die mid-take; then it is off for the rest of it.
  let cameraOn = cameraOnIn;
  const cameraWasOn = cameraOnIn;
  const screenFloor = SCREEN_FPS_STEPS.length - 1;
  const cameraFloor = CAMERA_FPS_STEPS.length - 1;

  let screenIdx = start.screen;
  let cameraIdx = start.camera;
  let cameraStopped = false;
  let cameraStoppedAt = null;
  let stepsDown = 0;
  let samples = [];
  let lastT = null;
  let lastChangeAt = null;
  let nominalSince = null;
  let criticalSince = null;
  let paused = false;
  let dropChunksOnNext = false;
  // Active ms since which the screen has been below full rate (null: at full
  // rate), and the lowest screen rate reached in the take.
  let screenBelowSince = start.screen > 0 ? 0 : null;
  let screenLowestFps = SCREEN_FPS_STEPS[start.screen];
  const steps = [];
  const MAX_STEPS_KEPT = 500;

  const snapshotState = () => ({
    screenFps: SCREEN_FPS_STEPS[screenIdx],
    cameraFps: cameraOn && !cameraStopped ? CAMERA_FPS_STEPS[cameraIdx] : null,
    cameraStopped,
  });

  // The state before the latest action, so a step the browser refused can be
  // taken back. Only the latest action can be undone, and only once.
  let actionSeq = 0;
  let undo = null;
  const markAction = () => {
    const snap = {
      screenIdx,
      cameraIdx,
      cameraStopped,
      cameraStoppedAt,
      stepsDown,
      samples,
      lastChangeAt,
      nominalSince,
      criticalSince,
      screenBelowSince,
      screenLowestFps,
      stepsLen: steps.length,
    };
    actionSeq += 1;
    const seq = actionSeq;
    undo = () => {
      ({
        screenIdx,
        cameraIdx,
        cameraStopped,
        cameraStoppedAt,
        stepsDown,
        samples,
        lastChangeAt,
        nominalSince,
        criticalSince,
        screenBelowSince,
        screenLowestFps,
      } = snap);
      steps.length = Math.min(steps.length, snap.stepsLen);
    };
    return seq;
  };

  const logStep = (t, from, to, trigger) => {
    if (steps.length < MAX_STEPS_KEPT) {
      steps.push({
        atMs: Math.round(t),
        fromScreenFps: from.screenFps,
        toScreenFps: to.screenFps,
        fromCamFps: from.cameraFps,
        toCamFps: to.cameraFps,
        trigger,
      });
    }
    screenLowestFps = Math.min(screenLowestFps, to.screenFps);
    if (to.screenFps < FULL_SCREEN_FPS && screenBelowSince === null)
      screenBelowSince = Math.round(t);
    if (to.screenFps >= FULL_SCREEN_FPS) screenBelowSince = null;
  };

  const atFloor = () =>
    screenIdx >= screenFloor &&
    (!cameraOn || cameraStopped || cameraIdx >= cameraFloor);

  // Editor note facts. The screen rate is the lowest reached, and absent when
  // the screen ended at full rate, so the note never says "lowered to 30 fps".
  const facts = () => {
    const screenLow = screenBelowSince !== null;
    // The camera cap only shows if it is below what her setting would have run.
    const userH = heightOf(inputs.ceilingQuality);
    const camLow =
      cameraWasOn &&
      Boolean(start.cameraMaxHeight) &&
      (userH === null || userH > start.cameraMaxHeight);
    const stopped = cameraStoppedAt !== null;
    if (!screenLow && !camLow && !stopped) return null;
    return {
      degradedScreenFps: screenLow ? screenLowestFps : null,
      degradedScreenFromMs: screenLow ? screenBelowSince : null,
      degradedCameraHeight: camLow ? start.cameraMaxHeight : null,
      degradedCameraFromMs: camLow ? 0 : null,
      cameraStoppedAtMs: stopped ? Math.round(cameraStoppedAt) : null,
    };
  };

  // One tick. The caller's sample is copied, never changed.
  const tickInner = (sampleIn) => {
    if (paused || !sampleIn || !finite(sampleIn.t)) return null;
    if (lastT !== null && sampleIn.t <= lastT) return null;
    // Span is what the caller measured, capped at the take time since the last
    // tick so a clock that ran through a pause cannot stretch the window. No
    // measurement: the gap itself.
    const gap = lastT === null ? null : sampleIn.t - lastT;
    const el = nonNeg(sampleIn.elapsedMs);
    const span =
      el !== null && el > 0
        ? gap !== null
          ? Math.min(el, gap)
          : el
        : gap ?? tick;
    const sample = { ...sampleIn, elapsedMs: span };
    if (dropChunksOnNext) {
      sample.chunkIntervalsMs = [];
      sample.msSinceChunk = null;
      dropChunksOnNext = false;
    }
    lastT = sample.t;
    samples.push(sample);
    // Exclusive, so a full window holds the same samples on first fill and after.
    const cutoff = sample.t - th.windowMs;
    const recent = samples.filter((s) => s.t > cutoff);
    // Keep the previous sample too: a machine ticking slower than the window
    // still gets judged, on what it has.
    samples = recent.length >= 2 ? recent : samples.slice(-2);
    // The window is full once the samples cover windowMs of take time, however
    // many samples that took. A starved machine ticks late, not never.
    const firstSpan = nonNeg(samples[0].elapsedMs) || tick;
    const windowStart = samples[0].t - firstSpan;
    if (sample.t - windowStart < th.windowMs) return null;
    const verdict = judgeWindow(samples, th);
    const t = sample.t;

    if (verdict.level === "critical") {
      // R4 counts critical time spent at the floor, not before it.
      if (atFloor()) {
        if (criticalSince === null) criticalSince = windowStart;
      } else {
        criticalSince = null;
      }
      nominalSince = null;
    } else if (verdict.level === "serious") {
      criticalSince = null;
      nominalSince = null;
    } else if (verdict.level === "nominal") {
      criticalSince = null;
      if (nominalSince === null) nominalSince = windowStart;
    } else {
      // unknown: no evidence of calm, and none of the critical stretch either
      nominalSince = null;
      criticalSince = null;
    }

    if (verdict.level === "critical" || verdict.level === "serious") {
      const trigger = verdict.level;
      if (
        cameraOn &&
        !cameraStopped &&
        atFloor() &&
        criticalSince !== null &&
        t - criticalSince >= th.criticalToCameraStopMs
      ) {
        const from = snapshotState();
        const seq = markAction();
        cameraStopped = true;
        cameraStoppedAt = t;
        stepsDown += 1;
        lastChangeAt = t;
        samples = [];
        logStep(t, from, snapshotState(), "r4");
        return {
          type: "camera-stop",
          seq,
          trigger: verdict.critical.join("+") || trigger,
        };
      }
      const units = verdict.level === "critical" ? 2 : 1;
      const nextScreen = Math.min(screenFloor, screenIdx + units);
      const nextCamera =
        cameraOn && !cameraStopped
          ? Math.min(cameraFloor, cameraIdx + units)
          : cameraIdx;
      const taken = Math.max(nextScreen - screenIdx, nextCamera - cameraIdx);
      if (taken <= 0) return null;
      const from = snapshotState();
      const seq = markAction();
      screenIdx = nextScreen;
      cameraIdx = nextCamera;
      // One per judged window, so a critical window (two rungs) is one.
      stepsDown += 1;
      lastChangeAt = t;
      samples = [];
      const to = snapshotState();
      logStep(t, from, to, trigger);
      return {
        type: "fps",
        seq,
        screenFps: to.screenFps,
        cameraFps: to.cameraFps,
        level: verdict.level,
        trigger: [...verdict.critical, ...verdict.serious].join("+"),
      };
    }

    // Up: only after a long nominal stretch, one step, never above the start
    // rung, and not at all once the take has needed too many down steps or R4.
    if (
      verdict.level === "nominal" &&
      nominalSince !== null &&
      t - nominalSince >= th.nominalBeforeUpMs &&
      (lastChangeAt === null || t - lastChangeAt >= th.nominalBeforeUpMs) &&
      stepsDown < th.maxDownBeforeNoUp &&
      !cameraStopped &&
      (screenIdx > start.screen || (cameraOn && cameraIdx > start.camera))
    ) {
      const from = snapshotState();
      const seq = markAction();
      screenIdx = Math.max(start.screen, screenIdx - 1);
      if (cameraOn) cameraIdx = Math.max(start.camera, cameraIdx - 1);
      lastChangeAt = t;
      nominalSince = t;
      samples = [];
      const to = snapshotState();
      logStep(t, from, to, "up");
      return {
        type: "fps",
        seq,
        screenFps: to.screenFps,
        cameraFps: to.cameraFps,
        level: "nominal",
        trigger: "nominal",
      };
    }
    return null;
  };

  return {
    enabled: true,
    state: snapshotState,
    // Camera track ended or is gone: no camera step, no R4, and it no longer
    // blocks stepping the screen back up. Stays off, even across an undo.
    cameraGone() {
      cameraOn = false;
      criticalSince = null;
    },
    // The browser refused the action with this seq: take it back so the record
    // and editor note claim nothing that did not happen.
    undoLast(seq) {
      if (!undo || seq !== actionSeq) return false;
      undo();
      undo = null;
      return true;
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      samples = [];
      nominalSince = null;
      criticalSince = null;
      // Chunk gaps measured across the pause are not load.
      dropChunksOnNext = true;
    },
    // sample: { t, elapsedMs, lagP90Ms, longTaskMs, chunkIntervalsMs[],
    //   msSinceChunk, micGapsMs[], heapUsed, heapLimit, pressure }. A sample with
    //   no signal counts as unknown, not calm.
    tick(sampleIn) {
      try {
        return tickInner(sampleIn);
      } catch {
        return null;
      }
    },
    // T7: degradation record for the heartbeat and diagnostic report. Shape is
    // agreed with the server sanitizer. Steps are capped at 20 (first 19 plus the
    // last, so the final state is kept).
    record() {
      const now = snapshotState();
      let derived = RUNGS.findIndex(
        (r) => r.screen >= screenIdx && (!cameraOn || r.camera >= cameraIdx)
      );
      if (derived < 0 || derived > LAST_FPS_RUNG) derived = LAST_FPS_RUNG;
      const finalRung = cameraStopped ? 4 : Math.max(start.n, derived);
      const kept =
        steps.length > 20
          ? [...steps.slice(0, 19), steps[steps.length - 1]]
          : steps.slice();
      return {
        startRung: start.n,
        startInputs: { ...inputs },
        steps: kept,
        stepCount: steps.length,
        finalRung,
        finalScreenFps: now.screenFps,
        finalCamFps: now.cameraFps,
        cameraStoppedAtMs:
          cameraStoppedAt === null ? null : Math.round(cameraStoppedAt),
        noteShown: facts() !== null,
      };
    },
    // What the editor note needs, same postMessage as the mic drop. Null when
    // nothing visible ended up below her setting. Times are active take ms.
    editorFacts: facts,
  };
};

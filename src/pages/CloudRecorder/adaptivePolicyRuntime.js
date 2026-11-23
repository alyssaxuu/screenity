// Runs the adaptive policy controller for one take: ticks it every TICK_MS of
// active take time, builds samples from the caller's sources, applies the
// result. No React, no chrome.*, so it is tested with fake timers. Flag off:
// createPolicyRuntime returns a frozen no-op and starts no timer.
// Tests: tests/unit/adaptivePolicyRuntime.test.mjs
import {
  TICK_MS,
  RUNGS,
  createPolicyController,
  chooseStartRung,
  resolveConfig,
  capHeightForRung,
  historyTakeIsBad,
} from "./adaptivePolicy.js";
import {
  policyFlagsFromStorage,
  normalizeHistory,
  summarizeHistory,
} from "./adaptivePolicyStore.js";
import { readLowspecResult } from "./lowspecSustained.js";

const NOOP = Object.freeze({
  enabled: false,
  start: () => {},
  stop: () => {},
  record: () => null,
  editorFacts: () => null,
  level: () => null,
});

const MAX_INTERVALS = 30;
// After a step every track refused, wait this long before judging again.
const REFUSED_HOLD_MS = 60 * 1000;
// A clean history entry this young is the take being started, not an earlier one.
const CURRENT_TAKE_MS = 2 * 60 * 1000;

// sources (all optional, each may throw or return nothing):
//   isPaused()       true while the take is paused
//   lagP90Ms()       event loop lag p90
//   longTaskTotalMs() running total of long task time
//   chunks()         { count, lastAt } of the screen recorder, lastAt in ms
//   micGaps()        { id, count, gaps, maxMs }: id changes when the mic
//                    detector is replaced, count is its total gap count,
//                    gaps its (capped) list of { ms }, maxMs its largest gap
//   heap()           { used, limit }
//   cameraLive()     false once the camera track has ended or is gone
//   pressure()       "nominal" | "fair" | "serious" | "critical" | null
// apply: { set({ screenFps, cameraFps, cameraHeight }) -> true when it took
//          effect (may be async), stopCamera() -> true when done, "gone" when
//          the camera was already off, false when it failed }
export const createPolicyRuntime = ({
  config,
  startRung = 0,
  startInputs = null,
  cameraOn = false,
  sources = {},
  apply = {},
  now = () => Date.now(),
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  onLevel = null,
} = {}) => {
  const ctl = createPolicyController({
    config,
    startRung,
    startInputs,
    cameraOn,
  });
  if (!ctl.enabled) return NOOP;
  const startRungN = ctl.record().startRung;

  const safe = (fn, fallback = null) => {
    try {
      return fn ? fn() : fallback;
    } catch {
      return fallback;
    }
  };

  let timer = null;
  let activeMs = 0;
  let lastWall = null;
  let wasPaused = false;
  let prevTask = null;
  let prevChunk = null;
  let prevGapCount = 0;
  let prevGapId = null;
  let resumedAtWall = null;
  let level = null;
  let stopped = false;
  let refusedUntil = 0;

  // A step counts when any track it touched took it. One every track refused is
  // taken back and held off for REFUSED_HOLD_MS, so a dead track cannot make the
  // loop retry it every 2 s.
  const settle = (action, r) => {
    if (stopped) return;
    let ok = true;
    if (typeof r === "boolean") ok = r;
    else if (r && typeof r === "object") {
      const tried = Object.values(r).filter(
        (v) => v !== null && v !== undefined && v !== "same"
      );
      ok = tried.length === 0 || tried.some((v) => v === true);
    }
    if (ok) return;
    if (ctl.undoLast(action.seq)) refusedUntil = activeMs + REFUSED_HOLD_MS;
  };

  const runTick = () => {
    const wall = now();
    const paused = safe(sources.isPaused, false) === true;
    const dt = lastWall === null ? TICK_MS : Math.max(0, wall - lastWall);
    lastWall = wall;
    if (paused) {
      if (!wasPaused) ctl.pause();
      wasPaused = true;
      return;
    }
    if (wasPaused) {
      ctl.resume();
      wasPaused = false;
      // The time since the last tick was a pause, not take time. A chunk that
      // lands after the resume must not be measured against one from before it.
      prevTask = safe(sources.longTaskTotalMs, null);
      prevChunk = null;
      resumedAtWall = wall;
      return;
    }
    activeMs += dt;

    const taskTotal = safe(sources.longTaskTotalMs, null);
    const longTaskMs =
      taskTotal !== null && prevTask !== null
        ? Math.max(0, taskTotal - prevTask)
        : 0;
    if (taskTotal !== null) prevTask = taskTotal;

    const intervals = [];
    let msSinceChunk = null;
    const c = safe(sources.chunks, null);
    if (c && Number.isFinite(c.lastAt) && c.lastAt > 0) {
      // A chunk from before the resume counts as arriving at the resume, so the
      // pause is never part of an interval or of the silence.
      const lastAt = Math.max(c.lastAt, resumedAtWall ?? 0);
      msSinceChunk = Math.max(0, wall - lastAt);
      if (
        prevChunk &&
        c.count > prevChunk.count &&
        Number.isFinite(prevChunk.lastAt) &&
        prevChunk.lastAt > 0
      ) {
        const n = c.count - prevChunk.count;
        const each = Math.max(0, (lastAt - prevChunk.lastAt) / n);
        for (let i = 0; i < Math.min(n, MAX_INTERVALS); i++)
          intervals.push(each);
      }
      prevChunk = { count: c.count, lastAt };
    }

    const mg = safe(sources.micGaps, null);
    let micGapsMs = [];
    if (mg && Number.isFinite(mg.count)) {
      // A replaced detector starts again at zero.
      if (mg.id !== prevGapId) {
        prevGapId = mg.id;
        prevGapCount = 0;
      }
      const list = Array.isArray(mg.gaps) ? mg.gaps : [];
      const fresh = Math.max(0, mg.count - prevGapCount);
      for (let i = 0; i < Math.min(fresh, MAX_INTERVALS); i++) {
        const known = list[prevGapCount + i];
        // Past the detector's list the length is unknown: use its largest gap.
        micGapsMs.push(known ? known.ms : mg.maxMs);
      }
      prevGapCount = mg.count;
    }
    const heap = safe(sources.heap, null);

    // Holding after a refused step: the take clock runs, the controller waits.
    if (activeMs < refusedUntil) return;
    // A camera that ended on its own (unplugged) is off: no step, no R4.
    if (typeof sources.cameraLive === "function" && !safe(sources.cameraLive, true))
      ctl.cameraGone();
    const action = ctl.tick({
      t: activeMs,
      elapsedMs: dt,
      lagP90Ms: safe(sources.lagP90Ms, null),
      longTaskMs,
      chunkIntervalsMs: intervals,
      msSinceChunk,
      micGapsMs,
      heapUsed: heap?.used,
      heapLimit: heap?.limit,
      pressure: safe(sources.pressure, null),
    });
    if (!action) return;
    level = action.level || action.trigger || null;
    try {
      onLevel?.(action);
    } catch {}
    // Refused steps are taken out of the record (settle).
    if (action.type === "fps") {
      let result;
      try {
        result = apply.set?.({
          screenFps: action.screenFps,
          cameraFps: action.cameraFps,
        });
      } catch {
        result = false;
      }
      Promise.resolve(result).then(
        (r) => settle(action, r),
        () => settle(action, false)
      );
    } else if (action.type === "camera-stop") {
      const ok = safe(() => apply.stopCamera?.(), false);
      if (ok === "gone") {
        // Nothing to stop: the camera was already off. Take the step back out.
        if (!stopped && ctl.undoLast(action.seq)) ctl.cameraGone();
      } else if (ok === false && !stopped && ctl.undoLast(action.seq))
        refusedUntil = activeMs + REFUSED_HOLD_MS;
    }
  };

  return {
    enabled: true,
    start() {
      if (timer !== null) return Promise.resolve();
      lastWall = now();
      // Rung 0 changes nothing, so it touches no track. Frame rate and camera
      // height go in one call: applyConstraints replaces the whole set.
      const st = ctl.state();
      const cap = cameraOn ? RUNGS[startRungN]?.cameraMaxHeight : null;
      const screenFps = st.screenFps < 30 ? st.screenFps : null;
      const cameraFps =
        st.cameraFps !== null && st.cameraFps < 30 ? st.cameraFps : null;
      let applied = Promise.resolve();
      if (screenFps || cameraFps || cap) {
        applied =
          safe(() =>
            Promise.resolve(
              apply.set?.({ screenFps, cameraFps, cameraHeight: cap || null })
            ).catch(() => {})
          ) || applied;
      }
      timer = setIntervalFn(runTick, TICK_MS);
      // Resolves once the start rung's changes are in (the caller can wait on it
      // before the camera encoder sizes itself).
      return applied;
    },
    stop() {
      stopped = true;
      if (timer !== null) clearIntervalFn(timer);
      timer = null;
    },
    isStopped: () => stopped,
    record: () => ctl.record(),
    editorFacts: () => ctl.editorFacts(),
    level: () => level,
    // exposed for tests
    tickNow: runTick,
  };
};

// Everything the click needs: the flag from its chrome.storage copy, the start
// rung from cached data only, and T8. Flag off, stale or missing: enabled false,
// rung 0, nothing else read. `stored` is chrome.storage.local.get of
// adaptivePolicy, adaptivePolicyThresholds, adaptivePolicyAt and
// adaptivePolicyHistory; `ls` is localStorage.
export const planStart = ({
  stored,
  ls,
  ceilingQuality = null,
  now = Date.now(),
} = {}) => {
  const OFF = {
    enabled: false,
    flags: null,
    rung: 0,
    startInputs: null,
    deviceHistory: null,
    rungInfo: RUNGS[0],
  };
  try {
    const flags = policyFlagsFromStorage(stored, now);
    const config = resolveConfig(flags);
    if (!config.enabled) return OFF;
    // The background stamps this take into the history before the recorder
    // asks, so leave out the newest entry when it is clean and just started.
    let history = normalizeHistory(stored?.adaptivePolicyHistory);
    const newest = history[history.length - 1];
    if (
      newest &&
      !historyTakeIsBad(newest) &&
      !newest.micEnded &&
      now - newest.at < CURRENT_TAKE_MS
    ) {
      history = history.slice(0, -1);
    }
    const pick = chooseStartRung(
      { sustained: readLowspecResult(ls, now), history, ceilingQuality },
      config
    );
    return {
      enabled: true,
      flags,
      rung: pick.rung,
      startInputs: pick.inputs,
      deviceHistory: summarizeHistory(history),
      rungInfo: RUNGS[pick.rung],
    };
  } catch {
    return OFF;
  }
};

export { capHeightForRung };

const CAP_720P = { width: 1280, height: 720, tier: "720p" };

// R3 caps the encode size at 720p (her own smaller setting wins). The caller
// also applies it to a MediaRecorder screen capture, but only where that path
// already constrains the capture (oversampled or high-res; not region mode or
// with the oversample switch off). A WebCodecs capture can still be oversampled
// against this encode size. No plan or no size cap: returned unchanged.
export const capEncodeForPlan = (cap, plan) => {
  if (!plan?.enabled || plan.rungInfo?.size !== "720p") return cap;
  return Number(cap?.width) * Number(cap?.height) <=
    CAP_720P.width * CAP_720P.height
    ? cap
    : { ...CAP_720P };
};

export const capBitrateForPlan = (bitrate, plan) => {
  const cap = plan?.enabled ? plan.rungInfo?.bitrateCap : null;
  return cap ? Math.min(bitrate, cap) : bitrate;
};

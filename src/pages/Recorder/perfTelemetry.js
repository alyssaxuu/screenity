// Numbers-only host health for the recorder document. One fps average over a
// take can't say when frames slowed or why, so this keeps fps per 30 s window
// and the main thread's long tasks.

export const FPS_WINDOW_MS = 30_000

// Fed cumulative frames and active (pause-excluded) ms, so a window closes on
// the first tick past its length. A starved take closes late, not never.
export const createFpsWindows = ({ windowMs = FPS_WINDOW_MS, maxWindows = 240 } = {}) => {
  const windows = []
  let startFrames = null
  let startMs = 0
  return {
    tick(frames, activeMs) {
      if (startFrames === null) {
        startFrames = frames
        startMs = activeMs
        return
      }
      const span = activeMs - startMs
      if (span < windowMs) return
      const fps = Math.round(((frames - startFrames) / (span / 1000)) * 10) / 10
      if (windows.length < maxWindows) windows.push(fps)
      startFrames = frames
      startMs = activeMs
    },
    snapshot() {
      return {
        count: windows.length,
        last: windows.length ? windows[windows.length - 1] : null,
        min: windows.length ? Math.min(...windows) : null,
        max: windows.length ? Math.max(...windows) : null,
        windows: windows.slice(),
      }
    },
  }
}

// Long tasks (50 ms+) on this document's main thread, where the capture read
// loop, canvas draw and encoder feed all run.
export const createLongTaskTracker = ({ Observer = globalThis.PerformanceObserver } = {}) => {
  let observer = null
  const totals = { count: 0, maxMs: 0, totalMs: 0 }
  return {
    start() {
      if (observer || typeof Observer !== "function") return
      try {
        observer = new Observer((list) => {
          for (const entry of list.getEntries()) {
            totals.count += 1
            totals.totalMs += entry.duration
            totals.maxMs = Math.max(totals.maxMs, entry.duration)
          }
        })
        observer.observe({ type: "longtask" })
      } catch {
        observer = null
      }
    },
    stop() {
      try {
        observer?.disconnect()
      } catch {}
      observer = null
    },
    reset() {
      totals.count = 0
      totals.maxMs = 0
      totals.totalMs = 0
    },
    snapshot() {
      return {
        count: totals.count,
        maxMs: Math.round(totals.maxMs),
        totalMs: Math.round(totals.totalMs),
      }
    },
  }
}

export const longTasks = createLongTaskTracker()

export const readDevice = (nav = globalThis.navigator) => ({
  hardwareConcurrency: Number.isFinite(nav?.hardwareConcurrency) ? nav.hardwareConcurrency : null,
  // Chrome reports this on Windows and Linux; Macs return nothing.
  deviceMemoryGb: Number.isFinite(nav?.deviceMemory) ? nav.deviceMemory : null,
})

// Flat keys for the server sanitizer, which whitelists encodeStats one key at a
// time. The per-window series travels in the diag event instead.
export const flattenPerfStats = ({
  device,
  fps,
  longTask,
  encodeHardware,
  tier,
  targetFps,
  lag,
  pressure,
}) => ({
  hardwareConcurrency: device?.hardwareConcurrency ?? null,
  deviceMemoryGb: device?.deviceMemoryGb ?? null,
  cpuArch: device?.cpuArch ?? null,
  onBattery: device?.onBattery ?? null,
  encodeHardware: encodeHardware ?? null,
  longTaskCount: longTask?.count ?? null,
  longTaskMaxMs: longTask?.maxMs ?? null,
  fpsWindowCount: fps?.count ?? null,
  fpsWindowLast: fps?.last ?? null,
  fpsWindowMin: fps?.min ?? null,
  fpsWindowMax: fps?.max ?? null,
  encodeTier: tier ?? null,
  encodeTargetFps: targetFps ?? null,
  lagP90Ms: lag?.p90Ms ?? null,
  lagMaxMs: lag?.maxMs ?? null,
  cpuPressure: pressure?.state ?? null,
  cpuPressureWorst: pressure?.worst ?? null,
  cpuPressureStatus: pressure?.status ?? null,
})

// Screen counters win over camera. Only the WebCodecs recorders have counters,
// so on the MediaRecorder fallback the host keys go alone, tagged with the
// recording track. perf is null when signed out: the zip keeps it then.
export const composeEncodeStats = ({ screenStats, cameraStats, track, perf }) => {
  const base = screenStats
    ? { ...screenStats, track: "screen" }
    : cameraStats
    ? { ...cameraStats, track: "camera" }
    : null
  if (!perf) return base
  return { ...(base || { track: track || null }), ...perf }
}

// How late a fixed-interval timer fires: a starved document runs timers late
// before anything else visibly breaks. p90 covers the last windowMs; maxMs is
// the worst since the take began.
export const LAG_INTERVAL_MS = 100
export const LAG_WINDOW_MS = 10_000

export const createLagTracker = ({
  intervalMs = LAG_INTERVAL_MS,
  windowMs = LAG_WINDOW_MS,
  now = () => performance.now(),
  setTimer = globalThis.setInterval,
  clearTimer = globalThis.clearInterval,
} = {}) => {
  let timer = null
  let last = 0
  let samples = []
  let maxMs = 0
  const tick = () => {
    const t = now()
    const late = Math.max(0, t - last - intervalMs)
    last = t
    samples.push({ t, late })
    maxMs = Math.max(maxMs, late)
    const cutoff = t - windowMs
    let drop = 0
    while (drop < samples.length && samples[drop].t < cutoff) drop += 1
    if (drop) samples = samples.slice(drop)
  }
  return {
    start() {
      if (timer || typeof setTimer !== "function") return
      last = now()
      timer = setTimer(tick, intervalMs)
    },
    stop() {
      if (timer) clearTimer(timer)
      timer = null
    },
    reset() {
      samples = []
      maxMs = 0
      last = now()
    },
    snapshot() {
      if (!samples.length) return { p90Ms: null, maxMs: null }
      const sorted = samples.map((s) => s.late).sort((a, b) => a - b)
      const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1)
      return { p90Ms: Math.round(sorted[idx]), maxMs: Math.round(maxMs) }
    },
  }
}

export const lagTracker = createLagTracker()

// Browser CPU pressure state (nominal, fair, serious, critical). Not every
// document may observe it, so "unsupported" and "denied" are kept as findings.
export const createPressureWatcher = ({ Observer = globalThis.PressureObserver } = {}) => {
  let observer = null
  let state = null
  let status = typeof Observer === "function" ? "idle" : "unsupported"
  let worst = null
  const RANK = { nominal: 0, fair: 1, serious: 2, critical: 3 }
  return {
    async start() {
      if (observer || typeof Observer !== "function") return status
      try {
        observer = new Observer((records) => {
          const rec = records[records.length - 1]
          if (!rec || typeof rec.state !== "string") return
          state = rec.state
          if (worst === null || (RANK[state] ?? -1) > (RANK[worst] ?? -1)) worst = state
        })
        await observer.observe("cpu", { sampleInterval: 1000 })
        status = "observing"
      } catch (err) {
        observer = null
        status = err?.name === "NotAllowedError" ? "denied" : "error"
      }
      return status
    },
    stop() {
      try {
        observer?.disconnect()
      } catch {}
      observer = null
    },
    reset() {
      worst = state
    },
    snapshot() {
      return { status, state, worst }
    },
  }
}

export const pressureWatcher = createPressureWatcher()

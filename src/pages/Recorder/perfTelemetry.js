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
export const flattenPerfStats = ({ device, fps, longTask, encodeHardware, tier, targetFps }) => ({
  hardwareConcurrency: device?.hardwareConcurrency ?? null,
  deviceMemoryGb: device?.deviceMemoryGb ?? null,
  encodeHardware: encodeHardware ?? null,
  longTaskCount: longTask?.count ?? null,
  longTaskMaxMs: longTask?.maxMs ?? null,
  fpsWindowCount: fps?.count ?? null,
  fpsWindowLast: fps?.last ?? null,
  fpsWindowMin: fps?.min ?? null,
  fpsWindowMax: fps?.max ?? null,
  encodeTier: tier ?? null,
  encodeTargetFps: targetFps ?? null,
})

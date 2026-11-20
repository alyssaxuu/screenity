// Coarse device hints for recorder telemetry. The async ones (CPU
// architecture, battery state) resolve in the background and are read
// synchronously afterwards, so they can be null for a very short first take.
// Only the CPU family and a charging boolean are kept: no model, no GPU
// string, no screen size.

const ARCHES = new Set(["x86", "arm"])

const state = {
  started: false,
  cpuArch: null,
  onBattery: null,
}

const start = () => {
  if (state.started || typeof navigator === "undefined") return
  state.started = true
  try {
    navigator.userAgentData
      ?.getHighEntropyValues?.(["architecture"])
      .then((v) => {
        const arch = typeof v?.architecture === "string" ? v.architecture : ""
        state.cpuArch = ARCHES.has(arch) ? arch : arch ? "other" : null
      })
      .catch(() => {})
  } catch {}
  try {
    navigator.getBattery?.()
      .then((b) => {
        state.onBattery = typeof b?.charging === "boolean" ? !b.charging : null
      })
      .catch(() => {})
  } catch {}
}

export const getDeviceHints = () => {
  start()
  return {
    cpuArch: state.cpuArch,
    onBattery: state.onBattery,
  }
}

// Called when a recorder is built so the async values are ready by the end of the take.
export const primeDeviceHints = start

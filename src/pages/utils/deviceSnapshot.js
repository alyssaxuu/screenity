const MB = 1024 * 1024;

export function readHeap() {
  const out = {};
  try {
    const mem = typeof performance !== "undefined" ? performance.memory : null;
    if (Number.isFinite(mem?.usedJSHeapSize)) {
      out.jsHeapUsedMb = Math.round(mem.usedJSHeapSize / MB);
    }
    if (Number.isFinite(mem?.jsHeapSizeLimit)) {
      out.jsHeapLimitMb = Math.round(mem.jsHeapSizeLimit / MB);
    }
  } catch {}
  return out;
}

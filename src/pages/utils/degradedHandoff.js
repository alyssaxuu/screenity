// Facts for the editor's degraded-take note ride along editor-ready ->
// update-project-ready like the mic drop (micDropHandoff.js). Returns {} unless
// the adaptive policy lowered something. Times are active take ms.
const num = (v) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;

export function degradedTakeFields(src) {
  if (!src || typeof src !== "object") return {};
  const out = {};
  const fps = num(src.degradedScreenFps);
  const fpsFrom = num(src.degradedScreenFromMs);
  if (fps !== null && fpsFrom !== null) {
    out.degradedScreenFps = fps;
    out.degradedScreenFromMs = fpsFrom;
  }
  const h = src.degradedCameraHeight;
  const hFrom = num(src.degradedCameraFromMs);
  if ((h === 480 || h === 720) && hFrom !== null) {
    out.degradedCameraHeight = h;
    out.degradedCameraFromMs = hFrom;
  }
  const stopped = num(src.cameraStoppedAtMs);
  if (stopped !== null) out.cameraStoppedAtMs = stopped;
  return out;
}

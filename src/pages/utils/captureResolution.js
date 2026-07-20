// Capture at 2x the encode size and let the resize canvas downscale: measured
// 1.315x more detail, matching full native at half the pixel cost. Below 2x is
// no better than not oversampling, so it is 2x or nothing.
export const OVERSAMPLE_FACTOR = 2;

// Also the encoder's per-dimension cap (VIDEO_DIM_HARD_CAP in recorderLogic.js).
const OVERSAMPLE_MAX_WIDTH = 3840;
const OVERSAMPLE_MAX_HEIGHT = 2160;

export const computeCaptureCap = (encodeWidth, encodeHeight, { disabled = false } = {}) => {
  const w = Number(encodeWidth);
  const h = Number(encodeHeight);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;

  const encode = { width: Math.round(w), height: Math.round(h), oversampled: false };
  if (disabled) return encode;

  const ow = w * OVERSAMPLE_FACTOR;
  const oh = h * OVERSAMPLE_FACTOR;
  if (ow > OVERSAMPLE_MAX_WIDTH || oh > OVERSAMPLE_MAX_HEIGHT) return encode;

  return { width: Math.round(ow), height: Math.round(oh), oversampled: true };
};

// capWidth/capHeight are the encode BOX, not the encode size. The real encode is
// the source fitted inside it, so the ratio comes from that fit; width alone
// misreads anything off the box aspect (a portrait tab binds on height).
export const enforceOversampleRatio = async (track, capWidth, capHeight) => {
  const settings = track?.getSettings?.() || {};
  const w = Number(settings.width);
  const h = Number(settings.height);
  const cw = Number(capWidth);
  const ch = Number(capHeight);
  if (![w, h, cw, ch].every((n) => Number.isFinite(n) && n > 0)) return "unknown";
  const fit = Math.min(cw / w, ch / h, 1);
  const ratio = 1 / fit;
  if (ratio >= OVERSAMPLE_FACTOR) return "supersampled";
  if (ratio <= 1) return "not-needed";
  return constrainTrackDown(track, cw, ch);
};

// Kill-switch, matching disableSurfaceSwitching. Absent means enabled.
export const isOversampleDisabled = async () => {
  try {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return false;
    const { disableCaptureOversample } = await chrome.storage.local.get([
      "disableCaptureOversample",
    ]);
    return disableCaptureOversample === true;
  } catch {
    return false;
  }
};

// MediaRecorder has no resize stage, so a supersampled track would encode at 2x.
// applyConstraints can only lower (crbug 40189508). The tri-state stops an
// already-small track being reported as a failure.
export const constrainTrackDown = async (track, width, height) => {
  if (!track || typeof track.applyConstraints !== "function") return "failed";
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return "failed";
  const settings = typeof track.getSettings === "function" ? track.getSettings() : {};
  if (settings.width <= w && settings.height <= h) return "not-needed";
  // applyConstraints REPLACES the constraint set, so re-assert the frame rate
  // the capture was opened with or the track loses its ceiling and floats up.
  const box = { width: { max: w }, height: { max: h } };
  const fps = Number(settings.frameRate);
  try {
    if (Number.isFinite(fps) && fps > 0) {
      // Retry without the rate if a source refuses the combination: a track at
      // the right size with no ceiling still beats one left at 2x.
      try {
        await track.applyConstraints({
          ...box,
          frameRate: { max: Math.round(fps) },
        });
        return "lowered";
      } catch {}
    }
    await track.applyConstraints(box);
    return "lowered";
  } catch {
    return "failed";
  }
};

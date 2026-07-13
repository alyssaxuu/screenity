// Fit + pad a source frame onto the encoder's fixed-size canvas so a
// mid-recording surface switch with a different aspect gets letterboxed, not
// stretched. Pure; unit-tested in tests/unit/.
export function computeLetterboxRect({ sw, sh, tw, th }) {
  if (!(sw > 0) || !(sh > 0) || !(tw > 0) || !(th > 0)) {
    return { x: 0, y: 0, w: tw, h: th, fills: true };
  }

  // Equal aspect (cross-multiplied) fills the canvas, so the caller can skip clearing.
  if (sw * th === sh * tw) {
    return { x: 0, y: 0, w: tw, h: th, fills: true };
  }

  const scale = Math.min(tw / sw, th / sh);
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));

  return {
    x: Math.round((tw - w) / 2),
    y: Math.round((th - h) / 2),
    w,
    h,
    fills: false,
  };
}

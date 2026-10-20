// Native display size for the resolution picker. availWidth/availHeight exclude
// the menu bar and taskbar, so a 3840x2160 monitor reported under 2160 and 4K
// stayed disabled. width/height times DPR gives physical pixels.
// Tests: tests/unit/physicalScreenSize.test.mjs
export function physicalScreenSize(screenLike, devicePixelRatio) {
  const dpr =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1;
  const w = Number(screenLike?.width) || Number(screenLike?.availWidth) || 0;
  const h = Number(screenLike?.height) || Number(screenLike?.availHeight) || 0;
  return { width: Math.round(w * dpr), height: Math.round(h * dpr) };
}

// Chrome reports screen.width in CSS px at the current page zoom, and
// devicePixelRatio includes that zoom, so the product is zoom-invariant (a
// 1920x1080 display is 960x540 at dpr 2 when the page is 200%, 2400x1350 at
// dpr 0.8 at 80%). No zoom input is needed; correcting for it would double
// count. Fractional zoom rounds screen.width, so allow a small shortfall.
export function screenFits(size, minWidth, minHeight, slack = 0.01) {
  const w = Number(size?.width) || 0;
  const h = Number(size?.height) || 0;
  return w >= minWidth * (1 - slack) && h >= minHeight * (1 - slack);
}

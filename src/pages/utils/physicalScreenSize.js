// Native pixel size of the display, used to decide which capture resolutions
// the picker offers. screen.availWidth/availHeight leave out the menu bar and
// taskbar, so a native 3840x2160 monitor reported 2160 minus the bar and the 4K
// option stayed disabled. screen.width/height are the full display in CSS
// pixels; the device pixel ratio turns them into physical pixels.
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

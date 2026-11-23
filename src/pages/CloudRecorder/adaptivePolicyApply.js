// Applies the policy's frame rate and camera height steps to live tracks.
// applyConstraints REPLACES the whole constraint set (see captureResolution.js
// constrainTrackDown), so every call re-asserts what the track already has: the
// size box on the screen, the height cap on the camera. A call that would change
// nothing touches nothing. Resolves true only when the browser accepted it.
// No React, no chrome.*; tests/unit/adaptivePolicyApply.test.mjs

const settingsOf = (track) => {
  try {
    return track?.getSettings?.() || {};
  } catch {
    return {};
  }
};

const pos = (n) => (Number.isFinite(n) && n > 0 ? n : null);

export const SAME = "same";

// The size box a track was opened with: the width and height of its own
// constraints (what capture or an earlier cap set), else its size right now.
// Read once when the take starts and reused, so a step never freezes the
// capture at a window size she later changes.
const openingBox = (track) => {
  let w = null;
  let h = null;
  try {
    const k = track?.getConstraints?.() || {};
    const pick = (v) =>
      pos(Number(typeof v === "object" && v ? v.max ?? v.ideal ?? v.exact : v));
    w = pick(k.width);
    h = pick(k.height);
  } catch {}
  if (!w || !h) {
    const s = settingsOf(track);
    w = pos(Number(s.width));
    h = pos(Number(s.height));
  }
  return { width: w, height: h };
};

// Move one track to a frame rate and/or under a height cap. `fps` may be above
// the current rate (stepping back up must reach the track) but never above
// `maxFps`, the rate the track opened with; the height cap only lowers.
// Resolves true when accepted, SAME when nothing needed changing, false when
// refused, null when there is no live track (an ended camera is off, not a
// failure). `box` is the opening size, re-asserted because applyConstraints
// replaces the whole set; without it the current size is asked for as an ideal.
export const constrainOne = async (
  track,
  { fps, height, box = null, maxFps = null } = {}
) => {
  if (!track || typeof track.applyConstraints !== "function") return null;
  if (track.readyState && track.readyState !== "live") return null;
  const s = settingsOf(track);
  let wantFps = pos(Number(fps));
  if (wantFps !== null && pos(maxFps)) wantFps = Math.min(wantFps, maxFps);
  const wantHeight = pos(Number(height));
  const curFps = pos(Math.round(Number(s.frameRate)));
  const curHeight = pos(Number(s.height));
  const curWidth = pos(Number(s.width));
  const fpsChanges = wantFps !== null && curFps !== wantFps;
  const heightChanges =
    wantHeight !== null && (curHeight === null || curHeight > wantHeight);
  if (!fpsChanges && !heightChanges) return SAME;
  const c = {};
  const rate = wantFps !== null ? wantFps : curFps;
  if (rate !== null) c.frameRate = { ideal: rate, max: rate };
  if (box) {
    // Screen: the opening box stays the ceiling.
    if (box.width) c.width = { max: box.width, ideal: box.width };
    if (box.height) c.height = { max: box.height, ideal: box.height };
  } else if (heightChanges) {
    // Camera height cap: the width follows at the same aspect.
    c.height = { max: wantHeight, ideal: wantHeight };
    if (curWidth && curHeight)
      c.width = { ideal: Math.round((curWidth * wantHeight) / curHeight) };
  } else {
    if (curWidth) c.width = { ideal: curWidth };
    if (curHeight) {
      c.height = { ideal: curHeight };
      if (wantHeight !== null) c.height.max = wantHeight;
    }
  }
  try {
    await track.applyConstraints(c);
    return true;
  } catch {
    return false;
  }
};

// `screen()` and `camera()` return the current tracks (they change on restart),
// so nothing here holds one.
export const createTrackApply = ({ screen, camera, stopCameraTracks }) => {
  let cameraHeightCap = null;
  let cameraStopped = false;
  // Set once any call really changed a track; restore does nothing before that.
  const touched = { screen: false, camera: false };
  const original = {
    screenFps: null,
    cameraFps: null,
    cameraDeviceId: null,
    cameraWidth: null,
    cameraHeight: null,
  };
  let screenBox = null;
  try {
    const sTrack = screen?.();
    const ss = settingsOf(sTrack);
    const cs = settingsOf(camera?.());
    original.screenFps = pos(Math.round(Number(ss.frameRate)));
    original.cameraFps = pos(Math.round(Number(cs.frameRate)));
    original.cameraDeviceId = cs.deviceId || null;
    original.cameraWidth = pos(Number(cs.width));
    original.cameraHeight = pos(Number(cs.height));
    screenBox = sTrack ? openingBox(sTrack) : null;
  } catch {}
  return {
    // Per-track result: { screen, camera }, each true (took effect), SAME
    // (nothing to change), false (refused) or null (not asked, or no live track).
    async set({ screenFps, cameraFps, cameraHeight } = {}) {
      if (cameraHeight) cameraHeightCap = cameraHeight;
      const [screenR, cameraR] = await Promise.all([
        screenFps
          ? constrainOne(screen?.(), {
              fps: screenFps,
              box: screenBox,
              maxFps: original.screenFps,
            })
          : null,
        cameraFps || cameraHeight
          ? constrainOne(camera?.(), {
              fps: cameraFps,
              height: cameraHeightCap,
              maxFps: original.cameraFps,
            })
          : null,
      ]);
      if (screenR === true) touched.screen = true;
      if (cameraR === true) touched.camera = true;
      return { screen: screenR, camera: cameraR };
    },
    isCameraLive() {
      const t = camera?.();
      return Boolean(t) && t.readyState === "live" && !cameraStopped;
    },
    // R4. A camera that is already gone is reported as "gone", not stopped.
    // track.stop() fires no ended event, so nothing else notices.
    stopCamera() {
      try {
        if (!this.isCameraLive()) return "gone";
        stopCameraTracks?.();
        cameraStopped = true;
        return true;
      } catch {
        return false;
      }
    },
    cameraStopped: () => cameraStopped,
    // Back to the rates the tracks were opened with (restart reuses the tracks).
    // Does nothing for a track no step ever changed.
    async restore() {
      const jobs = [];
      const s = screen?.();
      const c = camera?.();
      if (touched.screen && original.screenFps && s?.readyState === "live") {
        jobs.push(raise(s, original.screenFps, screenBox));
      }
      if (touched.camera && c?.readyState === "live") {
        jobs.push(
          raise(c, original.cameraFps, null, {
            width: original.cameraWidth,
            height: original.cameraHeight,
          })
        );
      }
      await Promise.all(jobs);
      touched.screen = false;
      touched.camera = false;
      cameraHeightCap = null;
    },
    original: () => ({ ...original }),
  };
};

// applyConstraints can raise a frame rate back to what the source offers, so a
// restart can undo a lowered rate. The opening box (screen) or size (camera)
// is re-asserted, nothing else.
const raise = async (track, fps, box, size = null) => {
  const c = fps ? { frameRate: { ideal: fps, max: fps } } : {};
  if (size?.width) c.width = { ideal: size.width };
  if (size?.height) c.height = { ideal: size.height };
  if (box?.width) c.width = { max: box.width, ideal: box.width };
  if (box?.height) c.height = { max: box.height, ideal: box.height };
  try {
    await track.applyConstraints(c);
    return true;
  } catch {
    return false;
  }
};

// getUserMedia constraints to bring a camera back after R4 stopped it, from what
// it was opened with. Without a size the browser picks 640x480.
export const cameraReacquireConstraints = (original) => ({
  audio: false,
  video: {
    ...(original?.cameraDeviceId
      ? { deviceId: { exact: original.cameraDeviceId } }
      : {}),
    ...(original?.cameraWidth
      ? { width: { ideal: original.cameraWidth } }
      : {}),
    ...(original?.cameraHeight
      ? { height: { ideal: original.cameraHeight } }
      : {}),
    ...(original?.cameraFps
      ? { frameRate: { ideal: original.cameraFps } }
      : {}),
  },
});

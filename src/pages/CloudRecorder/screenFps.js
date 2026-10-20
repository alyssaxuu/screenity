// Frame rate decisions for the cloud screen capture. Kept apart from
// CloudRecorder.jsx so the rules can be unit tested on their own.
// Tests: tests/unit/screenFps.test.mjs

// A 60 fps request only counts if the capture track really delivers this much.
// Displays at 30 Hz, throttled tabs and some capture paths hand back 30.
export const MIN_DELIVERED_60 = 50

// The checkbox is disabled under a fixed fps, so a stored smootherMotion is
// stale then. Same rule as getFreeCaptureCaps in Recorder/recorderConfig.js.
export const smootherMotionActive = ({ smootherMotion, fpsValue } = {}) =>
  smootherMotion === true && !(Number.parseInt(fpsValue, 10) > 0)

// What to ask getDisplayMedia for: 60 only when the speed test passed a 60 fps
// tier (encodeCap.fps) and it is not a region capture.
export const requestedScreenFps = (encodeCap, { isRegion = false } = {}) =>
  !isRegion && encodeCap?.fps === 60 ? 60 : 30

// The frame rate the encoder is configured for: 60 only when it was requested and
// the track delivers it. Never claims 60 on a 30 fps capture.
export const chosenScreenFps = (requestedFps, trackFrameRate) =>
  requestedFps === 60 && Number(trackFrameRate) >= MIN_DELIVERED_60 ? 60 : 30

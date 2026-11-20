// From the Start click on, a toast in the page is in the take's frames: during
// the preparing step, the countdown and a restart as well as the recording.
const CAPTURE_STARTING_FLAGS = [
  "recording",
  "pendingRecording",
  "preparingRecording",
  "countdownActive",
  "restartingRecording",
];

export const isCaptureStarting = (state) =>
  CAPTURE_STARTING_FLAGS.some((key) => Boolean(state?.[key]));

// A failed start turns every one off, so nothing waiting for them to drop (a
// held notice) waits forever.
export const clearCaptureStarting = (state) => ({
  ...state,
  ...Object.fromEntries(CAPTURE_STARTING_FLAGS.map((key) => [key, false])),
  isCountdownVisible: false,
});

// Keep the display awake while recording: a sleeping display drops or starves
// the screen-capture track (video freezes, audio continues). No-op without chrome.power.
import { diagEvent } from "../../utils/diagnosticLog";

const ENABLE_RECORDING_KEEP_AWAKE = true;

// Last applied state, so we don't request/release on every unrelated storage
// write. Resets on SW restart; init re-reads the recording flag to re-assert.
let currentlyHeld = null;

const applyKeepAwake = (isRecording) => {
  if (!ENABLE_RECORDING_KEEP_AWAKE) return;
  if (!chrome?.power?.requestKeepAwake || !chrome?.power?.releaseKeepAwake) {
    return;
  }
  const want = Boolean(isRecording);
  if (want === currentlyHeld) return;
  currentlyHeld = want;
  try {
    if (want) {
      // "display" not "system": screen capture needs the monitor to stay on.
      chrome.power.requestKeepAwake("display");
    } else {
      chrome.power.releaseKeepAwake();
    }
    diagEvent("recording-keep-awake", { held: want });
  } catch (err) {
    currentlyHeld = null;
    console.warn("[Screenity][BG] keep-awake apply failed", err);
  }
};

export const initKeepAwake = () => {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !("recording" in changes)) return;
    applyKeepAwake(changes.recording.newValue);
  });
  // Re-assert on SW boot: a restart mid-recording re-acquires the lock; a
  // restart after a stop releases any lock left behind.
  chrome.storage.local
    .get(["recording"])
    .then(({ recording }) => applyKeepAwake(recording))
    .catch(() => {});
};

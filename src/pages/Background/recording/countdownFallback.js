// Watchdog for the countdown → start-recording bridge. The countdown UI
// lives in the content script tab, so a navigation/unload during countdown
// kills it and the "countdown-finished" message never lands, leaving the
// recorder tab orphaned. Arm on diag-countdown-started, fire a fallback
// startAfterCountdown if recording hasn't begun in time.
//
// Don't arm on pendingRecording: custom region setup runs 5-6s before
// countdown begins, so the timer fires while the iframe isn't ready and
// we get spurious "failed to start" modals.
import { startAfterCountdown } from "./startRecording";

// 3s countdown + 1s END_HOLD_MS + POST_HIDE_START_DELAY_MS + slack
const FALLBACK_AFTER_COUNTDOWN_STARTED_MS = 8000;

let fallbackTimerId = null;

const clearFallback = () => {
  if (fallbackTimerId !== null) {
    clearTimeout(fallbackTimerId);
    fallbackTimerId = null;
  }
};

const scheduleFallback = (delayMs = FALLBACK_AFTER_COUNTDOWN_STARTED_MS) => {
  clearFallback();
  fallbackTimerId = setTimeout(async () => {
    fallbackTimerId = null;
    try {
      const { pendingRecording, recording, restarting } =
        await chrome.storage.local.get([
          "pendingRecording",
          "recording",
          "restarting",
        ]);
      // Only auto-dispatch if still pending and recording hasn't started.
      // Skip during restart - that flow has its own start sequencing.
      if (!pendingRecording || recording || restarting) return;
      console.info(
        "[Screenity][BG] countdown-finished missing after delay, auto-dispatching start",
      );
      try {
        startAfterCountdown("countdownFallback");
      } catch (err) {
        console.error(
          "[Screenity][BG] countdownFallback startAfterCountdown failed",
          err,
        );
      }
    } catch (err) {
      console.error("[Screenity][BG] countdownFallback storage read failed", err);
    }
  }, delayMs);
};

// Called when the countdown UI actually starts ticking (content script
// sends diag-countdown-started). This is the only trigger for the
// fallback timer.
export const noteCountdownStarted = () => {
  scheduleFallback();
};

export const initCountdownFallback = () => {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    // pendingRecording true → false (user cancelled): clear any armed timer.
    if (
      changes.pendingRecording &&
      changes.pendingRecording.newValue === false
    ) {
      clearFallback();
      return;
    }
    // recording transitioned to true (start succeeded): clear.
    if (changes.recording && changes.recording.newValue === true) {
      clearFallback();
    }
  });
};

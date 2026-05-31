// Fallback if the content-script countdown unloads before "countdown-finished"
// lands. Arm on diag-countdown-started, not pendingRecording (region setup
// runs 5-6s pre-countdown and would trigger spurious "failed to start").
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
  // Timestamp so startRecording can distinguish a fresh countdown from
  // a stale dispatch.
  try {
    chrome.storage.local.set({ countdownStartedAt: Date.now() });
  } catch {}
  scheduleFallback();
};

// SW-death recovery. setTimeout dies with the service worker and
// chrome.alarms clamps to ~30s, so on BG startup we re-fire the
// fallback dispatch synchronously if the deadline already passed.
export const recoverPendingCountdownOnStartup = async () => {
  try {
    const { pendingRecording, recording, restarting, countdownStartedAt } =
      await chrome.storage.local.get([
        "pendingRecording",
        "recording",
        "restarting",
        "countdownStartedAt",
      ]);
    if (!pendingRecording || recording || restarting) return;
    const startedAt = Number(countdownStartedAt) || 0;
    if (!startedAt) return;
    const elapsed = Date.now() - startedAt;
    if (elapsed < FALLBACK_AFTER_COUNTDOWN_STARTED_MS) return;
    console.info(
      "[Screenity][BG] recoverPendingCountdownOnStartup: SW restarted past countdown deadline, dispatching",
      { elapsedMs: elapsed },
    );
    try {
      startAfterCountdown("countdownFallback-sw-restart");
    } catch (err) {
      console.error(
        "[Screenity][BG] recoverPendingCountdownOnStartup startAfterCountdown failed",
        err,
      );
    }
  } catch (err) {
    console.error(
      "[Screenity][BG] recoverPendingCountdownOnStartup storage read failed",
      err,
    );
  }
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
  void recoverPendingCountdownOnStartup();
};

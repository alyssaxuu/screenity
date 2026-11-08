// Fallback if the content-script countdown unloads before "countdown-finished"
// lands. Arm on diag-countdown-started, not pendingRecording (region setup
// runs 5-6s pre-countdown and would trigger spurious "failed to start").
import { startAfterCountdown } from "./startRecording";

// 3s countdown + 1s END_HOLD_MS + POST_HIDE_START_DELAY_MS + slack
const FALLBACK_AFTER_COUNTDOWN_STARTED_MS = 8000;
// countdownStartedAt is never cleared, so on startup it can be days old. Past
// this it's a phantom start, not recovery: a real SW restart lands in seconds.
const FALLBACK_RECOVERY_CEILING_MS = 60000;

const fallbackTimers = new Map();

const clearFallback = () => {
  for (const timer of fallbackTimers.values()) clearTimeout(timer);
  fallbackTimers.clear();
};

const scheduleFallback = (delayMs = FALLBACK_AFTER_COUNTDOWN_STARTED_MS, countdownId = null) => {
  const key = countdownId || "legacy";
  if (fallbackTimers.has(key)) clearTimeout(fallbackTimers.get(key));
  const timer = setTimeout(async () => {
    if (fallbackTimers.get(key) !== timer) return;
    fallbackTimers.delete(key);
    try {
      const { pendingRecording, recording, restarting, activeCountdownId } =
        await chrome.storage.local.get([
          "pendingRecording",
          "recording",
          "restarting",
          "activeCountdownId",
        ]);
      // Only auto-dispatch if still pending and recording hasn't started.
      // Skip during restart - that flow has its own start sequencing.
      if (!pendingRecording || recording || restarting ||
          (countdownId && countdownId !== activeCountdownId)) return;
      console.info(
        "[Screenity][BG] countdown-finished missing after delay, auto-dispatching start",
      );
      try {
        startAfterCountdown("countdownFallback", countdownId);
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
  fallbackTimers.set(key, timer);
};

// Called when the countdown UI actually starts ticking (content script
// sends diag-countdown-started). This is the only trigger for the
// fallback timer.
export const noteCountdownStarted = async (countdownId = null) => {
  // Timestamp so startRecording can distinguish a fresh countdown from
  // a stale dispatch.
  try {
    if (countdownId) {
      const { activeCountdownId } = await chrome.storage.local.get(["activeCountdownId"]);
      if (countdownId !== activeCountdownId) return;
    }
    await chrome.storage.local.set({ countdownStartedAt: Date.now(), countdownStartedId: countdownId });
  } catch {}
  scheduleFallback(FALLBACK_AFTER_COUNTDOWN_STARTED_MS, countdownId);
};

// SW-death recovery. setTimeout dies with the service worker and
// chrome.alarms clamps to ~30s, so on BG startup we re-fire the
// fallback dispatch synchronously if the deadline already passed.
export const recoverPendingCountdownOnStartup = async () => {
  try {
    const {
      pendingRecording,
      recording,
      restarting,
      countdownStartedAt,
      activeCountdownId,
      countdownStartedId,
      recordingStoppedAt,
    } = await chrome.storage.local.get([
      "pendingRecording",
      "recording",
      "restarting",
      "countdownStartedAt",
      "activeCountdownId",
      "countdownStartedId",
      "recordingStoppedAt",
    ]);
    if (!pendingRecording || recording || restarting) return;
    if (countdownStartedId && countdownStartedId !== activeCountdownId) return;
    const startedAt = Number(countdownStartedAt) || 0;
    if (!startedAt) return;
    // A countdown that predates the last stop belongs to a finished recording.
    // pendingRecording can be true from a start whose countdown hasn't ticked.
    if (
      typeof recordingStoppedAt === "number" &&
      startedAt <= recordingStoppedAt
    ) {
      console.info(
        "[Screenity][BG] recoverPendingCountdownOnStartup: countdown predates last stop, skipping",
        { startedAt, recordingStoppedAt },
      );
      return;
    }
    const elapsed = Date.now() - startedAt;
    if (elapsed < FALLBACK_AFTER_COUNTDOWN_STARTED_MS) return;
    if (elapsed > FALLBACK_RECOVERY_CEILING_MS) {
      console.info(
        "[Screenity][BG] recoverPendingCountdownOnStartup: stale countdown, skipping",
        { elapsedMs: elapsed },
      );
      return;
    }
    console.info(
      "[Screenity][BG] recoverPendingCountdownOnStartup: SW restarted past countdown deadline, dispatching",
      { elapsedMs: elapsed },
    );
    try {
      startAfterCountdown("countdownFallback-sw-restart", activeCountdownId || null);
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

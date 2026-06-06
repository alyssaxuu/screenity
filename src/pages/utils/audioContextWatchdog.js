// AudioContext lifecycle watchdog.
//
// Chrome's macOS "interrupted" state (audio-server restart, phone call,
// exclusive-audio grab, Energy Saver) makes the connected MediaStreamDestination
// emit silence, which the AudioEncoder encodes as an unflagged silent gap.
// Diagnostic-first: log the transition and retry resume every 2s, but don't tear
// down the recording, so user reports of "audio cut out" can be traced.
//
// Transitions route through the background diag-forward channel rather than
// diagEvent directly: this runs in page realms (Web Audio has no SW context),
// where diagEvent's session log is never initialized and would silently no-op.
// Returns a live stats handle the caller can read at finalize time to attach
// interruption totals to upload telemetry.

const forwardDiag = (event, data) => {
  try {
    chrome.runtime
      .sendMessage({ type: "diag-forward", event, data })
      .catch(() => {});
  } catch {}
};

export function attachAudioContextWatchdog(aCtx, label) {
  const stats = {
    interruptedCount: 0,
    interruptedTotalMs: 0,
    sawInterrupted: false,
  };
  if (!aCtx || typeof aCtx.addEventListener !== "function") return stats;
  let resumeTimer = null;
  let interruptedAt = null;

  const tryResume = () => {
    if (!aCtx || aCtx.state === "closed" || aCtx.state === "running") {
      return;
    }
    try {
      aCtx.resume().catch(() => {});
    } catch {}
  };

  const onChange = () => {
    try {
      const state = aCtx.state;
      forwardDiag("audiocontext-statechange", {
        label,
        state,
        sinceInterruptedMs: interruptedAt ? Date.now() - interruptedAt : null,
      });
      // Only auto-resume "interrupted" (OS-driven). "suspended" is the user's
      // pause flow; resuming it would silently un-pause a Pro recording.
      if (state === "interrupted") {
        if (!interruptedAt) {
          interruptedAt = Date.now();
          stats.interruptedCount += 1;
          stats.sawInterrupted = true;
        }
        if (!resumeTimer) {
          resumeTimer = setInterval(tryResume, 2000);
        }
      } else if (state === "running") {
        if (interruptedAt) {
          const interruptedForMs = Date.now() - interruptedAt;
          stats.interruptedTotalMs += interruptedForMs;
          forwardDiag("audiocontext-resumed", { label, interruptedForMs });
        }
        interruptedAt = null;
        if (resumeTimer) {
          clearInterval(resumeTimer);
          resumeTimer = null;
        }
      } else if (state === "closed" || state === "suspended") {
        // suspended = user pause, closed = teardown: stop the resume timer.
        // Re-arms via statechange if it later returns to interrupted.
        if (interruptedAt) {
          stats.interruptedTotalMs += Date.now() - interruptedAt;
        }
        interruptedAt = null;
        if (resumeTimer) {
          clearInterval(resumeTimer);
          resumeTimer = null;
        }
      }
    } catch {}
  };

  try {
    aCtx.addEventListener("statechange", onChange);
  } catch {}
  return stats;
}

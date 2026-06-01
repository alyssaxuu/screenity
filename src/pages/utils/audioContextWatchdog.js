// AudioContext lifecycle watchdog.
//
// Chrome's macOS "interrupted" state (audio-server restart, phone call,
// exclusive-audio grab, Energy Saver) makes the connected MediaStreamDestination
// emit silence, which the AudioEncoder encodes as an unflagged silent gap.
// Diagnostic-first: log the transition and retry resume every 2s, but don't tear
// down the recording, so user reports of "audio cut out" can be traced.

import { diagEvent } from "./diagnosticLog";

export function attachAudioContextWatchdog(aCtx, label) {
  if (!aCtx || typeof aCtx.addEventListener !== "function") return;
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
      const detail = {
        label,
        state,
        sinceInterruptedMs: interruptedAt ? Date.now() - interruptedAt : null,
      };
      try { diagEvent("audiocontext-statechange", detail); } catch {}
      // Only auto-resume "interrupted" (OS-driven). "suspended" is the user's
      // pause flow; resuming it would silently un-pause a Pro recording.
      if (state === "interrupted") {
        if (!interruptedAt) interruptedAt = Date.now();
        if (!resumeTimer) {
          resumeTimer = setInterval(tryResume, 2000);
        }
      } else if (state === "running") {
        if (interruptedAt) {
          try {
            diagEvent("audiocontext-resumed", {
              label,
              interruptedForMs: Date.now() - interruptedAt,
            });
          } catch {}
        }
        interruptedAt = null;
        if (resumeTimer) {
          clearInterval(resumeTimer);
          resumeTimer = null;
        }
      } else if (state === "closed" || state === "suspended") {
        // suspended = user pause, closed = teardown: stop the resume timer.
        // Re-arms via statechange if it later returns to interrupted.
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
}

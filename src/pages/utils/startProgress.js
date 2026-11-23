import { perfMark } from "./perfMarks";

// Stage heartbeat for the BG start-fail re-check. Startup outlasts one window
// on a slow encoder probe, and the background reads that silence as a dead
// recorder and tears the start down.
export function markStartProgress(stage) {
  perfMark("Start.stage", { stage });
  try {
    chrome.storage.local.set({
      recorderStartProgress: { ts: Date.now(), stage },
    });
  } catch {}
}

// Tells the background re-check this start ended with nothing left to tear
// down (Stop or dismiss while it was still waiting).
export function markStartEnded() {
  try {
    chrome.storage.local.set({ lastStartEndedAt: Date.now() });
  } catch {}
}

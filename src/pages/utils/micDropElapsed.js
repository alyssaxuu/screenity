// Pause-adjusted recording time at the moment the mic dropped, and the rules
// for showing the editor note about it.

// Same arithmetic as the recorders' elapsed ticker: wall time since start, minus
// finished pauses, minus a pause that is still open.
export function computeMicDropElapsedMs({
  endedAt,
  startedAt,
  totalPausedMs = 0,
  paused = false,
  pausedAt = null,
} = {}) {
  const start = Number(startedAt);
  const end = Number(endedAt);
  if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(end)) {
    return null;
  }
  const base = Number(totalPausedMs) || 0;
  const open = paused && Number(pausedAt) ? Math.max(0, end - Number(pausedAt)) : 0;
  return Math.max(0, end - start - base - open);
}

export function formatMicDropTime(ms) {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Window in which an idb take's drop event still counts as "this take".
export const MIC_DROP_IDB_FRESH_MS = 10 * 60 * 1000;

// Editor note per drop source. Anything else gets no note.
export const DROP_NOTE_MESSAGE_KEYS = {
  mic: "micDisconnectedNote",
  "system-audio": "systemAudioDisconnectedNote",
};

export const dropNoteMessageKey = (source) =>
  Object.prototype.hasOwnProperty.call(DROP_NOTE_MESSAGE_KEYS, source)
    ? DROP_NOTE_MESSAGE_KEYS[source]
    : null;

// lastTrackEndEvent is only reset when a take starts, so it can outlive its
// take: count it only for the latest recording, and only once.
// OPFS takes match on recording id (part of the backend file name). IDB takes
// have no id in the editor URL, so an idb ref plus an event younger than the
// window means the latest take dropped. mode=recover is excluded: the stop flow
// never opens it, and that editor shows an older local recording.
export function shouldShowMicDropNote({
  event,
  launchRecordingId,
  backendFileName,
  backend,
  launchMode,
  now = Date.now(),
} = {}) {
  if (!event || !dropNoteMessageKey(event.source) || event.editorNoteShown) {
    return false;
  }
  if (!Number.isFinite(event.elapsedMs)) return false;
  if (backend === "idb" && !backendFileName && !launchRecordingId) {
    if (launchMode === "recover") return false;
    const age = now - Number(event.ts);
    return (
      Number.isFinite(age) &&
      age >= 0 &&
      age <= MIC_DROP_IDB_FRESH_MS
    );
  }
  if (!launchRecordingId || !backendFileName) return false;
  return String(backendFileName).includes(String(launchRecordingId));
}

// lastTrackEndEvent while the reconnect window is open. It already says the mic
// dropped, so a user stop during the window still gets the editor note.
export const buildMicDropInWindowEvent = ({ info, elapsedMs }) => ({
  ...info,
  source: "mic",
  elapsedMs,
  reason: "audio-track-reconnecting",
});

// After a successful reconnect: keep the diagnostics but drop source and
// elapsedMs so a recovered take never shows the note.
export const buildMicDropRecoveredEvent = ({ info }) => {
  const { source: _source, elapsedMs: _elapsed, ...rest } = info || {};
  return { ...rest, reason: "audio-track-reconnected" };
};

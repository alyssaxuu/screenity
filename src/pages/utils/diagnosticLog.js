/**
 * Ring-buffer diagnostic log stored in chrome.storage.local ("diagnosticLog").
 * Max 5 sessions, 100 events each. Used in the background service worker.
 */

const MAX_SESSIONS = 5;
const MAX_EVENTS = 100;
const FLUSH_EVERY_N = 10; // flush to storage every N events

let _log = null; // in-memory mirror of diagnosticLog
let _dirty = 0; // events written since last flush

const now = () => Date.now();

const makeId = () =>
  `diag-${now()}-${Math.random().toString(16).slice(2, 7)}`;

const currentSession = () => {
  if (!_log || !_log.sessions || _log.sessions.length === 0) return null;
  const last = _log.sessions[_log.sessions.length - 1];
  return last.endedAt == null ? last : null;
};

const flush = async () => {
  if (!_log) return;
  _dirty = 0;
  try {
    await chrome.storage.local.set({ diagnosticLog: _log });
  } catch {
    // SW may be shutting down — best-effort
  }
};

const maybeFlush = () => {
  _dirty += 1;
  if (_dirty >= FLUSH_EVERY_N) {
    flush(); // fire-and-forget
  }
};

/** Hydrate the in-memory log from storage. Call once on SW init. */
export const hydrateDiagnosticLog = async () => {
  try {
    const res = await chrome.storage.local.get("diagnosticLog");
    _log = res?.diagnosticLog || { schemaVersion: 1, sessions: [] };
  } catch {
    _log = { schemaVersion: 1, sessions: [] };
  }
};

/** Start a new session. Call from startRecording(). */
export const initDiagSession = async (config = {}) => {
  if (!_log) await hydrateDiagnosticLog();

  const session = {
    id: makeId(),
    startedAt: now(),
    endedAt: null,
    outcome: "in-progress",
    config,
    events: [],
  };

  _log.sessions.push(session);

  // Trim to MAX_SESSIONS
  while (_log.sessions.length > MAX_SESSIONS) {
    _log.sessions.shift();
  }

  await flush();
  return session.id;
};

/** Append an event to the current open session. */
export const diagEvent = (eventType, data) => {
  const s = currentSession();
  if (!s) return; // no open session

  const entry = {
    t: now() - s.startedAt,
    e: eventType,
  };
  if (data !== undefined && data !== null) {
    entry.d = data;
  }

  s.events.push(entry);

  // Ring-buffer trim
  while (s.events.length > MAX_EVENTS) {
    s.events.shift();
  }

  // Force-flush on lifecycle/error events so they survive SW termination.
  const ALWAYS_FLUSH = [
    "error",
    "crash",
    "start-fail",
    "warning",
    "session-start",
    "stop",
    "stop-tab",
    "editor-open",
    "chunks-sent",
    "chunks-fail",
    "sw-init",
    "countdown-started",
    "countdown-cancelled",
    "countdown-finished",
    "pause",
    "resume",
    "restart-requested",
    "restart-completed",
    "restart-failed",
    "alarm-fired",
    "recorded-tab-closed",
    "recorded-tab-navigated",
    "drive-upload-start",
    "drive-upload-ok",
    "drive-upload-fail",
    "drive-save-fail",
    "drive-auth-fail",
    "editor-load-ready",
  ];
  if (ALWAYS_FLUSH.includes(eventType)) {
    flush();
  } else {
    maybeFlush();
  }
};

/** Close the current session with a final outcome. */
export const endDiagSession = async (outcome = "ok") => {
  const s = currentSession();
  if (!s) return;
  s.endedAt = now();
  s.outcome = outcome;
  await flush();
};

/** Return the full diagnostic log (for export). */
export const getDiagnosticLog = async () => {
  if (!_log) await hydrateDiagnosticLog();
  return _log;
};

/** Collect error-state keys from storage into one object. */
export const getErrorSnapshot = async () => {
  const keys = [
    "lastRecordingError",
    "lastChunkSendFailure",
    "recorderSession",
    "freeRecorderSession",
    "fastRecorderValidation",
    "fastRecorderProbe",
    "fastRecorderDecision",
    "fastRecorderDisabledReason",
    "fastRecorderDisabledDetails",
    "fastRecorderDisabledAt",
    "memoryError",
    "recordingAttemptId",
  ];
  try {
    return await chrome.storage.local.get(keys);
  } catch {
    return {};
  }
};

/** Read current state flags for export. */
export const getStorageFlags = async () => {
  const keys = [
    "recording",
    "pendingRecording",
    "restarting",
    "paused",
    "offscreen",
    "sendingChunks",
    "postStopEditorOpening",
    "postStopEditorOpened",
    "recordingStartTime",
    "totalPausedMs",
    "recordingDuration",
    "recordingTab",
    "sandboxTab",
    "recordingUiTabId",
    "fastRecorderInUse",
    "memoryError",
    "lowStorageAbortAt",
    "lowStorageAbortChunks",
    "editorLoadTimeoutAt",
  ];
  try {
    return await chrome.storage.local.get(keys);
  } catch {
    return {};
  }
};

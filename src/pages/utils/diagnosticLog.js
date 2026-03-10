/**
 * Always-on diagnostic log for free/local recording sessions.
 *
 * Stores a compact ring buffer of session events in chrome.storage.local
 * under the key "diagnosticLog".  Max 5 sessions, 100 events each (~100 KB).
 *
 * Usage (background service worker):
 *   import { initDiagSession, diagEvent, endDiagSession } from '../utils/diagnosticLog';
 *   await initDiagSession({ recordingType: 'screen', quality: '1080p', ... });
 *   diagEvent('chunk', { idx: 10, bytes: 45000 });
 *   await endDiagSession('ok');
 */

const MAX_SESSIONS = 5;
const MAX_EVENTS = 100;
const FLUSH_EVERY_N = 10; // flush to storage every N events

let _log = null; // in-memory mirror of diagnosticLog
let _dirty = 0; // events written since last flush

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Hydrate the in-memory log from storage.  Call once on service-worker init.
 */
export const hydrateDiagnosticLog = async () => {
  try {
    const res = await chrome.storage.local.get("diagnosticLog");
    _log = res?.diagnosticLog || { schemaVersion: 1, sessions: [] };
  } catch {
    _log = { schemaVersion: 1, sessions: [] };
  }
};

/**
 * Begin a new diagnostic session.  Call from startRecording().
 * @param {Object} config — snapshot of recording settings
 */
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

/**
 * Append an event to the current (open) session.
 * @param {string} eventType — short event name, e.g. "stop", "error"
 * @param {Object}  [data]   — small payload (keep lightweight)
 */
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

  // Immediate flush for errors, crashes, and all session lifecycle events.
  // A normal recording only produces ~6-8 events, which is well under the
  // FLUSH_EVERY_N threshold of 10.  If the SW is killed before reaching
  // that threshold, all buffered events are lost.  Force-flushing on every
  // lifecycle event prevents this at negligible cost.
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
  ];
  if (ALWAYS_FLUSH.includes(eventType)) {
    flush();
  } else {
    maybeFlush();
  }
};

/**
 * Close the current session with a final outcome.
 * @param {"ok"|"error"|"crashed"|"cancelled"} outcome
 */
export const endDiagSession = async (outcome = "ok") => {
  const s = currentSession();
  if (!s) return;
  s.endedAt = now();
  s.outcome = outcome;
  await flush();
};

/**
 * Return the full diagnostic log (for export).
 */
export const getDiagnosticLog = async () => {
  if (!_log) await hydrateDiagnosticLog();
  return _log;
};

/**
 * Read all scattered error-state keys and return a consolidated object.
 */
export const getErrorSnapshot = async () => {
  const keys = [
    "lastRecordingError",
    "lastChunkSendFailure",
    "lastStartRecordingDispatch",
    "recorderSession",
    "freeRecorderSession",
    "fastRecorderValidation",
    "fastRecorderProbe",
    "fastRecorderDecision",
    "fastRecorderDisabledReason",
    "fastRecorderDisabledDetails",
    "fastRecorderDisabledAt",
    "memoryError",
  ];
  try {
    return await chrome.storage.local.get(keys);
  } catch {
    return {};
  }
};

/**
 * Read current boolean/numeric state flags for export.
 */
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
  ];
  try {
    return await chrome.storage.local.get(keys);
  } catch {
    return {};
  }
};

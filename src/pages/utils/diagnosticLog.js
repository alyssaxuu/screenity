/**
 * Ring-buffer diagnostic log stored in chrome.storage.local ("diagnosticLog").
 * Max 5 sessions, 100 events each. Used in the background service worker.
 */

const MAX_SESSIONS = 5;
const MAX_EVENTS = 100;
const FLUSH_EVERY_N = 10;

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
  // Client-side save/download breadcrumbs (forwarded from the editor). The
  // trigger + delivery steps were console-only, so a failed save left no trace.
  "editor-drive-save-start",
  "editor-drive-save-fail",
  "editor-download-start",
  "editor-download-fail",
  "editor-load-ready",
  // OPFS load + video element handoff: critical for diagnosing
  // editor-stuck-at-90% reports. If any of these is the last event
  // before a hang, that's the step that hung.
  "sandbox-opfs-reader-open-done",
  "sandbox-opfs-readblob-start",
  "sandbox-opfs-readblob-done",
  "sandbox-opfs-readblob-slow-finalize",
  "sandbox-opfs-materialize-start",
  "sandbox-opfs-materialize-done",
  "sandbox-opfs-materialize-fail",
  "sandbox-opfs-arraybuffer-done",
  "sandbox-opfs-materialize-skipped",
  "sandbox-video-src-set",
  "sandbox-video-loadedmetadata",
  "sandbox-video-load-error",
  "sandbox-opfs-wait-finalize-timeout",
  "sandbox-opfs-writer-dead-detected",
  "sandbox-opfs-empty-recording",
  "sandbox-opfs-materialize-deferred",
  "session-deferred-end",
  "editor-route-decision",
  "recorder-finalize-summary",
  "recorder-muxer-finalize-ok",
  "recorder-muxer-finalize-fail",
  "recorder-writer-close-result",
  "opfs-close-fail",
  "opfs-finalize-marker-set",
  "recorder-validation-start",
  "recorder-validation-done",
];

let _log = null;
let _dirty = 0;

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
  } catch {}
};

const maybeFlush = () => {
  _dirty += 1;
  if (_dirty >= FLUSH_EVERY_N) {
    flush();
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

  while (_log.sessions.length > MAX_SESSIONS) {
    _log.sessions.shift();
  }

  await flush();
  return session.id;
};

/** Append an event to the current open session. */
export const diagEvent = (eventType, data) => {
  const s = currentSession();
  if (!s) return;

  const t = now() - s.startedAt;

  // Collapse repeats of the same type into one entry with a count, so retry
  // spam can't flood the buffer and evict the event that explains the failure.
  for (let i = s.events.length - 1; i >= 0; i -= 1) {
    if (s.events[i].e === eventType) {
      s.events[i].n = (s.events[i].n || 1) + 1;
      s.events[i].lt = t;
      if (ALWAYS_FLUSH.includes(eventType)) flush();
      else maybeFlush();
      return;
    }
  }

  const entry = {
    t,
    e: eventType,
  };
  if (data !== undefined && data !== null) {
    entry.d = data;
  }

  s.events.push(entry);

  while (s.events.length > MAX_EVENTS) {
    s.events.shift();
  }

  // Force-flush on lifecycle/error events so they survive SW termination.
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
    // WebCodecs failure/retry telemetry; the rich payload that turns
    // "my recording failed" into a precise diagnosis (zero-frame vs
    // configure-failed vs flush-timeout vs HW-encoder-quota).
    "lastWebCodecsFailureCode",
    "lastWebCodecsFailureDetail",
    "lastWebCodecsSwRetry",
    "lastWebCodecsFailureAt",
    // Recorder-level stop classification + mid-stream source-end
    // diagnostic. Cover the non-WebCodecs and "encoder ran fine but
    // source disappeared" failure shapes.
    "lastRecorderStopReason",
    "lastRecorderStopAt",
    "lastTrackEndEvent",
    "lastTrackEndedEvent",
    "lastSubscriptionLoss",
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
    "lastRestartFlow",
    "restartFlowHistory",
    "lastFirstChunkWatchdog",
    // Cloud recorder lifecycle (Pro flow). Surfaces the recorder session
    // state machine + the message-flow flags needed to debug double-prompt
    // / silent-close scenarios.
    "recorderSession",
    "recorderPipelineState",
    "lastStartRecordingTabMessage",
    "lastRecordingBackendRef",
    "screenTrackLog",
    "cloudRestartPhase",
    "cloudRestartHistory",
    "tabPreferred",
    "tabStreamIdCache",
    "region",
    "customRegion",
    "multiMode",
    "multiProjectId",
    "multiSceneCount",
    "multiLastSceneId",
    "sceneId",
    "sceneIdStatus",
    "projectId",
    "isLoggedIn",
    "isSubscribed",
    "proSubscription",
  ];
  try {
    return await chrome.storage.local.get(keys);
  } catch {
    return {};
  }
};

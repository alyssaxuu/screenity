let recordingDebugEnabled = false;
let recordingDebugSession = null;

const hasWindowDebugFlag = () => {
  if (typeof window === "undefined") return false;
  return !!window.SCREENITY_DEBUG_RECORDER;
};

const ensureSession = (sessionOverride) => {
  if (sessionOverride?.sessionId) return sessionOverride;
  if (recordingDebugSession?.sessionId) return recordingDebugSession;

  const sessionId = `recdbg-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2, 7)}`;
  const startTimeMs = Date.now();
  recordingDebugSession = {
    sessionId,
    startTimeMs,
    startPerfMs: null,
  };

  try {
    chrome.storage?.local?.set?.({
      recordingDebugEnabled: true,
      recordingDebugSessionId: sessionId,
      recordingDebugStartMs: startTimeMs,
    });
  } catch {}

  return recordingDebugSession;
};

export const hydrateRecordingDebugFlag = async () => {
  try {
    const res = await chrome.storage?.local?.get?.([
      "recordingDebugEnabled",
      "recordingDebugSessionId",
      "recordingDebugStartMs",
    ]);
    recordingDebugEnabled = Boolean(
      res?.recordingDebugEnabled || res?.recordingDebugSessionId,
    );
    if (res?.recordingDebugSessionId) {
      recordingDebugSession = {
        sessionId: res.recordingDebugSessionId,
        startTimeMs: res.recordingDebugStartMs || Date.now(),
        startPerfMs: null,
      };
    }
  } catch {}
};

export const resetRecordingDebugSession = async () => {
  recordingDebugEnabled = false;
  recordingDebugSession = null;
  try {
    await chrome.storage?.local?.remove?.([
      "recordingDebugEnabled",
      "recordingDebugSessionId",
      "recordingDebugStartMs",
    ]);
  } catch {}
};

export const isRecordingDebugEnabled = () =>
  recordingDebugEnabled || hasWindowDebugFlag();

export const debugRecordingEventWithSession = (session, eventType, payload) => {
  if (!isRecordingDebugEnabled()) return;
  const activeSession = ensureSession(session);
  const now = Date.now();
  const tSinceStartMs =
    activeSession?.startTimeMs != null ? now - activeSession.startTimeMs : null;

  try {
    chrome.runtime?.sendMessage?.({
      type: "recdbg",
      action: "recdbg",
      kind: "RECDBG",
      eventType,
      payload,
      sessionId: activeSession?.sessionId || null,
      tSinceStartMs,
      ts: now,
    });
  } catch {}
};

export const debugRecordingEvent = (sessionRef, eventType, payload) => {
  const session = sessionRef?.current || sessionRef || null;
  debugRecordingEventWithSession(session, eventType, payload);
};

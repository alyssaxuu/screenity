let recordingDebugEnabled = false;

const createSessionId = () =>
  `recdbg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const setRecordingDebugEnabled = (enabled) => {
  recordingDebugEnabled = Boolean(enabled);
};

const initRecordingDebugFlag = () => {
  try {
    if (!chrome?.storage?.local) return;

    chrome.storage.local.get(["SCREENITY_DEBUG_RECORDING"], (result) => {
      setRecordingDebugEnabled(result?.SCREENITY_DEBUG_RECORDING === true);
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.SCREENITY_DEBUG_RECORDING) {
        setRecordingDebugEnabled(
          changes.SCREENITY_DEBUG_RECORDING.newValue === true,
        );
      }
    });
  } catch {
    // ignore - debug only
  }
};

initRecordingDebugFlag();

if (globalThis.SCREENITY_DEBUG_RECORDING === true) {
  setRecordingDebugEnabled(true);
  try {
    chrome?.storage?.local?.set({ SCREENITY_DEBUG_RECORDING: true });
  } catch {
    // ignore - debug only
  }
}

if (!globalThis.__screenityEnableRecordingDebug) {
  globalThis.__screenityEnableRecordingDebug = (enabled = true) => {
    const next = enabled === true;
    setRecordingDebugEnabled(next);
    try {
      chrome?.storage?.local?.set({ SCREENITY_DEBUG_RECORDING: next });
    } catch {
      // ignore - debug only
    }
  };
}

if (!globalThis.__screenityPingRecdbg) {
  globalThis.__screenityPingRecdbg = () =>
    chrome?.runtime?.sendMessage?.({ type: "recdbg-ping" }, () => {
      void chrome?.runtime?.lastError;
    });
}

export const isRecordingDebugEnabled = () => recordingDebugEnabled === true;

export const enableRecordingDebug = () => {
  setRecordingDebugEnabled(true);
  try {
    chrome?.storage?.local?.set({ SCREENITY_DEBUG_RECORDING: true });
  } catch {
    // ignore - debug only
  }
};

export const hydrateRecordingDebugFlag = async () => {
  try {
    if (!chrome?.storage?.local) return isRecordingDebugEnabled();
    const result = await chrome.storage.local.get([
      "SCREENITY_DEBUG_RECORDING",
    ]);
    setRecordingDebugEnabled(result?.SCREENITY_DEBUG_RECORDING === true);
  } catch {
    // ignore - debug only
  }
  return isRecordingDebugEnabled();
};

export const createRecordingDebugSession = () => ({
  sessionId: createSessionId(),
  startTimeMs: Date.now(),
  startPerfMs:
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : null,
});

export const resetRecordingDebugSession = (sessionRef) => {
  if (!isRecordingDebugEnabled()) return null;
  const next = createRecordingDebugSession();
  if (sessionRef) {
    sessionRef.current = next;
  }
  return next;
};

export const ensureRecordingDebugSession = (sessionRef) => {
  if (!isRecordingDebugEnabled()) return null;
  if (sessionRef?.current) return sessionRef.current;
  return resetRecordingDebugSession(sessionRef);
};

const computeSinceStart = (session, fallbackTs) => {
  if (!session) return null;
  if (
    session.startPerfMs != null &&
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return Math.max(0, Math.round(performance.now() - session.startPerfMs));
  }
  if (session.startTimeMs != null) {
    return Math.max(0, Math.round(fallbackTs - session.startTimeMs));
  }
  return null;
};

export const debugRecordingEvent = (sessionRef, eventType, payload) => {
  if (!isRecordingDebugEnabled()) return null;

  const session = ensureRecordingDebugSession(sessionRef);
  if (!session) return null;

  const ts = Date.now();
  const tSinceStartMs = computeSinceStart(session, ts);
  const event = {
    type: "recdbg",
    action: "recdbg",
    kind: "RECDBG",
    sessionId: session.sessionId,
    eventType,
    ts,
    tSinceStartMs,
    payload,
  };

  try {
    chrome?.runtime?.sendMessage?.({ type: "recdbg", ...event }, () => {
      void chrome?.runtime?.lastError;
    });
  } catch {
    // ignore - debug only
  }

  return event;
};

export const debugRecordingEventWithSession = (session, eventType, payload) => {
  if (!isRecordingDebugEnabled() || !session?.sessionId) return null;

  const ts = Date.now();
  const tSinceStartMs = computeSinceStart(session, ts);
  const event = {
    type: "recdbg",
    action: "recdbg",
    kind: "RECDBG",
    sessionId: session.sessionId,
    eventType,
    ts,
    tSinceStartMs,
    payload,
  };

  try {
    chrome?.runtime?.sendMessage?.({ type: "recdbg", ...event }, () => {
      void chrome?.runtime?.lastError;
    });
  } catch {
    // ignore - debug only
  }

  return event;
};

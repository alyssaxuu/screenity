/**
 * Start-flow trace for recording diagnostics.
 *
 * Single bounded object in chrome.storage.local ("startFlowTrace"),
 * overwritten each attempt. No URLs, no page content, no user identity
 * beyond isPro boolean. Error text is truncated and URL-stripped.
 */

const STORAGE_KEY = "startFlowTrace";
const MAX_ERR_LEN = 120;

const sanitize = (str) => {
  if (!str) return null;
  return String(str)
    .replace(/https?:\/\/[^\s)]+/gi, "[url]")
    .replace(/chrome-extension:\/\/[^\s)]+/gi, "[ext]")
    .slice(0, MAX_ERR_LEN);
};

/** Create a fresh trace for a new recording attempt. */
export const initStartFlowTrace = async (attemptId, config = {}) => {
  const trace = {
    attemptId: attemptId || null,
    recordingType: config.recordingType || null,
    surface: config.surface || null,
    isPro: Boolean(config.isPro),
    countdown: Boolean(config.countdown),
    outcome: "in-progress",

    t: {
      startStreaming: null,
      desktopCaptureSent: null,
      recorderTabCreated: null,
      streamAcquired: null,
      preparingSent: null,
      preparingReceived: null,
      apiProjectCreated: null,
      apiUploadersReady: null,
      resetActiveTabSent: null,
      readyToRecordSent: null,
      readyToRecordReceived: null,
      countdownStart: null,
      countdownEnd: null,
      recordingStarted: null,
    },

    routing: {
      targetTabId: null,
      activeTab: null,
      currentTabId: null,
      shouldFocusTab: null,
    },

    error: null,
    errorCode: null,
    stuck: null,
  };

  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: trace });
  } catch {
    // best effort
  }
  return trace;
};

/** Write a timestamp checkpoint. Merges extra fields without overwriting others. */
export const traceStep = async (stepName, extra = {}) => {
  try {
    const res = await chrome.storage.local.get(STORAGE_KEY);
    const trace = res?.[STORAGE_KEY];
    if (!trace) return;

    if (trace.t && stepName in trace.t) {
      trace.t[stepName] = Date.now();
    }

    // Merge extra fields (surface, routing, etc.)
    for (const [key, value] of Object.entries(extra)) {
      if (key === "routing" && trace.routing) {
        Object.assign(trace.routing, value);
      } else if (key !== "t") {
        trace[key] = value;
      }
    }

    await chrome.storage.local.set({ [STORAGE_KEY]: trace });
  } catch {
    // best effort
  }
};

/** Set the final outcome. Only overwrites "in-progress". */
export const setStartFlowOutcome = async (outcome, extra = {}) => {
  try {
    const res = await chrome.storage.local.get(STORAGE_KEY);
    const trace = res?.[STORAGE_KEY];
    if (!trace) return;

    const wasInProgress = trace.outcome === "in-progress";
    if (wasInProgress) {
      trace.outcome = outcome;
    }

    if (extra.error) trace.error = sanitize(extra.error);
    if (extra.errorCode) trace.errorCode = extra.errorCode;
    if (extra.stuck) trace.stuck = extra.stuck;

    await chrome.storage.local.set({ [STORAGE_KEY]: trace });

    // Submit to server for Pro users on terminal outcomes
    if (wasInProgress) {
      if (outcome === "error" || outcome === "stuck") {
        submitDiagnosticReport(outcome);
      } else if (outcome === "cancelled" && extra.error) {
        // Only submit cancelled if there's a diagnostic reason
        // (permission-denied, quota issues) not plain user dismiss
        submitDiagnosticReport("cancelled");
      } else if (outcome === "ok") {
        submitDiagnosticReport("success-summary");
      }
    }
  } catch {
    // best effort
  }
};

/** Read the current trace for export. */
export const getStartFlowTrace = async () => {
  try {
    const res = await chrome.storage.local.get(STORAGE_KEY);
    return res?.[STORAGE_KEY] || null;
  } catch {
    return null;
  }
};

// Track submitted attempt IDs to avoid duplicate submissions
const submittedAttempts = new Set();

/**
 * Submit the current trace to the server for Pro users.
 * Delegates to the background service worker which has no origin
 * restrictions. Best-effort, fire-and-forget. No retries.
 */
export const submitDiagnosticReport = async (trigger) => {
  try {
    const res = await chrome.storage.local.get([
      STORAGE_KEY,
      "isSubscribed",
      "isLoggedIn",
    ]);
    const trace = res?.[STORAGE_KEY];
    if (!trace) return;

    // Only submit for Pro users
    if (!res.isSubscribed || !res.isLoggedIn) return;

    // Dedupe by attemptId
    if (!trace.attemptId || submittedAttempts.has(trace.attemptId)) return;
    submittedAttempts.add(trace.attemptId);

    // Send to background for the actual network call
    chrome.runtime.sendMessage({
      type: "submit-diagnostic-report",
      trigger,
    }).catch(() => {});
  } catch {
    // best effort
  }
};

/** Format the trace as a compact human-readable timeline. */
export const formatStartFlowTimeline = (trace) => {
  if (!trace?.t) return null;

  const base = trace.t.startStreaming;
  if (!base) return null;

  const STEP_ORDER = [
    "startStreaming",
    "desktopCaptureSent",
    "recorderTabCreated",
    "streamAcquired",
    "preparingSent",
    "preparingReceived",
    "apiProjectCreated",
    "apiUploadersReady",
    "resetActiveTabSent",
    "readyToRecordSent",
    "readyToRecordReceived",
    "countdownStart",
    "countdownEnd",
    "recordingStarted",
  ];

  const lines = [];
  for (const step of STEP_ORDER) {
    const ts = trace.t[step];
    if (ts != null) {
      const delta = ts - base;
      lines.push(`  ${step.padEnd(26)} T+${delta}ms`);
    } else {
      lines.push(`  ${step.padEnd(26)} (not reached)`);
    }
  }

  const lastTs = trace.t.recordingStarted;
  const outcomeStr = trace.outcome || "unknown";
  if (lastTs) {
    lines.push(`  Outcome: ${outcomeStr} (${((lastTs - base) / 1000).toFixed(2)}s total)`);
  } else {
    lines.push(`  Outcome: ${outcomeStr}`);
  }

  if (trace.stuck) {
    lines.push(`  Stuck: ${trace.stuck.state} for ${trace.stuck.durationMs}ms`);
  }

  return lines.join("\n");
};

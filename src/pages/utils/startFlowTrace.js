// Start-flow trace for recording diagnostics. One bounded object in
// chrome.storage.local, overwritten each attempt. No URLs, no page
// content, no identity beyond isPro.

const STORAGE_KEY = "startFlowTrace";
const MAX_ERR_LEN = 120;
// Off in prod by default; set globalThis.SCREENITY_DEBUG_RECORDER for support.
const DEBUG_FLOW =
  process.env.NODE_ENV !== "production" ||
  (typeof globalThis !== "undefined" && !!globalThis.SCREENITY_DEBUG_RECORDER);

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
      recorderOffscreenCreated: null,
      pickerRequested: null,
      actionClick: null,
      stopRequested: null,
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

// Writes from one context run in order. recording-error and stop-pending
// arrive together, each read the trace before the other wrote, and the second
// write put back a copy without the first one's error.
let traceQueue = Promise.resolve();
const inOrder = (fn) => {
  const run = traceQueue.then(fn, fn);
  traceQueue = run.catch(() => {});
  return run;
};

/** Write a timestamp checkpoint. Merges extra fields without overwriting others. */
export const traceStep = (stepName, extra = {}) => {
  const now = Date.now();
  return inOrder(() => writeTraceStep(stepName, extra, now));
};

const writeTraceStep = async (stepName, extra, now) => {
  try {
    const res = await chrome.storage.local.get(STORAGE_KEY);
    const trace = res?.[STORAGE_KEY];
    if (!trace) return;

    if (trace.t && stepName in trace.t) {
      trace.t[stepName] = now;
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

    // Mirror every tick to BG so the unified timeline is visible on
    // the SW console even when the originating tab is gone. Uses
    // console.warn because Terser strips log/info/debug in prod.
    const base = trace.t?.startStreaming;
    const elapsedMs = base ? now - base : 0;
    if (DEBUG_FLOW) {
      try {
        // eslint-disable-next-line no-console
        console.warn(
          `[start-flow T+${elapsedMs}ms] ${stepName}`,
          Object.keys(extra).length ? extra : "",
        );
      } catch {}
    }
    try {
      chrome.runtime.sendMessage({
        type: "start-flow-tick",
        event: stepName,
        data: { ...extra, elapsedMs },
        ts: now,
      });
    } catch {}
  } catch {
    // best effort
  }
};

/** Set the final outcome. Only overwrites "in-progress". */
export const setStartFlowOutcome = (outcome, extra = {}) =>
  inOrder(() => writeStartFlowOutcome(outcome, extra));

const writeStartFlowOutcome = async (outcome, extra) => {
  try {
    const res = await chrome.storage.local.get(STORAGE_KEY);
    const trace = res?.[STORAGE_KEY];
    if (!trace) return;

    const wasInProgress = trace.outcome === "in-progress";
    if (wasInProgress) {
      trace.outcome = outcome;
    }

    // The first failure is the cause; what follows is its fallout.
    if (extra.error && (wasInProgress || !trace.error)) {
      trace.error = sanitize(extra.error);
    }
    if (extra.errorCode && (wasInProgress || !trace.errorCode)) {
      trace.errorCode = extra.errorCode;
    }
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

// The recorder's start stages live under their own key. Written into the trace,
// they raced the content script's outcome write from another context, and the
// success report went out before they landed in about half of the takes.
export const START_STAGES_KEY = "startFlowStartStages";
const START_STAGES_WAIT_MS = 10000;

export const writeStartStages = async (attemptId, startStages) => {
  if (!startStages) return;
  try {
    await chrome.storage.local.set({
      [START_STAGES_KEY]: { attemptId: attemptId || null, startStages },
    });
  } catch {}
};

const stagesFor = (entry, attemptId) =>
  attemptId && entry?.attemptId === attemptId ? entry.startStages || null : null;

// The success report is posted when the take goes live, a moment before the
// recorder writes its stages. Waits for them, bounded; null if they never come.
export const awaitStartStages = (attemptId, timeoutMs = START_STAGES_WAIT_MS) =>
  new Promise((resolve) => {
    if (!attemptId) {
      resolve(null);
      return;
    }
    let done = false;
    let timer = null;
    const onChange = (changes, area) => {
      if (area !== "local") return;
      const stages = stagesFor(changes?.[START_STAGES_KEY]?.newValue, attemptId);
      if (stages) finish(stages);
    };
    const finish = (stages) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        chrome.storage.onChanged.removeListener(onChange);
      } catch {}
      resolve(stages);
    };
    timer = setTimeout(() => finish(null), timeoutMs);
    try {
      chrome.storage.onChanged.addListener(onChange);
    } catch {}
    Promise.resolve(chrome.storage.local.get(START_STAGES_KEY))
      .then((res) => {
        const stages = stagesFor(res?.[START_STAGES_KEY], attemptId);
        if (stages) finish(stages);
      })
      .catch(() => {});
  });

/** Read the current trace for export. */
export const getStartFlowTrace = async () => {
  try {
    const res = await chrome.storage.local.get([STORAGE_KEY, START_STAGES_KEY]);
    const trace = res?.[STORAGE_KEY] || null;
    const stages = stagesFor(res?.[START_STAGES_KEY], trace?.attemptId);
    return trace && stages ? { ...trace, startStages: stages } : trace;
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

let lastIgnoredReportAt = 0;
const IGNORED_REPORT_COOLDOWN_MS = 10000;

/**
 * Report a Start click the double-click guard swallowed. Own event, not the
 * stored trace (that belongs to the attempt still in flight). Throttled so a
 * mashed button is one report.
 */
export const reportIgnoredStartClick = async ({
  reason,
  pendingAgeMs,
  recordingType,
}) => {
  try {
    const now = Date.now();
    if (now - lastIgnoredReportAt < IGNORED_REPORT_COOLDOWN_MS) return;
    lastIgnoredReportAt = now;

    const res = await chrome.storage.local.get(["isSubscribed", "isLoggedIn"]);
    if (!res.isSubscribed || !res.isLoggedIn) return;

    chrome.runtime
      .sendMessage({
        type: "submit-diagnostic-report",
        event: {
          attemptId: `ig-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          trigger: "ignored",
          outcome: "ignored",
          stage: "start-click-ignored",
          reason,
          pendingAgeMs,
          recordingType: recordingType || null,
        },
      })
      .catch(() => {});
  } catch {}
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
    "recorderOffscreenCreated",
    "pickerRequested",
    "actionClick",
    "stopRequested",
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

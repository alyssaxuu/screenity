/**
 * Builds a URL-safe support-context object for Tally form prefills.
 * No URLs, tokens, page content, or blobs — only sanitized technical metadata.
 */

const MAX_ERR_LEN = 120;

const sanitizeError = (err) => {
  if (!err) return "";
  const str =
    typeof err === "string"
      ? err
      : err.message || err.errorCode || JSON.stringify(err);
  return str
    .replace(/https?:\/\/[^\s)]+/gi, "[url]")
    .replace(/chrome-extension:\/\/[^\s)]+/gi, "[ext]")
    .slice(0, MAX_ERR_LEN);
};

const shortBrowser = () => {
  const ua = navigator.userAgent || "";
  const edg = ua.match(/Edg\/(\d+)/);
  if (edg) return `Edge/${edg[1]}`;
  const ch = ua.match(/Chrome\/(\d+)/);
  if (ch) return `Chrome/${ch[1]}`;
  return "Unknown";
};

/** Build support context. Returns flat key-value pairs for URLSearchParams. */
export const buildSupportContext = async (opts = {}) => {
  const ctx = {};

  // ---- always included ----
  ctx.v = chrome.runtime.getManifest().version;
  ctx.lang = chrome.i18n.getMessage("@@ui_locale") || "unknown";
  ctx.br = shortBrowser();

  try {
    const info = await chrome.runtime.getPlatformInfo();
    ctx.os = info.os; // "mac", "win", "linux", "cros", etc.
  } catch {
    ctx.os = "unknown";
  }

  // Human-readable platform for Tally choice prefill
  const platformMap = { mac: "macOS", win: "Windows", linux: "Linux", cros: "ChromeOS" };
  ctx.platform = platformMap[ctx.os] || "Other";

  ctx.cloud =
    process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true" ? "1" : "0";

  if (opts.source) {
    ctx.src = opts.source;
  }

  // ---- recording / error state (opt-in) ----
  if (opts.includeRecordingState) {
    try {
      const keys = [
        "lastRecordingError",
        "lastRecordingType",
        "recordingType",
        "fastRecorderInUse",
        "fastRecorderDisabledReason",
        "isSubscribed",
        "diagnosticLog",
        "recordingAttemptId",
      ];
      const store = await chrome.storage.local.get(keys);

      const recType = store.lastRecordingType || store.recordingType;
      if (recType) ctx.recType = recType;
      if (store.fastRecorderInUse != null)
        ctx.fast = store.fastRecorderInUse ? "1" : "0";
      if (store.fastRecorderDisabledReason)
        ctx.fastOff = String(store.fastRecorderDisabledReason).slice(0, 60);
      ctx.sub = store.isSubscribed ? "1" : "0";
      ctx.cloud = store.isSubscribed ? "1" : "0";
      if (store.lastRecordingError) {
        ctx.lastErr = sanitizeError(
          store.lastRecordingError.why || store.lastRecordingError.error,
        );
        if (store.lastRecordingError.errorCode)
          ctx.errCode = store.lastRecordingError.errorCode;
      }
      if (store.recordingAttemptId)
        ctx.attemptId = store.recordingAttemptId;

      // Last diagnostic session outcome (compact — just the outcome string)
      if (store.diagnosticLog?.sessions?.length) {
        const last =
          store.diagnosticLog.sessions[
            store.diagnosticLog.sessions.length - 1
          ];
        if (last?.outcome) ctx.lastOutcome = last.outcome;
        // Detect incomplete editor handoff (editor opened but never loaded)
        if (last?.events?.length) {
          const hasEditorOpen = last.events.some(
            (ev) => ev.e === "editor-open" && ev.d?.type === "editorwebcodecs",
          );
          const hasEditorReady = last.events.some(
            (ev) => ev.e === "editor-load-ready",
          );
          if (hasEditorOpen && !hasEditorReady) ctx.editorHandoff = "incomplete";
        }
      }
    } catch {
      // storage read failed — continue without recording state
    }
  }

  // ---- explicit error overrides (from error modal "Get help" button) ----
  if (opts.errorCode) ctx.errCode = opts.errorCode;
  if (opts.errorWhy) ctx.lastErr = sanitizeError(opts.errorWhy);

  // ---- support code (short human-readable reference) ----
  if (ctx.attemptId) {
    const hash = ctx.attemptId.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    ctx.supportCode = `SCR-${hash}-${date}`;
  }

  // ---- user info (only when explicitly provided) ----
  if (opts.user) {
    if (opts.user.name) ctx.name = opts.user.name;
    if (opts.user.email) ctx.email = opts.user.email;
  }

  return ctx;
};

/** Build context and return as a query string. */
export const supportContextQuery = async (opts = {}) => {
  const ctx = await buildSupportContext(opts);
  const params = new URLSearchParams();
  for (const [k, val] of Object.entries(ctx)) {
    if (val !== undefined && val !== null && val !== "") {
      params.set(k, val);
    }
  }
  return params.toString();
};

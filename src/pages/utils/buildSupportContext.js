/**
 * Builds a flat, URL-safe support-context object for Tally form prefills.
 *
 * Privacy rules:
 *  - No full URLs, user IDs, auth tokens, or page content
 *  - Error messages are stripped of URL-like substrings and truncated
 *  - No raw diagnostic logs, video blobs, or storage dumps
 *  - User name/email only included when caller explicitly passes them
 *
 * All values are short strings safe for URLSearchParams.
 */

const MAX_ERR_LEN = 120;

/** Strip anything that looks like a URL from an error string. */
const sanitizeError = (err) => {
  if (!err) return "";
  const str = typeof err === "string" ? err : String(err);
  return str
    .replace(/https?:\/\/[^\s)]+/gi, "[url]")
    .replace(/chrome-extension:\/\/[^\s)]+/gi, "[ext]")
    .slice(0, MAX_ERR_LEN);
};

/** Extract "Chrome/124" or "Edg/124" from the user-agent string. */
const shortBrowser = () => {
  const ua = navigator.userAgent || "";
  const edg = ua.match(/Edg\/(\d+)/);
  if (edg) return `Edge/${edg[1]}`;
  const ch = ua.match(/Chrome\/(\d+)/);
  if (ch) return `Chrome/${ch[1]}`;
  return "Unknown";
};

/**
 * Build support context.
 *
 * @param {Object}  [opts]
 * @param {boolean} [opts.includeRecordingState] — pull last-recording fields from storage
 * @param {string}  [opts.source]               — where the form was opened (e.g. "popup", "settings", "editor")
 * @param {{name:string, email:string}} [opts.user] — only pass when the user is already authenticated
 * @returns {Promise<Record<string, string>>}    flat key-value pairs for URLSearchParams
 */
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
        "recordingType",
        "fastRecorderInUse",
        "fastRecorderDisabledReason",
        "isSubscribed",
        "diagnosticLog",
      ];
      const store = await chrome.storage.local.get(keys);

      if (store.recordingType) ctx.recType = store.recordingType;
      if (store.fastRecorderInUse != null)
        ctx.fast = store.fastRecorderInUse ? "1" : "0";
      if (store.fastRecorderDisabledReason)
        ctx.fastOff = String(store.fastRecorderDisabledReason).slice(0, 60);
      if (store.isSubscribed != null)
        ctx.sub = store.isSubscribed ? "1" : "0";
      if (store.lastRecordingError)
        ctx.lastErr = sanitizeError(store.lastRecordingError);

      // Last diagnostic session outcome (compact — just the outcome string)
      if (store.diagnosticLog?.sessions?.length) {
        const last =
          store.diagnosticLog.sessions[
            store.diagnosticLog.sessions.length - 1
          ];
        if (last?.outcome) ctx.lastOutcome = last.outcome;
      }
    } catch {
      // storage read failed — continue without recording state
    }
  }

  // ---- user info (only when explicitly provided) ----
  if (opts.user) {
    if (opts.user.name) ctx.name = opts.user.name;
    if (opts.user.email) ctx.email = opts.user.email;
  }

  return ctx;
};

/**
 * Convenience: build context and return it as a query string.
 * Drops any key whose value is empty/undefined.
 */
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

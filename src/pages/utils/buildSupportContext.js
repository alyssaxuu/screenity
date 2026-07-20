/**
 * Builds a URL-safe support-context object for Tally form prefills.
 * No URLs, tokens, page content, or blobs, only sanitized technical metadata.
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
    // strip user-home paths from stack traces so support payloads don't
    // leak the OS account name
    .replace(/\/Users\/[^/\s)]+/g, "/Users/[redacted]")
    .replace(/\/home\/[^/\s)]+/g, "/home/[redacted]")
    .replace(/[A-Z]:\\Users\\[^\\\s)]+/g, "C:\\Users\\[redacted]")
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

// shortBrowser() can only say Chrome/150; the high-entropy hint has the real
// build. Brand order mirrors shortBrowser().
const fullBrowserVersion = async () => {
  try {
    const uaData = navigator.userAgentData;
    if (!uaData?.getHighEntropyValues) return null;
    const { fullVersionList } = await uaData.getHighEntropyValues([
      "fullVersionList",
    ]);
    if (!Array.isArray(fullVersionList)) return null;
    for (const wanted of [/^Microsoft Edge$/i, /^Google Chrome$/i, /^Chromium$/i]) {
      const hit = fullVersionList.find((b) => wanted.test(b?.brand || ""));
      if (hit?.version) return String(hit.version);
    }
    return null;
  } catch {
    return null;
  }
};

/** Build support context. Returns flat key-value pairs for URLSearchParams. */
export const buildSupportContext = async (opts = {}) => {
  const ctx = {};

  ctx.v = chrome.runtime.getManifest().version;
  ctx.lang = chrome.i18n.getMessage("@@ui_locale") || "unknown";
  ctx.br = shortBrowser();
  const brFull = await fullBrowserVersion();
  if (brFull) ctx.brFull = brFull;

  // Coarse device class, to see if stuck-recording reports cluster on low-RAM
  // or low-core devices. Both are already exposed to every page, no PII.
  if (typeof navigator.deviceMemory === "number") {
    ctx.mem = String(navigator.deviceMemory);
  }
  if (typeof navigator.hardwareConcurrency === "number") {
    ctx.cores = String(navigator.hardwareConcurrency);
  }

  try {
    const info = await chrome.runtime.getPlatformInfo();
    ctx.os = info.os;
  } catch {
    ctx.os = "unknown";
  }

  const platformMap = { mac: "macOS", win: "Windows", linux: "Linux", cros: "ChromeOS" };
  ctx.platform = platformMap[ctx.os] || "Other";

  ctx.cloud =
    process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true" ? "1" : "0";

  if (opts.source) {
    ctx.src = opts.source;
  }

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
        "lastRecordingBackendRef",
        "lastRecordingFinalizedFileName",
        "freeRecorderSession",
        "fastRecorderValidation",
        "editorReadyAt",
        "lastTrackEndEvent",
        "editorRecordingError",
        "lastTabStreamMintMs",
        "lastTabStreamMintOk",
        "lastTabStreamMintOffscreen",
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

      // Distinguishes writer-hung from writer-ok-editor-failed for
      // triaging stuck-at-90% reports.
      if (store.lastRecordingBackendRef?.backend) {
        ctx.backend = store.lastRecordingBackendRef.backend;
      }
      if (store.lastRecordingBackendRef?.fileName) {
        ctx.finalized =
          store.lastRecordingFinalizedFileName ===
          store.lastRecordingBackendRef.fileName
            ? "1"
            : "0";
      }

      // Tab streamId mint latency, for tabStreamUnavailableError reports. High
      // mintMs with mintOk=0 means slow not hung; mintOff=1 means via the SW.
      if (store.lastTabStreamMintMs != null) {
        ctx.mintMs = String(store.lastTabStreamMintMs);
        ctx.mintOk = store.lastTabStreamMintOk ? "1" : "0";
        ctx.mintOff = store.lastTabStreamMintOffscreen ? "1" : "0";
      }

      if (store.freeRecorderSession) {
        if (store.freeRecorderSession.chunkCount != null)
          ctx.chunks = String(store.freeRecorderSession.chunkCount);
        if (store.freeRecorderSession.status)
          ctx.recSessStatus = String(store.freeRecorderSession.status).slice(
            0,
            30,
          );
      }

      if (store.fastRecorderValidation) {
        ctx.validationOk = store.fastRecorderValidation.ok ? "1" : "0";
        if (store.fastRecorderValidation.hardFail) ctx.validationHardFail = "1";
        if (
          !store.fastRecorderValidation.ok &&
          Array.isArray(store.fastRecorderValidation.reasons)
        ) {
          ctx.validationReason = String(
            store.fastRecorderValidation.reasons[0] || "",
          ).slice(0, 60);
        }
        if (store.fastRecorderValidation.details?.size) {
          // MB rounded; keeps the URL short.
          ctx.fileMb = String(
            Math.round(store.fastRecorderValidation.details.size / (1024 * 1024)),
          );
        }
      }

      // Editor reached ready (new instrumentation; storage mirror of
      // contentState.ready). Absence means the editor never loaded.
      if (store.editorReadyAt) ctx.editorReady = "1";

      // Track-end reason: distinguishes graceful stop from stream-end
      // teardown (display sleep, Chrome native Stop sharing, source-tab
      // close). Both bug-reporters had REC_RUN_STREAM_END so this is
      // critical for matching.
      if (store.lastTrackEndEvent?.reason) {
        ctx.trackEndReason = String(store.lastTrackEndEvent.reason).slice(
          0,
          60,
        );
      }

      // Editor-side error if surfaced. Differentiates types of stuck.
      if (store.editorRecordingError?.errorCode) {
        ctx.editorErr = String(store.editorRecordingError.errorCode).slice(
          0,
          60,
        );
      }

      if (store.diagnosticLog?.sessions?.length) {
        const last =
          store.diagnosticLog.sessions[
            store.diagnosticLog.sessions.length - 1
          ];
        if (last?.outcome) ctx.lastOutcome = last.outcome;
        if (last?.events?.length) {
          const hasEditorOpen = last.events.some(
            (ev) => ev.e === "editor-open" && ev.d?.type === "editor",
          );
          const hasEditorReady = last.events.some(
            (ev) => ev.e === "editor-load-ready",
          );
          if (hasEditorOpen && !hasEditorReady) ctx.editorHandoff = "incomplete";

          // Last 30 events as "name@msFromSessionStart". Just the
          // sequence, no payloads.
          const recent = last.events.slice(-30);
          const compact = recent
            // xN is how many times a collapsed event repeated (sw-init@1234x4
            // means the SW restarted 4 times).
            .map((ev) => `${ev.e}@${ev.t}${ev.n > 1 ? `x${ev.n}` : ""}`)
            .join(",");
          // Cap so a runaway log doesn't blow past Tally URL limits.
          if (compact && compact.length <= 3000) {
            ctx.diagEvents = compact;
          } else if (compact) {
            // Keep the most recent.
            ctx.diagEvents = compact.slice(-3000);
          }
        }
      }

      // One-line failure summary from the fields above, readable at a glance.
      const summaryBits = [];
      if (ctx.finalized === "0") summaryBits.push("not-finalized");
      if (ctx.chunks === "0") summaryBits.push("0-chunks");
      if (
        ctx.recSessStatus &&
        ctx.recSessStatus !== "complete" &&
        ctx.recSessStatus !== "completed"
      )
        summaryBits.push(`sess:${ctx.recSessStatus}`);
      if (ctx.editorHandoff === "incomplete") summaryBits.push("editor-stuck");
      if (ctx.editorErr) summaryBits.push(`editorErr:${ctx.editorErr}`);
      if (ctx.trackEndReason) summaryBits.push("track-ended");
      if (summaryBits.length) {
        ctx.summary = summaryBits.join("+").slice(0, 80);
      }
    } catch {}
  }

  if (opts.errorCode) ctx.errCode = opts.errorCode;
  if (opts.errorWhy) ctx.lastErr = sanitizeError(opts.errorWhy);

  if (ctx.attemptId) {
    const hash = ctx.attemptId.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    ctx.supportCode = `SCR-${hash}-${date}`;
  }

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

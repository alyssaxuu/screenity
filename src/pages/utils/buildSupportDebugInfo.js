/**
 * Clipboard-friendly debug summary for support.
 * Same privacy rules as buildSupportContext — no URLs, tokens, or user content.
 */

import { makeSupportCode } from "./errorCodes";
import { getStartFlowTrace, formatStartFlowTimeline } from "./startFlowTrace";

const MAX_ERR_LEN = 120;

const sanitizeError = (err) => {
  if (!err) return "";
  const str = typeof err === "string" ? err : String(err);
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

const shortOS = async () => {
  try {
    const info = await chrome.runtime.getPlatformInfo();
    return info.os || "unknown";
  } catch {
    return "unknown";
  }
};

/** Build a plain-text debug info block for clipboard. */
export const buildSupportDebugInfo = async (opts = {}) => {
  const version = chrome.runtime.getManifest().version;
  const browser = shortBrowser();
  const os = await shortOS();
  const ts = new Date().toISOString();

  // Pull relevant state from storage
  let store = {};
  try {
    store = await chrome.storage.local.get([
      "recordingAttemptId",
      "recordingType",
      "fastRecorderInUse",
      "fastRecorderDisabledReason",
      "isSubscribed",
      "lastRecordingError",
      "lastStreamCheckFail",
      "lastAutoDiscardableError",
      "streamLifecycleLog",
      "diagnosticLog",
    ]);
  } catch {
    // storage read failed — continue with defaults
  }

  const attemptId = store.recordingAttemptId || null;
  const supportCode = makeSupportCode(attemptId);

  // Determine error code: prefer explicit, fall back to stored
  const errorCode =
    opts.errorCode ||
    store.lastRecordingError?.errorCode ||
    null;

  const errorWhy = sanitizeError(
    opts.errorWhy || store.lastRecordingError?.why || ""
  );

  // Recording mode
  const recType = store.recordingType || "unknown";
  const fastRec = store.fastRecorderInUse ? "active" : "off";
  const fastOff = store.fastRecorderDisabledReason || null;
  const sub = store.isSubscribed ? "pro" : "free";

  // Last diagnostic session outcome + editor handoff check
  let lastOutcome = null;
  let editorHandoffIncomplete = false;
  if (store.diagnosticLog?.sessions?.length) {
    const last =
      store.diagnosticLog.sessions[store.diagnosticLog.sessions.length - 1];
    lastOutcome = last?.outcome || null;
    if (last?.events?.length) {
      const hasEditorOpen = last.events.some(
        (ev) => ev.e === "editor-open" && ev.d?.type === "editorwebcodecs",
      );
      const hasEditorReady = last.events.some(
        (ev) => ev.e === "editor-load-ready",
      );
      editorHandoffIncomplete = hasEditorOpen && !hasEditorReady;
    }
  }

  // Build the text block
  const lines = [
    `Screenity Debug Info`,
    `====================`,
    `Code:      ${supportCode}`,
  ];
  if (errorCode) lines.push(`Error:     ${errorCode}`);
  if (errorWhy) lines.push(`Detail:    ${errorWhy}`);
  lines.push(`Version:   ${version}`);
  lines.push(`Browser:   ${browser}`);
  lines.push(`OS:        ${os}`);
  lines.push(`Mode:      ${recType}`);
  lines.push(`Fast MP4:  ${fastRec}${fastOff ? ` (${fastOff})` : ""}`);
  lines.push(`Plan:      ${sub}`);
  if (lastOutcome) lines.push(`Session:   ${lastOutcome}`);
  if (editorHandoffIncomplete) lines.push(`EditorLoad: incomplete (editor opened but never became ready)`);
  if (store.lastStreamCheckFail) {
    const sc = store.lastStreamCheckFail;
    lines.push(`StreamChk: ${sc.bucket || "?"} vis=${sc.docVisibility || sc.docHidden} ms=${sc.msSinceReady ?? "?"}`);
  }
  if (store.lastAutoDiscardableError) {
    lines.push(`AutoDisc:  failed tab=${store.lastAutoDiscardableError.tabId}`);
  }
  if (store.streamLifecycleLog?.length) {
    const sl = store.streamLifecycleLog;
    const tags = sl.map((e) => `${e.tag}@${e.t}`).join(" → ");
    lines.push(`SL(${sl.length}): ${tags.slice(0, 300)}`);
  }
  if (attemptId) lines.push(`Ref:       ${attemptId}`);
  lines.push(`Time:      ${ts}`);

  // Start-flow trace timeline
  try {
    const trace = await getStartFlowTrace();
    if (trace) {
      const timeline = formatStartFlowTimeline(trace);
      if (timeline) {
        lines.push("");
        lines.push("Start Flow:");
        lines.push(timeline);
      }
    }
  } catch {
    // best effort
  }

  return lines.join("\n");
};

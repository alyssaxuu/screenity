// recorder -> background messaging, shared by CloudRecorder and Recorder.
// iframe-context reload on error is a no-op for the offscreen Recorder, so it's safe to share.
// sendStopRecording accepts a string or object reason, plus optional extra fields.
import { classifyError } from "./errorCodes";

const urlParams = new URLSearchParams(window.location.search);
const IS_INJECTED_IFRAME = urlParams.has("injected");
const IS_IFRAME_CONTEXT =
  IS_INJECTED_IFRAME ||
  (window.top !== window.self &&
    !document.referrer.startsWith("chrome-extension://"));

export function sendRecordingError(why, cancel = false) {
  const errorType = !cancel ? "stream-error" : "cancel-modal";
  const whyStr = typeof why === "string" ? why : JSON.stringify(why);
  const errorCode = classifyError(whyStr, errorType);

  chrome.runtime.sendMessage({
    type: "recording-error",
    error: errorType,
    why: whyStr,
    errorCode,
  });

  if (IS_IFRAME_CONTEXT) {
    window.location.reload();
  }
}

export function sendStopRecording(reason = "generic", extra = {}) {
  const base =
    typeof reason === "string"
      ? { reason }
      : { ...(reason || {}), reason: reason?.reason || "generic" };

  chrome.runtime.sendMessage({
    type: "stop-recording-tab",
    ...base,
    ...extra,
  });
}

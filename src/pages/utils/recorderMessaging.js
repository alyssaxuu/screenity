// recorder -> background messaging, shared by CloudRecorder and Recorder.
// iframe-context reload on error is a no-op for the offscreen Recorder, so it's safe to share.
// sendStopRecording accepts a string or object reason, plus optional extra fields.
import { classifyError } from "./errorCodes";
import { IS_IFRAME_HOST } from "./recordingHost";

export function sendRecordingError(why, cancel = false, errorCodeOverride = null) {
  const errorType = !cancel ? "stream-error" : "cancel-modal";
  const whyStr = typeof why === "string" ? why : JSON.stringify(why);
  const errorCode = errorCodeOverride || classifyError(whyStr, errorType);

  chrome.runtime.sendMessage({
    type: "recording-error",
    error: errorType,
    why: whyStr,
    errorCode,
  });

  if (IS_IFRAME_HOST) {
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

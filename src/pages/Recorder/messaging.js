import { classifyError } from "../utils/errorCodes";

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
}

export function sendStopRecording(reason = "generic", extra = {}) {
  chrome.runtime.sendMessage({
    type: "stop-recording-tab",
    reason,
    ...extra,
  });
}

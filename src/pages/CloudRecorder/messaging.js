import { classifyError } from "../utils/errorCodes";

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
    // Reload the iframe
    window.location.reload();
  }
}

export function sendStopRecording(reason = "generic") {
  const payload =
    typeof reason === "string"
      ? { reason }
      : { ...(reason || {}), reason: reason?.reason || "generic" };

  chrome.runtime.sendMessage({
    type: "stop-recording-tab",
    ...payload,
  });
}

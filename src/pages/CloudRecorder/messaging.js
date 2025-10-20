const urlParams = new URLSearchParams(window.location.search);
const IS_INJECTED_IFRAME = urlParams.has("injected");
const IS_IFRAME_CONTEXT =
  IS_INJECTED_IFRAME ||
  (window.top !== window.self &&
    !document.referrer.startsWith("chrome-extension://"));

export function sendRecordingError(why, cancel = false) {
  chrome.runtime.sendMessage({
    type: "recording-error",
    error: !cancel ? "stream-error" : "cancel-modal",
    why: typeof why === "string" ? why : JSON.stringify(why),
  });

  if (IS_IFRAME_CONTEXT) {
    // Reload the iframe
    window.location.reload();
  }
}

export function sendStopRecording(reason = "generic") {
  chrome.runtime.sendMessage({
    type: "stop-recording-tab",
    reason,
  });
}

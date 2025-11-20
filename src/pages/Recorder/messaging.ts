export function sendRecordingError(why, cancel = false) {
  chrome.runtime.sendMessage({
    type: "recording-error",
    error: !cancel ? "stream-error" : "cancel-modal",
    why: typeof why === "string" ? why : JSON.stringify(why),
  });
}

export function sendStopRecording(reason = "generic") {
  chrome.runtime.sendMessage({
    type: "stop-recording-tab",
    reason,
  });
}

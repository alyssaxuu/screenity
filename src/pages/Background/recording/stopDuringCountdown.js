// pendingRecording without recording covers the countdown. The content script
// owns the countdown, so a stop then goes there as a cancel, not to the recorder.
export const cancelCountdownForStop = async ({ get, send }) => {
  try {
    const { pendingRecording, recording, restarting, recordingUiTabId, activeTab } =
      await get(["pendingRecording", "recording", "restarting", "recordingUiTabId", "activeTab"]);
    if (!pendingRecording || recording || restarting) return false;
    const tabId = recordingUiTabId || activeTab;
    if (!tabId) return false;
    const res = await send(tabId, { type: "cancel-countdown-for-stop" });
    return Boolean(res?.countdownCancelled);
  } catch {
    // Unreachable tab: let the stop go through as before.
    return false;
  }
};

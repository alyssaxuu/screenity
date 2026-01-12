import { sendMessageTab } from "../tabManagement";

export const handleTabActivation = async (activeInfo) => {
  try {
    const {
      recordingStartTime,
      recording,
      restarting,
      pendingRecording,
      recorderSession,
    } = await chrome.storage.local.get([
      "recordingStartTime",
      "recording",
      "restarting",
      "pendingRecording",
      "recorderSession",
      "paused",
      "pausedAt",
      "totalPausedMs",
    ]);

    // Get the activated tab
    const tab = await chrome.tabs.get(activeInfo.tabId);

    // Check both recording flag AND recorderSession to avoid race conditions
    // recorderSession persists even if the SW restarts
    const isActivelyRecording =
      recording || (recorderSession && recorderSession.status === "recording");

    if (isActivelyRecording) {
      // Check if region recording and if the current tab is the recording tab
      const { tabRecordedID, region, customRegion, recordingType } =
        await chrome.storage.local.get([
          "tabRecordedID",
          "region",
          "customRegion",
          "recordingType",
        ]);
      if (tabRecordedID && tabRecordedID !== activeInfo.tabId) {
        sendMessageTab(activeInfo.tabId, { type: "hide-popup-recording" });
      } else if (
        !(
          tab.url.includes("backup.html") &&
          tab.url.includes("chrome-extension://")
        )
      ) {
        // Update the active tab reference
        chrome.storage.local.set({ activeTab: activeInfo.tabId });
      }

      // Check if it's region or customRegion recording
      if (!region && !customRegion && recordingType !== "region") {
        sendMessageTab(activeInfo.tabId, {
          type: "recording-check",
          recordingStartTime,
        });
      }
    } else if (!isActivelyRecording && !restarting && !pendingRecording) {
      sendMessageTab(activeInfo.tabId, { type: "recording-ended" });
    }

    // If there's a recording start time, update the UI with time
    if (recordingStartTime) {
      const now = Date.now();
      const basePaused = totalPausedMs || 0;
      const extraPaused = paused && pausedAt ? Math.max(0, now - pausedAt) : 0;

      const elapsed = Math.max(
        0,
        Math.floor((now - recordingStartTime - basePaused - extraPaused) / 1000)
      );

      const { alarm } = await chrome.storage.local.get(["alarm"]);
      if (alarm) {
        const { alarmTime } = await chrome.storage.local.get(["alarmTime"]);
        const remaining = Math.max(0, Math.floor(alarmTime - elapsed));
        sendMessageTab(activeInfo.tabId, { type: "time", time: remaining });
      } else {
        sendMessageTab(activeInfo.tabId, { type: "time", time: elapsed });
      }
    }
  } catch (error) {
    console.error("Error in handleTabActivation:", error.message);
  }
};

export const onTabActivatedListener = () => {
  chrome.tabs.onActivated.addListener(handleTabActivation);
};

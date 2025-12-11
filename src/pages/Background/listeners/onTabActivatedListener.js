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
      const { alarm } = await chrome.storage.local.get(["alarm"]);
      if (alarm) {
        const { alarmTime } = await chrome.storage.local.get(["alarmTime"]);
        const seconds = parseFloat(alarmTime);
        const time = Math.floor((Date.now() - recordingStartTime) / 1000);
        const remaining = seconds - time;
        sendMessageTab(activeInfo.tabId, {
          type: "time",
          time: remaining,
        });
      } else {
        const time = Math.floor((Date.now() - recordingStartTime) / 1000);
        sendMessageTab(activeInfo.tabId, { type: "time", time: time });
      }
    }
  } catch (error) {
    console.error("Error in handleTabActivation:", error.message);
  }
};

export const onTabActivatedListener = () => {
  chrome.tabs.onActivated.addListener(handleTabActivation);
};

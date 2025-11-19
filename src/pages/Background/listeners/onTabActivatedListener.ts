import { sendMessageTab } from "../tabManagement";

export const handleTabActivation = async (
  activeInfo: chrome.tabs.TabActiveInfo
): Promise<void> => {
  try {
    const result = await chrome.storage.local.get(["recordingStartTime"]);
    const recordingStartTime = result.recordingStartTime as number | undefined;

    // Get the activated tab
    const tab = await chrome.tabs.get(activeInfo.tabId);

    // Check if currently recording or restarting
    const recordingResult = await chrome.storage.local.get(["recording"]);
    const restartingResult = await chrome.storage.local.get(["restarting"]);
    const pendingResult = await chrome.storage.local.get(["pendingRecording"]);
    const recording = recordingResult.recording as boolean | undefined;
    const restarting = restartingResult.restarting as boolean | undefined;
    const pendingRecording = pendingResult.pendingRecording as
      | boolean
      | undefined;

    if (recording) {
      // Check if region recording and if the current tab is the recording tab
      const tabResult = await chrome.storage.local.get(["tabRecordedID"]);
      const tabRecordedID = tabResult.tabRecordedID as number | undefined;
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
      const { region } = await chrome.storage.local.get(["region"]);
      const { customRegion } = await chrome.storage.local.get(["customRegion"]);
      const { recordingType } = await chrome.storage.local.get([
        "recordingType",
      ]);
      if (!region && !customRegion && recordingType !== "region") {
        sendMessageTab(activeInfo.tabId, {
          type: "recording-check",
          recordingStartTime,
        });
      }
    } else if (!recording && !restarting && !pendingRecording) {
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

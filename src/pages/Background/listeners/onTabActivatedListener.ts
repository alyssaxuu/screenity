import { sendMessageTab } from "../tabManagement";

interface TabActiveInfo {
  tabId: number;
  windowId: number;
}

export const handleTabActivation = async (
  activeInfo: TabActiveInfo
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
        tab.url &&
        !(
          tab.url.includes("backup.html") &&
          tab.url.includes("chrome-extension://")
        )
      ) {
        // Update the active tab reference
        chrome.storage.local.set({ activeTab: activeInfo.tabId });
      }

      // Check if it's region or customRegion recording
      const regionResult = await chrome.storage.local.get(["region"]);
      const customRegionResult = await chrome.storage.local.get(["customRegion"]);
      const typeResult = await chrome.storage.local.get(["recordingType"]);
      const region = regionResult.region as boolean | undefined;
      const customRegion = customRegionResult.customRegion as boolean | undefined;
      const recordingType = typeResult.recordingType as string | undefined;
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
      const alarmResult = await chrome.storage.local.get(["alarm"]);
      const alarm = alarmResult.alarm as boolean | undefined;
      if (alarm) {
        const timeResult = await chrome.storage.local.get(["alarmTime"]);
        const alarmTime = timeResult.alarmTime as string | number | undefined;
        const seconds = parseFloat(String(alarmTime || 0));
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
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Error in handleTabActivation:", err.message);
  }
};

export const onTabActivatedListener = () => {
  chrome.tabs.onActivated.addListener(handleTabActivation);
};

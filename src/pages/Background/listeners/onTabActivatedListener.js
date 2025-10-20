import { sendMessageTab } from "../tabManagement";

export const handleTabActivation = async (activeInfo) => {
  try {
    const { recordingStartTime } = await chrome.storage.local.get([
      "recordingStartTime",
    ]);

    // Get the activated tab
    const tab = await chrome.tabs.get(activeInfo.tabId);

    // Check if currently recording or restarting
    const { recording } = await chrome.storage.local.get(["recording"]);
    const { restarting } = await chrome.storage.local.get(["restarting"]);
    const { pendingRecording } = await chrome.storage.local.get([
      "pendingRecording",
    ]);

    if (recording) {
      // Check if region recording and if the current tab is the recording tab
      const { tabRecordedID } = await chrome.storage.local.get([
        "tabRecordedID",
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

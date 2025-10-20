import { stopRecording } from "../recording/stopRecording.js";
import { sendMessageTab } from "../tabManagement";
import { sendMessageRecord } from "../recording/sendMessageRecord.js";

// Utility to handle tab messaging logic
const handleTabMessaging = async (tab) => {
  const { activeTab } = await chrome.storage.local.get(["activeTab"]);

  try {
    const targetTab = await chrome.tabs.get(activeTab);

    if (targetTab) {
      sendMessageTab(activeTab, { type: "stop-recording-tab" });
    } else {
      sendMessageTab(tab.id, { type: "stop-recording-tab" });
      chrome.storage.local.set({ activeTab: tab.id });
    }
  } catch (error) {
    console.error("Error in handleTabMessaging:", error);
  }
};

export const handleAlarm = async (alarm) => {
  if (alarm.name === "recording-alarm") {
    const { recording } = await chrome.storage.local.get(["recording"]);

    if (recording) {
      stopRecording();
      sendMessageRecord({ type: "stop-recording-tab" });
      await handleTabMessaging(tab);
    }

    await chrome.alarms.clear("recording-alarm");
  }
};

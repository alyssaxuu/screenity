import { stopRecording } from "../recording/stopRecording";
import { sendMessageTab } from "../tabManagement";
import { sendMessageRecord } from "../recording/sendMessageRecord";

// Utility to handle tab messaging logic
const handleTabMessaging = async (tab: chrome.tabs.Tab): Promise<void> => {
  const result = await chrome.storage.local.get(["activeTab"]);
  const activeTab = result.activeTab as number | undefined;

  try {
    if (activeTab) {
      const targetTab = await chrome.tabs.get(activeTab);

      if (targetTab) {
        sendMessageTab(activeTab, { type: "stop-recording-tab" });
      } else if (tab.id) {
        sendMessageTab(tab.id, { type: "stop-recording-tab" });
        chrome.storage.local.set({ activeTab: tab.id });
      }
    } else if (tab.id) {
      sendMessageTab(tab.id, { type: "stop-recording-tab" });
      chrome.storage.local.set({ activeTab: tab.id });
    }
  } catch (error) {
    console.error("Error in handleTabMessaging:", error);
  }
};

export const handleAlarm = async (alarm: chrome.alarms.Alarm): Promise<void> => {
  if (alarm.name === "recording-alarm") {
    const result = await chrome.storage.local.get(["recording", "activeTab"]);
    const recording = result.recording as boolean | undefined;
    const activeTab = result.activeTab as number | undefined;

    if (recording) {
      stopRecording();
      sendMessageRecord({ type: "stop-recording-tab" });
      
      if (activeTab) {
        try {
          const tab = await chrome.tabs.get(activeTab);
          if (tab) {
            await handleTabMessaging(tab);
          }
        } catch (error) {
          console.error("Error getting active tab:", error);
        }
      }
    }

    await chrome.alarms.clear("recording-alarm");
  }
};

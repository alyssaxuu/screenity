import { stopRecording } from "../recording/stopRecording.js";
import { sendMessageTab } from "../tabManagement";
import { sendMessageRecord } from "../recording/sendMessageRecord.js";

const DEBUG_BG = globalThis.SCREENITY_DEBUG_BG === true;

// Utility to handle tab messaging logic
const handleTabMessaging = async () => {
  const { activeTab } = await chrome.storage.local.get(["activeTab"]);

  if (!activeTab) {
    if (DEBUG_BG) {
      console.warn("[Screenity][Alarm] No activeTab in storage during alarm");
    }
    return;
  }

  try {
    await chrome.tabs.get(activeTab);
    await sendMessageTab(activeTab, { type: "stop-recording-tab" });
  } catch (error) {
    if (DEBUG_BG) {
      console.warn(
        "[Screenity][Alarm] Failed to notify active tab on alarm stop:",
        error
      );
    }
  }
};

export const handleAlarm = async (alarm) => {
  if (alarm.name === "recording-alarm") {
    const { recording } = await chrome.storage.local.get(["recording"]);

    if (recording) {
      stopRecording();
      sendMessageRecord({ type: "stop-recording-tab" });
      await handleTabMessaging();
    }

    await chrome.alarms.clear("recording-alarm");
  }
};

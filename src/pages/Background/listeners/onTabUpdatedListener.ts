import { sendMessageTab } from "../tabManagement";

export const handleTabUpdate = async (
  tabId: number,
  changeInfo: { status?: string } | undefined,
  tab: chrome.tabs.Tab
): Promise<void> => {
  try {
    if (changeInfo.status === "complete") {
      const recordingResult = await chrome.storage.local.get(["recording"]);
      const restartingResult = await chrome.storage.local.get(["restarting"]);
      const tabResult = await chrome.storage.local.get(["tabRecordedID"]);
      const pendingResult = await chrome.storage.local.get(["pendingRecording"]);
      const timeResult = await chrome.storage.local.get(["recordingStartTime"]);
      const recording = recordingResult.recording as boolean | undefined;
      const restarting = restartingResult.restarting as boolean | undefined;
      const tabRecordedID = tabResult.tabRecordedID as number | undefined;
      const pendingRecording = pendingResult.pendingRecording as boolean | undefined;
      const recordingStartTime = timeResult.recordingStartTime as number | undefined;

      if (!recording && !restarting && !pendingRecording) {
        sendMessageTab(tabId, { type: "recording-ended" });
      } else if (recording) {
        if (tabRecordedID && tabRecordedID === tabId) {
          sendMessageTab(tabId, {
            type: "recording-check",
            force: true,
            recordingStartTime,
          });
        } else if (tabRecordedID && tabRecordedID !== tabId) {
          sendMessageTab(tabId, { type: "hide-popup-recording" });
        }
      }

      if (recordingStartTime) {
        // Check if alarm
        const alarmResult = await chrome.storage.local.get(["alarm"]);
        const alarm = alarmResult.alarm as boolean | undefined;
        if (alarm) {
          const timeResult = await chrome.storage.local.get(["alarmTime"]);
          const alarmTime = timeResult.alarmTime as string | number | undefined;
          const seconds = parseFloat(String(alarmTime || 0));
          const time = Math.floor((Date.now() - recordingStartTime) / 1000);
          const remaining = seconds - time;
          sendMessageTab(tabId, {
            type: "time",
            time: remaining,
          });
        } else {
          const time = Math.floor((Date.now() - recordingStartTime) / 1000);
          sendMessageTab(tabId, { type: "time", time: time });
        }
      }

      const commands = await chrome.commands.getAll();

      sendMessageTab(tabId, {
        type: "commands",
        commands: commands,
      });

      // Check if tab is playground.html
      if (
        tab.url &&
        tab.url.includes(chrome.runtime.getURL("playground.html")) &&
        changeInfo?.status === "complete" &&
        tab.id
      ) {
        sendMessageTab(tab.id, { type: "toggle-popup" });
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Error in handleTabUpdate:", err.message);
  }
};

export const onTabUpdatedListener = () => {
  chrome.tabs.onUpdated.addListener(handleTabUpdate);
};

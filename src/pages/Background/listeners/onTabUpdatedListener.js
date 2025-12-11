import { sendMessageTab } from "../tabManagement";

export const handleTabUpdate = async (tabId, changeInfo, tab) => {
  try {
    if (changeInfo.status === "complete") {
      const {
        recording,
        restarting,
        tabRecordedID,
        pendingRecording,
        recordingStartTime,
        recorderSession,
      } = await chrome.storage.local.get([
        "recording",
        "restarting",
        "tabRecordedID",
        "pendingRecording",
        "recordingStartTime",
        "recorderSession",
      ]);

      // Check both recording flag AND recorderSession to avoid race conditions
      // recorderSession persists even if the SW restarts
      const isActivelyRecording =
        recording ||
        (recorderSession && recorderSession.status === "recording");
      const isPendingOrRestarting = restarting || pendingRecording;

      if (!isActivelyRecording && !isPendingOrRestarting) {
        sendMessageTab(tabId, { type: "recording-ended" });
      } else if (isActivelyRecording) {
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
        const { alarm } = await chrome.storage.local.get(["alarm"]);
        if (alarm) {
          const { alarmTime } = await chrome.storage.local.get(["alarmTime"]);
          const seconds = parseFloat(alarmTime);
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
        tab.url.includes(chrome.runtime.getURL("playground.html")) &&
        changeInfo.status === "complete"
      ) {
        sendMessageTab(tab.id, { type: "toggle-popup" });
      }
    }
  } catch (error) {
    console.error("Error in handleTabUpdate:", error.message);
  }
};

export const onTabUpdatedListener = () => {
  chrome.tabs.onUpdated.addListener(handleTabUpdate);
};

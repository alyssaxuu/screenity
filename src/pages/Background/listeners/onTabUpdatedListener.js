import { sendMessageTab } from "../tabManagement";

export const handleTabUpdate = async (tabId, changeInfo, tab) => {
  try {
    if (changeInfo.status === "complete") {
      const {
        recording,
        paused,
        pausedAt,
        totalPausedMs,
        restarting,
        tabRecordedID,
        pendingRecording,
        recordingStartTime,
        recorderSession,
      } = await chrome.storage.local.get([
        "recording",
        "paused",
        "pausedAt",
        "totalPausedMs",
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
        const now = Date.now();
        const basePaused = totalPausedMs || 0;
        const extraPaused =
          paused && pausedAt ? Math.max(0, now - pausedAt) : 0;

        const elapsed = Math.max(
          0,
          Math.floor(
            (now - recordingStartTime - basePaused - extraPaused) / 1000
          )
        );

        const { alarm } = await chrome.storage.local.get(["alarm"]);
        if (alarm) {
          const { alarmTime } = await chrome.storage.local.get(["alarmTime"]);
          const remaining = Math.max(0, Math.floor(alarmTime - elapsed));
          sendMessageTab(tabId, { type: "time", time: remaining });
        } else {
          sendMessageTab(tabId, { type: "time", time: elapsed });
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

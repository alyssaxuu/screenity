import { sendMessageTab } from "../tabManagement";
import { diagEvent } from "../../utils/diagnosticLog";
import { videoReady } from "../recording/recordingHelpers";
import { chunksStore } from "../recording/chunkHandler";

export const handleTabUpdate = async (tabId, changeInfo, tab) => {
  try {
    // React to URL changes EARLY (fires at navigation start, before the new
    // page loads) so we can clear recording state before the new content
    // script re-injects the region UI.
    if (changeInfo.url) {
      const {
        recording,
        tabRecordedID,
        recorderSession,
        customRegion,
        recordingType,
        restarting,
      } = await chrome.storage.local.get([
        "recording",
        "tabRecordedID",
        "recorderSession",
        "customRegion",
        "recordingType",
        "restarting",
      ]);

      const isActivelyRecording =
        recording ||
        (recorderSession && recorderSession.status === "recording");
      const isRegionRecording = customRegion || recordingType === "region";

      if (
        !restarting &&
        isActivelyRecording &&
        isRegionRecording &&
        tabRecordedID &&
        tabRecordedID === tabId
      ) {
        diagEvent("region-nav-stop", { tabId });
        // Clear ALL recording state IMMEDIATELY so the new page's content
        // script won't see an active recording, and so the status=complete
        // handler won't send a recording-check that re-enables the UI.
        // Also clear recordingTab so stopRecording() opens the editor
        // instead of thinking it was already handled.
        await chrome.storage.local.set({
          recording: false,
          customRegion: false,
          recordingTab: null,
          postStopEditorOpening: false,
          postStopEditorOpened: false,
          recorderSession: recorderSession
            ? { ...recorderSession, status: "stopped" }
            : null,
        });
        const chunkCount = await chunksStore.length().catch(() => 0);
        if (chunkCount === 0) {
          diagEvent("region-nav-no-chunks");
          sendMessageTab(tabId, {
            type: "show-toast",
            message: chrome.i18n.getMessage("recordingTooShortToast"),
            timeout: 5000,
          }).catch(() => {});
          return;
        }
        await videoReady();
        return; // Skip the status=complete handler for this event
      }
    }

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
        customRegion,
        recordingType,
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
        "customRegion",
        "recordingType",
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
          diagEvent("recorded-tab-navigated");

          // For non-region recordings, send a check to the content script
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

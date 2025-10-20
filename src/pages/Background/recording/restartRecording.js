import { sendMessageRecord } from "./sendMessageRecord";
import { removeTab } from "../tabManagement";
import { resetActiveTabRestart } from "../tabManagement/resetActiveTab";

export const handleRestart = async () => {
  chrome.storage.local.set({ restarting: true });

  resetActiveTabRestart();
};

export const handleRestartRecordingTab = async (request) => {
  // Check if Chrome version is 109 or below
  if (navigator.userAgent.includes("Chrome/")) {
    const version = parseInt(navigator.userAgent.match(/Chrome\/([0-9]+)/)[1]);
    if (version <= 109) {
      editor_url = "editorfallback.html";
    }
  }

  // Check if recording tab is open
  // FLAG: Not sure why we need to close the tab here?
  // const { recordingTab } = await chrome.storage.local.get(["recordingTab"]);
  // if (recordingTab) {
  //   removeTab(recordingTab);
  // }

  sendMessageRecord({ type: "restart-recording-tab" });
};

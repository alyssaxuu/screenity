import { sendMessageRecord } from "./sendMessageRecord";
import { removeTab } from "../tabManagement";
import { resetActiveTabRestart } from "../tabManagement/resetActiveTab";

export const handleRestart = async () => {
  chrome.storage.local.set({ restarting: true });

  resetActiveTabRestart();
};

export const handleRestartRecordingTab = async (request) => {
  sendMessageRecord({ type: "restart-recording-tab" });
};

import { sendMessageRecord } from "./sendMessageRecord";
import { resetActiveTabRestart } from "../tabManagement/resetActiveTab";

export const handleRestart = async () => {
  chrome.storage.local.set({ restarting: true });

  sendMessageRecord({ type: "restart-recording-tab" });

  resetActiveTabRestart();
};

export const handleRestartRecordingTab = async (request) => {
  handleRestart();
  //sendMessageRecord({ type: "restart-recording-tab" });
};

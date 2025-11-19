import { sendMessageRecord } from "./sendMessageRecord";
import { removeTab } from "../tabManagement";
import { resetActiveTabRestart } from "../tabManagement/resetActiveTab";

export const handleRestart = async (): Promise<any> => {
  chrome.storage.local.set({ restarting: true });

  resetActiveTabRestart();
};

export const handleRestartRecordingTab = async (request: any): Promise<any> => {
  sendMessageRecord({ type: "restart-recording-tab" });
};

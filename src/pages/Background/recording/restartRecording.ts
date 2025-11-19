import { sendMessageRecord } from "./sendMessageRecord";
import { removeTab } from "../tabManagement";
import { resetActiveTabRestart } from "../tabManagement/resetActiveTab";
import type { ExtensionMessage } from "../../../types/messaging";

export const handleRestart = async (): Promise<void> => {
  chrome.storage.local.set({ restarting: true });

  resetActiveTabRestart();
};

export const handleRestartRecordingTab = async (request: ExtensionMessage): Promise<void> => {
  sendMessageRecord({ type: "restart-recording-tab" });
};

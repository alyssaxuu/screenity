import { getCurrentTab } from "../tabManagement";
import { initBackup } from "../backup/initBackup";
import { offscreenDocument } from "../offscreen/offscreenDocument";
import { localDirectoryStore } from "./chunkHandler";

export const desktopCapture = async (request: any): Promise<any> => {
  const { backup } = await chrome.storage.local.get(["backup"]);
  const { backupSetup } = await chrome.storage.local.get(["backupSetup"]);

  // Ensure that chunk sending is marked as not in progress
  chrome.storage.local.set({ sendingChunks: false });

  if (backup) {
    // Clear the local directory store if backup hasn't been set up
    if (!backupSetup) {
      localDirectoryStore.clear();
    }

    // Get the current active tab and initialize backup
    const activeTab = await getCurrentTab();
    initBackup(request, activeTab.id);
  } else {
    // Proceed with offscreen document creation
    offscreenDocument(request);
  }
};

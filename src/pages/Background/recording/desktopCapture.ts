import { getCurrentTab } from "../tabManagement";
import { initBackup } from "../backup/initBackup";
import { offscreenDocument } from "../offscreen/offscreenDocument";
import { localDirectoryStore } from "./chunkHandler";

import type { ExtensionMessage } from "../../../types/messaging";

export const desktopCapture = async (request: ExtensionMessage): Promise<void> => {
  const backupResult = await chrome.storage.local.get(["backup"]);
  const setupResult = await chrome.storage.local.get(["backupSetup"]);
  const backup = backupResult.backup as boolean | undefined;
  const backupSetup = setupResult.backupSetup as boolean | undefined;

  // Ensure that chunk sending is marked as not in progress
  chrome.storage.local.set({ sendingChunks: false });

  if (backup) {
    // Clear the local directory store if backup hasn't been set up
    if (!backupSetup) {
      localDirectoryStore.clear();
    }

    // Get the current active tab and initialize backup
    const activeTab = await getCurrentTab();
    if (activeTab && activeTab.id) {
      initBackup(request, activeTab.id);
    }
  } else {
    // Proceed with offscreen document creation
    offscreenDocument(request);
  }
};

import { sendMessageTab } from "../tabManagement";

import type { ExtensionMessage } from "../../../types/messaging";

export const initBackup = async (request: ExtensionMessage, id: number): Promise<void> => {
  const result = await chrome.storage.local.get(["backupTab"]);
  const backupTab = result.backupTab as number | undefined;
  const backupURL = chrome.runtime.getURL("backup.html");

  const createBackupTab = () => {
    chrome.tabs.create(
      {
        url: backupURL,
        active: true,
        pinned: true,
        index: 0,
      },
      (tab) => {
        chrome.storage.local.set({ backupTab: tab.id });
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          if (tabId === tab.id && changeInfo.status === "complete") {
            sendMessageTab(tab.id, {
              type: "init-backup",
              request: request,
              tabId: id,
            });
            chrome.tabs.onUpdated.removeListener(listener);
          }
        });
      }
    );
  };

  if (backupTab) {
    chrome.tabs.get(backupTab, (tab) => {
      if (tab && tab.id) {
        sendMessageTab(tab.id, {
          type: "init-backup",
          request: request,
          tabId: id,
        });
      } else {
        createBackupTab();
      }
    });
  } else {
    createBackupTab();
  }
};

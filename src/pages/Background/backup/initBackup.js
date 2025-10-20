import { sendMessageTab } from "../tabManagement";

export const initBackup = async (request, id) => {
  const { backupTab } = await chrome.storage.local.get(["backupTab"]);
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
      if (tab) {
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

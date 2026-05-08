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
        let settled = false;
        const safetyId = setTimeout(() => {
          if (settled) return;
          settled = true;
          chrome.tabs.onUpdated.removeListener(listener);
          console.warn(
            "[Screenity][BG] backup tab load timed out",
            tab.id,
          );
        }, 30000);
        function listener(tabId, changeInfo) {
          if (tabId === tab.id && changeInfo.status === "complete") {
            if (settled) return;
            settled = true;
            clearTimeout(safetyId);
            chrome.tabs.onUpdated.removeListener(listener);
            sendMessageTab(tab.id, {
              type: "init-backup",
              request: request,
              tabId: id,
            });
          }
        }
        chrome.tabs.onUpdated.addListener(listener);
      }
    );
  };

  if (backupTab) {
    chrome.tabs.get(backupTab, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        createBackupTab();
      } else {
        sendMessageTab(tab.id, {
          type: "init-backup",
          request: request,
          tabId: id,
        });
      }
    });
  } else {
    createBackupTab();
  }
};

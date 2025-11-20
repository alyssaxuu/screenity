import { sendMessageTab, getCurrentTab } from "../tabManagement";
import type { TabChangeInfo } from "../../../types/tabs";

// Main command listener
export const onCommandListener = () => {
  chrome.commands.onCommand.addListener(async (command: string) => {
    const activeTab = await getCurrentTab();

    if (!activeTab || !activeTab.url || !activeTab.id) {
      return;
    }

    if (command === "start-recording") {
      // Validate if it's possible to inject into content
      if (
        !(
          (navigator.onLine === false &&
            !activeTab.url.includes("/playground.html") &&
            !activeTab.url.includes("/setup.html")) ||
          activeTab.url.startsWith("chrome://") ||
          (activeTab.url.startsWith("chrome-extension://") &&
            !activeTab.url.includes("/playground.html") &&
            !activeTab.url.includes("/setup.html"))
        ) &&
        !activeTab.url.includes("stackoverflow.com/") &&
        !activeTab.url.includes("chrome.google.com/webstore") &&
        !activeTab.url.includes("chromewebstore.google.com")
      ) {
        sendMessageTab(activeTab.id, { type: "start-stream" });
      } else {
        chrome.tabs
          .create({
            url: "playground.html",
            active: true,
          })
          .then((tab) => {
            if (tab.id) {
              chrome.storage.local.set({ activeTab: tab.id });

              // Wait for the tab to load
              chrome.tabs.onUpdated.addListener(function _(
                tabId: number,
                changeInfo: chrome.tabs.TabChangeInfo | undefined,
                updatedTab: chrome.tabs.Tab
              ) {
                if (tabId === tab.id && changeInfo?.status === "complete" && tab.id) {
                  setTimeout(() => {
                    sendMessageTab(tab.id!, { type: "start-stream" });
                  }, 500);
                  chrome.tabs.onUpdated.removeListener(_);
                }
              });
            }
          });
      }
    } else if (command === "cancel-recording") {
      sendMessageTab(activeTab.id, { type: "cancel-recording" });
    } else if (command === "pause-recording") {
      sendMessageTab(activeTab.id, { type: "pause-recording" });
    }
  });
};

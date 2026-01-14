import { sendMessageTab, getCurrentTab } from "../tabManagement";

// Main command listener
export const onCommandListener = () => {
  let lastToggleDrawingAt = 0;
  const TOGGLE_DRAWING_COOLDOWN_MS = 400;

  chrome.commands.onCommand.addListener(async (command) => {
    const activeTab = await getCurrentTab();
    if (!activeTab || !activeTab.id) return;

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
            chrome.storage.local.set({ activeTab: tab.id });

            // Wait for the tab to load
            chrome.tabs.onUpdated.addListener(function _(tabId, changeInfo) {
              if (tabId === tab.id && changeInfo.status === "complete") {
                setTimeout(() => {
                  sendMessageTab(tab.id, { type: "start-stream" });
                }, 500);
                chrome.tabs.onUpdated.removeListener(_);
              }
            });
          });
      }
    } else if (command === "cancel-recording") {
      sendMessageTab(activeTab.id, { type: "cancel-recording" });
    } else if (command === "pause-recording") {
      sendMessageTab(activeTab.id, { type: "pause-recording" });
    } else if (command === "stop-recording") {
      sendMessageTab(activeTab.id, { type: "stop-recording-tab" });
    } else if (command === "toggle-drawing-mode") {
      const now = Date.now();
      if (now - lastToggleDrawingAt < TOGGLE_DRAWING_COOLDOWN_MS) {
        return;
      }
      lastToggleDrawingAt = now;
      sendMessageTab(activeTab.id, { type: "toggle-drawing-mode" });
    } else if (command === "toggle-blur-mode") {
      sendMessageTab(activeTab.id, { type: "toggle-blur-mode" });
    } else if (command === "toggle-hide-ui") {
      sendMessageTab(activeTab.id, { type: "toggle-hide-ui" });
    } else if (command === "toggle-cursor-mode") {
      sendMessageTab(activeTab.id, { type: "toggle-cursor-mode" });
    }
  });
};

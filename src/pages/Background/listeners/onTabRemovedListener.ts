import { sendMessageTab, focusTab } from "../tabManagement";

/**
 * Listener for when a tab is removed.
 * It checks if the removed tab is the active recording tab and handles cleanup if so.
 */
export const onTabRemovedListener = () => {
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    try {
      const {
        region,
        customRegion,
        recording,
        restarting,
        recordingTab,
        tabRecordedID,
      } = await chrome.storage.local.get([
        "region",
        "customRegion",
        "recording",
        "restarting",
        "recordingTab",
        "tabRecordedID",
      ]);

      const isRegionMode = region || customRegion;
      const recordedTabId = tabRecordedID || recordingTab;

      if (!recording || restarting) return;

      // If the removed tab is the one being recorded
      if (tabId === recordedTabId) {
        // Clear reference to the removed tab
        chrome.storage.local.set({ recordingTab: null, tabRecordedID: null });

        const { activeTab } = await chrome.storage.local.get(["activeTab"]);

        try {
          if (activeTab) {
            await sendMessageTab(activeTab, { type: "stop-recording-tab" });
          }
        } catch (err) {
          console.warn("Could not message active tab to stop recording:", err);
        }

        chrome.action.setIcon({ path: "assets/icon-34.png" });
      }
    } catch (error) {
      console.error("Error handling tab removal:", error.message);
    }
  });
};

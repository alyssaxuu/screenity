import { sendMessageTab, focusTab } from "../tabManagement";

/**
 * Listener for when a tab is removed.
 * It checks if the removed tab is the active recording tab and handles cleanup if so.
 */
export const onTabRemovedListener = () => {
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    try {
      const result = await chrome.storage.local.get([
        "region",
        "customRegion",
        "recording",
        "restarting",
        "recordingTab",
        "tabRecordedID",
      ]);
      const region = result.region as boolean | undefined;
      const customRegion = result.customRegion as boolean | undefined;
      const recording = result.recording as boolean | undefined;
      const restarting = result.restarting as boolean | undefined;
      const recordingTab = result.recordingTab as number | undefined;
      const tabRecordedID = result.tabRecordedID as number | undefined;

      const isRegionMode = region || customRegion;
      const recordedTabId = tabRecordedID || recordingTab;

      if (!recording || restarting) return;

      // If the removed tab is the one being recorded
      if (tabId === recordedTabId) {
        // Clear reference to the removed tab
        chrome.storage.local.set({ recordingTab: null, tabRecordedID: null });

        const activeResult = await chrome.storage.local.get(["activeTab"]);
        const activeTab = activeResult.activeTab as number | undefined;

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
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("Error handling tab removal:", err.message);
    }
  });
};

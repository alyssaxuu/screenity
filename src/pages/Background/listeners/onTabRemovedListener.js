import { sendMessageTab, focusTab } from "../tabManagement";
import { sendMessageRecord } from "../recording/sendMessageRecord";

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
        recorderSession,
      } = await chrome.storage.local.get([
        "region",
        "customRegion",
        "recording",
        "restarting",
        "recordingTab",
        "tabRecordedID",
        "recorderSession",
      ]);

      const isRegionMode = region || customRegion;
      const recordedTabId = tabRecordedID || recordingTab;

      // Check both recording flag AND recorderSession
      const isActivelyRecording =
        recording ||
        (recorderSession && recorderSession.status === "recording");

      if (!isActivelyRecording || restarting) return;

      // If the removed tab is the one being recorded (for tab capture)
      if (tabId === recordedTabId) {
        // Clear reference to the removed tab
        chrome.storage.local.set({ recordingTab: null, tabRecordedID: null });

        // Send stop directly to the recorder, not through content script
        // This is more reliable as the content script tab may not exist
        try {
          await sendMessageRecord({
            type: "stop-recording-tab",
            reason: "recorded-tab-closed",
          });
        } catch (err) {
          console.warn("Could not message recorder to stop:", err);
        }

        // Also try to notify the active tab for UI cleanup
        const { activeTab } = await chrome.storage.local.get(["activeTab"]);
        if (activeTab && activeTab !== tabId) {
          sendMessageTab(activeTab, { type: "stop-pending" }).catch(() => {});
        }

        chrome.action.setIcon({ path: "assets/icon-34.png" });
      }

      // If the CloudRecorder tab itself was closed, that's a critical failure
      if (tabId === recordingTab && recordingTab !== recordedTabId) {
        console.error("CloudRecorder tab was closed during recording!");
        chrome.storage.local.set({
          recording: false,
          recorderSession: recorderSession
            ? { ...recorderSession, status: "crashed", crashedAt: Date.now() }
            : null,
        });
        chrome.action.setIcon({ path: "assets/icon-34.png" });
      }
    } catch (error) {
      console.error("Error handling tab removal:", error.message);
    }
  });
};

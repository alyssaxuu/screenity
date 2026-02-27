import { sendMessageTab, focusTab } from "../tabManagement";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";

export const handleDismiss = async () => {
  try {
    await chrome.storage.local.set({ restarting: true });

    const { region, wasRegion } = await chrome.storage.local.get([
      "region",
      "wasRegion",
    ]);

    if (wasRegion) {
      await chrome.storage.local.set({ wasRegion: false, region: true });
    }

    chrome.action.setIcon({ path: "assets/icon-34.png" });
    chrome.runtime.sendMessage({ type: "turn-off-pip" });
    chrome.storage.local.set({ pipForceClose: Date.now() });
    chrome.storage.local.set({ recordingUiTabId: null });
    chrome.storage.local.remove(["recordingMeta"]);
  } catch (error) {
    console.error("Failed to handle dismiss:", error);
  }
};

export const cancelRecording = async () => {
  try {
    // Reset the icon to its default state
    chrome.action.setIcon({ path: "assets/icon-34.png" });

    // Get the active tab from storage
    const { activeTab, recordingUiTabId, tabRecordedID } =
      await chrome.storage.local.get([
        "activeTab",
        "recordingUiTabId",
        "tabRecordedID",
      ]);

    await chrome.storage.local.set({
      pendingRecording: false,
      recordingUiTabId: null,
      tabRecordedID: null,
    });

    // Send stop message, focus the tab, and clean up
    const candidateTabs = [activeTab, recordingUiTabId, tabRecordedID].filter(
      (id, idx, arr) => Number.isInteger(id) && arr.indexOf(id) === idx,
    );
    candidateTabs.forEach((id) => {
      sendMessageTab(id, { type: "stop-pending" }).catch(() => {});
    });
    focusTab(activeTab);
    discardOffscreenDocuments();
    chrome.runtime.sendMessage({ type: "turn-off-pip" });
    chrome.storage.local.set({ pipForceClose: Date.now() });
    chrome.storage.local.set({ recordingUiTabId: null });
    chrome.storage.local.remove(["recordingMeta"]);
  } catch (error) {
    console.error("Failed to cancel recording:", error.message);
  }
};

import { sendMessageTab, focusTab } from "../tabManagement";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";

export const handleDismiss = async (): Promise<void> => {
  try {
    await chrome.storage.local.set({ restarting: true });

    const result = await chrome.storage.local.get([
      "region",
      "wasRegion",
    ]);
    const region = result.region as boolean | undefined;
    const wasRegion = result.wasRegion as boolean | undefined;

    if (wasRegion) {
      await chrome.storage.local.set({ wasRegion: false, region: true });
    }

    chrome.action.setIcon({ path: "assets/icon-34.png" });
    chrome.runtime.sendMessage({ type: "turn-off-pip" });
  } catch (error) {
    console.error("Failed to handle dismiss:", error);
  }
};

export const cancelRecording = async (): Promise<void> => {
  try {
    // Reset the icon to its default state
    chrome.action.setIcon({ path: "assets/icon-34.png" });

    // Get the active tab from storage
    const result = await chrome.storage.local.get(["activeTab"]);
    const activeTab = result.activeTab as number | undefined;
    
    if (!activeTab) return;

    // Send stop message, focus the tab, and clean up
    sendMessageTab(activeTab, { type: "stop-pending" });
    focusTab(activeTab);
    discardOffscreenDocuments();
    chrome.runtime.sendMessage({ type: "turn-off-pip" });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Failed to cancel recording:", err.message);
  }
};

import { sendMessageTab, focusTab } from "../tabManagement";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";

export const handleDismiss = async (): Promise<any> => {
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
  } catch (error) {
    console.error("Failed to handle dismiss:", error);
  }
};

export const cancelRecording = async (): Promise<any> => {
  try {
    // Reset the icon to its default state
    chrome.action.setIcon({ path: "assets/icon-34.png" });

    // Get the active tab from storage
    const { activeTab } = await chrome.storage.local.get(["activeTab"]);

    // Send stop message, focus the tab, and clean up
    sendMessageTab(activeTab, { type: "stop-pending" });
    focusTab(activeTab);
    discardOffscreenDocuments();
    chrome.runtime.sendMessage({ type: "turn-off-pip" });
  } catch (error) {
    console.error("Failed to cancel recording:", error.message);
  }
};

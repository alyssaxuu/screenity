import { sendMessageTab, focusTab } from "../tabManagement";
import { removeTab } from "../tabManagement/removeTab";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";
import { resetWatchdogState } from "./resetWatchdogState";

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
    chrome.storage.local.set({
      recordingUiTabId: null,
      multiMode: false,
      multiSceneCount: 0,
      multiProjectId: null,
      multiLastSceneId: null,
    });
    chrome.storage.local.remove(["recordingMeta"]);
  } catch (error) {
    console.error("Failed to handle dismiss:", error);
  }
};

export const cancelRecording = async () => {
  try {
    chrome.action.setIcon({ path: "assets/icon-34.png" });

    const { activeTab, recordingUiTabId, tabRecordedID, recordingTab } =
      await chrome.storage.local.get([
        "activeTab",
        "recordingUiTabId",
        "tabRecordedID",
        "recordingTab",
      ]);

    await chrome.storage.local.set({
      pendingRecording: false,
      recordingUiTabId: null,
      tabRecordedID: null,
      recordingTab: null,
      // mirror stopRecording's cleared fields so cancel can't leak into next attempt
      region: false,
      customRegion: false,
      recording: false,
      restarting: false,
      offscreen: false,
      memoryError: false,
    });

    // URL-guard so we never close a user tab by mistake
    if (recordingTab) {
      try {
        const tab = await chrome.tabs.get(recordingTab);
        const url = tab?.url || "";
        if (
          url.includes("recorder.html") ||
          url.includes("cloudrecorder.html")
        ) {
          try {
            await removeTab(recordingTab);
          } catch (removeErr) {
            // distinguish benign "No tab with id" race from real failures
            const msg = String(removeErr?.message || removeErr);
            if (!/No tab with id/i.test(msg)) {
              console.warn(
                "[Screenity][BG] cancelRecording: removeTab failed",
                { tabId: recordingTab, err: msg },
              );
            }
          }
        }
      } catch {}
    }

    const candidateTabs = [activeTab, recordingUiTabId, tabRecordedID].filter(
      (id, idx, arr) => Number.isInteger(id) && arr.indexOf(id) === idx,
    );
    candidateTabs.forEach((id) => {
      sendMessageTab(id, { type: "stop-pending" }).catch(() => {});
    });
    focusTab(activeTab);
    // shouldFinalize:false: cancel throws the take away, so the offscreen
    // recorder must not finalize into a video-ready / editor open.
    try {
      await discardOffscreenDocuments({ reason: "cancel", shouldFinalize: false });
    } catch {}
    await resetWatchdogState();
    chrome.runtime.sendMessage({ type: "turn-off-pip" });
    chrome.storage.local.set({ pipForceClose: Date.now() });
    chrome.storage.local.set({
      recordingUiTabId: null,
      multiMode: false,
      multiSceneCount: 0,
      multiProjectId: null,
      multiLastSceneId: null,
    });
    chrome.storage.local.remove(["recordingMeta"]);
  } catch (error) {
    console.error("Failed to cancel recording:", error.message);
  }
};

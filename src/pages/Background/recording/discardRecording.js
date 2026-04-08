import { sendMessageRecord } from "./sendMessageRecord";
import { removeTab } from "../tabManagement/removeTab";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";

export const discardRecording = async () => {
  sendMessageRecord({ type: "dismiss-recording" });
  chrome.action.setIcon({ path: "assets/icon-34.png" });

  // Clear offscreen documents if they exist
  discardOffscreenDocuments();

  const { multiMode, multiSceneCount, recordingTab } =
    await chrome.storage.local.get([
      "multiMode",
      "multiSceneCount",
      "recordingTab",
    ]);

  // Close the recorder tab if it's an extension page
  if (recordingTab) {
    try {
      const tab = await chrome.tabs.get(recordingTab);
      if (tab?.url?.startsWith(chrome.runtime.getURL(""))) {
        removeTab(recordingTab);
      }
    } catch {}
  }

  // Keep multiMode on but reset project state if no scenes were saved
  const multiState = multiMode
    ? {
        multiMode: true,
        ...(multiSceneCount > 0 ? {} : {
          multiProjectId: null,
          multiLastSceneId: null,
        }),
      }
    : {
        multiMode: false,
        multiSceneCount: 0,
        multiProjectId: null,
        multiLastSceneId: null,
      };

  chrome.storage.local.set({
    recordingTab: null,
    sandboxTab: null,
    recording: false,
    restarting: false,
    pendingRecording: false,
    offscreen: false,
    postStopEditorOpened: false,
    ...multiState,
  });
  chrome.storage.local.set({ pipForceClose: Date.now() });
  chrome.storage.local.set({ recordingUiTabId: null });
  chrome.storage.local.remove(["recordingMeta"]);

  chrome.runtime.sendMessage({ type: "discard-backup" });
  chrome.runtime.sendMessage({ type: "turn-off-pip" });
};

export const handleDismissRecordingTab = async () => {
  chrome.runtime.sendMessage({ type: "discard-backup" });
  discardRecording();
};

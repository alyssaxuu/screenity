import { sendMessageRecord } from "./sendMessageRecord";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";

export const discardRecording = async () => {
  sendMessageRecord({ type: "dismiss-recording" });
  chrome.action.setIcon({ path: "assets/icon-34.png" });

  // Clear offscreen documents if they exist
  discardOffscreenDocuments();

  chrome.storage.local.set({
    recordingTab: null,
    sandboxTab: null,
    recording: false,
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

import { sendMessageRecord } from "./sendMessageRecord";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";

export const discardRecording = async (): Promise<void> => {
  sendMessageRecord({ type: "dismiss-recording" });
  chrome.action.setIcon({ path: "assets/icon-34.png" });

  // Clear offscreen documents if they exist
  discardOffscreenDocuments();

  chrome.storage.local.set({
    recordingTab: null,
    sandboxTab: null,
    recording: false,
  });

  chrome.runtime.sendMessage({ type: "discard-backup" });
  chrome.runtime.sendMessage({ type: "turn-off-pip" });
};

export const handleDismissRecordingTab = async (): Promise<void> => {
  chrome.runtime.sendMessage({ type: "discard-backup" });
  discardRecording();
};

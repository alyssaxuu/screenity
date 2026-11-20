import { discardRecording } from "./discardRecording";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";
import { isActiveRecorderAlive } from "../offscreen/recorderHost";

export const checkRecording = async () => {
  const { recordingTab, offscreen } = await chrome.storage.local.get([
    "recordingTab",
    "offscreen",
  ]);

  if (recordingTab && !offscreen) {
    try {
      chrome.tabs.get(recordingTab, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          discardRecording();
        }
      });
    } catch (error) {
      discardRecording();
    }
  } else if (offscreen) {
    try {
      if (!(await isActiveRecorderAlive())) {
        discardOffscreenDocuments();
        discardRecording();
      }
    } catch (error) {
      console.error("Error checking offscreen document: ", error);
      discardRecording();
    }
  }
};

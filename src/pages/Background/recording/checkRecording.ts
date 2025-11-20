import { discardRecording } from "./discardRecording";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";

export const checkRecording = async (): Promise<void> => {
  const result = await chrome.storage.local.get([
    "recordingTab",
    "offscreen",
  ]);
  const recordingTab = result.recordingTab as number | undefined;
  const offscreen = result.offscreen as boolean | undefined;

  if (recordingTab && !offscreen) {
    try {
      chrome.tabs.get(recordingTab as number, (tab) => {
        if (!tab) {
          discardRecording();
        }
      });
    } catch (error) {
      discardRecording();
    }
  } else if (offscreen) {
    try {
      const existingContexts = await chrome.runtime.getContexts({});
      const offDocument = existingContexts.find(
        (c) => c.contextType === "OFFSCREEN_DOCUMENT"
      );

      if (!offDocument) {
        discardOffscreenDocuments();
        discardRecording();
      }
    } catch (error) {
      console.error("Error checking offscreen document: ", error);
      discardRecording();
    }
  }
};

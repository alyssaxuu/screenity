import { discardRecording } from "./discardRecording";
import { discardOffscreenDocuments } from "../offscreen/discardOffscreenDocuments";

export const checkRecording = async () => {
  const { recordingTab, offscreen } = await chrome.storage.local.get([
    "recordingTab",
    "offscreen",
  ]);

  if (recordingTab && !offscreen) {
    try {
      chrome.tabs.get(recordingTab, (tab) => {
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

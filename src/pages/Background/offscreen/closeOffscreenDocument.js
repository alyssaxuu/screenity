import { noteOffscreenClose } from "./hostWatch";
export const closeOffscreenDocument = async () => {
  try {
    const existingContexts = await chrome.runtime.getContexts({});
    const offscreenDocument = existingContexts.find(
      (c) => c.contextType === "OFFSCREEN_DOCUMENT"
    );

    if (offscreenDocument) {
      noteOffscreenClose("close-offscreen");
      await chrome.offscreen.closeDocument();
    }
  } catch (error) {
    console.error("Failed to close offscreen document:", error);
  }
};

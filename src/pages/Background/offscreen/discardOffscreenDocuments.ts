/**
 * Closes any active offscreen document if it exists.
 */
export const discardOffscreenDocuments = async (): Promise<any> => {
  try {
    const existingContexts = await chrome.runtime.getContexts({});
    const offscreenDocument = existingContexts.find(
      (c) => c.contextType === "OFFSCREEN_DOCUMENT"
    );

    if (offscreenDocument) {
      await chrome.offscreen.closeDocument();
    }
  } catch (error) {
    console.error("Failed to discard offscreen documents:", error.message);
  }
};

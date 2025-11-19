export const closeOffscreenDocument = async (): Promise<any> => {
  try {
    const existingContexts = await chrome.runtime.getContexts({});
    const offscreenDocument = existingContexts.find(
      (c) => c.contextType === "OFFSCREEN_DOCUMENT"
    );

    if (offscreenDocument) {
      await chrome.offscreen.closeDocument();
    }
  } catch (error) {
    console.error("Failed to close offscreen document:", error);
  }
};

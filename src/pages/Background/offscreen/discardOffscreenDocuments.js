import { closeOffscreenDocumentWithFlush } from "./closeOffscreenDocumentWithFlush";

/**
 * Closes any active offscreen document if it exists.
 * Runs the flush handshake so in-flight recording state has a chance to
 * drain before teardown, then clears the offscreen storage flag.
 */
export const discardOffscreenDocuments = async ({
  reason = "discard",
  flush = true,
} = {}) => {
  console.warn("[Screenity][discardOffscreenDocuments]", { reason, flush, stack: new Error().stack });
  try {
    if (flush) {
      await closeOffscreenDocumentWithFlush({ reason });
    } else {
      const existingContexts = await chrome.runtime.getContexts({});
      const offscreenDocument = existingContexts.find(
        (c) => c.contextType === "OFFSCREEN_DOCUMENT"
      );
      if (offscreenDocument) {
        await chrome.offscreen.closeDocument();
      }
    }
  } catch (error) {
    console.error("Failed to discard offscreen documents:", error.message);
  }
  chrome.storage.local.set({ offscreen: false });
};

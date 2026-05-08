import { closeOffscreenDocumentWithFlush } from "./closeOffscreenDocumentWithFlush";
import { perfSpan } from "../../utils/perfMarks";

export const discardOffscreenDocuments = async ({
  reason = "discard",
  flush = true,
} = {}) => {
  console.warn("[Screenity][discardOffscreenDocuments]", { reason, flush, stack: new Error().stack });
  const endFlush = perfSpan("BG.offscreen discardOffscreenDocuments", { reason, flush });
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
  // verify gone before clearing flag; otherwise sendMessageRecord routes to dead listener
  try {
    const remaining = await chrome.runtime.getContexts({});
    const stillExists = remaining.some(
      (c) => c.contextType === "OFFSCREEN_DOCUMENT",
    );
    chrome.storage.local.set({ offscreen: stillExists });
    endFlush({ stillExists });
  } catch {
    chrome.storage.local.set({ offscreen: false });
    endFlush({ result: "getContexts-failed" });
  }
};

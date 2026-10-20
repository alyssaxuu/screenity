import { closeOffscreenDocumentWithFlush } from "./closeOffscreenDocumentWithFlush";
import { perfSpan } from "../../utils/perfMarks";
import { noteOffscreenClose, noteOffscreenCloseSkipped } from "./hostWatch";

// The separated mic uploads from inside the offscreen document after the scene
// POST, but the BG discards that document ~80ms later on editor-ready, killing
// the take's only copy of the voice. Bounded so a wedged upload can't strand it.
const MIC_UPLOAD_GRACE_MS = 120000;
const MIC_UPLOAD_POLL_MS = 250;

const waitForMicUpload = async () => {
  const startedAt = Date.now();
  for (;;) {
    let flag = null;
    try {
      ({ micUploadInFlight: flag } = await chrome.storage.local.get([
        "micUploadInFlight",
      ]));
    } catch {
      return;
    }
    if (!flag?.at) return;
    // A flag left behind by a crashed document must not hold the next discard.
    if (Date.now() - flag.at > MIC_UPLOAD_GRACE_MS) {
      try {
        await chrome.storage.local.remove(["micUploadInFlight"]);
      } catch {}
      return;
    }
    if (Date.now() - startedAt > MIC_UPLOAD_GRACE_MS) return;
    await new Promise((r) => setTimeout(r, MIC_UPLOAD_POLL_MS));
  }
};

export const discardOffscreenDocuments = async ({
  reason = "discard",
  flush = true,
  // Discard/cancel callers pass false so the recorder halts without finalizing;
  // a finalize emits video-ready and opens the editor on the discarded take.
  shouldFinalize = true,
} = {}) => {
  console.warn("[Screenity][discardOffscreenDocuments]", { reason, flush, shouldFinalize, stack: new Error().stack });
  const endFlush = perfSpan("BG.offscreen discardOffscreenDocuments", { reason, flush });
  // The mic wait below can outlast a new recording's start, so pin the document.
  let expectedDocumentId = null;
  let contextsRead = false;
  try {
    const ctx = await chrome.runtime.getContexts({});
    expectedDocumentId =
      ctx.find((c) => c.contextType === "OFFSCREEN_DOCUMENT")?.documentId ||
      null;
    contextsRead = true;
  } catch {}
  // Discard/cancel must not wait on the take it is throwing away.
  if (shouldFinalize) await waitForMicUpload();
  // No document at discard start, so one now is a new take's.
  let startedAfterDiscard = false;
  if (contextsRead && !expectedDocumentId) {
    try {
      const ctx = await chrome.runtime.getContexts({});
      startedAfterDiscard = ctx.some(
        (c) => c.contextType === "OFFSCREEN_DOCUMENT"
      );
    } catch {}
  }
  try {
    if (startedAfterDiscard) {
      noteOffscreenCloseSkipped("discard:replaced");
    } else if (flush) {
      await closeOffscreenDocumentWithFlush({
        reason,
        shouldFinalize,
        expectedDocumentId,
      });
    } else {
      const existingContexts = await chrome.runtime.getContexts({});
      const offscreenDocument = existingContexts.find(
        (c) => c.contextType === "OFFSCREEN_DOCUMENT"
      );
      if (
        offscreenDocument &&
        expectedDocumentId &&
        offscreenDocument.documentId &&
        offscreenDocument.documentId !== expectedDocumentId
      ) {
        noteOffscreenCloseSkipped("discard-noflush:replaced");
      } else if (offscreenDocument) {
        noteOffscreenClose("discard-noflush");
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

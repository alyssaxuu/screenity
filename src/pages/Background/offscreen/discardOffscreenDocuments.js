import { closeOffscreenDocumentWithFlush } from "./closeOffscreenDocumentWithFlush";
import { perfSpan } from "../../utils/perfMarks";
import { noteOffscreenClose, noteOffscreenCloseSkipped } from "./hostWatch";
import { micUploadInFlightTtlMs } from "../../utils/recordingLimit";
import {
  LEGACY_MIC_UPLOAD_FLAG_KEY,
  micUploadFlagKey,
  readMicUploadFlags,
} from "../../utils/micUploadFlag";
import {
  readOffscreenContexts,
  pickTargetFrame,
  removeRecorderTake,
} from "./recorderHost";

// The separated mic uploads from inside the offscreen document after the scene
// POST, but the BG discards that document ~80ms later on editor-ready, killing
// the take's only copy of the voice. Bounded by the upload's own budget (from
// the flag) so a wedged upload can't strand it; 120 s for an older build's flag.
const MIC_UPLOAD_GRACE_MS = 120000;
const MIC_UPLOAD_POLL_MS = 250;

// A take waits on its own key; a take-less (single document) close on all of them.
const readFlagsFor = async (takeId) => {
  if (!takeId) return readMicUploadFlags();
  const own = micUploadFlagKey({ takeId });
  const got = await chrome.storage.local.get([own, LEGACY_MIC_UPLOAD_FLAG_KEY]);
  const legacy = got?.[LEGACY_MIC_UPLOAD_FLAG_KEY];
  return {
    [own]: got?.[own],
    // An older build's flag names no take; one naming another take is not ours.
    [LEGACY_MIC_UPLOAD_FLAG_KEY]:
      legacy && (!legacy.takeId || legacy.takeId === takeId) ? legacy : null,
  };
};

const waitForMicUpload = async ({ takeId = null } = {}) => {
  const startedAt = Date.now();
  for (;;) {
    let flags = null;
    try {
      flags = await readFlagsFor(takeId);
    } catch {
      return;
    }
    let graceMs = 0;
    const stale = [];
    for (const [key, flag] of Object.entries(flags || {})) {
      if (!flag?.at) continue;
      const ttl = micUploadInFlightTtlMs(flag, MIC_UPLOAD_GRACE_MS);
      // A flag left behind by a crashed document must not hold the next discard.
      if (Date.now() - flag.at > ttl) stale.push(key);
      else graceMs = Math.max(graceMs, ttl);
    }
    if (stale.length) {
      try {
        await chrome.storage.local.remove(stale);
      } catch {}
    }
    if (!graceMs) return;
    if (Date.now() - startedAt > graceMs) return;
    await new Promise((r) => setTimeout(r, MIC_UPLOAD_POLL_MS));
  }
};

export const discardOffscreenDocuments = async ({
  reason = "discard",
  flush = true,
  // Discard/cancel callers pass false so the recorder halts without finalizing;
  // a finalize emits video-ready and opens the editor on the discarded take.
  shouldFinalize = true,
  // Late messages from an earlier take close only that take's own document.
  onlyDocumentId = null,
  // The same for a take in the host document, named by the id its frame stamps.
  onlyTakeId = null,
} = {}) => {
  console.warn("[Screenity][discardOffscreenDocuments]", { reason, flush, shouldFinalize, stack: new Error().stack });
  const endFlush = perfSpan("BG.offscreen discardOffscreenDocuments", { reason, flush });
  const described = await readOffscreenContexts();
  if (described.host) {
    // A document that is none of the host's frames (a tab, the region iframe, the
    // host itself) has no take to close here; the active frame is never a fallback.
    let takeId = onlyTakeId;
    if (!takeId && onlyDocumentId) {
      takeId =
        described.frames.find((f) => f.documentId === onlyDocumentId)?.takeId ||
        null;
      if (!takeId) {
        noteOffscreenCloseSkipped(`${reason}:not-a-take-frame`);
        endFlush({ skipped: "not-a-take-frame" });
        return;
      }
    }
    await discardTake({ reason, flush, shouldFinalize, onlyTakeId: takeId, described });
    endFlush({ host: true });
    return;
  }
  if (onlyTakeId) {
    endFlush({ skipped: "no-host" });
    return;
  }
  if (onlyDocumentId) {
    let current = null;
    try {
      const ctx = await chrome.runtime.getContexts({});
      current =
        ctx.find((c) => c.contextType === "OFFSCREEN_DOCUMENT" && !c.frameId) ||
        null;
    } catch {}
    if (!current || current.documentId !== onlyDocumentId) {
      noteOffscreenCloseSkipped(`${reason}:not-current`);
      return;
    }
  }
  // The mic wait below can outlast a new recording's start, so pin the document.
  // For an earlier take the pin is the requested document, never re-derived: a
  // newer take's document may have appeared since the check above.
  let expectedDocumentId = onlyDocumentId || null;
  let contextsRead = Boolean(onlyDocumentId);
  if (!onlyDocumentId) {
    try {
      const ctx = await chrome.runtime.getContexts({});
      expectedDocumentId =
        ctx.find((c) => c.contextType === "OFFSCREEN_DOCUMENT")?.documentId ||
        null;
      contextsRead = true;
    } catch {}
  }
  // Discard/cancel must not wait on the take it is discarding; with no document (tab-hosted recorder)
  // there is no upload to protect. A discard for a new start never waits: the marker already covers
  // the upload it would kill.
  const forNewStart = /^start/.test(String(reason));
  if (shouldFinalize && !forNewStart && (!contextsRead || expectedDocumentId)) {
    await waitForMicUpload();
  }
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

// Host document: act on one take's frame, pinned before any wait so a take
// started meanwhile is never the one closed.
const discardTake = async ({ reason, flush, shouldFinalize, onlyTakeId, described }) => {
  let activeTakeId = null;
  try {
    ({ activeRecorderTakeId: activeTakeId } = await chrome.storage.local.get([
      "activeRecorderTakeId",
    ]));
  } catch {}
  const target = pickTargetFrame({
    frames: described.frames,
    activeTakeId,
    takeId: onlyTakeId,
  });
  if (!target) {
    if (onlyTakeId) {
      noteOffscreenCloseSkipped(`${reason}:take-gone`);
    } else {
      await closeOffscreenDocumentWithFlush({ reason, shouldFinalize });
    }
  } else {
    const forNewStart = /^start/.test(String(reason));
    if (shouldFinalize && !forNewStart) {
      await waitForMicUpload({ takeId: target.takeId });
    }
    try {
      if (flush) {
        await closeOffscreenDocumentWithFlush({
          reason,
          shouldFinalize,
          takeId: target.takeId,
        });
      } else {
        noteOffscreenClose("discard-noflush-take");
        await removeRecorderTake(target.takeId, reason);
      }
    } catch (error) {
      console.error("Failed to discard recorder take:", error?.message);
    }
  }
  // The waits above can last a mic upload and a flush; a take started meanwhile
  // is the active one now, so read it again.
  let activeNow = activeTakeId;
  try {
    ({ activeRecorderTakeId: activeNow } = await chrome.storage.local.get([
      "activeRecorderTakeId",
    ]));
  } catch {}
  // An earlier take's frame going says nothing about the take recording now.
  if (onlyTakeId && onlyTakeId !== activeNow) return;
  // Otherwise the flag follows the active take, not the document: frames still
  // finishing in the host must not route a tab-hosted take's controls here.
  const after = await readOffscreenContexts();
  const activeInHost = after.host
    ? Boolean(pickTargetFrame({ frames: after.frames, activeTakeId: activeNow }))
    : Boolean(after.doc);
  chrome.storage.local.set({ offscreen: activeInHost });
};

import { noteOffscreenClose, noteOffscreenCloseSkipped } from "./hostWatch";
import {
  readOffscreenContexts,
  pickTargetFrame,
  removeRecorderTake,
  closeHostIfEmpty,
} from "./recorderHost";

const waitForShutdownAck = ({ takeId, timeoutMs }) => {
  let cleanup = () => {};
  const promise = new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      resolve({ ok: false, timedOut: true });
    }, timeoutMs);
    const listener = (msg) => {
      if (msg?.type !== "offscreen-shutdown-complete") return;
      if (takeId && msg.__takeId && msg.__takeId !== takeId) return;
      clearTimeout(timer);
      chrome.runtime.onMessage.removeListener(listener);
      resolve({ ok: true, timedOut: false });
    };
    chrome.runtime.onMessage.addListener(listener);
    cleanup = () => {
      clearTimeout(timer);
      chrome.runtime.onMessage.removeListener(listener);
    };
  });
  return { promise, cleanup: () => cleanup() };
};

// The host document holds one frame per take: flush and remove one take, and
// close the document only once no take is left in it.
const flushTakeFrame = async ({
  reason,
  timeoutMs,
  shouldFinalize,
  expectedDocumentId,
  takeId,
  host,
  frames,
}) => {
  if (expectedDocumentId && expectedDocumentId !== host.documentId) {
    const pinned = frames.find((f) => f.documentId === expectedDocumentId);
    if (!pinned) {
      noteOffscreenCloseSkipped(`${reason}:replaced-before-flush`);
      return { ok: true, existed: false, skipped: "replaced" };
    }
  }
  const { activeRecorderTakeId } = await chrome.storage.local
    .get(["activeRecorderTakeId"])
    .catch(() => ({}));
  const target = pickTargetFrame({
    frames,
    activeTakeId: activeRecorderTakeId || null,
    takeId,
    documentId: expectedDocumentId,
  });
  if (!target) {
    if (takeId) return { ok: true, existed: false, skipped: "no-take" };
    await closeHostIfEmpty(`${reason}:empty-host`);
    return { ok: true, existed: true, empty: true };
  }
  const effectiveTimeoutMs = target.cloud ? timeoutMs : Math.min(timeoutMs, 3000);
  const ack = waitForShutdownAck({
    takeId: target.takeId,
    timeoutMs: effectiveTimeoutMs,
  });
  const sendPromise = chrome.runtime.sendMessage({
    type: "offscreen-shutdown",
    takeId: target.takeId,
    reason,
    shouldFinalize,
    timeoutMs: Math.max(2000, effectiveTimeoutMs - 2000),
  });
  const noReceiver = sendPromise.then(
    () => new Promise(() => {}),
    () => ({ ok: false, noReceiver: true })
  );
  const result = await Promise.race([ack.promise, noReceiver]);
  ack.cleanup();
  noteOffscreenClose("close-take-with-flush");
  const { remaining } = await removeRecorderTake(target.takeId, reason);
  return { ok: true, existed: true, takeId: target.takeId, remaining, ...result };
};

export const closeOffscreenDocumentWithFlush = async ({
  reason = "unknown",
  timeoutMs = 25000,
  shouldFinalize = true,
  // closeDocument() closes whatever is current, which may be a newer recording's.
  expectedDocumentId = null,
  takeId = null,
} = {}) => {
  const described = await readOffscreenContexts();
  if (described.host) {
    return flushTakeFrame({
      reason,
      timeoutMs,
      shouldFinalize,
      expectedDocumentId,
      takeId,
      host: described.host,
      frames: described.frames,
    });
  }
  if (takeId) return { ok: true, existed: false, skipped: "no-host" };
  let offDoc = null;
  try {
    const existingContexts = await chrome.runtime.getContexts({});
    offDoc =
      existingContexts.find(
        (c) => c.contextType === "OFFSCREEN_DOCUMENT" && !c.frameId
      ) || null;
  } catch (err) {
    console.warn("closeOffscreenDocumentWithFlush getContexts:", err);
  }

  if (!offDoc) return { ok: true, existed: false };

  if (
    expectedDocumentId &&
    offDoc.documentId &&
    offDoc.documentId !== expectedDocumentId
  ) {
    noteOffscreenCloseSkipped(`${reason}:replaced-before-flush`);
    return { ok: true, existed: false, skipped: "replaced" };
  }

  // The long timeout only matters for an in-flight TUS upload (cloud). A free
  // doc has no uploader, so waiting 25s for an ack it may never send just blocks
  // the next picker. Cloud docs carry ?cloud=1 in their URL; free ones don't.
  const isCloudDoc =
    typeof offDoc.documentUrl === "string" &&
    offDoc.documentUrl.includes("cloud=1");
  const effectiveTimeoutMs = isCloudDoc ? timeoutMs : Math.min(timeoutMs, 3000);

  // A resume doc is draining journalled TUS uploads and answers only
  // "resume-pending-uploads", so it never acks a shutdown even though it is
  // busy. Give it the full wait rather than the early close below.
  const isResumeDoc =
    typeof offDoc.documentUrl === "string" &&
    offDoc.documentUrl.includes("resume=1");

  let cleanupAck = () => {};
  const ackPromise = new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      resolve({ ok: false, timedOut: true });
    }, effectiveTimeoutMs);
    const listener = (msg) => {
      if (msg?.type === "offscreen-shutdown-complete") {
        clearTimeout(timer);
        chrome.runtime.onMessage.removeListener(listener);
        resolve({ ok: true, timedOut: false });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    cleanupAck = () => {
      clearTimeout(timer);
      chrome.runtime.onMessage.removeListener(listener);
    };
  });

  const sendPromise = chrome.runtime.sendMessage({
    type: "offscreen-shutdown",
    reason,
    shouldFinalize,
    timeoutMs: Math.max(2000, effectiveTimeoutMs - 2000),
  });

  // A rejected send means nobody answered, so no ack is coming and waiting out
  // the timeout only stalls the next picker. It also fires for a live doc whose
  // listeners ignore the message, hence the resume guard above. A resolved send
  // proves nothing (any context may answer), so it keeps the normal wait.
  const noReceiver = sendPromise.then(
    () => new Promise(() => {}),
    () => (isResumeDoc ? new Promise(() => {}) : { ok: false, noReceiver: true }),
  );

  const result = await Promise.race([ackPromise, noReceiver]);
  cleanupAck();

  try {
    const nowContexts = await chrome.runtime.getContexts({});
    const nowDoc =
      nowContexts.find(
        (c) => c.contextType === "OFFSCREEN_DOCUMENT" && !c.frameId
      ) || null;
    if (!nowDoc) return { ok: true, existed: true, ...result };
    if (
      offDoc.documentId &&
      nowDoc.documentId &&
      nowDoc.documentId !== offDoc.documentId
    ) {
      noteOffscreenCloseSkipped(`${reason}:replaced-during-flush`);
      return { ok: true, existed: true, ...result, skipped: "replaced" };
    }
  } catch {}

  try {
    noteOffscreenClose("close-with-flush");
    await chrome.offscreen.closeDocument();
  } catch (err) {
    console.warn("closeOffscreenDocumentWithFlush closeDocument:", err);
  }

  return { ok: true, existed: true, ...result };
};

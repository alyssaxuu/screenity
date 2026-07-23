export const closeOffscreenDocumentWithFlush = async ({
  reason = "unknown",
  timeoutMs = 25000,
  shouldFinalize = true,
} = {}) => {
  let offDoc = null;
  try {
    const existingContexts = await chrome.runtime.getContexts({});
    offDoc =
      existingContexts.find((c) => c.contextType === "OFFSCREEN_DOCUMENT") ||
      null;
  } catch (err) {
    console.warn("closeOffscreenDocumentWithFlush getContexts:", err);
  }

  if (!offDoc) return { ok: true, existed: false };

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
    await chrome.offscreen.closeDocument();
  } catch (err) {
    console.warn("closeOffscreenDocumentWithFlush closeDocument:", err);
  }

  return { ok: true, existed: true, ...result };
};

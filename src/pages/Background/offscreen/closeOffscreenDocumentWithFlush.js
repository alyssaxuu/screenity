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
  });

  chrome.runtime
    .sendMessage({
      type: "offscreen-shutdown",
      reason,
      shouldFinalize,
      timeoutMs: Math.max(2000, effectiveTimeoutMs - 2000),
    })
    .catch(() => {});

  const result = await ackPromise;

  try {
    await chrome.offscreen.closeDocument();
  } catch (err) {
    console.warn("closeOffscreenDocumentWithFlush closeDocument:", err);
  }

  return { ok: true, existed: true, ...result };
};

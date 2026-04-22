export const closeOffscreenDocumentWithFlush = async ({
  reason = "unknown",
  timeoutMs = 25000,
  shouldFinalize = true,
} = {}) => {
  let offDocExists = false;
  try {
    const existingContexts = await chrome.runtime.getContexts({});
    offDocExists = existingContexts.some(
      (c) => c.contextType === "OFFSCREEN_DOCUMENT"
    );
  } catch (err) {
    console.warn("closeOffscreenDocumentWithFlush getContexts:", err);
  }

  if (!offDocExists) return { ok: true, existed: false };

  const ackPromise = new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      resolve({ ok: false, timedOut: true });
    }, timeoutMs);
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
      timeoutMs: Math.max(5000, timeoutMs - 2000),
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

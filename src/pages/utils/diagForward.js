/**
 * Forward a diag event to the service worker from non-SW contexts
 * (sandboxed editor pages, offscreen documents). Fire-and-forget; the
 * SW handler filters out non-whitelisted event names.
 */
export const diagForward = (event, data) => {
  try {
    chrome.runtime
      .sendMessage({ type: "diag-forward", event, data: data ?? null })
      .catch(() => {});
  } catch {
    // sendMessage can throw synchronously if the runtime is gone
  }
};

// An editor tab asks "which recording is mine" on load, while the stop path registers it
// asynchronously. A take started right after Stop keeps the SW busy enough for the question to
// win, and an unregistered tab falls back to the shared pointer, which by then names the next
// take's slot. The answer waits for the registration already running.
const pending = new Map();

export const trackEditorRegistration = (tabId, promise) => {
  if (typeof tabId !== "number" || !promise) return promise;
  const tracked = Promise.resolve(promise)
    .catch(() => {})
    .finally(() => {
      if (pending.get(tabId) === tracked) pending.delete(tabId);
    });
  pending.set(tabId, tracked);
  return tracked;
};

// Every registration still in flight, for a sweep that closes editor tabs the
// registry does not list.
export const awaitPendingEditorRegistrations = async (timeoutMs = 3000) => {
  if (!pending.size) return;
  let timer = null;
  await Promise.race([
    Promise.allSettled([...pending.values()]),
    new Promise((r) => {
      timer = setTimeout(r, timeoutMs);
    }),
  ]);
  clearTimeout(timer);
};

export const awaitEditorRegistration = async (tabId, timeoutMs = 5000) => {
  const p = pending.get(tabId);
  if (!p) return false;
  let timer = null;
  await Promise.race([
    p,
    new Promise((r) => {
      timer = setTimeout(r, timeoutMs);
    }),
  ]);
  clearTimeout(timer);
  return true;
};

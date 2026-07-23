// The editor is an extension page. Background's "show-toast" handler relays to
// the content script of the active tab (handlers.js), which is the recorded
// page, never the editor, so a toast raised from here was never seen. Toast.jsx
// publishes openToast on contentState; route to that instead.
export const showEditorToast = (contentState, message, durationMs = 4000) => {
  if (!message) return false;
  const openToast = contentState?.openToast;
  if (typeof openToast !== "function") return false;
  try {
    openToast(message, null, durationMs);
    return true;
  } catch {
    return false;
  }
};

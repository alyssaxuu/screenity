// getDisplayMedia needs a focused, fully-active document or it rejects with
// InvalidStateError (before any picker shows). Retry once on that after asking
// the background to refocus the recorder tab; any other error (cancel, hardware
// lock) rethrows unchanged. Pure w.r.t. injected deps so it's unit-testable.
export async function acquireDisplayMediaWithFocusRetry({
  getDisplayMedia,
  constraints,
  onReactivate,
  delayMs = 250,
}) {
  try {
    return await getDisplayMedia(constraints);
  } catch (err) {
    if (err?.name !== "InvalidStateError") throw err;
    // Refocus the recorder tab, then retry once; a second failure propagates.
    if (typeof onReactivate === "function") {
      try {
        await onReactivate();
      } catch {}
    }
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return await getDisplayMedia(constraints);
  }
}

/*
 * Creates or reuses the remux offscreen document. Chrome only permits one
 * offscreen document per extension; if a different offscreen (audio beeps,
 * cloud-upload resume) is currently open, we close it first.
 *
 * The remux offscreen uses the WORKERS reason so it can spawn a dedicated
 * worker that calls createSyncAccessHandle() on OPFS, which is only
 * available in Dedicated Workers.
 */
const REMUX_OFFSCREEN_URL = "remuxoffscreen.html";

export const ensureRemuxOffscreen = async () => {
  if (!chrome.offscreen || typeof chrome.offscreen.createDocument !== "function") {
    throw new Error("offscreen-api-unavailable");
  }

  const contexts = await chrome.runtime.getContexts({});
  const existing = contexts.find(
    (c) => c.contextType === "OFFSCREEN_DOCUMENT",
  );
  if (existing) {
    const existingUrl =
      typeof existing.documentUrl === "string" ? existing.documentUrl : "";
    const alreadyRemux = existingUrl.endsWith(REMUX_OFFSCREEN_URL);
    if (alreadyRemux) return;
    // never displace the recorder offscreen; closing it mid-capture kills the
    // recording and mid-upload aborts TUS finalize. editor download() falls back.
    if (existingUrl.includes("offscreenrecorder.html")) {
      throw new Error("offscreen-busy-recorder");
    }
    try {
      await chrome.offscreen.closeDocument();
    } catch (err) {
      // If closeDocument fails we still try to proceed; createDocument
      // will surface a clearer error if the state is actually bad.
      console.warn("ensureRemuxOffscreen: closeDocument failed", err);
    }
  }

  await chrome.offscreen.createDocument({
    url: REMUX_OFFSCREEN_URL,
    reasons: ["WORKERS"],
    justification:
      "Re-mux fragmented MP4 recording to standard MP4 using a worker that writes to OPFS via a sync access handle.",
  });
};

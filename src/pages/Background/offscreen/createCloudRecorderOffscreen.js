// Offscreen doc host for the recorder; immune to background-tab freeze/discard.
// ?cloud=1 renders <CloudRecorder/>, else <Recorder/>. Chrome allows only one
// offscreen doc per extension, so any existing one is closed first.
export const createCloudRecorderOffscreen = async ({ cloud = true } = {}) => {
  if (!chrome.offscreen || typeof chrome.offscreen.createDocument !== "function") {
    throw new Error("chrome.offscreen API unavailable");
  }

  try {
    const contexts = await chrome.runtime.getContexts({});
    const hasOffscreen = (contexts || []).some(
      (c) => c.contextType === "OFFSCREEN_DOCUMENT",
    );
    if (hasOffscreen) {
      await chrome.offscreen.closeDocument();
    }
  } catch (err) {
    // non-fatal; still attempt create, a stale doc surfaces as a create error
    console.warn("[createCloudRecorderOffscreen] pre-close failed", err);
  }

  await chrome.offscreen.createDocument({
    url: cloud ? "offscreenrecorder.html?cloud=1" : "offscreenrecorder.html",
    reasons: ["USER_MEDIA", "DISPLAY_MEDIA", "BLOBS", "WORKERS"],
    justification:
      "Host the screen recorder so a long recording survives background-tab freeze/discard.",
  });
};

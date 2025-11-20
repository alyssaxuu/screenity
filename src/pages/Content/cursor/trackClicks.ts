export function startClickTracking(
  isRegion = false,
  regionWidth = 0,
  regionHeight = 0,
  regionX = 0,
  regionY = 0,
  contentStateRef = null // <- optional
) {
  const handleClick = async (e: any): Promise<any> => {
    // Skip if blur mode is active
    if (contentStateRef?.current?.blurMode) return;

    // Ignore clicks inside the toolbar
    if (
      e.target.closest(".ToolbarRoot") ||
      e.target.closest(".ToolbarRecordingControls") ||
      e.target.closest(".ToolbarToggleWrap") ||
      e.target.closest(".ToolbarPaused") ||
      e.target.closest(".Toast") ||
      e.target.closest("#screenity-root-container")
    ) {
      return;
    }

    const canvasWrapper = document.getElementById("canvas-wrapper-screenity");
    if (canvasWrapper && canvasWrapper.contains(e.target)) {
      return;
    }

    const { surface, recordingWindowId, recordingType } =
      await chrome.storage.local.get([
        "surface",
        "recordingWindowId",
        "recordingType",
      ]);

    if (recordingType === "camera") {
      return;
    }

    let clickX = e.clientX;
    let clickY = e.clientY;

    if (isRegion) {
      // Check if click is inside region bounds
      const inRegion =
        clickX >= regionX &&
        clickX <= regionX + regionWidth &&
        clickY >= regionY &&
        clickY <= regionY + regionHeight;

      if (!inRegion) {
        return;
      }

      // Normalize to region-relative coordinates
      clickX = clickX - regionX;
      clickY = clickY - regionY;
    }

    chrome.runtime.sendMessage({
      type: "click-event",
      payload: {
        x: clickX,
        y: clickY,
        relativeToRegion: isRegion,
        surface: surface || "unknown",
        recordingWindowId,
        timestamp: Date.now(),
        region: isRegion,
        isTab: recordingType === "region",
      },
    });
  };

  window.addEventListener("mousedown", handleClick, true);
  return () => window.removeEventListener("mousedown", handleClick, true);
}

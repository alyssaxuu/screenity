export function startClickTracking(
  isRegion = false,
  regionWidth = 0,
  regionHeight = 0,
  regionX = 0,
  regionY = 0,
  contentStateRef = null // <- optional
) {
  // Refreshed on storage change: a restart can swap recordingType
  // (camera ↔ screen) and we'd otherwise dispatch against the prior mode.
  let cachedSurface = "unknown";
  let cachedRecordingWindowId = null;
  let cachedRecordingType = null;
  chrome.storage.local
    .get(["surface", "recordingWindowId", "recordingType"])
    .then((vals) => {
      cachedSurface = vals.surface || "unknown";
      cachedRecordingWindowId = vals.recordingWindowId ?? null;
      cachedRecordingType = vals.recordingType ?? null;
    })
    .catch(() => {});

  const onStorageChanged = (changes, area) => {
    if (area !== "local") return;
    if (changes.surface) cachedSurface = changes.surface.newValue || "unknown";
    if (changes.recordingWindowId)
      cachedRecordingWindowId = changes.recordingWindowId.newValue ?? null;
    if (changes.recordingType)
      cachedRecordingType = changes.recordingType.newValue ?? null;
  };
  try {
    chrome.storage.onChanged.addListener(onStorageChanged);
  } catch {}

  const handleClick = (e) => {
    if (contentStateRef?.current?.blurMode) return;

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

    if (cachedRecordingType === "camera") {
      return;
    }

    let clickX = e.clientX;
    let clickY = e.clientY;

    if (isRegion) {
      const inRegion =
        clickX >= regionX &&
        clickX <= regionX + regionWidth &&
        clickY >= regionY &&
        clickY <= regionY + regionHeight;

      if (!inRegion) {
        return;
      }

      clickX = clickX - regionX;
      clickY = clickY - regionY;
    }

    chrome.runtime.sendMessage({
      type: "click-event",
      payload: {
        x: clickX,
        y: clickY,
        relativeToRegion: isRegion,
        surface: cachedSurface,
        recordingWindowId: cachedRecordingWindowId,
        timestamp: Date.now(),
        region: isRegion,
        isTab: cachedRecordingType === "region",
      },
    });
  };

  window.addEventListener("mousedown", handleClick, true);
  return () => {
    window.removeEventListener("mousedown", handleClick, true);
    try {
      chrome.storage.onChanged.removeListener(onStorageChanged);
    } catch {}
  };
}

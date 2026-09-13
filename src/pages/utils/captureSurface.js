// What kind of surface a recording actually captured, in the shape the
// app expects (monitor, browser, window). Anything else maps to window.
export const normalizeCaptureSurface = (displaySurface) => {
  if (typeof displaySurface !== "string" || !displaySurface) return null;
  if (displaySurface === "monitor" || displaySurface === "browser") {
    return displaySurface;
  }
  return "window";
};

// Chrome only fills displaySurface on getDisplayMedia streams. A
// tabCapture stream has none but is a tab either way.
export const resolveCaptureSurface = (displaySurface, { isTab } = {}) => {
  const normalized = normalizeCaptureSurface(displaySurface);
  if (normalized) return normalized;
  return isTab ? "browser" : null;
};

// null means unknown, and the key is left cleared so the scene payload
// omits surface rather than guessing.
export const setCapturedSurface = async (surface) => {
  try {
    if (surface) {
      await chrome.storage.local.set({ capturedSurface: surface });
    } else {
      await chrome.storage.local.remove(["capturedSurface"]);
    }
  } catch {}
};

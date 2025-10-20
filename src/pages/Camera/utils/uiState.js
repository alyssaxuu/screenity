import { getContextRefs } from "../context/CameraContext";

export const setWidth = (width) => {
  const { videoRef, setWidth: contextSetWidth } = getContextRefs();
  if (contextSetWidth) {
    contextSetWidth(width);
  } else if (videoRef?.current) {
    videoRef.current.style.width = width;
  }
};

export const setHeight = (height) => {
  const { videoRef, setHeight: contextSetHeight } = getContextRefs();
  if (contextSetHeight) {
    contextSetHeight(height);
  } else if (videoRef?.current) {
    videoRef.current.style.height = height;
  }
};

export const setPipMode = (mode) => {
  const { videoRef, setPipMode: contextSetPipMode } = getContextRefs();
  if (contextSetPipMode) {
    contextSetPipMode(mode);
  } else if (videoRef?.current) {
    // Fallback behavior if context setter isn't available
  }
};

export const setBackgroundEffects = (active) => {
  const { videoRef, setBackgroundEffects: contextSetBackgroundEffects } =
    getContextRefs();

  if (contextSetBackgroundEffects) {
    contextSetBackgroundEffects(active);
  } else {
    chrome.storage.local.set({ backgroundEffectsActive: active }, () => {});

    if (videoRef?.current) {
      videoRef.current.style.display = !active ? "block" : "none";
    }
  }

  return active;
};

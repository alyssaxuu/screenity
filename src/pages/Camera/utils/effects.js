import { renderEffectBackground } from "./backgroundUtils";
import { getContextRefs } from "../context/CameraContext";

export const loadEffect = (effectUrl) => {
  return new Promise((resolve, reject) => {
    if (!effectUrl) {
      console.warn("No effect URL provided");
      resolve(null);
      return;
    }

    const { effectRef, blurRef, bottomCanvasRef, bottomCanvasContextRef } =
      getContextRefs();

    const img = new Image();
    img.src = effectUrl;

    img.onload = () => {
      effectRef.current = img;
      blurRef.current = false;

      renderEffectBackground(img, bottomCanvasRef, bottomCanvasContextRef);

      chrome.storage.local.set({ backgroundEffect: effectUrl });

      resolve(img);
    };

    // Handle load failure
    img.onerror = (error) => {
      console.error(`❌ Failed to load effect: ${effectUrl}`, error);
      reject(error);
    };
  });
};

export const clearAllEffects = () => {
  const { blurRef, effectRef } = getContextRefs();

  blurRef.current = false;
  effectRef.current = null;

  chrome.storage.local.set({ backgroundEffect: "" });

  return true;
};

export const toggleBlur = (enabled) => {
  const { blurRef, effectRef } = getContextRefs();

  const newState = enabled !== undefined ? enabled : !blurRef.current;

  blurRef.current = newState;

  if (newState) {
    effectRef.current = null;
  }

  chrome.storage.local.set({ backgroundEffect: newState ? "blur" : "" });

  return newState;
};

export const getCurrentEffect = () => {
  const { blurRef, effectRef } = getContextRefs();

  return {
    isBlurEnabled: blurRef.current,
    hasCustomEffect: effectRef.current !== null,
    customEffectUrl: effectRef.current ? effectRef.current.src : null,
  };
};

/**
 * Apply saved effect settings at startup
 */
export const applySavedEffectSettings = async () => {
  try {
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(["backgroundEffect"], resolve);
    });

    if (result.backgroundEffect === "blur") {
      toggleBlur(true);
    } else if (result.backgroundEffect) {
      await loadEffect(result.backgroundEffect);
    }

    return true;
  } catch (error) {
    console.error("Error applying saved effect settings:", error);
    return false;
  }
};

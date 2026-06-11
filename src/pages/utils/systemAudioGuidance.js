import { shouldUseDisplayMediaForScreen } from "./screenCaptureMode";

let sent = false;

// Offscreen screen recordings can't show the "record computer audio" warning
// directly, so trigger the same component in the content script (via the SW),
// passing the variant. Fires once per recorder document.
export const sendSystemAudioGuidanceToast = () => {
  if (sent) return;
  sent = true;
  const isMac = navigator.userAgent.indexOf("Mac") !== -1;
  chrome.storage.local.get(
    ["forceDisplayMediaScreen", "macSystemAudioCapture"],
    ({ forceDisplayMediaScreen, macSystemAudioCapture }) => {
      const useDisplayMedia = shouldUseDisplayMediaForScreen({
        forceDisplayMediaScreen,
        macSystemAudioCapture,
      });
      const variant = isMac && !useDisplayMedia ? "mac" : "other";
      try {
        chrome.runtime.sendMessage({
          type: "show-audio-warning",
          variant,
          timeout: 10000,
        });
      } catch {}
    },
  );
};

import { shouldUseDisplayMediaForScreen } from "./screenCaptureMode";

let sent = false;

// Offscreen screen recordings can't show the in-document "record computer
// audio" Warning, so surface the same guidance as a content toast instead.
// Fires once per recorder document (a new recording = a fresh offscreen doc).
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
      const message =
        isMac && !useDisplayMedia
          ? chrome.i18n.getMessage("recordAudioWarningMacDescription")
          : chrome.i18n.getMessage("recordAudioWarningOtherDescription");
      if (!message) return;
      try {
        chrome.runtime.sendMessage({ type: "show-toast", message, timeout: 10000 });
      } catch {}
    },
  );
};

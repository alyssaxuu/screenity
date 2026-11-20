import { shouldUseDisplayMediaForScreen } from "./screenCaptureMode";

let sent = false;
// What the latest call did, for recordingSignals. Read once per take.
let outcome = "not-called";
let everShown = false;
// Bumped on consume, so a storage callback that lands after the take read the
// outcome cannot leak "shown" into the next take.
let generation = 0;

export const consumeSystemAudioGuidanceOutcome = () => {
  const last = outcome;
  outcome = "not-called";
  generation += 1;
  return last;
};

// Camera-only has no computer audio to share, so the guidance doesn't apply.
export const hasComputerAudioToShare = (recordingType) =>
  recordingType !== "camera";

// Offscreen screen recordings can't show the "record computer audio" warning
// directly, so trigger the same component in the content script (via the SW),
// passing the variant. Fires once per recorder document.
export const sendSystemAudioGuidanceToast = () => {
  if (sent) {
    // A camera-only first call also sets `sent`, so this may never have shown.
    outcome = everShown ? "already-shown" : "suppressed";
    return;
  }
  sent = true;
  outcome = "pending";
  const gen = generation;
  const isMac = navigator.userAgent.indexOf("Mac") !== -1;
  chrome.storage.local.get(
    ["forceDisplayMediaScreen", "macSystemAudioCapture", "recordingType"],
    ({ forceDisplayMediaScreen, macSystemAudioCapture, recordingType }) => {
      if (!hasComputerAudioToShare(recordingType)) {
        if (gen === generation) outcome = "not-applicable";
        return;
      }
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
        if (gen === generation) outcome = "shown";
        everShown = true;
      } catch {}
    },
  );
};

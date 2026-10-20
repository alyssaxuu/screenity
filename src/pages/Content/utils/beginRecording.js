import { wantsCameraLayerAtStart } from "../teleprompter/prompterRules";
import { getPipLayers, openPipLayer } from "../teleprompter/prompterWindow";

// Single start path for the popup button and the floating window's button.
// Start goes before opening the camera window: the permission request needs the
// click's activation, and opening the window spends it.
const beginStreaming = (state, source) => {
  if (process.env.NODE_ENV !== "production") {
    console.debug(
      "[Screenity][pip] start",
      JSON.stringify({
        sub: state.isSubscribed,
        instant: state.instantMode,
        type: state.recordingType,
        cam: state.cameraActive,
        vin: state.defaultVideoInput,
      })
    );
  }
  // A click in the floating window gives this page no activation, so a first-time
  // permission request would be rejected. Read it here, in the click's own turn.
  const noPageGesture =
    source === "floating-window" &&
    navigator.userActivation?.isActive === false;
  const started = state.startStreaming({ noPageGesture });
  if (
    wantsCameraLayerAtStart({
      cloud: process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true",
      subscribed: state.isSubscribed,
      instantMode: state.instantMode,
      recordingType: state.recordingType,
      cameraOn: state.cameraActive && state.defaultVideoInput !== "none",
      windowOpen: Object.values(getPipLayers()).some(Boolean),
    })
  ) {
    openPipLayer("camera", "start");
  }
  return started;
};

// A new recording destroys one still unsaved in an editor tab, so confirm first.
export const beginRecording = async (state, source) => {
  let unsaved = null;
  try {
    unsaved = await chrome.runtime.sendMessage({
      type: "unsaved-retained-recording",
    });
  } catch {}
  if (unsaved?.hasUnsaved && typeof state.openModal === "function") {
    state.openModal(
      chrome.i18n.getMessage("unsavedRecordingModalTitle"),
      chrome.i18n.getMessage("unsavedRecordingModalDescription"),
      chrome.i18n.getMessage("unsavedRecordingModalAction"),
      chrome.i18n.getMessage("unsavedRecordingModalCancel"),
      () => {
        beginStreaming(state, source);
      },
      () => {
        chrome.runtime
          .sendMessage({
            type: "focus-retained-recording",
            tabId: unsaved.tabId,
          })
          .catch(() => {});
      },
      null,
      null,
      null,
      false,
      chrome.i18n.getMessage("unsavedRecordingModalDismiss"),
      () => {
        // Dismiss the prompt for good and still start, so this button is not a dead end.
        chrome.storage.local
          .set({ unsavedRecordingPromptDismissed: Date.now() })
          .catch(() => {});
        beginStreaming(state, source);
      }
    );
    return;
  }
  beginStreaming(state, source);
};

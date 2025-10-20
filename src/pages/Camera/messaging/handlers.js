import {
  registerMessage,
  messageRouter,
} from "../../../messaging/messageRouter";
import { getContextRefs } from "../context/CameraContext";
import {
  getCameraStream,
  stopCameraStream,
  togglePip,
  surfaceHandler,
  cameraToggledToolbar,
} from "../utils/cameraUtils";
import { loadEffect } from "../utils/backgroundUtils";
import {
  setWidth,
  setHeight,
  setPipMode,
  setBackgroundEffects,
} from "../utils/uiState";

function waitForVideoRef(callback, attempts = 10) {
  const { videoRef } = getContextRefs();

  if (videoRef?.current) {
    callback(videoRef.current);
  } else if (attempts > 0) {
    setTimeout(() => waitForVideoRef(callback, attempts - 1), 100);
  }
}

export const setupHandlers = ({ setLoading }) => {
  registerMessage("toggle-blur", handleToggleBlur);
  registerMessage("load-custom-effect", handleLoadCustomEffect);
  registerMessage("set-background-effect", handleSetBackgroundEffect);
  registerMessage("stop-recording", handleStopRecording);
  registerMessage("dismiss-recording", handleStopRecording);

  let cameraSwitchTimeout;
  registerMessage("switch-camera", (message) => {
    if (message.id !== "none") {
      clearTimeout(cameraSwitchTimeout);
      stopCameraStream();

      cameraSwitchTimeout = setTimeout(() => {
        const {
          videoRef,
          streamRef,
          offScreenCanvasRef,
          offScreenCanvasContextRef,
        } = getContextRefs();

        getCameraStream(
          { video: { deviceId: { exact: message.id } } },
          streamRef,
          videoRef,
          offScreenCanvasRef,
          offScreenCanvasContextRef,
          {
            onStart: () => setLoading("videoElement", true),
            onFinish: () => setLoading("videoElement", false),
          }
        );
      }, 500);
    }
  });

  registerMessage("background-effects-active", () =>
    setBackgroundEffects(true)
  );
  registerMessage("background-effects-inactive", () =>
    setBackgroundEffects(false)
  );
  registerMessage("camera-only-update", handleCameraOnlyUpdate);
  registerMessage("screen-update", handleScreenUpdate);
  registerMessage("toggle-pip", () => togglePip(getContextRefs().videoRef));
  registerMessage("set-surface", (message) => {
    console.log("Preparing Picture in Picture request");

    waitForVideoRef((videoEl) => {
      surfaceHandler(message, { current: videoEl }); // ✅ FIXED
    });
  });
  registerMessage("camera-toggled-toolbar", cameraToggledToolbar);
  registerMessage("turn-off-pip", () => {
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch((error) => {
        console.error("Failed to exit Picture in Picture:", error);
      });
    }
    setPipMode(false);
    chrome.runtime.sendMessage({ type: "pip-ended" });
  });

  messageRouter();
};

const handleStopRecording = async (request) => {
  if (document.pictureInPictureElement) {
    document.exitPictureInPicture();
    setPipMode(false);
    chrome.runtime.sendMessage({ type: "pip-ended" });
  }
};

const safelyApplyFilter = (contextRef, filter) => {
  if (contextRef.current) {
    try {
      contextRef.current.filter = filter;
    } catch (error) {
      console.warn("⚠️ Failed to apply filter:", error.message);
    }
  }
};

const handleSetBackgroundEffect = async (message) => {
  const { blurRef, effectRef, offScreenCanvasContextRef } = getContextRefs();

  await chrome.storage.local.set({ backgroundEffect: message.effect });

  if (message.effect === "blur") {
    blurRef.current = true;
    effectRef.current = null;
    safelyApplyFilter(offScreenCanvasContextRef, "blur(5px)");
  } else if (message.effect) {
    blurRef.current = false;

    try {
      const effectImage = await loadEffect(message.effect);
      effectRef.current = effectImage;
      safelyApplyFilter(offScreenCanvasContextRef, "none");
    } catch (err) {
      console.error("Failed to load effect:", err);
    }
  } else {
    blurRef.current = false;
    effectRef.current = null;
    safelyApplyFilter(offScreenCanvasContextRef, "none");
  }
};

const handleToggleBlur = async (message) => {
  const { blurRef, offScreenCanvasContextRef } = getContextRefs();
  const enabled = message.enabled ?? !blurRef.current;

  blurRef.current = enabled;

  await chrome.storage.local.set({ backgroundEffect: enabled ? "blur" : "" });

  safelyApplyFilter(offScreenCanvasContextRef, enabled ? "blur(5px)" : "none");
};

const handleLoadCustomEffect = async (message) => {
  if (!message.effectUrl) {
    console.warn("⚠️ No effect URL provided");
    return;
  }

  const { blurRef, effectRef, offScreenCanvasContextRef } = getContextRefs();

  try {
    const effectUrl = await loadEffect(message.effectUrl);
    blurRef.current = false;
    effectRef.current = message.effectUrl;

    await chrome.storage.local.set({ backgroundEffect: message.effectUrl });

    safelyApplyFilter(offScreenCanvasContextRef, "none");
  } catch (error) {
    console.error("Failed to load custom effect:", error);
  }
};

const handleCameraOnlyUpdate = () => {
  const { recordingTypeRef, setWidth, setHeight, setIsCameraMode } =
    getContextRefs();

  if (setWidth && setHeight) {
    setWidth("auto");
    setHeight("100%");
  }

  setIsCameraMode(true);
  recordingTypeRef.current = "camera";
};

const handleScreenUpdate = () => {
  const { videoRef, recordingTypeRef, setWidth, setHeight, setIsCameraMode } =
    getContextRefs();

  if (!videoRef.current || !setWidth || !setHeight) {
    console.warn("⚠️ Missing required refs for screen update");
    return;
  }

  setIsCameraMode(false);

  const { videoWidth, videoHeight } = videoRef.current;

  if (videoWidth > videoHeight) {
    setWidth("auto");
    setHeight("100%");
  } else {
    setWidth("100%");
    setHeight("auto");
  }

  recordingTypeRef.current = "screen";
};

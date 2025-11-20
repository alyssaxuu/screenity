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

function waitForVideoRef(callback: (videoEl: HTMLVideoElement) => void, attempts = 10): void {
  const { videoRef } = getContextRefs();

  if (videoRef?.current) {
    callback(videoRef.current);
  } else if (attempts > 0) {
    setTimeout(() => waitForVideoRef(callback, attempts - 1), 100);
  }
}

export const setupHandlers = ({ setLoading }: any) => {
  registerMessage("toggle-blur", handleToggleBlur);
  registerMessage("load-custom-effect", handleLoadCustomEffect);
  registerMessage("set-background-effect", handleSetBackgroundEffect);
  registerMessage("stop-recording", handleStopRecording);
  registerMessage("dismiss-recording", handleStopRecording);

  let cameraSwitchTimeout: NodeJS.Timeout | undefined;
  registerMessage("switch-camera", (message: ExtensionMessage) => {
    const switchMessage = message as ExtensionMessage & { id?: string };
    if (switchMessage.id && switchMessage.id !== "none") {
      if (cameraSwitchTimeout) {
        clearTimeout(cameraSwitchTimeout);
      }
      stopCameraStream();

      cameraSwitchTimeout = setTimeout(() => {
        const {
          videoRef,
          streamRef,
          offScreenCanvasRef,
          offScreenCanvasContextRef,
        } = getContextRefs();

        getCameraStream(
          { video: { deviceId: { exact: switchMessage.id } } },
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
  registerMessage("set-surface", (message: ExtensionMessage) => {
    console.log("Preparing Picture in Picture request");

    waitForVideoRef((videoEl: HTMLVideoElement) => {
      surfaceHandler(message, { current: videoEl });
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

const handleStopRecording = async (request: any): Promise<any> => {
  if (document.pictureInPictureElement) {
    document.exitPictureInPicture();
    setPipMode(false);
    chrome.runtime.sendMessage({ type: "pip-ended" });
  }
};

const safelyApplyFilter = (contextRef: React.RefObject<CanvasRenderingContext2D | null>, filter: string): void => {
  if (contextRef.current) {
    try {
      contextRef.current.filter = filter;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn("⚠️ Failed to apply filter:", errorMessage);
    }
  }
};

const handleSetBackgroundEffect = async (message: any): Promise<any> => {
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

const handleToggleBlur = async (message: ExtensionMessage & { enabled?: boolean }): Promise<void> => {
  const { blurRef, offScreenCanvasContextRef } = getContextRefs();
  const enabled = message.enabled ?? !blurRef.current;

  if (blurRef.current !== undefined) blurRef.current = enabled;

  await chrome.storage.local.set({ backgroundEffect: enabled ? "blur" : "" });

  safelyApplyFilter(offScreenCanvasContextRef, enabled ? "blur(5px)" : "none");
};

const handleLoadCustomEffect = async (message: ExtensionMessage & { effectUrl?: string }): Promise<void> => {
  if (!message.effectUrl) {
    console.warn("⚠️ No effect URL provided");
    return;
  }

  const { blurRef, effectRef, offScreenCanvasContextRef } = getContextRefs();

  try {
    const effectUrl = await loadEffect(message.effectUrl) as HTMLImageElement | null;
    if (blurRef.current !== undefined) blurRef.current = false;
    if (effectRef.current !== undefined) effectRef.current = effectUrl;

    await chrome.storage.local.set({ backgroundEffect: message.effectUrl });

    safelyApplyFilter(offScreenCanvasContextRef, "none");
  } catch (error) {
    console.error("Failed to load custom effect:", error);
  }
};

const handleCameraOnlyUpdate = (): void => {
  const { recordingTypeRef, setWidth, setHeight, setIsCameraMode } =
    getContextRefs();

  if (setWidth && setHeight) {
    setWidth("auto");
    setHeight("100%");
  }

  if (setIsCameraMode) {
    setIsCameraMode(true);
  }
  if (recordingTypeRef.current !== undefined) {
    recordingTypeRef.current = "camera";
  }
};

const handleScreenUpdate = (): void => {
  const { videoRef, recordingTypeRef, setWidth, setHeight, setIsCameraMode } =
    getContextRefs();

  if (!videoRef.current || !setWidth || !setHeight) {
    console.warn("⚠️ Missing required refs for screen update");
    return;
  }

  if (setIsCameraMode) {
    setIsCameraMode(false);
  }

  const { videoWidth, videoHeight } = videoRef.current;

  if (videoWidth > videoHeight) {
    setWidth("auto");
    setHeight("100%");
  } else {
    setWidth("100%");
    setHeight("auto");
  }

  if (recordingTypeRef.current !== undefined) {
    recordingTypeRef.current = "screen";
  }
};

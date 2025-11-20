import { getContextRefs } from "../context/CameraContext";
import { setPipMode } from "./uiState";

const CLOUD_FEATURES_ENABLED =
  process.env.SCREENITY_ENABLE_CLOUD_FEATURES === "true";

export const getCameraStream = async (
  constraints: MediaStreamConstraints,
  streamRef: React.RefObject<MediaStream>,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  offScreenCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  offScreenCanvasContextRef: React.RefObject<CanvasRenderingContext2D | null>,
  { onStart = async (): Promise<void> => {}, onFinish = (): void => {} } = {}
): Promise<void> => {
  const { setWidth, setHeight, recordingTypeRef } = getContextRefs();

  onStart();

  if (
    !streamRef ||
    !videoRef ||
    !offScreenCanvasRef ||
    !offScreenCanvasContextRef
  ) {
    throw new Error("Required refs are missing");
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    (streamRef as React.MutableRefObject<MediaStream>).current = stream;

    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    const width = settings.width ?? 1280;
    const height = settings.height ?? 720;

    if (setWidth && setHeight) {
      const isCamera = recordingTypeRef?.current === "camera";
      const w = isCamera || width / height < 1 ? "100%" : "auto";
      const h = isCamera || width / height < 1 ? "auto" : "100%";
      setWidth(w);
      setHeight(h);
    } else {
      console.warn("⚠️ setWidth or setHeight not available from context.");
    }

    // VIDEO REF SETUP
    if (!videoRef.current) {
      console.warn("⏳ videoRef not ready yet. Will poll every 100ms.");
      const maxWaitTime = 5000;
      const startTime = Date.now();

      const intervalId = setInterval(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          clearInterval(intervalId);
        } else if (Date.now() - startTime > maxWaitTime) {
          console.warn("⚠️ Timed out waiting for videoRef.current");
          clearInterval(intervalId);
        }
      }, 100);
      return;
    }

    const video = videoRef.current;
    video.srcObject = stream;

    await new Promise<void>((resolve) => {
      video.onloadedmetadata = async () => {
        await video.play().catch((err) => {
          console.error("❌ Error during video.play():", err);
        });

        await new Promise<void>((r) => setTimeout(r, 100));

        const canvas = offScreenCanvasRef?.current;
        if (!canvas) {
          console.warn("⚠️ offScreenCanvasRef.current is null.");
          return resolve();
        }

        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;

        const context = canvas.getContext("2d");
        if (!context) {
          console.error("❌ Failed to get 2D context from canvas.");
          return resolve();
        }

        (
          offScreenCanvasContextRef as React.MutableRefObject<CanvasRenderingContext2D | null>
        ).current = context;

        resolve();
      };
    });

    onFinish();
  } catch (err) {
    console.error("❌ Failed to get camera stream:", err);
    onFinish();
  }
};

export const stopCameraStream = (
  streamRef: React.RefObject<MediaStream>,
  videoRef: React.RefObject<HTMLVideoElement | null>
): void => {
  if (!streamRef?.current) {
    console.warn("⚠️ No active stream to stop.");
    return;
  }

  const stream = streamRef.current;

  stream.getTracks().forEach((track) => track.stop());

  if (videoRef && videoRef.current) {
    videoRef.current.srcObject = null;
  }
};

export const togglePip = (videoRef: any) => {
  if (document.pictureInPictureElement) {
    document.exitPictureInPicture();
  } else {
    try {
      videoRef.current.requestPictureInPicture().catch(() => {
        setPipMode(false);
        chrome.runtime.sendMessage({ type: "pip-ended" });
      });
    } catch (error) {
      setPipMode(false);
      chrome.runtime.sendMessage({ type: "pip-ended" });
    }
  }
};
import type { CameraToggledRequest } from "../../../types/camera";

export const surfaceHandler = async (
  request: CameraToggledRequest,
  videoRef: React.RefObject<HTMLVideoElement | null>
): Promise<void> => {
  console.log("Picture in Picture request ready");

  if (!videoRef?.current?.requestPictureInPicture) {
    setPipMode(false);
    chrome.runtime.sendMessage({ type: "pip-ended" });
    return;
  }

  if (!CLOUD_FEATURES_ENABLED) {
    const shouldEnterPip = request.surface === "monitor";
    if (shouldEnterPip && videoRef.current) {
      try {
        await videoRef.current.requestPictureInPicture();
      } catch (err) {
        console.error("❌ Failed to enter PiP:", err);
        setPipMode(false);
        chrome.runtime.sendMessage({ type: "pip-ended" });
      }
    }
    return;
  }

  try {
    const result = await chrome.runtime.sendMessage({
      type: "check-auth-status",
    });

    const isSubscribed = result?.subscribed || false;
    const instantMode = result?.instantMode || false;

    const shouldEnterPip =
      (request.surface === "monitor" && (!isSubscribed || instantMode)) ||
      (request.surface !== "monitor" && isSubscribed && !instantMode);

    if (shouldEnterPip && videoRef.current) {
      await videoRef.current.requestPictureInPicture();
    }
  } catch (error) {
    console.error("❌ Failed to enter Picture in Picture:", error);
    setPipMode(false);
    chrome.runtime.sendMessage({ type: "pip-ended" });
  }
};

export const cameraToggledToolbar = async (
  request: CameraToggledRequest
): Promise<void> => {
  const { streamRef, videoRef } = getContextRefs();
  if (request.active) {
    setTimeout(() => {
      stopCameraStream(streamRef, videoRef);
      const { offScreenCanvasRef, offScreenCanvasContextRef } =
        getContextRefs();
      getCameraStream(
        {
          video: {
            deviceId: { exact: request.id },
          },
        } as MediaStreamConstraints,
        streamRef,
        videoRef,
        offScreenCanvasRef,
        offScreenCanvasContextRef
      );
    }, 2000);
    setPipMode(false);
  }
};

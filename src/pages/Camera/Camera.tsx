import React, { useEffect, useRef, useState } from "react";
import Background from "./components/Background";
import { useCameraContext } from "./context/CameraContext";
import { getCameraStream, stopCameraStream } from "./utils/cameraUtils";
import { setupHandlers } from "./messaging/handlers";

const Camera = () => {
  const [loadingStates, setLoadingStates] = useState({
    recordingType: true,
    backgroundEffects: true,
    videoElement: true,
    modelLoading: false,
  });
  const {
    width,
    height,
    pipMode,
    setPipMode,
    backgroundEffects,
    setBackgroundEffects,
    imageDataState,
    recordingTypeRef,
    setWidth,
    setHeight,
    captureFrame,
    videoRef,
    streamRef,
    offScreenCanvasRef,
    offScreenCanvasContextRef,
    isModelLoaded,
    isCameraMode,
    setIsCameraMode,
  } = useCameraContext();

  // Helper function to update loading states
  const updateLoadingState = (
    key: keyof typeof loadingStates,
    value: boolean
  ) => {
    setLoadingStates((prev) => ({ ...prev, [key]: value }));
  };

  // Calculate if anything is still loading
  const isLoading = Object.values(loadingStates).some((state) => state);

  // Ensure the offScreenCanvas is created exactly once
  useEffect(() => {
    // Canvas is already initialized in CameraContext
    // This effect is kept for compatibility but doesn't need to do anything
  }, []);

  // Initialize message listener
  useEffect(() => {
    setupHandlers({
      setLoading: updateLoadingState,
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.get(["recordingType"], (result) => {
      const recordingType = result.recordingType as string | undefined;
      const type = recordingType === "camera" ? "camera" : "screen";
      // recordingTypeRef is managed by CameraContext, we just use it
      updateLoadingState("recordingType", false);
      setIsCameraMode(type === "camera");
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.get(["backgroundEffectsActive"], (result) => {
      const active = result.backgroundEffectsActive as boolean | undefined;
      if (active !== undefined) {
        setBackgroundEffects(active);
      }

      if (!active) {
        updateLoadingState("modelLoading", false);
      }

      updateLoadingState("backgroundEffects", false);
    });
  }, []);

  useEffect(() => {
    if (backgroundEffects && !isModelLoaded) {
      updateLoadingState("modelLoading", true);
    } else if (!backgroundEffects || isModelLoaded) {
      updateLoadingState("modelLoading", false);
    }
  }, [backgroundEffects, isModelLoaded]);

  useEffect(() => {
    if (!videoRef.current || streamRef.current?.active) return;

    updateLoadingState("videoElement", true);

    chrome.storage.local.get(["defaultVideoInput"], (result) => {
      const constraints =
        result.defaultVideoInput !== "none"
          ? { video: { deviceId: { exact: result.defaultVideoInput } } }
          : { video: true };

      getCameraStream(
        constraints,
        streamRef,
        videoRef,
        offScreenCanvasRef,
        offScreenCanvasContextRef,
        {
          onStart: async () => {
            updateLoadingState("videoElement", true);
          },
          onFinish: () => {
            updateLoadingState("videoElement", false);
          },
        }
      ).catch((err) => {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("Failed to get camera stream:", error);
        updateLoadingState("videoElement", false);
      });
    });
  }, [videoRef.current]); // Will run once when videoRef is set

  // Handle PiP events
  const handleEnterPip = () => {
    setPipMode(true);
    chrome.runtime.sendMessage({ type: "pip-started" });
  };

  const handleLeavePip = () => {
    setPipMode(false);
    chrome.runtime.sendMessage({ type: "pip-ended" });
  };

  useEffect(() => {
    if (!videoRef.current) {
      console.warn("Video element not ready for PiP events.");
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    video.addEventListener("enterpictureinpicture", handleEnterPip);
    video.addEventListener("leavepictureinpicture", handleLeavePip);

    return () => {
      video.removeEventListener("enterpictureinpicture", handleEnterPip);
      video.removeEventListener("leavepictureinpicture", handleLeavePip);
    };
  }, [videoRef]);

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      {backgroundEffects && <Background />}
      <video
        style={{
          // height: height,
          // width: width,
          height: "100%",
          width: "100%",
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 99,
          display: !backgroundEffects ? "block" : "none",
          objectFit: isCameraMode ? "contain" : "cover",
          objectPosition: "50% 50%",
        }}
        ref={videoRef}
        playsInline
        muted
      ></video>

      {isLoading && (
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#CBD0D8",
            zIndex: 999,
            position: "absolute",
            top: 0,
            left: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div className="loader"></div>
        </div>
      )}

      {pipMode && (
        <img
          src={chrome.runtime.getURL("assets/pip-mode.svg")}
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 999,
          }}
        />
      )}
      <style>
        {`.loader {
  font-size: 10px;
  width: 1em;
  height: 1em;
	margin: auto;
  border-radius: 50%;
  position: relative;
  text-indent: -9999em;
  animation: mulShdSpin 1.1s infinite ease;
  transform: translateZ(0);
}
@keyframes mulShdSpin {
  0%,
  100% {
    box-shadow: 0em -2.6em 0em 0em #ffffff, 1.8em -1.8em 0 0em rgba(255,255,255, 0.2), 2.5em 0em 0 0em rgba(255,255,255, 0.2), 1.75em 1.75em 0 0em rgba(255,255,255, 0.2), 0em 2.5em 0 0em rgba(255,255,255, 0.2), -1.8em 1.8em 0 0em rgba(255,255,255, 0.2), -2.6em 0em 0 0em rgba(255,255,255, 0.5), -1.8em -1.8em 0 0em rgba(255,255,255, 0.7);
  }
  12.5% {
    box-shadow: 0em -2.6em 0em 0em rgba(255,255,255, 0.7), 1.8em -1.8em 0 0em #ffffff, 2.5em 0em 0 0em rgba(255,255,255, 0.2), 1.75em 1.75em 0 0em rgba(255,255,255, 0.2), 0em 2.5em 0 0em rgba(255,255,255, 0.2), -1.8em 1.8em 0 0em rgba(255,255,255, 0.2), -2.6em 0em 0 0em rgba(255,255,255, 0.2), -1.8em -1.8em 0 0em rgba(255,255,255, 0.5);
  }
  25% {
    box-shadow: 0em -2.6em 0em 0em rgba(255,255,255, 0.5), 1.8em -1.8em 0 0em rgba(255,255,255, 0.7), 2.5em 0em 0 0em #ffffff, 1.75em 1.75em 0 0em rgba(255,255,255, 0.2), 0em 2.5em 0 0em rgba(255,255,255, 0.2), -1.8em 1.8em 0 0em rgba(255,255,255, 0.2), -2.6em 0em 0 0em rgba(255,255,255, 0.2), -1.8em -1.8em 0 0em rgba(255,255,255, 0.2);
  }
  37.5% {
    box-shadow: 0em -2.6em 0em 0em rgba(255,255,255, 0.2), 1.8em -1.8em 0 0em rgba(255,255,255, 0.5), 2.5em 0em 0 0em rgba(255,255,255, 0.7), 1.75em 1.75em 0 0em #ffffff, 0em 2.5em 0 0em rgba(255,255,255, 0.2), -1.8em 1.8em 0 0em rgba(255,255,255, 0.2), -2.6em 0em 0 0em rgba(255,255,255, 0.2), -1.8em -1.8em 0 0em rgba(255,255,255, 0.2);
  }
  50% {
    box-shadow: 0em -2.6em 0em 0em rgba(255,255,255, 0.2), 1.8em -1.8em 0 0em rgba(255,255,255, 0.2), 2.5em 0em 0 0em rgba(255,255,255, 0.5), 1.75em 1.75em 0 0em rgba(255,255,255, 0.7), 0em 2.5em 0 0em #ffffff, -1.8em 1.8em 0 0em rgba(255,255,255, 0.2), -2.6em 0em 0 0em rgba(255,255,255, 0.2), -1.8em -1.8em 0 0em rgba(255,255,255, 0.2);
  }
  62.5% {
    box-shadow: 0em -2.6em 0em 0em rgba(255,255,255, 0.2), 1.8em -1.8em 0 0em rgba(255,255,255, 0.2), 2.5em 0em 0 0em rgba(255,255,255, 0.2), 1.75em 1.75em 0 0em rgba(255,255,255, 0.5), 0em 2.5em 0 0em rgba(255,255,255, 0.7), -1.8em 1.8em 0 0em #ffffff, -2.6em 0em 0 0em rgba(255,255,255, 0.2), -1.8em -1.8em 0 0em rgba(255,255,255, 0.2);
  }
  75% {
    box-shadow: 0em -2.6em 0em 0em rgba(255,255,255, 0.2), 1.8em -1.8em 0 0em rgba(255,255,255, 0.2), 2.5em 0em 0 0em rgba(255,255,255, 0.2), 1.75em 1.75em 0 0em rgba(255,255,255, 0.2), 0em 2.5em 0 0em rgba(255,255,255, 0.5), -1.8em 1.8em 0 0em rgba(255,255,255, 0.7), -2.6em 0em 0 0em #ffffff, -1.8em -1.8em 0 0em rgba(255,255,255, 0.2);
  }
  87.5% {
    box-shadow: 0em -2.6em 0em 0em rgba(255,255,255, 0.2), 1.8em -1.8em 0 0em rgba(255,255,255, 0.2), 2.5em 0em 0 0em rgba(255,255,255, 0.2), 1.75em 1.75em 0 0em rgba(255,255,255, 0.2), 0em 2.5em 0 0em rgba(255,255,255, 0.2), -1.8em 1.8em 0 0em rgba(255,255,255, 0.5), -2.6em 0em 0 0em rgba(255,255,255, 0.7), -1.8em -1.8em 0 0em #ffffff;
  }
}`}
      </style>
    </div>
  );
};

export default Camera;

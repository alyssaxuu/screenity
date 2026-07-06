import React, { useEffect, useRef, useState } from "react";
import Background from "./components/Background";
import { useCameraContext } from "./context/CameraContext";
import {
  getCameraStream,
  stopCameraStream,
  surfaceHandler,
} from "./utils/cameraUtils";
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
    recordingTypeRef,
    setWidth,
    setHeight,
    videoRef,
    streamRef,
    offScreenCanvasRef,
    offScreenCanvasContextRef,
    isModelLoaded,
    isCameraMode,
    setIsCameraMode,
  } = useCameraContext();

  const updateLoadingState = (key, value) => {
    setLoadingStates((prev) => ({ ...prev, [key]: value }));
  };

  const isLoading = Object.values(loadingStates).some((state) => state);

  useEffect(() => {
    if (!offScreenCanvasRef.current) {
      offScreenCanvasRef.current = document.createElement("canvas");
    }
  }, []);

  useEffect(() => {
    setupHandlers({
      setLoading: updateLoadingState,
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.get(["recordingType"], (result) => {
      recordingTypeRef.current =
        result.recordingType === "camera" ? "camera" : "screen";
      updateLoadingState("recordingType", false);
      setIsCameraMode(recordingTypeRef.current === "camera");
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.get(["backgroundEffectsActive"], (result) => {
      if (result.backgroundEffectsActive !== undefined) {
        setBackgroundEffects(result.backgroundEffectsActive);
      }

      if (!result.backgroundEffectsActive) {
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

  // 30s ceiling on modelLoading; clears the spinner so the camera feed
  // shows even if CameraContext's inner GPU+CPU timeouts race past.
  useEffect(() => {
    if (!loadingStates.modelLoading) return;
    const id = setTimeout(() => {
      console.warn(
        "[Screenity] modelLoading hard-capped at 30s; clearing spinner",
      );
      try {
        chrome.runtime.sendMessage({
          type: "diag-forward",
          event: "recorder-camera-modelloading-hard-cap",
        });
      } catch {}
      updateLoadingState("modelLoading", false);
    }, 30000);
    return () => clearTimeout(id);
  }, [loadingStates.modelLoading]);

  // Re-entry guard. Toggling camera off while getUserMedia is still
  // in-flight made stopCameraStream operate on a half-built stream, so
  // the device lock stayed and the LED stayed on.
  const isAcquiringRef = useRef(false);

  const acquireStream = () => {
    if (!videoRef.current || streamRef.current?.active) return;
    if (isAcquiringRef.current) return;
    isAcquiringRef.current = true;
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
          onStart: () => updateLoadingState("videoElement", true),
          onFinish: () => {
            updateLoadingState("videoElement", false);
            isAcquiringRef.current = false;
          },
        }
      );
    });
  };

  useEffect(() => {
    // Acquire the preview whenever the camera is enabled, so the user sees
    // their camera before recording too, not only during a recording.
    chrome.storage.local.get(["cameraActive"], (result) => {
      if (result.cameraActive) {
        acquireStream();
      }
    });
  }, [videoRef.current]);

  // Hold the camera while the bubble is on (cameraActive), release it when off.
  // This is what shows the preview before recording, not only during it.
  useEffect(() => {
    let inflightAcquire = false;
    const evaluate = async () => {
      const { cameraActive } = await chrome.storage.local.get(["cameraActive"]);
      // The camera iframe only mounts when cameraActive is true, so a tab
      // recording without camera never reaches here and can't re-acquire.
      const wantStream = Boolean(cameraActive);
      const hasStream = Boolean(streamRef.current?.active);
      if (!wantStream && hasStream) {
        stopCameraStream(streamRef, videoRef);
      } else if (wantStream && !hasStream && !inflightAcquire) {
        inflightAcquire = true;
        try {
          acquireStream();
        } finally {
          // getCameraStream's onFinish flips loading off async; the
          // boolean flag here is just a re-entry guard, not a true lock.
          setTimeout(() => {
            inflightAcquire = false;
          }, 500);
        }
      }
    };
    const listener = (changes, area) => {
      if (area !== "local") return;
      if ("cameraActive" in changes) {
        evaluate();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // re-enter PiP if needed after camera stream is ready. user navigated while
  // recording a monitor, old PiP was destroyed with old page, re-enter once the
  // new camera iframe has a live stream.
  useEffect(() => {
    if (!videoRef.current || !streamRef.current?.active) return;

    chrome.storage.local.get(
      ["surface", "recording"],
      (result) => {
        if (result.recording && result.surface) {
          surfaceHandler({ surface: result.surface }, videoRef);
        }
      },
    );
  }, [videoRef.current, streamRef.current?.active]);

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

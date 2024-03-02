import React, { useEffect, useState, useRef } from "react";
import Background from "./modules/Background";

const Camera = () => {
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [backgroundEffects, setBackgroundEffects] = useState(false);
  const backgroundEffectsRef = useRef(false);
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const [imageDataState, setImageDataState] = useState(null);
  const [pipMode, setPipMode] = useState(false);
  const recordingTypeRef = useRef("screen");

  // Offscreen canvas for getting video frame
  const offScreenCanvasRef = useRef(null);
  const offScreenCanvasContextRef = useRef(null);

  useEffect(() => {
    offScreenCanvasRef.current = document.createElement("canvas");
  }, []);

  const getCameraStream = (constraints) => {
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        streamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        const { width, height } = videoTrack.getSettings();
        if (recordingTypeRef.current === "camera") {
          setWidth("100%");
          setHeight("auto");
        } else {
          setWidth(width / height < 1 ? "100%" : "auto");
          setHeight(width / height < 1 ? "auto" : "100%");
        }
        const video = videoRef.current;
        video.srcObject = stream;
        video.onloadedmetadata = (e) => {
          video.play();

          const canvas = offScreenCanvasRef.current;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          offScreenCanvasContextRef.current = canvas.getContext("2d");
          requestAnimationFrame(captureFrame);
        };
      })
      .catch((err) => {
        // Error getting camera stream
      });
  };

  const stopCameraStream = () => {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach((track) => track.stop());
    videoRef.current.srcObject = null;
  };

  useEffect(() => {
    backgroundEffectsRef.current = backgroundEffects;
  }, [backgroundEffects]);

  const captureFrame = () => {
    if (
      backgroundEffectsRef.current &&
      offScreenCanvasContextRef.current &&
      offScreenCanvasRef.current
    ) {
      const video = videoRef.current;
      offScreenCanvasContextRef.current.drawImage(
        video,
        0,
        0,
        offScreenCanvasRef.current.width,
        offScreenCanvasRef.current.height
      );
      setImageDataState(
        offScreenCanvasContextRef.current.getImageData(
          0,
          0,
          offScreenCanvasRef.current.width,
          offScreenCanvasRef.current.height
        )
      );
    }
    requestAnimationFrame(captureFrame);
  };

  useEffect(() => {
    chrome.runtime.onMessage.addListener(function (
      request,
      sender,
      sendResponse
    ) {
      if (request.type === "switch-camera") {
        if (request.id !== "none") {
          stopCameraStream();
          setTimeout(() => {
            getCameraStream({
              video: {
                deviceId: {
                  exact: request.id,
                },
              },
            });
          }, 2000);
        }
      } else if (request.type === "background-effects-active") {
        setBackgroundEffects(true);
      } else if (request.type === "background-effects-inactive") {
        setBackgroundEffects(false);
      } else if (request.type === "camera-only-update") {
        setWidth("auto");
        setHeight("100%");
        recordingTypeRef.current = "camera";
      } else if (request.type === "screen-update") {
        // Needs to fit 100% width and height but considering aspect ratio
        const video = videoRef.current;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        if (videoWidth > videoHeight) {
          setWidth("auto");
          setHeight("100%");
        } else {
          setWidth("100%");
          setHeight("auto");
        }

        recordingTypeRef.current = "screen";
      } else if (request.type === "toggle-pip") {
        // If picture in picture is active, close it, otherwise open it
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture();
        } else {
          try {
            videoRef.current.requestPictureInPicture().catch(() => {
              // Cancel pip mode if it fails
              setPipMode(false);
              chrome.runtime.sendMessage({ type: "pip-ended" });
            });
          } catch (error) {
            // Cancel pip mode if it fails
            setPipMode(false);
            chrome.runtime.sendMessage({ type: "pip-ended" });
          }
        }
      } else if (request.type === "set-surface") {
        if (request.surface === "monitor") {
          try {
            videoRef.current.requestPictureInPicture().catch(() => {
              // Cancel pip mode if it fails
              setPipMode(false);
              chrome.runtime.sendMessage({ type: "pip-ended" });
            });
          } catch (error) {
            // Cancel pip mode if it fails
            setPipMode(false);
            chrome.runtime.sendMessage({ type: "pip-ended" });
          }
        }
      } else if (request.type === "camera-toggled-toolbar") {
        if (request.active) {
          stopCameraStream();
          setTimeout(() => {
            getCameraStream({
              video: {
                deviceId: {
                  exact: request.id,
                },
              },
            });
          }, 2000);
          setPipMode(false);
        }
      }
    });
  }, []);

  // Check chrome local storage
  useEffect(() => {
    chrome.storage.local.get(["recordingType"], (result) => {
      if (result.recordingType === "camera") {
        recordingTypeRef.current = "camera";
      } else {
        recordingTypeRef.current = "screen";
      }
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.get(["backgroundEffectsActive"], (result) => {
      setBackgroundEffects(result.backgroundEffectsActive);
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.get(["defaultVideoInput"], (result) => {
      if (result.defaultVideoInput !== "none") {
        getCameraStream({
          video: {
            deviceId: {
              exact: result.defaultVideoInput,
            },
          },
        });
      } else {
        getCameraStream({
          video: true,
        });
      }
    });
  }, []);

  // Detect when Pip mode switches
  useEffect(() => {
    const handleEnterPip = () => {
      setPipMode(true);
      chrome.runtime.sendMessage({ type: "pip-started" });
    };
    const handleLeavePip = () => {
      setPipMode(false);
      chrome.runtime.sendMessage({ type: "pip-ended" });
    };

    videoRef.current.addEventListener("enterpictureinpicture", handleEnterPip);
    videoRef.current.addEventListener("leavepictureinpicture", handleLeavePip);

    return () => {
      videoRef.current.removeEventListener(
        "enterpictureinpicture",
        handleEnterPip
      );
      videoRef.current.removeEventListener(
        "leavepictureinpicture",
        handleLeavePip
      );
    };
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      {backgroundEffects && <Background frame={imageDataState} />}
      <video
        style={{
          height: height,
          width: width,
          position: "absolute",
          top: "50%",
          left: "50%",
          right: 0,
          transform: "translateY(-50%) translateX(-50%)",
          margin: "auto",
          zIndex: 99,
          display: !backgroundEffects ? "block" : "none",
        }}
        ref={videoRef}
      ></video>
      {recordingTypeRef.current != "camera" && (
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#CBD0D8",
            zIndex: 9,
            position: "absolute",
            top: "0px",
            left: "0px",
            margin: "auto",
            display: "flex",
            alignContent: "center",
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
            top: "0px",
            left: "0px",
            margin: "auto",
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

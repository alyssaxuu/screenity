import React, { useRef, useEffect, useState } from "react";
import { useCameraContext } from "../context/CameraContext";
import { resizeCanvases } from "../utils/canvasUtils";
import {
  segmentFromVideo,
  renderBlurFromVideo,
  renderPersonCutoutFromVideo,
  renderEffectBackground,
} from "../utils/backgroundUtils";

const Background = () => {
  const canvasRef = useRef(null);
  const canvasContextRef = useRef(null);
  const bottomCanvasRef = useRef(null);
  const bottomCanvasContextRef = useRef(null);

  const {
    videoRef,
    backgroundEffects,
    setBackgroundEffects,
    segmenterRef,
    blurRef,
    effectRef,
  } = useCameraContext();

  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    if (!canvasRef.current || !bottomCanvasRef.current) return;

    canvasContextRef.current = canvasRef.current.getContext("2d", {
      alpha: true,
      willReadFrequently: true,
      preserveDrawingBuffer: true,
    });
    bottomCanvasContextRef.current = bottomCanvasRef.current.getContext("2d", {
      alpha: true,
      willReadFrequently: true,
      preserveDrawingBuffer: true,
    });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Re-render background image on resize or effect change
  useEffect(() => {
    if (!effectRef.current || blurRef.current) return;

    if (
      bottomCanvasRef.current &&
      bottomCanvasContextRef.current &&
      canvasRef.current
    ) {
      renderEffectBackground(
        effectRef.current,
        bottomCanvasRef,
        bottomCanvasContextRef,
      );

      resizeCanvases(
        effectRef.current.width,
        effectRef.current.height,
        true,
        effectRef.current,
        canvasRef,
        bottomCanvasRef,
        bottomCanvasContextRef,
      );
    }
  }, [windowSize, effectRef.current, blurRef.current]);

  // Self-contained render loop — segments video directly, no React state per frame
  useEffect(() => {
    if (!backgroundEffects) return;

    let animFrameId;
    let running = true;
    let consecutiveErrors = 0;

    const tick = () => {
      if (!running) return;

      try {
        const video = videoRef.current;
        const segmenter = segmenterRef.current;

        if (video && video.readyState >= 2 && segmenter && video.videoWidth > 0) {
          const result = segmentFromVideo(video, segmenter);

          if (result && result.categoryMask) {
            consecutiveErrors = 0;
            if (blurRef.current) {
              renderBlurFromVideo(video, result, canvasRef);
            } else if (effectRef.current) {
              renderEffectBackground(
                effectRef.current,
                bottomCanvasRef,
                bottomCanvasContextRef,
              );
              renderPersonCutoutFromVideo(
                video,
                result,
                canvasRef,
                canvasContextRef,
              );
            }
          }
        }
      } catch (error) {
        consecutiveErrors++;
        console.error("Background segmentation error:", error);
        if (consecutiveErrors >= 3) {
          console.warn("Disabling background effects after repeated failures");
          setBackgroundEffects(false);
          return;
        }
      }

      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameId);
    };
  }, [backgroundEffects]);

  // Listen for Chrome extension messages
  useEffect(() => {
    const handleMessage = (request) => {
      if (request.type === "set-background-effect") {
        if (globalThis.SCREENITY_VERBOSE_LOGS) {
          console.log("Background component received effect change message");
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        zIndex: 99999,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <canvas
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "100%",
            height: "100%",
            zIndex: 999999,
            opacity: backgroundEffects ? 1 : 0,
            backgroundColor: "transparent",
          }}
          ref={canvasRef}
        ></canvas>

        <canvas
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "100%",
            height: "100%",
            zIndex: 999998,
            opacity: backgroundEffects && !blurRef.current ? 1 : 0,
            backgroundColor: "transparent",
          }}
          ref={bottomCanvasRef}
        ></canvas>
      </div>
    </div>
  );
};

export default Background;

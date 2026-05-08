import React, { useRef, useEffect, useState } from "react";
import { useCameraContext } from "../context/CameraContext";
import { resizeCanvases } from "../utils/canvasUtils";
import {
  segmentFromVideo,
  renderBlurFromVideo,
  renderPersonCutoutFromVideo,
  renderEffectBackground,
  loadSegmentationModel,
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

  useEffect(() => {
    if (!backgroundEffects) return;

    let animFrameId;
    let running = true;
    let consecutiveErrors = 0;
    let lastSuccessAt = Date.now();
    let recreatingSegmenter = false;

    // Watchdog: if the segmenter goes silent (returns null masks for
    // 5s+ while video is delivering frames), the GPU context likely
    // crashed or the segmenter is wedged. Recreate it once. Without
    // this the user's blur/effect freezes mid-recording with no error
    // and no recovery.
    const STALE_MASK_THRESHOLD_MS = 5000;
    const recreateSegmenter = async () => {
      if (recreatingSegmenter) return;
      recreatingSegmenter = true;
      try {
        chrome.runtime.sendMessage({
          type: "diag-forward",
          event: "recorder-segmenter-recreate-attempt",
          data: { msSinceLastSuccess: Date.now() - lastSuccessAt },
        });
      } catch {}
      try {
        try { segmenterRef.current?.close?.(); } catch {}
        const fresh = await loadSegmentationModel();
        if (fresh && running) {
          segmenterRef.current = fresh;
          lastSuccessAt = Date.now();
          consecutiveErrors = 0;
          try {
            chrome.runtime.sendMessage({
              type: "diag-forward",
              event: "recorder-segmenter-recreate-ok",
            });
          } catch {}
        } else if (running) {
          // Recreate failed; disable effects so the camera feed isn't frozen.
          console.warn(
            "[Screenity] Segmenter recreate failed; disabling background effects",
          );
          try {
            chrome.runtime.sendMessage({
              type: "diag-forward",
              event: "recorder-segmenter-recreate-failed",
            });
          } catch {}
          setBackgroundEffects(false);
        }
      } finally {
        recreatingSegmenter = false;
      }
    };

    const tick = () => {
      if (!running) return;

      try {
        const video = videoRef.current;
        const segmenter = segmenterRef.current;

        if (video && video.readyState >= 2 && segmenter && video.videoWidth > 0) {
          const result = segmentFromVideo(video, segmenter);

          if (result && result.categoryMask) {
            consecutiveErrors = 0;
            lastSuccessAt = Date.now();
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
          } else if (
            Date.now() - lastSuccessAt > STALE_MASK_THRESHOLD_MS &&
            !recreatingSegmenter
          ) {
            // Video frames flowing but segmenter silent: GPU context loss.
            recreateSegmenter();
          }
        }
      } catch (error) {
        consecutiveErrors++;
        console.error("Background segmentation error:", error);
        if (consecutiveErrors >= 3) {
          console.warn("Disabling background effects after repeated failures");
          try {
            chrome.runtime.sendMessage({
              type: "diag-forward",
              event: "recorder-segmenter-disabled-after-errors",
              data: { error: String(error?.message || error).slice(0, 200) },
            });
          } catch {}
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

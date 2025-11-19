import React, { useRef, useEffect, useState } from "react";
import { useCameraContext } from "../context/CameraContext";
import { setupCanvasContexts, resizeCanvases } from "../utils/canvasUtils";
import * as bodySegmentation from "@tensorflow-models/body-segmentation";
import {
  renderEffect,
  renderBlur,
  renderEffectBackground,
} from "../utils/backgroundUtils";

const Background = () => {
  const canvasRef = useRef(null);
  const canvasContextRef = useRef(null);
  const bottomCanvasRef = useRef(null);
  const bottomCanvasContextRef = useRef(null);

  const {
    currentFrame,
    backgroundEffects,
    segmenterRef,
    blurRef,
    effectRef,
    offScreenCanvasRef,
    offScreenCanvasContextRef,
  } = useCameraContext();

  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    if (!canvasRef.current || !bottomCanvasRef.current) return;

    const canvasContext = canvasRef.current.getContext("2d", {
      alpha: true,
      willReadFrequently: true,
      preserveDrawingBuffer: true,
    });
    const bottomCanvasContext = bottomCanvasRef.current.getContext("2d", {
      alpha: true,
      willReadFrequently: true,
      preserveDrawingBuffer: true,
    });

    canvasContextRef.current = canvasContext;
    bottomCanvasContextRef.current = bottomCanvasContext;
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

    const loadAndRenderBackground = async (): Promise<any> => {
      if (
        bottomCanvasRef.current &&
        bottomCanvasContextRef.current &&
        canvasRef.current
      ) {
        renderEffectBackground(
          effectRef.current,
          bottomCanvasRef,
          bottomCanvasContextRef
        );

        resizeCanvases(
          effectRef.current.width,
          effectRef.current.height,
          true, // isBackgroundEffect
          effectRef.current,
          canvasRef,
          bottomCanvasRef,
          bottomCanvasContextRef
        );
      }
    };

    loadAndRenderBackground();
  }, [windowSize, effectRef.current, blurRef.current]);

  // Process new frame when it arrives
  useEffect(() => {
    if (!currentFrame || !canvasContextRef.current) return;

    const processFrame = async (): Promise<any> => {
      const canvas = canvasRef.current;
      const ctx = canvasContextRef.current;

      // Ensure canvas dimensions match the frame
      if (
        canvas.width !== currentFrame.width ||
        canvas.height !== currentFrame.height
      ) {
        canvas.width = currentFrame.width;
        canvas.height = currentFrame.height;
      }

      if (backgroundEffects && segmenterRef.current) {
        try {
          const people = await segmenterRef.current.segmentPeople(currentFrame);

          if (people && people.length > 0) {
            if (blurRef.current) {
              await renderBlur(currentFrame, people[0], canvasRef);
            } else if (effectRef.current) {
              if (effectRef.current) {
                renderEffectBackground(
                  effectRef.current,
                  bottomCanvasRef,
                  bottomCanvasContextRef
                );
              }

              // Create a binary mask for the person
              const personMask = await bodySegmentation.toBinaryMask(
                people[0],
                { r: 255, g: 255, b: 255, a: 255 }, // White for the person
                { r: 0, g: 0, b: 0, a: 0 }, // Transparent for background
                false,
                0.6
              );

              // Start with a clear canvas
              ctx.clearRect(0, 0, canvas.width, canvas.height);

              // Create an RGBA image data with transparency
              const imageData = ctx.createImageData(
                canvas.width,
                canvas.height
              );

              // Copy RGB from current frame and use mask for alpha
              for (let i = 0; i < currentFrame.data.length; i += 4) {
                const maskPixel = personMask.data[i]; // Get mask value
                imageData.data[i] = currentFrame.data[i]; // R
                imageData.data[i + 1] = currentFrame.data[i + 1]; // G
                imageData.data[i + 2] = currentFrame.data[i + 2]; // B
                imageData.data[i + 3] = maskPixel ? 255 : 0; // A (fully opaque for person, transparent for background)
              }

              // Put the processed image data on the canvas
              ctx.putImageData(imageData, 0, 0);
            }
          } else {
            ctx.putImageData(currentFrame, 0, 0);
          }
        } catch (error) {
          console.error("Error processing frame:", error);
          ctx.putImageData(currentFrame, 0, 0);
        }
      } else {
        // If no background effects enabled, just show the original frame
        ctx.putImageData(currentFrame, 0, 0);
      }
    };

    processFrame().catch(console.error);
  }, [currentFrame, backgroundEffects, blurRef.current, effectRef.current]);

  // Listen for Chrome extension messages
  useEffect(() => {
    const handleMessage = (request: any) => {
      if (request.type === "set-background-effect") {
        // The actual handling is now in message handlers, this just forces a re-render
        console.log("Background component received effect change message");
      }
    };

    // Add event listener
    chrome.runtime.onMessage.addListener(handleMessage);

    // Remove event listener on cleanup
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

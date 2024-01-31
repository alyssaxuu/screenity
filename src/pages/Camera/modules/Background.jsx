// first, import all you need
import React, { useRef, useEffect, useCallback, useState } from "react";

import * as bodySegmentation from "@tensorflow-models/body-segmentation";
import "@tensorflow/tfjs-core";
// Register WebGL backend.
//import "@tensorflow/tfjs-backend-webgl";
import "@mediapipe/selfie_segmentation";

const Background = (props) => {
  // Canvases
  const offScreenCanvasRef = useRef(null);
  const offScreenCanvasContextRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasContextRef = useRef(null);
  const bottomCanvasRef = useRef(null);
  const bottomCanvasContextRef = useRef(null);

  const segmenterRef = useRef(null);

  // Variables to track frame rendering
  const latestImageDataRef = useRef(null);
  const frameRequestedRef = useRef(false);
  const blurRef = useRef(false);
  const effectRef = useRef(null);

  useEffect(() => {
    // Offscreen canvas
    offScreenCanvasRef.current = document.createElement("canvas");
    offScreenCanvasContextRef.current = offScreenCanvasRef.current.getContext(
      "2d",
      { willReadFrequently: true }
    );

    // Canvas
    canvasContextRef.current = canvasRef.current.getContext("2d", {
      willReadFrequently: true,
    });

    // Bottom canvas
    bottomCanvasContextRef.current = bottomCanvasRef.current.getContext("2d", {
      willReadFrequently: true,
    });
  }, []);

  // Track window size
  const [windowSize, setWindowSize] = useState({
    width: innerWidth,
    height: innerHeight,
  });

  // Check if window size has changed, if so re-render Effect canvas
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: innerWidth,
        height: innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    chrome.storage.local.get(["backgroundEffect"], (result) => {
      if (result.backgroundEffect != "blur") {
        blurRef.current = false;
        loadEffect(result.backgroundEffect);
      } else {
        blurRef.current = true;
      }
    });
  }, []);

  useEffect(() => {
    // Event listener (extension messaging)
    chrome.runtime.onMessage.addListener(function (
      request,
      sender,
      sendResponse
    ) {
      if (request.type === "set-background-effect") {
        if (request.effect === "blur") {
          blurRef.current = true;
          effectRef.current = null;
        } else if (request.effect != "") {
          blurRef.current = false;
          loadEffect(request.effect);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (blurRef.current) return;
    if (!effectRef.current) return;
    if (!bottomCanvasRef.current) return;

    renderEffectBackground();
  }, [windowSize]);

  const renderEffectBackground = () => {
    bottomCanvasRef.current.width = innerWidth;
    bottomCanvasRef.current.height = innerHeight;
    bottomCanvasContextRef.current.drawImage(
      effectRef.current,
      0,
      0,
      effectRef.current.width,
      effectRef.current.height,
      0,
      0,
      innerWidth,
      innerHeight
    );
  };

  const loadEffect = (effect) => {
    const img = new Image();
    img.src = effect;
    img.onload = () => {
      effectRef.current = img;
      renderEffectBackground();
    };
  };

  useEffect(() => {
    loadModel();
  }, []);

  const loadModel = async () => {
    const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
    const segmenterConfig = {
      runtime: "mediapipe",
      solutionPath: "./assets/selfieSegmentation",
      modelType: "general",
    };
    segmenterRef.current = await bodySegmentation.createSegmenter(
      model,
      segmenterConfig
    );
  };

  useEffect(() => {
    if (props.frame === null) return;

    latestImageDataRef.current = props.frame;
    requestFrameRender();
  }, [props.frame]);

  // Function to handle rendering updates using requestAnimationFrame
  const requestFrameRender = useCallback(() => {
    if (!frameRequestedRef.current) {
      frameRequestedRef.current = true;
      requestAnimationFrame(() => {
        frameRequestedRef.current = false;
        renderFrame();
      });
    }
  }, [frameRequestedRef.current]);

  // Function to handle frame rendering
  const renderFrame = async () => {
    try {
      if (!latestImageDataRef.current) return; // No new frame to render
      if (!segmenterRef.current) return; // Model not loaded yet

      segmentPerson(latestImageDataRef.current);
    } catch (error) {
      console.error(error);
    }
  };

  const segmentPerson = async (img) => {
    try {
      if (!blurRef.current && !effectRef.current) return;
      if (!latestImageDataRef.current) return;
      if (!segmenterRef.current) return; // Model not loaded yet

      const people = await segmenterRef.current.segmentPeople(img);
      if (people.length === 0) return; // No people in the frame

      const width = people[0].mask.mask.width;
      const height = people[0].mask.mask.height;

      if (blurRef.current) {
        renderBlur(img, people);
      } else {
        renderEffect(img, people, width, height);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const renderBlur = async (img, people) => {
    try {
      const backgroundBlurAmount = 16;
      const edgeBlurAmount = 10;
      const flipHorizontal = false;
      const foregroundThresholdProbability = 0.6;

      const ratio = img.width / img.height;
      canvasRef.current.width = innerHeight * ratio;
      canvasRef.current.height = innerHeight;
      await bodySegmentation.drawBokehEffect(
        canvasRef.current,
        img,
        people,
        foregroundThresholdProbability,
        backgroundBlurAmount,
        edgeBlurAmount,
        flipHorizontal
      );

      // Prevent redundant rendering
      latestImageDataRef.current = null;
    } catch (error) {
      console.error(error);
    }
  };

  const renderEffect = async (img, people, width, height) => {
    try {
      const ratio = img.width / img.height;
      // Render new image data
      const foregroundColor = { r: 0, g: 0, b: 0, a: 0 };
      const backgroundColor = { r: 0, g: 0, b: 0, a: 255 };
      const drawContour = false;
      const foregroundThresholdProbability = 0.7;
      const backgroundDarkeningMask = await bodySegmentation.toBinaryMask(
        people,
        foregroundColor,
        backgroundColor,
        drawContour,
        foregroundThresholdProbability
      );

      const maskImg = new Image();
      maskImg.src = getImageURL(backgroundDarkeningMask);

      maskImg.onload = async () => {
        const opacity = 0;
        const edgeBlurAmount = 10; // Number of pixels to blur between person and background

        canvasRef.current.width = innerHeight * ratio;
        canvasRef.current.height = innerHeight;

        // Render in canvas
        await bodySegmentation.drawMask(
          offScreenCanvasRef.current,
          img,
          backgroundDarkeningMask,
          opacity,
          edgeBlurAmount
        );

        offScreenCanvasContextRef.current.save();
        offScreenCanvasContextRef.current.globalCompositeOperation =
          "destination-out";

        offScreenCanvasContextRef.current.drawImage(
          maskImg,
          0,
          0,
          offScreenCanvasRef.current.width,
          offScreenCanvasRef.current.height
        );
        offScreenCanvasContextRef.current.restore();

        // Set canvas size
        canvasRef.current.width = innerHeight * ratio;
        canvasRef.current.height = innerHeight;

        // Render offscreen canvas to canvas
        canvasContextRef.current.drawImage(
          offScreenCanvasRef.current,
          0,
          0,
          offScreenCanvasRef.current.width,
          offScreenCanvasRef.current.height,
          0,
          0,
          canvasRef.current.width,
          canvasRef.current.height
        );

        // Prevent redundant rendering
        latestImageDataRef.current = null;
      };
    } catch (error) {
      console.error(error);
    }
  };

  const getImageURL = (imageData) => {
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const context = canvas.getContext("2d");
    context.putImageData(imageData, 0, 0);
    const dataURL = canvas.toDataURL();
    return dataURL;
  };

  return (
    <div
      style={{
        zIndex: 99999,
        top: "0px",
        left: "0px",
        height: "100%",
        width: "100%",
        position: "absolute",
        overflow: "hidden",
      }}
    >
      <div>
        <div>
          <canvas
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              height: "100%",
              zIndex: 999999,
              transform: "translate(-50%, -50%)",
            }}
            ref={canvasRef}
          ></canvas>
          <canvas
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              height: "100%",
              transform: "translate(-50%, -50%)",
            }}
            ref={bottomCanvasRef}
          ></canvas>
        </div>
      </div>
    </div>
  );
};

export default Background;

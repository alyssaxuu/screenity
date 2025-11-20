import React, { useRef, useEffect, useCallback, useState } from "react";

import * as bodySegmentation from "@tensorflow-models/body-segmentation";
import "@tensorflow/tfjs-core";
// Register WebGL backend.
//import "@tensorflow/tfjs-backend-webgl";
import "@mediapipe/selfie_segmentation";

interface BackgroundProps {
  [key: string]: unknown;
}

const Background = (props: BackgroundProps) => {
  const offScreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offScreenCanvasContextRef = useRef<CanvasRenderingContext2D | null>(
    null
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const bottomCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bottomCanvasContextRef = useRef<CanvasRenderingContext2D | null>(null);

  const segmenterRef = useRef<any>(null);

  const latestImageDataRef = useRef<ImageData | null>(null);
  const frameRequestedRef = useRef(false);
  const blurRef = useRef<boolean>(false);
  const effectRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    offScreenCanvasRef.current = document.createElement("canvas");
    const offCtx = offScreenCanvasRef.current.getContext("2d", {
      willReadFrequently: true,
    });
    if (offCtx) {
      offScreenCanvasContextRef.current = offCtx;
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d", {
        willReadFrequently: true,
      });
      if (ctx) {
        canvasContextRef.current = ctx;
      }
    }

    if (bottomCanvasRef.current) {
      const bottomCtx = bottomCanvasRef.current.getContext("2d", {
        willReadFrequently: true,
      });
      if (bottomCtx) {
        bottomCanvasContextRef.current = bottomCtx;
      }
    }
  }, []);

  const [windowSize, setWindowSize] = useState({
    width: innerWidth,
    height: innerHeight,
  });

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

  const renderEffectBackground = (): void => {
    const bottomCanvas = bottomCanvasRef.current;
    const bottomCtx = bottomCanvasContextRef.current;
    const effect = effectRef.current;
    
    if (!bottomCanvas || !bottomCtx || !effect) return;
    
    bottomCanvas.width = innerWidth;
    bottomCanvas.height = innerHeight;
    bottomCtx.drawImage(
      effect,
      0,
      0,
      effect.width,
      effect.height,
      0,
      0,
      innerWidth,
      innerHeight
    );
  };

  const loadEffect = (effect: string): void => {
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

  const loadModel = async (): Promise<void> => {
    const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
    const segmenterConfig: bodySegmentation.MediaPipeSelfieSegmentationMediaPipeModelConfig = {
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

    latestImageDataRef.current = props.frame as ImageData | null;
    requestFrameRender();
  }, [props.frame]);

  const requestFrameRender = useCallback(() => {
    if (!frameRequestedRef.current) {
      frameRequestedRef.current = true;
      requestAnimationFrame(() => {
        frameRequestedRef.current = false;
        renderFrame();
      });
    }
  }, [frameRequestedRef.current]);

  const renderFrame = async () => {
    try {
      if (!latestImageDataRef.current) return;
      if (!segmenterRef.current) return;

      segmentPerson(latestImageDataRef.current);
    } catch (error) {
      console.error(error);
    }
  };

  const segmentPerson = async (img: ImageData): Promise<void> => {
    try {
      if (!blurRef.current && !effectRef.current) return;
      if (!latestImageDataRef.current) return;
      if (!segmenterRef.current) return;

      const people = await segmenterRef.current.segmentPeople(img);
      if (people.length === 0) return;

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

  const renderBlur = async (img: ImageData, people: any[]): Promise<void> => {
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

      latestImageDataRef.current = null;
    } catch (error) {
      console.error(error);
    }
  };

  const renderEffect = async (img: ImageData, people: any[], width: number, height: number): Promise<void> => {
    try {
      const ratio = img.width / img.height;
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
        const edgeBlurAmount = 10;

        canvasRef.current.width = innerHeight * ratio;
        canvasRef.current.height = innerHeight;

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

        canvasRef.current.width = innerHeight * ratio;
        canvasRef.current.height = innerHeight;

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

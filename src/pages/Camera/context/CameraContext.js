import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import {
  loadSegmentationModel,
  loadEffect,
  renderEffectBackground,
} from "../utils/backgroundUtils";
import { initializeCanvases, setupCanvasContexts } from "../utils/canvasUtils";

const CameraContext = createContext();

export const globalRefs = {
  videoRef: null,
  streamRef: null,
  recordingTypeRef: null,
  offScreenCanvasRef: null,
  offScreenCanvasContextRef: null,
  segmenterRef: null,
  blurRef: null,
  effectRef: null,
  setWidth: null,
  setHeight: null,
  setBackgroundEffects: null,
  backgroundEffectsRef: null,
  width: null,
  height: null,
};

export const useCameraContext = () => useContext(CameraContext);

export const getContextRefs = () => {
  const missingRefs = [];

  if (!globalRefs.videoRef) missingRefs.push("videoRef");
  if (!globalRefs.streamRef) missingRefs.push("streamRef");
  if (!globalRefs.recordingTypeRef) missingRefs.push("recordingTypeRef");
  if (!globalRefs.offScreenCanvasRef) missingRefs.push("offScreenCanvasRef");
  if (!globalRefs.offScreenCanvasContextRef)
    missingRefs.push("offScreenCanvasContextRef");
  if (!globalRefs.segmenterRef) missingRefs.push("segmenterRef");
  if (!globalRefs.blurRef) missingRefs.push("blurRef");
  if (!globalRefs.effectRef) missingRefs.push("effectRef");
  if (!globalRefs.setWidth) missingRefs.push("setWidth");
  if (!globalRefs.setHeight) missingRefs.push("setHeight");
  if (!globalRefs.setBackgroundEffects)
    missingRefs.push("setBackgroundEffects");
  if (!globalRefs.backgroundEffectsRef)
    missingRefs.push("backgroundEffectsRef");

  if (missingRefs.length > 0) {
    console.warn(
      `⚠️ Some context references are not initialized yet: ${missingRefs.join(
        ", "
      )}`
    );
  }

  return {
    videoRef: globalRefs.videoRef ?? { current: null },
    streamRef: globalRefs.streamRef ?? { current: new MediaStream() },
    recordingTypeRef: globalRefs.recordingTypeRef ?? { current: "screen" },
    offScreenCanvasRef: globalRefs.offScreenCanvasRef ?? { current: null },
    offScreenCanvasContextRef: globalRefs.offScreenCanvasContextRef ?? {
      current: null,
    },
    segmenterRef: globalRefs.segmenterRef ?? { current: null },
    blurRef: globalRefs.blurRef ?? { current: false },
    effectRef: globalRefs.effectRef ?? { current: null },
    setWidth:
      globalRefs.setWidth ??
      ((width) => console.warn("⚠️ setWidth not initialized")),
    setHeight:
      globalRefs.setHeight ??
      ((height) => console.warn("⚠️ setHeight not initialized")),
    setBackgroundEffects: globalRefs.setBackgroundEffects ?? (() => {}),
    backgroundEffectsRef: globalRefs.backgroundEffectsRef ?? { current: false },
  };
};

export const CameraProvider = ({ children }) => {
  const [width, setWidth] = useState("auto");
  const [height, setHeight] = useState("100%");
  const [backgroundEffects, setBackgroundEffects] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [pipMode, setPipMode] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(null);
  const [isCameraMode, setIsCameraMode] = useState(false);

  const backgroundEffectsRef = useRef(false);
  const recordingTypeRef = useRef("screen");
  const videoRef = useRef(null);
  const streamRef = useRef(new MediaStream());
  const frameRequestedRef = useRef(false);

  const offScreenCanvasRef = useRef(null);
  const offScreenCanvasContextRef = useRef(null);

  const segmenterRef = useRef(null);
  const blurRef = useRef(false);
  const effectRef = useRef(null);

  useEffect(() => {
    const { offScreenCanvas, offScreenCanvasContext } = initializeCanvases();

    offScreenCanvasRef.current = offScreenCanvas;
    offScreenCanvasContextRef.current = offScreenCanvasContext;

    globalRefs.videoRef = videoRef;
    globalRefs.streamRef = streamRef;
    globalRefs.recordingTypeRef = recordingTypeRef;
    globalRefs.offScreenCanvasRef = offScreenCanvasRef;
    globalRefs.offScreenCanvasContextRef = offScreenCanvasContextRef;
    globalRefs.segmenterRef = segmenterRef;
    globalRefs.blurRef = blurRef;
    globalRefs.effectRef = effectRef;
    globalRefs.setWidth = handleSetWidth;
    globalRefs.setHeight = handleSetHeight;
    globalRefs.setBackgroundEffects = handleSetBackgroundEffects;
    globalRefs.backgroundEffectsRef = backgroundEffectsRef;

    const initializeModel = async () => {
      try {
        const model = await loadSegmentationModel();
        segmenterRef.current = model;
        setIsModelLoaded(true);
      } catch (error) {
        console.error("Failed to load segmentation model:", error);
      }
    };

    initializeModel();

    chrome.storage.local.get(["backgroundEffect"], (result) => {
      if (result.backgroundEffect === "blur") {
        blurRef.current = true;
      } else if (result.backgroundEffect) {
        blurRef.current = false;
        loadCustomEffect(result.backgroundEffect);
      }
    });

    return () => {
      segmenterRef.current = null;
      setIsModelLoaded(false);
    };
  }, []);

  useEffect(() => {
    backgroundEffectsRef.current = backgroundEffects;
  }, [backgroundEffects]);

  const handleSetBackgroundEffects = useCallback(
    (active) => {
      setBackgroundEffects(active);
      backgroundEffectsRef.current = active;
      if (videoRef.current) {
        videoRef.current.style.display = !active ? "block" : "none";
      }
      chrome.storage.local.set({ backgroundEffectsActive: active });
    },
    [videoRef]
  );

  const handleSetWidth = useCallback(
    (newWidth) => {
      setWidth(newWidth);
      if (videoRef.current) {
        videoRef.current.style.width = newWidth;
      }
    },
    [videoRef]
  );

  const handleSetHeight = useCallback(
    (newHeight) => {
      setHeight(newHeight);
      if (videoRef.current) {
        videoRef.current.style.height = newHeight;
      }
    },
    [videoRef]
  );

  const captureFrame = useCallback(() => {
    if (
      !videoRef.current ||
      !offScreenCanvasRef.current ||
      frameRequestedRef.current
    ) {
      return;
    }

    frameRequestedRef.current = true;

    if (backgroundEffectsRef.current && videoRef.current.readyState === 4) {
      const video = videoRef.current;
      const canvas = offScreenCanvasRef.current;
      const ctx = offScreenCanvasContextRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.drawImage(video, 0, 0);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (segmenterRef.current) {
        segmenterRef.current.segmentPeople(frame).then((segmentation) => {
          if (blurRef.current) {
            renderEffectBackground(canvas, ctx, frame, segmentation, "blur");
          } else if (effectRef.current) {
            renderEffectBackground(
              canvas,
              ctx,
              frame,
              segmentation,
              "custom",
              effectRef.current
            );
          }

          setCurrentFrame(frame);
          frameRequestedRef.current = false;
        });
      }
    } else {
      frameRequestedRef.current = false;
    }

    requestAnimationFrame(captureFrame);
  }, []);

  useEffect(() => {
    if (backgroundEffects) {
      requestAnimationFrame(captureFrame);
    }

    return () => {
      if (frameRequestedRef.current) {
        frameRequestedRef.current = false;
      }
    };
  }, [backgroundEffects, captureFrame]);

  const loadCustomEffect = async (effectUrl) => {
    try {
      if (!effectUrl) {
        effectRef.current = null;
        return;
      }

      const image = await loadEffect(effectUrl);
      effectRef.current = image;

      return true;
    } catch (error) {
      console.error("Failed to load custom effect:", error);
      return false;
    }
  };

  const enableBlur = (enabled) => {
    blurRef.current = enabled;

    chrome.storage.local.set({ backgroundEffect: enabled ? "blur" : "" });

    return enabled;
  };

  const setCustomEffect = async (effectUrl) => {
    try {
      const success = await loadCustomEffect(effectUrl);

      if (success) {
        blurRef.current = false;

        chrome.storage.local.set({ backgroundEffect: effectUrl });

        return true;
      }

      return false;
    } catch (error) {
      console.error("Error setting custom effect:", error);
      return false;
    }
  };

  const clearEffect = () => {
    blurRef.current = false;
    effectRef.current = null;

    chrome.storage.local.set({ backgroundEffect: "" });

    return true;
  };

  const contextValue = {
    width,
    height,
    backgroundEffects,
    isModelLoaded,
    pipMode,
    currentFrame,
    isCameraMode,
    videoRef,
    streamRef,
    recordingTypeRef,
    offScreenCanvasRef,
    offScreenCanvasContextRef,
    segmenterRef,
    blurRef,
    effectRef,
    setWidth: handleSetWidth,
    setHeight: handleSetHeight,
    setBackgroundEffects: handleSetBackgroundEffects,
    setPipMode,
    setIsCameraMode,
    loadCustomEffect,
    enableBlur,
    setCustomEffect,
    clearEffect,
    captureFrame,
  };

  return (
    <CameraContext.Provider value={contextValue}>
      {children}
    </CameraContext.Provider>
  );
};

export default CameraProvider;

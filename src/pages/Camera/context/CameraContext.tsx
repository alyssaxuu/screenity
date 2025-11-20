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
  renderBlur,
  renderEffect,
} from "../utils/backgroundUtils";
import { initializeCanvases, setupCanvasContexts } from "../utils/canvasUtils";

interface CameraContextType {
  width: string;
  height: string;
  backgroundEffects: boolean;
  isModelLoaded: boolean;
  pipMode: boolean;
  currentFrame: ImageData | null;
  isCameraMode: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  streamRef: React.RefObject<MediaStream>;
  recordingTypeRef: React.RefObject<string>;
  offScreenCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  offScreenCanvasContextRef: React.RefObject<CanvasRenderingContext2D | null>;
  segmenterRef: React.RefObject<any>;
  blurRef: React.RefObject<boolean>;
  effectRef: React.RefObject<HTMLImageElement | null>;
  setWidth: (newWidth: string) => void;
  setHeight: (newHeight: string) => void;
  setBackgroundEffects: (active: boolean) => void;
  setPipMode: (active: boolean) => void;
  setIsCameraMode: (active: boolean) => void;
  loadCustomEffect: (effectUrl: string) => Promise<boolean>;
  enableBlur: (enabled: boolean) => boolean;
  setCustomEffect: (effectUrl: string) => Promise<boolean>;
  clearEffect: () => boolean;
  captureFrame: () => void;
  imageDataState: ImageData | null;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export const globalRefs: {
  videoRef: React.RefObject<HTMLVideoElement> | null;
  streamRef: React.RefObject<MediaStream> | null;
  recordingTypeRef: React.RefObject<string> | null;
  offScreenCanvasRef: React.RefObject<HTMLCanvasElement | null> | null;
  offScreenCanvasContextRef: React.RefObject<CanvasRenderingContext2D | null> | null;
  segmenterRef: React.RefObject<any> | null;
  blurRef: React.RefObject<boolean> | null;
  effectRef: React.RefObject<HTMLImageElement | null> | null;
  setWidth: ((newWidth: string) => void) | null;
  setHeight: ((newHeight: string) => void) | null;
  setBackgroundEffects: ((active: boolean) => void) | null;
  backgroundEffectsRef: React.RefObject<boolean> | null;
  setIsCameraMode: ((active: boolean) => void) | null;
  width: string | null;
  height: string | null;
} = {
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
  setIsCameraMode: null,
  width: null,
  height: null,
};

export const useCameraContext = (): CameraContextType => {
  const context = useContext(CameraContext);
  if (!context) {
    throw new Error("useCameraContext must be used within CameraProvider");
  }
  return context;
};

export const getContextRefs = () => {
  const missingRefs: string[] = [];

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

  // Create mutable refs for fallback cases using React.MutableRefObject pattern
  const createMutableRef = <T,>(value: T): React.MutableRefObject<T> => {
    return { current: value } as React.MutableRefObject<T>;
  };

  return {
    videoRef: (globalRefs.videoRef ??
      createMutableRef<HTMLVideoElement | null>(
        null
      )) as React.MutableRefObject<HTMLVideoElement | null>,
    streamRef: (globalRefs.streamRef ??
      createMutableRef<MediaStream>(
        new MediaStream()
      )) as React.MutableRefObject<MediaStream>,
    recordingTypeRef: (globalRefs.recordingTypeRef ??
      createMutableRef<string>("screen")) as React.MutableRefObject<string>,
    offScreenCanvasRef: (globalRefs.offScreenCanvasRef ??
      createMutableRef<HTMLCanvasElement | null>(
        null
      )) as React.MutableRefObject<HTMLCanvasElement | null>,
    offScreenCanvasContextRef: (globalRefs.offScreenCanvasContextRef ??
      createMutableRef<CanvasRenderingContext2D | null>(
        null
      )) as React.MutableRefObject<CanvasRenderingContext2D | null>,
    segmenterRef: (globalRefs.segmenterRef ??
      createMutableRef<any>(null)) as React.MutableRefObject<any>,
    blurRef: (globalRefs.blurRef ??
      createMutableRef<boolean>(false)) as React.MutableRefObject<boolean>,
    effectRef: (globalRefs.effectRef ??
      createMutableRef<HTMLImageElement | null>(
        null
      )) as React.MutableRefObject<HTMLImageElement | null>,
    setWidth:
      globalRefs.setWidth ??
      ((width: string) => console.warn("⚠️ setWidth not initialized")),
    setHeight:
      globalRefs.setHeight ??
      ((height: string) => console.warn("⚠️ setHeight not initialized")),
    setBackgroundEffects: globalRefs.setBackgroundEffects ?? (() => {}),
    backgroundEffectsRef: (globalRefs.backgroundEffectsRef ??
      createMutableRef<boolean>(false)) as React.MutableRefObject<boolean>,
    setIsCameraMode: globalRefs.setIsCameraMode ?? (() => {}),
  };
};

interface CameraProviderProps {
  children: React.ReactNode;
}

export const CameraProvider = ({ children }: CameraProviderProps) => {
  const [width, setWidth] = useState<string>("auto");
  const [height, setHeight] = useState<string>("100%");
  const [backgroundEffects, setBackgroundEffects] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [pipMode, setPipMode] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<ImageData | null>(null);
  const [isCameraMode, setIsCameraMode] = useState(false);

  const backgroundEffectsRef = useRef(false);
  const recordingTypeRef = useRef<string>("screen");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream>(new MediaStream());
  const frameRequestedRef = useRef(false);

  const offScreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offScreenCanvasContextRef = useRef<CanvasRenderingContext2D | null>(
    null
  );

  const segmenterRef = useRef<any>(null);
  const blurRef = useRef<boolean>(false);
  const effectRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const { offScreenCanvas, offScreenCanvasContext } = initializeCanvases();

    offScreenCanvasRef.current = offScreenCanvas as HTMLCanvasElement | null;
    offScreenCanvasContextRef.current =
      offScreenCanvasContext as CanvasRenderingContext2D | null;

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

    const initializeModel = async (): Promise<any> => {
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
      const backgroundEffect = result.backgroundEffect as string | undefined;
      if (backgroundEffect === "blur") {
        blurRef.current = true;
      } else if (backgroundEffect) {
        blurRef.current = false;
        loadCustomEffect(backgroundEffect);
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
    (active: boolean) => {
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
    (newWidth: string) => {
      setWidth(newWidth);
      if (videoRef.current) {
        videoRef.current.style.width = newWidth;
      }
    },
    [videoRef]
  );

  const handleSetHeight = useCallback(
    (newHeight: string) => {
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
      !offScreenCanvasContextRef.current ||
      frameRequestedRef.current
    ) {
      return;
    }

    frameRequestedRef.current = true;

    if (backgroundEffectsRef.current && videoRef.current.readyState === 4) {
      const video = videoRef.current;
      const canvas = offScreenCanvasRef.current;
      const ctx = offScreenCanvasContextRef.current;

      if (!ctx) {
        frameRequestedRef.current = false;
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.drawImage(video, 0, 0);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (segmenterRef.current) {
        segmenterRef.current
          .segmentPeople(frame)
          .then(async (segmentation: any) => {
            if (blurRef.current) {
              // Use renderBlur for blur effect
              await renderBlur(frame, segmentation, { current: canvas });
            } else if (
              effectRef.current &&
              offScreenCanvasRef.current &&
              offScreenCanvasContextRef.current
            ) {
              // Use renderEffect for custom effects
              await renderEffect(
                frame,
                segmentation,
                offScreenCanvasRef,
                offScreenCanvasContextRef,
                { current: canvas },
                { current: ctx }
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

  const loadCustomEffect = async (effectUrl: string): Promise<boolean> => {
    try {
      if (!effectUrl) {
        effectRef.current = null;
        return false;
      }

      const image = await loadEffect(effectUrl);
      effectRef.current = image as HTMLImageElement | null;

      return true;
    } catch (error) {
      console.error("Failed to load custom effect:", error);
      return false;
    }
  };

  const enableBlur = (enabled: boolean): boolean => {
    blurRef.current = enabled;

    chrome.storage.local.set({ backgroundEffect: enabled ? "blur" : "" });

    return enabled;
  };

  const setCustomEffect = async (effectUrl: string): Promise<boolean> => {
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

  const contextValue: CameraContextType = {
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
    imageDataState: currentFrame,
  };

  return (
    <CameraContext.Provider value={contextValue}>
      {children}
    </CameraContext.Provider>
  );
};

export default CameraProvider;

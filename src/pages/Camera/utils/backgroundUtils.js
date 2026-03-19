import {
  FilesetResolver,
  ImageSegmenter,
} from "@mediapipe/tasks-vision";

// Pre-allocated canvases reused across frames to avoid GC pressure
let _frameCanvas = null;
let _frameCtx = null;
let _blurCanvas = null;
let _blurCtx = null;
let _maskCanvas = null;
let _maskCtx = null;
let _smoothMaskCanvas = null;
let _smoothMaskCtx = null;
let _personCanvas = null;
let _personCtx = null;

function getReusableCanvases() {
  if (!_frameCanvas) {
    _frameCanvas = document.createElement("canvas");
    _frameCtx = _frameCanvas.getContext("2d");
    _blurCanvas = document.createElement("canvas");
    _blurCtx = _blurCanvas.getContext("2d");
    _maskCanvas = document.createElement("canvas");
    _maskCtx = _maskCanvas.getContext("2d");
    _smoothMaskCanvas = document.createElement("canvas");
    _smoothMaskCtx = _smoothMaskCanvas.getContext("2d");
    _personCanvas = document.createElement("canvas");
    _personCtx = _personCanvas.getContext("2d");
  }
  return {
    frameCanvas: _frameCanvas, frameCtx: _frameCtx,
    blurCanvas: _blurCanvas, blurCtx: _blurCtx,
    maskCanvas: _maskCanvas, maskCtx: _maskCtx,
    smoothMaskCanvas: _smoothMaskCanvas, smoothMaskCtx: _smoothMaskCtx,
    personCanvas: _personCanvas, personCtx: _personCtx,
  };
}

// Pre-allocated typed array for mask ImageData, reused across frames
let _maskImageDataCache = null;
let _maskImageDataCacheSize = 0;

function getOrCreateMaskImageData(ctx, width, height) {
  const size = width * height;
  if (_maskImageDataCache && _maskImageDataCacheSize === size) {
    return _maskImageDataCache;
  }
  _maskImageDataCache = ctx.createImageData(width, height);
  _maskImageDataCacheSize = size;
  return _maskImageDataCache;
}

export const loadSegmentationModel = async () => {
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "./assets/mediapipeVision"
    );

    const segmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "./assets/mediapipeVision/selfie_segmenter.tflite",
        delegate: "GPU",
      },
      outputCategoryMask: true,
      outputConfidenceMasks: false,
      runningMode: "VIDEO",
    });

    return segmenter;
  } catch (error) {
    console.error("Error loading segmentation model:", error);
    return null;
  }
};

// Segment directly from a video element — avoids ImageData round-trips.
// The segmentForVideo callback fires synchronously, so this returns the result directly.
export const segmentFromVideo = (videoElement, segmenter) => {
  if (!videoElement || !segmenter) return null;
  if (videoElement.readyState < 2 || videoElement.videoWidth === 0) return null;

  try {
    const timestampMs = performance.now();
    let result = null;

    segmenter.segmentForVideo(videoElement, timestampMs, (r) => {
      result = r;
    });

    if (!result || !result.categoryMask) return null;
    return result;
  } catch (error) {
    console.error("Error during segmentation:", error);
    return null;
  }
};

// Build a smoothed person mask from segmentation result onto reusable canvases.
// Shared by both blur and cutout render paths.
function buildSmoothedMask(segmentationResult, edgeBlurAmount, personOpaque) {
  const mask = segmentationResult.categoryMask;
  const maskData = mask.getAsUint8Array();
  const maskW = mask.width;
  const maskH = mask.height;

  const { maskCanvas, maskCtx, smoothMaskCanvas, smoothMaskCtx } = getReusableCanvases();

  if (maskCanvas.width !== maskW || maskCanvas.height !== maskH) {
    maskCanvas.width = maskW;
    maskCanvas.height = maskH;
    smoothMaskCanvas.width = maskW;
    smoothMaskCanvas.height = maskH;
  }

  const maskImageData = getOrCreateMaskImageData(maskCtx, maskW, maskH);
  const maskPixels = maskImageData.data;

  for (let i = 0; i < maskData.length; i++) {
    const offset = i * 4;
    const isPerson = maskData[i] === 1;
    if (personOpaque) {
      // Person = opaque white, background = transparent (for blur + cutout)
      maskPixels[offset] = 255;
      maskPixels[offset + 1] = 255;
      maskPixels[offset + 2] = 255;
      maskPixels[offset + 3] = isPerson ? 255 : 0;
    } else {
      // Person = transparent, background = opaque black (for destination-out masking)
      maskPixels[offset] = 0;
      maskPixels[offset + 1] = 0;
      maskPixels[offset + 2] = 0;
      maskPixels[offset + 3] = isPerson ? 0 : 255;
    }
  }
  maskCtx.putImageData(maskImageData, 0, 0);

  smoothMaskCtx.clearRect(0, 0, maskW, maskH);
  smoothMaskCtx.filter = `blur(${edgeBlurAmount}px)`;
  smoothMaskCtx.drawImage(maskCanvas, 0, 0);
  smoothMaskCtx.filter = "none";

  return { smoothMaskCanvas, maskW, maskH };
}

// Render blur effect using the video element directly (no ImageData round-trip)
export const renderBlurFromVideo = (videoElement, segmentationResult, canvasRef) => {
  if (!videoElement || !segmentationResult || !canvasRef.current) return false;

  try {
    const backgroundBlurAmount = 16;
    const edgeBlurAmount = 8;

    const vw = videoElement.videoWidth;
    const vh = videoElement.videoHeight;

    const { frameCanvas, frameCtx, blurCanvas, blurCtx, personCanvas, personCtx } =
      getReusableCanvases();

    // Resize reusable canvases only when dimensions change
    if (frameCanvas.width !== vw || frameCanvas.height !== vh) {
      frameCanvas.width = vw;
      frameCanvas.height = vh;
      blurCanvas.width = vw;
      blurCanvas.height = vh;
    }

    // Draw original frame from video
    frameCtx.drawImage(videoElement, 0, 0);

    // Draw blurred version
    blurCtx.filter = `blur(${backgroundBlurAmount}px)`;
    blurCtx.drawImage(frameCanvas, 0, 0);
    blurCtx.filter = "none";

    // Build smoothed person mask
    const { smoothMaskCanvas, maskW, maskH } =
      buildSmoothedMask(segmentationResult, edgeBlurAmount, true);

    // Size output canvas
    const ratio = vw / vh;
    const outW = Math.round(window.innerHeight * ratio);
    const outH = window.innerHeight;

    if (canvasRef.current.width !== outW || canvasRef.current.height !== outH) {
      canvasRef.current.width = outW;
      canvasRef.current.height = outH;
    }

    if (personCanvas.width !== outW || personCanvas.height !== outH) {
      personCanvas.width = outW;
      personCanvas.height = outH;
    }

    const outputCtx = canvasRef.current.getContext("2d");

    // Base layer: blurred frame
    outputCtx.drawImage(blurCanvas, 0, 0, vw, vh, 0, 0, outW, outH);

    // Person layer: mask → source-in with sharp frame
    personCtx.clearRect(0, 0, outW, outH);
    personCtx.globalCompositeOperation = "source-over";
    personCtx.drawImage(smoothMaskCanvas, 0, 0, maskW, maskH, 0, 0, outW, outH);
    personCtx.globalCompositeOperation = "source-in";
    personCtx.drawImage(frameCanvas, 0, 0, vw, vh, 0, 0, outW, outH);

    // Composite person on top of blurred background
    outputCtx.drawImage(personCanvas, 0, 0);

    return true;
  } catch (error) {
    console.error("Error rendering blur:", error);
    return false;
  }
};

// Render person cutout (transparent background) using the video element directly
export const renderPersonCutoutFromVideo = (
  videoElement,
  segmentationResult,
  canvasRef,
  canvasContextRef,
) => {
  if (!videoElement || !segmentationResult || !canvasRef.current) return false;

  try {
    const edgeBlurAmount = 4;

    const vw = videoElement.videoWidth;
    const vh = videoElement.videoHeight;

    const { frameCanvas, frameCtx, personCanvas, personCtx } = getReusableCanvases();

    if (frameCanvas.width !== vw || frameCanvas.height !== vh) {
      frameCanvas.width = vw;
      frameCanvas.height = vh;
    }

    // Draw original frame from video
    frameCtx.drawImage(videoElement, 0, 0);

    // Build smoothed person mask
    const { smoothMaskCanvas, maskW, maskH } =
      buildSmoothedMask(segmentationResult, edgeBlurAmount, true);

    const canvas = canvasRef.current;
    const ctx = canvasContextRef.current;

    if (personCanvas.width !== canvas.width || personCanvas.height !== canvas.height) {
      personCanvas.width = canvas.width;
      personCanvas.height = canvas.height;
    }

    // Composite: mask → source-in with frame = person-only with smooth edges
    personCtx.clearRect(0, 0, canvas.width, canvas.height);
    personCtx.globalCompositeOperation = "source-over";
    personCtx.drawImage(smoothMaskCanvas, 0, 0, maskW, maskH, 0, 0, canvas.width, canvas.height);
    personCtx.globalCompositeOperation = "source-in";
    personCtx.drawImage(frameCanvas, 0, 0, vw, vh, 0, 0, canvas.width, canvas.height);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(personCanvas, 0, 0);

    return true;
  } catch (error) {
    console.error("Error rendering person cutout:", error);
    return false;
  }
};

export const loadEffect = (effectUrl) => {
  return new Promise((resolve, reject) => {
    if (!effectUrl) {
      resolve(null);
      return;
    }

    const img = new Image();
    img.src = effectUrl;
    img.onload = () => resolve(img);
    img.onerror = (error) => {
      console.error("Failed to load effect image:", error);
      reject(error);
    };
  });
};

// Render the background effect image to the bottom canvas
export const renderEffectBackground = (
  effectImg,
  bottomCanvasRef,
  bottomCanvasContextRef
) => {
  if (!effectImg || !bottomCanvasRef.current || !bottomCanvasContextRef.current)
    return false;

  try {
    const canvas = bottomCanvasRef.current;
    const ctx = bottomCanvasContextRef.current;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Calculate dimensions to cover the canvas while maintaining aspect ratio
    const imgRatio = effectImg.width / effectImg.height;
    const canvasRatio = canvas.width / canvas.height;
    let drawWidth = canvas.width;
    let drawHeight = canvas.height;

    if (canvasRatio > imgRatio) {
      drawWidth = canvas.height * imgRatio;
      drawHeight = canvas.height;
    } else {
      drawWidth = canvas.width;
      drawHeight = canvas.width / imgRatio;
    }

    const x = (canvas.width - drawWidth) / 2;
    const y = (canvas.height - drawHeight) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(effectImg, x, y, drawWidth, drawHeight);

    return true;
  } catch (error) {
    console.error("Error rendering effect background:", error);
    return false;
  }
};

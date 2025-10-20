export const initializeCanvases = () => {
  const offScreenCanvas = document.createElement("canvas");
  const offScreenCanvasContext = offScreenCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  return {
    offScreenCanvas,
    offScreenCanvasContext,
  };
};

export const setupCanvasContexts = (canvasRef, bottomCanvasRef) => {
  if (!canvasRef.current || !bottomCanvasRef.current) {
    console.error("Canvas references not available");
    return {
      canvasContext: null,
      bottomCanvasContext: null,
    };
  }

  const canvasContext = canvasRef.current.getContext("2d", {
    willReadFrequently: true,
  });

  const bottomCanvasContext = bottomCanvasRef.current.getContext("2d", {
    willReadFrequently: true,
  });

  return {
    canvasContext,
    bottomCanvasContext,
  };
};

export const resizeCanvases = (
  videoWidth,
  videoHeight,
  isBackgroundEffect,
  effectImg,
  canvasRef,
  bottomCanvasRef,
  bottomCanvasContextRef
) => {
  if (!canvasRef.current) return false;

  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const ratio = videoWidth / videoHeight;

  canvasRef.current.width = windowHeight * ratio;
  canvasRef.current.height = windowHeight;

  if (isBackgroundEffect && bottomCanvasRef.current && effectImg) {
    bottomCanvasRef.current.width = windowWidth;
    bottomCanvasRef.current.height = windowHeight;

    if (bottomCanvasContextRef.current && effectImg) {
      bottomCanvasContextRef.current.drawImage(
        effectImg,
        0,
        0,
        effectImg.width,
        effectImg.height,
        0,
        0,
        windowWidth,
        windowHeight
      );
    }
  }

  return true;
};

export const calculateCanvasDimensions = (videoWidth, videoHeight) => {
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const videoRatio = videoWidth / videoHeight;
  const windowRatio = windowWidth / windowHeight;

  let width, height;

  if (videoRatio > windowRatio) {
    width = windowWidth;
    height = windowWidth / videoRatio;
  } else {
    height = windowHeight;
    width = windowHeight * videoRatio;
  }

  return { width, height };
};

export const captureVideoFrame = (videoRef, canvasRef, canvasContextRef) => {
  if (!videoRef.current || !canvasRef.current || !canvasContextRef.current) {
    return null;
  }

  const video = videoRef.current;
  const canvas = canvasRef.current;
  const context = canvasContextRef.current;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  return context.getImageData(0, 0, canvas.width, canvas.height);
};

export const clearCanvases = (canvasRefs) => {
  const {
    canvasRef,
    canvasContextRef,
    offScreenCanvasRef,
    offScreenCanvasContextRef,
    bottomCanvasRef,
    bottomCanvasContextRef,
  } = canvasRefs;

  if (canvasRef.current && canvasContextRef.current) {
    canvasContextRef.current.clearRect(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );
  }

  if (offScreenCanvasRef.current && offScreenCanvasContextRef.current) {
    offScreenCanvasContextRef.current.clearRect(
      0,
      0,
      offScreenCanvasRef.current.width,
      offScreenCanvasRef.current.height
    );
  }

  if (bottomCanvasRef.current && bottomCanvasContextRef.current) {
    bottomCanvasContextRef.current.clearRect(
      0,
      0,
      bottomCanvasRef.current.width,
      bottomCanvasRef.current.height
    );
  }
};

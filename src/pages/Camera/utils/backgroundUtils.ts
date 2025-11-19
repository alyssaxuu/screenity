import * as bodySegmentation from "@tensorflow-models/body-segmentation";
import "@tensorflow/tfjs-core";
import "@mediapipe/selfie_segmentation";

export const loadSegmentationModel = async (): Promise<any> => {
  try {
    const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
    const segmenterConfig = {
      runtime: "mediapipe",
      solutionPath: "./assets/selfieSegmentation",
      modelType: "general",
    };

    return await bodySegmentation.createSegmenter(model, segmenterConfig);
  } catch (error) {
    console.error("Error loading segmentation model:", error);
    return null;
  }
};

export const segmentPerson = async (img, segmenter: any): Promise<any> => {
  if (!img || !segmenter) {
    console.warn("Missing input: ", {
      hasImage: !!img,
      hasSegmenter: !!segmenter,
    });
    return null;
  }

  if (!img.data || img.width === 0 || img.height === 0) {
    console.warn("Invalid image dimensions or incomplete image data");
    return null;
  }

  try {
    const segmentationPromise = segmenter.segmentPeople(img);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Segmentation timed out")), 5000)
    );

    const people = await Promise.race([segmentationPromise, timeoutPromise]);

    if (!people || people.length === 0) {
      return null;
    }

    return people;
  } catch (error) {
    console.error("Error during person segmentation:", error);

    return null;
  }
};

export const renderBlur = async (img, people, canvasRef: any): Promise<any> => {
  if (!img || !people || !canvasRef.current) return;

  try {
    const backgroundBlurAmount = 16;
    const edgeBlurAmount = 10;
    const flipHorizontal = false;
    const foregroundThresholdProbability = 0.6;

    const ratio = img.width / img.height;
    canvasRef.current.width = window.innerHeight * ratio;
    canvasRef.current.height = window.innerHeight;

    await bodySegmentation.drawBokehEffect(
      canvasRef.current,
      img,
      people,
      foregroundThresholdProbability,
      backgroundBlurAmount,
      edgeBlurAmount,
      flipHorizontal
    );

    return true;
  } catch (error) {
    console.error("Error rendering blur:", error);
    return false;
  }
};

export const getImageURL = (imageData: any) => {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext("2d");
  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
};

export const renderEffect = async (
  img,
  people,
  offScreenCanvasRef,
  offScreenCanvasContextRef,
  canvasRef,
  canvasContextRef
: any): Promise<any> => {
  if (!img || !people || !offScreenCanvasRef.current || !canvasRef.current)
    return false;

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

    offScreenCanvasRef.current.width = img.width;
    offScreenCanvasRef.current.height = img.height;
    canvasRef.current.width = window.innerHeight * ratio;
    canvasRef.current.height = window.innerHeight;

    offScreenCanvasContextRef.current.putImageData(img, 0, 0);

    offScreenCanvasContextRef.current.globalCompositeOperation =
      "destination-out";
    await bodySegmentation.drawMask(
      offScreenCanvasRef.current,
      img,
      backgroundDarkeningMask,
      0, // opacity
      3 // edgeBlurAmount
    );

    offScreenCanvasContextRef.current.globalCompositeOperation = "source-over";

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

    return true;
  } catch (error) {
    console.error("Error rendering effect:", error);
    return false;
  }
};

export const loadEffect = (effectUrl: any) => {
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
: any) => {
  if (!effectImg || !bottomCanvasRef.current || !bottomCanvasContextRef.current)
    return false;

  try {
    const canvas = bottomCanvasRef.current;
    const ctx = bottomCanvasContextRef.current;

    // Set canvas size to window dimensions
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Calculate dimensions to cover the canvas while maintaining aspect ratio
    const imgRatio = effectImg.width / effectImg.height;
    const canvasRatio = canvas.width / canvas.height;
    let drawWidth = canvas.width;
    let drawHeight = canvas.height;

    if (canvasRatio > imgRatio) {
      // Canvas is wider than the image ratio
      drawWidth = canvas.height * imgRatio;
      drawHeight = canvas.height;
    } else {
      // Canvas is taller than the image ratio
      drawWidth = canvas.width;
      drawHeight = canvas.width / imgRatio;
    }

    // Center the image
    const x = (canvas.width - drawWidth) / 2;
    const y = (canvas.height - drawHeight) / 2;

    // Clear canvas and draw the background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(effectImg, x, y, drawWidth, drawHeight);

    return true;
  } catch (error) {
    console.error("Error rendering effect background:", error);
    return false;
  }
};

// Process a new video frame with current effect settings
export const processVideoFrame = async (
  frameData,
  segmenter,
  isBlurEnabled,
  effectImg,
  canvasRefs
: any): Promise<any> => {
  if (!frameData || !segmenter) return;

  try {
    const people = await segmentPerson(frameData, segmenter);
    if (!people) return;

    const {
      canvasRef,
      canvasContextRef,
      offScreenCanvasRef,
      offScreenCanvasContextRef,
      bottomCanvasRef,
      bottomCanvasContextRef,
    } = canvasRefs;

    if (isBlurEnabled) {
      await renderBlur(frameData, people, canvasRef);
    } else if (effectImg) {
      await renderEffect(
        frameData,
        people,
        offScreenCanvasRef,
        offScreenCanvasContextRef,
        canvasRef,
        canvasContextRef
      );
    }
  } catch (error) {
    console.error("Error processing video frame:", error);
  }
};

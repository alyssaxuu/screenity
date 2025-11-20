import React from "react";

/**
 * Camera module type definitions
 */

export interface CameraRefs {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  streamRef: React.RefObject<MediaStream>;
  recordingTypeRef: React.RefObject<string>;
  offScreenCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  offScreenCanvasContextRef: React.RefObject<CanvasRenderingContext2D | null>;
  bottomCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  bottomCanvasContextRef: React.RefObject<CanvasRenderingContext2D | null>;
  segmenterRef: React.RefObject<any>;
  blurRef: React.RefObject<boolean>;
  effectRef: React.RefObject<HTMLImageElement | null>;
  backgroundEffectsRef: React.RefObject<boolean>;
}

export interface CameraSetters {
  setWidth: (newWidth: string) => void;
  setHeight: (newHeight: string) => void;
  setBackgroundEffects: (active: boolean) => void;
  setPipMode: (active: boolean) => void;
  setIsCameraMode: (active: boolean) => void;
}

export interface CameraContextRefs extends CameraRefs, CameraSetters {}

export interface CameraToggledRequest {
  surface?: string;
  active?: boolean;
  id?: string;
}

export interface StorageResult {
  backgroundEffect?: string;
  backgroundEffectsActive?: boolean;
  defaultVideoInput?: string;
  recordingType?: string;
}

export interface CanvasDimensions {
  width: number;
  height: number;
}


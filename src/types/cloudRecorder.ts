import React from "react";
import BunnyTusUploader from "../pages/CloudRecorder/bunnyTusUploader";

/**
 * CloudRecorder module type definitions
 */

export interface TimerState {
  start: number | null;
  total: number;
  paused: boolean;
  notificationInterval?: NodeJS.Timeout | null;
  warned?: boolean;
}

export interface UploadMetaScreen {
  videoId: string | null;
  mediaId: string | null;
  offset: number;
  status: string;
  error: string | null;
  isPaused: boolean;
  isFinalizing: boolean;
  metadata: Record<string, unknown>;
  sceneId?: string | null;
  thumbnail?: string;
  width?: number;
  height?: number;
}

export interface UploadMetaCamera {
  videoId: string | null;
  mediaId: string | null;
  offset: number;
  status: string;
  error: string | null;
  isPaused: boolean;
  isFinalizing: boolean;
  metadata: Record<string, unknown>;
  sceneId?: string | null;
  thumbnail?: string;
  width?: number;
  height?: number;
}

export interface UploadMetaAudio {
  videoId: string | null;
  mediaId: string | null;
  path?: string;
  url?: string;
}

export interface UploadMeta {
  screen?: UploadMetaScreen | null;
  camera?: UploadMetaCamera | null;
  audio?: UploadMetaAudio | null;
  sceneId?: string | null;
}

export interface RecorderRefs {
  screenTimer: React.MutableRefObject<TimerState>;
  cameraTimer: React.MutableRefObject<TimerState>;
  screenStream: React.MutableRefObject<MediaStream | null>;
  cameraStream: React.MutableRefObject<MediaStream | null>;
  micStream: React.MutableRefObject<MediaStream | null>;
  rawMicStream: React.MutableRefObject<MediaStream | null>;
  screenRecorder: React.MutableRefObject<MediaRecorder | null>;
  cameraRecorder: React.MutableRefObject<MediaRecorder | null>;
  audioRecorder: React.MutableRefObject<MediaRecorder | null>;
  screenUploader: React.MutableRefObject<BunnyTusUploader | null>;
  cameraUploader: React.MutableRefObject<BunnyTusUploader | null>;
  uploadMetaRef: React.MutableRefObject<UploadMeta | null>;
}

export interface VideoQuality {
  width: number;
  height: number;
}

export interface Bitrates {
  audio: number;
  video: number;
}

export interface RecorderConfig {
  quality?: string;
  defaultVideoInput?: string;
  defaultAudioInput?: string;
  multiSceneCount?: number;
}

export interface ChromeStorageResult {
  quality?: string;
  defaultVideoInput?: string;
  defaultAudioInput?: string;
  multiSceneCount?: number;
  projectId?: string;
  [key: string]: unknown;
}

export interface CreateVideoProjectResponse {
  success: boolean;
  videoId?: string;
  message?: string;
  error?: string;
}


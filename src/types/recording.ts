// Recording-related types

export interface ChunkData {
  timestamp: number;
  chunk: Blob;
}

export interface RecordingStartTime {
  recordingStartTime: number;
}

export interface RecordingState {
  recording: boolean;
  paused?: boolean;
  restarting?: boolean;
  recordingStartTime?: number;
  recordingDuration?: number;
  pendingRecording?: boolean;
}

export interface RecordingTabInfo {
  recordingTab: number | null;
  tabRecordedID?: number | null;
  activeTab?: number;
  sandboxTab?: number;
  editorTab?: number;
  backupTab?: number;
}

export interface RecordingSettings {
  region?: boolean;
  customRegion?: boolean;
  backup?: boolean;
  backupSetup?: boolean;
  offscreen?: boolean;
  surface?: "screen" | "window" | "browser" | "monitor";
  recordingType?: string;
  wasRegion?: boolean;
}

export interface AlarmSettings {
  alarm?: boolean;
  alarmTime?: string | number;
}

export interface StreamingData {
  qualityValue?: string;
  fpsValue?: string;
  [key: string]: unknown;
}

export interface CheckCapturePermissionsParams {
  isLoggedIn: boolean;
  isSubscribed: boolean;
}

export interface CheckCapturePermissionsResponse {
  status: "ok" | "error";
}

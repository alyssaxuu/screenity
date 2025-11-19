// Comprehensive message types for Chrome extension messaging
// All message types used throughout the extension

// Base message interface
export interface BaseMessage {
  type: string;
}

// ============================================================================
// DRIVE MESSAGES
// ============================================================================

export interface SaveToDriveMessage extends BaseMessage {
  type: "save-to-drive" | "save-to-drive-fallback";
  base64?: string;
  title: string;
}

export interface DriveUploadResponse {
  status: "ok" | "ew";
  url: string | null;
  error?: string;
}

// ============================================================================
// RECORDING MESSAGES
// ============================================================================

export interface StartRecordingMessage extends BaseMessage {
  type: "start-recording";
}

export interface StopRecordingMessage extends BaseMessage {
  type: "stop-recording" | "stop-recording-tab";
  memoryError?: boolean;
}

export interface PauseRecordingMessage extends BaseMessage {
  type: "pause-recording" | "pause-recording-tab";
}

export interface ResumeRecordingMessage extends BaseMessage {
  type: "resume-recording" | "resume-recording-tab";
}

export interface CancelRecordingMessage extends BaseMessage {
  type: "cancel-recording";
}

export interface RestartRecordingMessage extends BaseMessage {
  type: "restart-recording-tab";
}

export interface RecordingErrorMessage extends BaseMessage {
  type: "recording-error";
  error?: "stream-error" | "backup-error";
}

export interface NewChunkMessage extends BaseMessage {
  type: "new-chunk";
  chunk: Blob;
  index: number;
}

export interface DesktopCaptureMessage extends BaseMessage {
  type: "desktop-capture";
}

export interface BackupCreatedMessage extends BaseMessage {
  type: "backup-created";
  request: ExtensionMessage;
  tabId: number;
}

export interface WriteFileMessage extends BaseMessage {
  type: "write-file";
}

export interface VideoReadyMessage extends BaseMessage {
  type: "video-ready";
}

export interface RecordingCompleteMessage extends BaseMessage {
  type: "recording-complete";
}

export interface CheckRecordingMessage extends BaseMessage {
  type: "check-recording";
}

// ============================================================================
// TAB MANAGEMENT MESSAGES
// ============================================================================

export interface ResetActiveTabMessage extends BaseMessage {
  type: "reset-active-tab" | "reset-active-tab-restart";
}

export interface SetSurfaceMessage extends BaseMessage {
  type: "set-surface";
  surface: "screen" | "window" | "browser" | "monitor";
}

export interface SetMicActiveMessage extends BaseMessage {
  type: "set-mic-active-tab";
  active: boolean;
  defaultAudioInput?: string;
}

export interface FocusTabMessage extends BaseMessage {
  type: "focus-this-tab";
}

// ============================================================================
// AUTH MESSAGES
// ============================================================================

export interface CheckAuthStatusMessage extends BaseMessage {
  type: "check-auth-status";
}

export interface HandleLoginMessage extends BaseMessage {
  type: "handle-login";
}

export interface HandleLogoutMessage extends BaseMessage {
  type: "handle-logout";
}

export interface RefreshAuthMessage extends BaseMessage {
  type: "refresh-auth";
}

export interface AuthResponse {
  authenticated: boolean;
  subscribed?: boolean;
  user?: User;
  proSubscription?: ProSubscription;
  hasSubscribedBefore?: boolean;
  message?: string;
  success?: boolean;
  error?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface ProSubscription {
  id: string;
  status: string;
  plan: string;
}

// ============================================================================
// VIDEO PROJECT MESSAGES
// ============================================================================

export interface CreateVideoProjectMessage extends BaseMessage {
  type: "create-video-project";
  title: string;
  instantMode?: boolean;
}

export interface FinishMultiRecordingMessage extends BaseMessage {
  type: "finish-multi-recording";
  projectId: string;
  sceneId?: string;
  multiMode?: boolean;
  publicUrl?: string;
  newProject?: boolean;
}

export interface FetchVideosMessage extends BaseMessage {
  type: "fetch-videos";
  page?: number;
  pageSize?: number;
  sort?: "newest" | "oldest" | "alphabetical" | "reverse-alphabetical";
  filter?: "all" | "personal" | "team" | "shared";
}

export interface UpdateProjectLoadingMessage extends BaseMessage {
  type: "update-project-loading";
  multiMode?: boolean;
}

export interface UpdateProjectReadyMessage extends BaseMessage {
  type: "update-project-ready";
  share?: boolean;
  newProject?: boolean;
  sceneId?: string | null;
}

export interface EditorReadyMessage extends BaseMessage {
  type: "editor-ready";
  projectId?: string;
  sceneId?: string;
  multiMode?: boolean;
}

export interface PreparingRecordingMessage extends BaseMessage {
  type: "preparing-recording";
}

// ============================================================================
// DOWNLOAD MESSAGES
// ============================================================================

export interface RequestDownloadMessage extends BaseMessage {
  type: "request-download";
  base64: string;
  title: string;
}

export interface DownloadIndexedDBMessage extends BaseMessage {
  type: "indexed-db-download";
}

// ============================================================================
// WINDOW & UI MESSAGES
// ============================================================================

export interface ResizeWindowMessage extends BaseMessage {
  type: "resize-window";
  width: number;
  height: number;
}

export interface PipStartedMessage extends BaseMessage {
  type: "pip-started";
}

export interface PipEndedMessage extends BaseMessage {
  type: "pip-ended";
}

// ============================================================================
// PERMISSIONS MESSAGES
// ============================================================================

export interface OnGetPermissionsMessage extends BaseMessage {
  type: "on-get-permissions";
  data?: ExtensionMessage;
}

export interface CheckCapturePermissionsMessage extends BaseMessage {
  type: "check-capture-permissions";
  isLoggedIn: boolean;
  isSubscribed: boolean;
}

export interface CheckCapturePermissionsResponse {
  status: "ok" | "error";
}

// ============================================================================
// STREAMING MESSAGES
// ============================================================================

export interface GetStreamingDataMessage extends BaseMessage {
  type: "get-streaming-data";
}

// ============================================================================
// RESTORE MESSAGES
// ============================================================================

export interface RestoreRecordingMessage extends BaseMessage {
  type: "restore-recording";
}

export interface CheckRestoreMessage extends BaseMessage {
  type: "check-restore";
}

// ============================================================================
// SYNC MESSAGES
// ============================================================================

export interface SyncRecordingStateMessage extends BaseMessage {
  type: "sync-recording-state";
}

export interface SyncRecordingStateResponse {
  recording: boolean;
  paused: boolean;
  recordingStartTime: number | null;
  pendingRecording: boolean;
}

// ============================================================================
// BANNER MESSAGES
// ============================================================================

export interface CheckBannerSupportMessage extends BaseMessage {
  type: "check-banner-support";
}

export interface CheckBannerSupportResponse {
  bannerSupport: boolean;
}

export interface HideBannerMessage extends BaseMessage {
  type: "hide-banner";
}

// ============================================================================
// ALARM MESSAGES
// ============================================================================

export interface AddAlarmListenerMessage extends BaseMessage {
  type: "add-alarm-listener";
}

export interface ClearRecordingAlarmMessage extends BaseMessage {
  type: "clear-recording-alarm";
}

// ============================================================================
// UTILITY MESSAGES
// ============================================================================

export interface IsPinnedMessage extends BaseMessage {
  type: "is-pinned";
}

export interface GetPlatformInfoMessage extends BaseMessage {
  type: "get-platform-info";
}

export interface AvailableMemoryMessage extends BaseMessage {
  type: "available-memory";
}

export interface ForceProcessingMessage extends BaseMessage {
  type: "force-processing";
}

export interface ClearRecordingsMessage extends BaseMessage {
  type: "clear-recordings";
}

// ============================================================================
// UNION TYPE - All Extension Messages
// ============================================================================

export type ExtensionMessage =
  | SaveToDriveMessage
  | StartRecordingMessage
  | StopRecordingMessage
  | PauseRecordingMessage
  | ResumeRecordingMessage
  | CancelRecordingMessage
  | RestartRecordingMessage
  | RecordingErrorMessage
  | NewChunkMessage
  | DesktopCaptureMessage
  | BackupCreatedMessage
  | WriteFileMessage
  | VideoReadyMessage
  | RecordingCompleteMessage
  | CheckRecordingMessage
  | ResetActiveTabMessage
  | SetSurfaceMessage
  | SetMicActiveMessage
  | FocusTabMessage
  | CheckAuthStatusMessage
  | HandleLoginMessage
  | HandleLogoutMessage
  | RefreshAuthMessage
  | CreateVideoProjectMessage
  | FinishMultiRecordingMessage
  | FetchVideosMessage
  | UpdateProjectLoadingMessage
  | UpdateProjectReadyMessage
  | EditorReadyMessage
  | PreparingRecordingMessage
  | RequestDownloadMessage
  | DownloadIndexedDBMessage
  | ResizeWindowMessage
  | PipStartedMessage
  | PipEndedMessage
  | OnGetPermissionsMessage
  | CheckCapturePermissionsMessage
  | GetStreamingDataMessage
  | RestoreRecordingMessage
  | CheckRestoreMessage
  | SyncRecordingStateMessage
  | CheckBannerSupportMessage
  | HideBannerMessage
  | AddAlarmListenerMessage
  | ClearRecordingAlarmMessage
  | IsPinnedMessage
  | GetPlatformInfoMessage
  | AvailableMemoryMessage
  | ForceProcessingMessage
  | ClearRecordingsMessage
  | BaseMessage;


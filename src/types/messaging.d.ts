// Message types for Chrome extension messaging

export interface BaseMessage {
  type: string;
  [key: string]: any;
}

export interface SaveToDriveMessage extends BaseMessage {
  type: "save-to-drive" | "save-to-drive-fallback";
  base64?: string;
  title: string;
}

export interface RecordingMessage extends BaseMessage {
  type: "start-recording" | "stop-recording" | "pause-recording" | "cancel-recording";
  [key: string]: any;
}

export interface AuthMessage extends BaseMessage {
  type: "check-auth-status" | "handle-login" | "handle-logout" | "refresh-auth";
  [key: string]: any;
}

export interface VideoMessage extends BaseMessage {
  type: "fetch-videos" | "create-video-project" | "finish-multi-recording";
  page?: number;
  pageSize?: number;
  sort?: "newest" | "oldest" | "alphabetical" | "reverse-alphabetical";
  filter?: "all" | "personal" | "team" | "shared";
  title?: string;
  data?: any;
  instantMode?: boolean;
  [key: string]: any;
}

export type ExtensionMessage = SaveToDriveMessage | RecordingMessage | AuthMessage | VideoMessage | BaseMessage;


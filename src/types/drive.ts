// Drive-related types

export interface DriveUploadResponse {
  status: "ok" | "ew";
  url: string | null;
  error?: string;
}

export interface SaveToDriveRequest {
  base64?: string;
  title: string;
}

export interface TokenPayload {
  exp: number;
  [key: string]: unknown;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType?: string;
}

export interface GoogleDriveFileList {
  files: GoogleDriveFile[];
}


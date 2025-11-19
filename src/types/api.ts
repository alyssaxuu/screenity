// API-related types

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface VideoProject {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  scenes?: VideoScene[];
  [key: string]: unknown;
}

export interface VideoScene {
  id: string;
  projectId: string;
  title?: string;
  order: number;
  [key: string]: unknown;
}

export interface Video {
  id: string;
  title: string;
  url?: string;
  thumbnailUrl?: string;
  duration?: number;
  createdAt: string;
  updatedAt: string;
  projectId?: string;
  sceneId?: string;
  [key: string]: unknown;
}

export interface CreateVideoProjectRequest {
  title: string;
  instantMode?: boolean;
}

export interface CreateVideoProjectResponse {
  success: boolean;
  videoId?: string;
  projectId?: string;
  error?: string;
}

export interface FetchVideosRequest {
  page?: number;
  pageSize?: number;
  sort?: "newest" | "oldest" | "alphabetical" | "reverse-alphabetical";
  filter?: "all" | "personal" | "team" | "shared";
}

export interface FetchVideosResponse {
  success: boolean;
  videos?: Video[];
  error?: string;
}

export interface StorageQuotaResponse {
  success: boolean;
  quota?: number;
  usage?: number;
  error?: string;
}

export interface AutoPublishRequest {
  projectId: string;
}

export interface AutoPublishResponse {
  success: boolean;
  publicUrl?: string;
  error?: string;
}


/**
 * Shared types between frontend and backend
 */

export interface PinImage {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
  source: string;
  isSelected?: boolean;
  downloadProgress?: number;
}

export interface BoardAnalysis {
  boardName: string;
  description: string;
  images: PinImage[];
  groundingSources?: Array<{
    title: string;
    uri: string;
  }>;
  boardId?: string;
  totalImages?: number;
  taskId?: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SCRAPING = 'SCRAPING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  DOWNLOADING = 'DOWNLOADING'
}

export interface DownloadState {
  selectedImages: string[];
  isDownloading: boolean;
  progress: number;
  taskId?: string;
  downloadUrl?: string;
  totalImages: number;
}

export interface ScrapingResponse {
  boardId: string;
  boardName: string;
  description: string;
  images: PinImage[];
  totalImages: number;
  taskId: string;
}

export interface DownloadRequest {
  boardId: string;
  imageIds: string[];
  format?: 'zip';
}

export interface DownloadResponse {
  taskId: string;
  downloadUrl: string;
  expiresAt: string;
  fileSize: number;
}

export interface ProgressResponse {
  taskId: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
  downloadedCount?: number;
  totalCount?: number;
}
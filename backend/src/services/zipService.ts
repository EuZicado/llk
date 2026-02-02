/**
 * ZIP generation service for bundling Pinterest images
 */
import archiver from 'archiver';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { PinImage } from './sharedTypes';

interface ZipProgress {
  taskId: string;
  progress: number;
  status: 'pending' | 'downloading' | 'compressing' | 'completed' | 'failed';
  message: string;
  downloadedCount: number;
  totalCount: number;
  fileSize?: number;
}

interface ZipTask {
  taskId: string;
  boardId: string;
  imageIds: string[];
  images: PinImage[];
  outputPath: string;
  createdAt: Date;
  expiresAt: Date;
}

export class ZipService {
  private tempDir: string;
  private downloadDir: string;
  private zipTasks: Map<string, ZipTask> = new Map();
  private progressCallbacks: Map<string, (progress: ZipProgress) => void> = new Map();

  constructor() {
    this.tempDir = process.env.TEMP_DIR || './temp';
    this.downloadDir = path.join(this.tempDir, 'downloads');
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    await fs.ensureDir(this.tempDir);
    await fs.ensureDir(this.downloadDir);
  }

  /**
   * Create ZIP archive from Pinterest images
   * @param boardId - Board identifier
   * @param images - Array of images to include
   * @param imageIds - Specific image IDs to download (empty for all)
   * @param onProgress - Progress callback function
   * @returns Promise with download URL and file information
   */
  public async createZipArchive(
    boardId: string,
    images: PinImage[],
    imageIds: string[] = [],
    onProgress?: (progress: ZipProgress) => void
  ): Promise<{ taskId: string; downloadUrl: string; fileSize: number; expiresAt: string }> {
    const taskId = uuidv4();
    
    // Filter images if specific IDs provided
    const filteredImages = imageIds.length > 0 
      ? images.filter(img => imageIds.includes(img.id))
      : images;

    if (filteredImages.length === 0) {
      throw new Error('No images selected for download');
    }

    const outputPath = path.join(this.downloadDir, `${taskId}.zip`);
    const expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 hours

    // Store task information
    const task: ZipTask = {
      taskId,
      boardId,
      imageIds,
      images: filteredImages,
      outputPath,
      createdAt: new Date(),
      expiresAt
    };

    this.zipTasks.set(taskId, task);
    if (onProgress) {
      this.progressCallbacks.set(taskId, onProgress);
    }

    try {
      // Create ZIP archive
      await this.generateZip(taskId, filteredImages);
      
      // Get file size
      const stats = await fs.stat(outputPath);
      
      // Schedule cleanup
      this.scheduleCleanup(taskId);

      const downloadUrl = `/api/download/${taskId}`;
      
      return {
        taskId,
        downloadUrl,
        fileSize: stats.size,
        expiresAt: expiresAt.toISOString()
      };

    } catch (error) {
      // Clean up on failure
      await this.cleanupTask(taskId);
      throw error;
    }
  }

  /**
   * Generate ZIP file with progress tracking
   */
  private async generateZip(taskId: string, images: PinImage[]): Promise<void> {
    const task = this.zipTasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const output = fs.createWriteStream(task.outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    return new Promise((resolve, reject) => {
      let downloadedCount = 0;
      const totalCount = images.length;

      // Handle archive events
      output.on('close', () => {
        this.updateProgress(taskId, {
          progress: 100,
          status: 'completed',
          message: `ZIP created successfully (${archive.pointer()} bytes)`,
          downloadedCount: totalCount,
          totalCount
        });
        resolve();
      });

      archive.on('error', (err) => {
        this.updateProgress(taskId, {
          progress: 0,
          status: 'failed',
          message: `ZIP creation failed: ${err.message}`,
          downloadedCount: 0,
          totalCount
        });
        reject(err);
      });

      archive.on('progress', (progress) => {
        const percent = Math.round((downloadedCount / totalCount) * 100);
        this.updateProgress(taskId, {
          progress: percent,
          status: 'compressing',
          message: `Compressing files... (${downloadedCount}/${totalCount})`,
          downloadedCount,
          totalCount
        });
      });

      // Pipe archive to output
      archive.pipe(output);

      // Download and add each image
      const downloadPromises = images.map(async (image, index) => {
        try {
          this.updateProgress(taskId, {
            progress: Math.round((downloadedCount / totalCount) * 50),
            status: 'downloading',
            message: `Downloading image ${index + 1}/${totalCount}...`,
            downloadedCount,
            totalCount
          });

          // Download image
          const response = await axios({
            method: 'GET',
            url: image.url,
            responseType: 'stream',
            timeout: 30000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });

          // Sanitize filename
          const extension = this.getFileExtension(image.url) || 'jpg';
          const filename = this.sanitizeFilename(`${image.title || `image-${index + 1}`}.${extension}`);

          // Add to archive
          archive.append(response.data, { name: filename });
          downloadedCount++;

        } catch (error) {
          console.warn(`Failed to download image ${image.id}:`, error);
          // Add placeholder for failed images
          const placeholder = Buffer.from(`Download failed for: ${image.url}`);
          archive.append(placeholder, { name: `failed-${index + 1}.txt` });
        }
      });

      // Wait for all downloads to complete
      Promise.all(downloadPromises)
        .then(() => {
          archive.finalize();
        })
        .catch(reject);
    });
  }

  /**
   * Get download stream for a completed ZIP file
   */
  public async getDownloadStream(taskId: string): Promise<NodeJS.ReadableStream> {
    const task = this.zipTasks.get(taskId);
    
    if (!task) {
      throw new Error('Download task not found');
    }

    if (new Date() > task.expiresAt) {
      await this.cleanupTask(taskId);
      throw new Error('Download expired');
    }

    if (!(await fs.pathExists(task.outputPath))) {
      throw new Error('Download file not found');
    }

    return fs.createReadStream(task.outputPath);
  }

  /**
   * Get progress for a ZIP task
   */
  public getProgress(taskId: string): ZipProgress | undefined {
    // This would typically come from a progress tracking system
    // For now, we'll return a simplified version
    const task = this.zipTasks.get(taskId);
    if (!task) return undefined;

    return {
      taskId,
      progress: 0, // Would be updated by the actual progress tracking
      status: 'pending',
      message: 'Preparing download...',
      downloadedCount: 0,
      totalCount: task.images.length
    };
  }

  /**
   * Sanitize filename to prevent filesystem issues
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/^\.+/, '')
      .replace(/\s+/g, '-')
      .substring(0, 100); // Limit length
  }

  /**
   * Extract file extension from URL
   */
  private getFileExtension(url: string): string | null {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:[#?]|$)/);
    return match ? match[1].toLowerCase() : null;
  }

  /**
   * Update progress for a task
   */
  private updateProgress(taskId: string, updates: Partial<ZipProgress>): void {
    const callback = this.progressCallbacks.get(taskId);
    if (callback) {
      const currentProgress = this.getProgress(taskId) || {
        taskId,
        progress: 0,
        status: 'pending',
        message: '',
        downloadedCount: 0,
        totalCount: 0
      };
      callback({ ...currentProgress, ...updates });
    }
  }

  /**
   * Schedule cleanup for expired files
   */
  private scheduleCleanup(taskId: string): void {
    const task = this.zipTasks.get(taskId);
    if (!task) return;

    const delay = task.expiresAt.getTime() - Date.now();
    if (delay > 0) {
      setTimeout(() => {
        this.cleanupTask(taskId);
      }, delay);
    }
  }

  /**
   * Clean up task and associated files
   */
  private async cleanupTask(taskId: string): Promise<void> {
    const task = this.zipTasks.get(taskId);
    if (task) {
      try {
        if (await fs.pathExists(task.outputPath)) {
          await fs.unlink(task.outputPath);
        }
      } catch (error) {
        console.warn(`Failed to delete file ${task.outputPath}:`, error);
      }
      
      this.zipTasks.delete(taskId);
      this.progressCallbacks.delete(taskId);
    }
  }

  /**
   * Cleanup expired files
   */
  public async cleanupExpired(): Promise<void> {
    const now = new Date();
    const expiredTasks: string[] = [];

    for (const [taskId, task] of this.zipTasks.entries()) {
      if (now > task.expiresAt) {
        expiredTasks.push(taskId);
      }
    }

    for (const taskId of expiredTasks) {
      await this.cleanupTask(taskId);
    }
  }

  /**
   * Get statistics about current tasks
   */
  public getStats(): { activeTasks: number; totalSize: number } {
    let totalSize = 0;
    
    for (const task of this.zipTasks.values()) {
      try {
        const stats = fs.statSync(task.outputPath);
        totalSize += stats.size;
      } catch {
        // File might not exist yet
      }
    }

    return {
      activeTasks: this.zipTasks.size,
      totalSize
    };
  }
}
/**
 * Pinterest API Controller
 */
import { Request, Response, NextFunction } from 'express';
import { PinterestScraperService } from '../services/scraperService';
import { ZipService } from '../services/zipService';
import { validatePinterestUrl } from '../utils/validators';
import { 
  ScrapingResponse, 
  DownloadRequest, 
  DownloadResponse, 
  ProgressResponse 
} from '../types/sharedTypes';

export class PinterestController {
  private scraperService: PinterestScraperService;
  private zipService: ZipService;

  constructor(scraperService: PinterestScraperService, zipService: ZipService) {
    this.scraperService = scraperService;
    this.zipService = zipService;
  }

  /**
   * Scrape Pinterest board and return image list
   * POST /api/scrape
   */
  public async scrapeBoard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { url } = req.body;

      if (!url) {
        res.status(400).json({
          error: 'URL is required'
        });
        return;
      }

      // Validate URL
      const validationResult = validatePinterestUrl(url);
      if (!validationResult.isValid) {
        res.status(400).json({
          error: validationResult.errorMessage || 'Invalid Pinterest URL'
        });
        return;
      }

      // Start scraping with progress updates
      const result = await this.scraperService.scrapeBoard(url, (progress) => {
        // In a real implementation, you'd send progress via WebSocket or SSE
        console.log(`Scraping progress: ${progress.currentImages}/${progress.totalImages} - ${progress.message}`);
      });

      const response: ScrapingResponse = {
        boardId: result.boardId,
        boardName: result.boardName,
        description: result.description,
        images: result.images,
        totalImages: result.totalImages,
        taskId: result.taskId
      };

      res.status(200).json(response);

    } catch (error: any) {
      console.error('Scraping error:', error);
      
      // Handle specific error cases
      if (error.message.includes('private')) {
        res.status(403).json({
          error: 'This board is private or requires login'
        });
        return;
      }
      
      if (error.message.includes('Invalid Pinterest URL')) {
        res.status(400).json({
          error: error.message
        });
        return;
      }

      res.status(500).json({
        error: error.message || 'Failed to scrape Pinterest board'
      });
    }
  }

  /**
   * Get images for a board with pagination
   * GET /api/images/:boardId
   */
  public async getBoardImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { boardId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      if (pageNum < 1 || limitNum < 1) {
        res.status(400).json({
          error: 'Page and limit must be positive numbers'
        });
        return;
      }

      // In a real implementation, you'd fetch from a database or cache
      // For now, we'll return a placeholder response
      res.status(200).json({
        boardId,
        page: pageNum,
        limit: limitNum,
        images: [],
        total: 0,
        hasNext: false,
        hasPrev: pageNum > 1
      });

    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to fetch board images'
      });
    }
  }

  /**
   * Create ZIP download for selected images
   * POST /api/download
   */
  public async createDownload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { boardId, imageIds }: DownloadRequest = req.body;

      if (!boardId) {
        res.status(400).json({
          error: 'Board ID is required'
        });
        return;
      }

      // In a real implementation, you'd fetch the actual images from storage
      // For now, we'll simulate the process
      const downloadResult = await this.zipService.createZipArchive(
        boardId,
        [], // Empty images array for simulation
        imageIds || [],
        (progress) => {
          console.log(`ZIP progress: ${progress.progress}% - ${progress.message}`);
        }
      );

      const response: DownloadResponse = {
        taskId: downloadResult.taskId,
        downloadUrl: downloadResult.downloadUrl,
        expiresAt: downloadResult.expiresAt,
        fileSize: downloadResult.fileSize
      };

      res.status(200).json(response);

    } catch (error: any) {
      console.error('Download creation error:', error);
      
      if (error.message.includes('No images selected')) {
        res.status(400).json({
          error: 'No images selected for download'
        });
        return;
      }

      res.status(500).json({
        error: error.message || 'Failed to create download'
      });
    }
  }

  /**
   * Get download progress
   * GET /api/progress/:taskId
   */
  public async getProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { taskId } = req.params;

      // Check scraping progress first
      const scrapingProgress = this.scraperService.getScrapingProgress(taskId);
      if (scrapingProgress) {
        const response: ProgressResponse = {
          taskId,
          progress: Math.round((scrapingProgress.currentImages / Math.max(scrapingProgress.totalImages, 1)) * 100),
          status: scrapingProgress.status === 'completed' ? 'completed' : 
                  scrapingProgress.status === 'failed' ? 'failed' : 'processing',
          message: scrapingProgress.message,
          downloadedCount: scrapingProgress.currentImages,
          totalCount: scrapingProgress.totalImages
        };

        res.status(200).json(response);
        return;
      }

      // Check ZIP progress
      const zipProgress = this.zipService.getProgress(taskId);
      if (zipProgress) {
        res.status(200).json(zipProgress);
        return;
      }

      res.status(404).json({
        error: 'Task not found'
      });

    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to get progress'
      });
    }
  }

  /**
   * Serve download file
   * GET /api/download/:taskId
   */
  public async serveDownload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { taskId } = req.params;

      const stream = await this.zipService.getDownloadStream(taskId);
      
      // Set appropriate headers
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="pinterest-board-${taskId}.zip"`);
      
      // Stream the file
      stream.pipe(res);

    } catch (error: any) {
      console.error('Download serving error:', error);
      
      if (error.message.includes('not found')) {
        res.status(404).json({
          error: 'Download not found'
        });
        return;
      }
      
      if (error.message.includes('expired')) {
        res.status(410).json({
          error: 'Download has expired'
        });
        return;
      }

      res.status(500).json({
        error: error.message || 'Failed to serve download'
      });
    }
  }

  /**
   * Get service statistics
   * GET /api/stats
   */
  public async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const zipStats = this.zipService.getStats();
      
      res.status(200).json({
        activeDownloads: zipStats.activeTasks,
        totalDownloadSize: zipStats.totalSize,
        serverUptime: process.uptime(),
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      res.status(500).json({
        error: error.message || 'Failed to get statistics'
      });
    }
  }
}
/**
 * API Routes Configuration
 */
import express from 'express';
import { PinterestController } from '../controllers/pinterestController';
import { PinterestScraperService } from '../services/scraperService';
import { ZipService } from '../services/zipService';

// Initialize services
const scraperService = new PinterestScraperService();
const zipService = new ZipService();

// Initialize controller
const pinterestController = new PinterestController(scraperService, zipService);

const router = express.Router();

// Scrape Pinterest board
router.post('/scrape', (req, res, next) => 
  pinterestController.scrapeBoard(req, res, next)
);

// Get board images with pagination
router.get('/images/:boardId', (req, res, next) => 
  pinterestController.getBoardImages(req, res, next)
);

// Create download ZIP
router.post('/download', (req, res, next) => 
  pinterestController.createDownload(req, res, next)
);

// Get task progress
router.get('/progress/:taskId', (req, res, next) => 
  pinterestController.getProgress(req, res, next)
);

// Serve download file
router.get('/download/:taskId', (req, res, next) => 
  pinterestController.serveDownload(req, res, next)
);

// Get service statistics
router.get('/stats', (req, res, next) => 
  pinterestController.getStats(req, res, next)
);

export default router;
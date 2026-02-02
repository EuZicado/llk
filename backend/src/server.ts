/**
 * Main Express server configuration
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Import routes
import apiRoutes from './routes/api';

// Import services
import { PinterestScraperService } from './services/scraperService';
import { ZipService } from './services/zipService';

class Server {
  public app: express.Application;
  private port: number;
  private scraperService: PinterestScraperService;
  private zipService: ZipService;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3001', 10);
    
    // Initialize services
    this.scraperService = new PinterestScraperService();
    this.zipService = new ZipService();
    
    this.configureMiddleware();
    this.configureRoutes();
    this.handleErrors();
  }

  private configureMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10), // limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    this.app.use(limiter);

    // CORS configuration
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com'] // Replace with your frontend domain
        : ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Serve static files
    this.app.use('/downloads', express.static(path.join(__dirname, '../temp/downloads')));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private configureRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // API routes
    this.app.use('/api', apiRoutes);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
      });
    });
  }

  private handleErrors(): void {
    // Error handling middleware
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Error occurred:', err);
      
      // Handle specific error types
      if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
          error: 'Invalid JSON in request body'
        });
      }

      if (err.type === 'entity.too.large') {
        return res.status(413).json({
          error: 'Request entity too large'
        });
      }

      // Default error response
      res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    });
  }

  public async start(): Promise<void> {
    try {
      // Start server
      this.app.listen(this.port, () => {
        console.log(`🚀 Pinterest Downloader API Server running on port ${this.port}`);
        console.log(`📅 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📁 Temp directory: ${process.env.TEMP_DIR || './temp'}`);
      });

      // Graceful shutdown handling
      process.on('SIGTERM', async () => {
        console.log('SIGTERM received, shutting down gracefully...');
        await this.shutdown();
      });

      process.on('SIGINT', async () => {
        console.log('SIGINT received, shutting down gracefully...');
        await this.shutdown();
      });

    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  private async shutdown(): Promise<void> {
    try {
      console.log('Cleaning up resources...');
      
      // Cleanup services
      await this.scraperService.cleanup();
      await this.zipService.cleanupExpired();
      
      console.log('Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  // Getter methods for services (for testing and external access)
  public getScraperService(): PinterestScraperService {
    return this.scraperService;
  }

  public getZipService(): ZipService {
    return this.zipService;
  }
}

// Export for use in other files
export default Server;

// Start server if this file is run directly
if (require.main === module) {
  const server = new Server();
  server.start();
}
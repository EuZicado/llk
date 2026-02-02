/**
 * Pinterest board scraper service using Puppeteer
 */
import puppeteer, { Browser, Page } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';
import { PinImage } from '../types/sharedTypes';
import { validatePinterestUrl, isBoardPrivate, normalizePinterestUrl } from '../utils/validators';

interface ScrapingProgress {
  currentImages: number;
  totalImages: number;
  status: 'initializing' | 'loading' | 'scrolling' | 'completed' | 'failed';
  message: string;
}

interface ScrapingResult {
  boardId: string;
  boardName: string;
  description: string;
  images: PinImage[];
  totalImages: number;
  taskId: string;
}

export class PinterestScraperService {
  private browser: Browser | null = null;
  private tempDir: string;
  private scrapingTasks: Map<string, ScrapingProgress> = new Map();

  constructor() {
    this.tempDir = process.env.TEMP_DIR || './temp';
    this.ensureTempDir();
  }

  private async ensureTempDir(): Promise<void> {
    await fs.ensureDir(this.tempDir);
  }

  /**
   * Launch browser instance with appropriate settings
   */
  private async launchBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--lang=en-US,en'
      ]
    });

    return this.browser;
  }

  /**
   * Scrape a Pinterest board and extract all images
   * @param boardUrl - Pinterest board URL
   * @param onProgress - Progress callback function
   * @returns Promise with scraping result
   */
  public async scrapeBoard(
    boardUrl: string,
    onProgress?: (progress: ScrapingProgress) => void
  ): Promise<ScrapingResult> {
    const taskId = uuidv4();
    const normalizedUrl = normalizePinterestUrl(boardUrl);
    
    // Validate URL first
    const validationResult = validatePinterestUrl(normalizedUrl);
    if (!validationResult.isValid) {
      throw new Error(validationResult.errorMessage || 'Invalid Pinterest URL');
    }

    const browser = await this.launchBrowser();
    let page: Page | null = null;

    try {
      // Initialize progress tracking
      this.scrapingTasks.set(taskId, {
        currentImages: 0,
        totalImages: 0,
        status: 'initializing',
        message: 'Initializing scraper...'
      });
      onProgress?.(this.scrapingTasks.get(taskId)!);

      // Create new page
      page = await browser.newPage();
      
      // Set viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Navigate to board
      this.updateProgress(taskId, { status: 'loading', message: 'Loading Pinterest board...' });
      onProgress?.(this.scrapingTasks.get(taskId)!);

      await page.goto(normalizedUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Check if board is private
      const pageContent = await page.content();
      if (isBoardPrivate(pageContent)) {
        throw new Error('This board appears to be private or requires login');
      }

      // Wait for initial content to load
      await page.waitForSelector('div[data-test-id="pinWrapper"]', { timeout: 10000 }).catch(() => {
        // If pin wrappers not found, try alternative selectors
        return page!.waitForSelector('div[role="feed"]', { timeout: 5000 }).catch(() => {});
      });

      // Get board information
      const boardInfo = await this.extractBoardInfo(page);
      
      // Scroll and collect images
      const images = await this.collectImages(page, taskId, onProgress);
      
      // Clean up
      await page.close();

      this.updateProgress(taskId, { 
        status: 'completed', 
        message: `Successfully collected ${images.length} images`,
        currentImages: images.length,
        totalImages: images.length
      });
      onProgress?.(this.scrapingTasks.get(taskId)!);

      return {
        boardId: validationResult.boardId!,
        boardName: boardInfo.name,
        description: boardInfo.description,
        images,
        totalImages: images.length,
        taskId
      };

    } catch (error) {
      this.updateProgress(taskId, { 
        status: 'failed', 
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      onProgress?.(this.scrapingTasks.get(taskId)!);
      
      if (page) {
        await page.close().catch(() => {});
      }
      throw error;
    }
  }

  /**
   * Extract board name and description
   */
  private async extractBoardInfo(page: Page): Promise<{ name: string; description: string }> {
    try {
      // Try to get board name from various selectors
      const boardName = await page.evaluate(() => {
        // Look for board title in different places
        const titleElement = document.querySelector('h1') || 
                            document.querySelector('[data-test-id="boardName"]') ||
                            document.querySelector('title');
        return titleElement ? titleElement.textContent?.trim() || 'Untitled Board' : 'Untitled Board';
      });

      // Try to get description
      const description = await page.evaluate(() => {
        const descElements = Array.from(document.querySelectorAll('meta[name="description"], [property="og:description"]'));
        for (const el of descElements) {
          const content = el.getAttribute('content');
          if (content) return content;
        }
        return 'Pinterest board collection';
      });

      return {
        name: boardName.replace(' - Pinterest', '').trim(),
        description: description.trim()
      };
    } catch (error) {
      return {
        name: 'Pinterest Board',
        description: 'Collection of Pinterest images'
      };
    }
  }

  /**
   * Collect all images by scrolling and extracting URLs
   */
  private async collectImages(
    page: Page,
    taskId: string,
    onProgress?: (progress: ScrapingProgress) => void
  ): Promise<PinImage[]> {
    const images: PinImage[] = [];
    const seenUrls = new Set<string>();
    let previousHeight = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 50; // Prevent infinite scrolling

    this.updateProgress(taskId, { status: 'scrolling', message: 'Collecting images...' });
    onProgress?.(this.scrapingTasks.get(taskId)!);

    while (scrollAttempts < maxScrollAttempts) {
      // Extract images from current view
      const newImages = await this.extractImagesFromPage(page);
      
      // Add only unique images
      for (const image of newImages) {
        if (!seenUrls.has(image.url)) {
          seenUrls.add(image.url);
          images.push(image);
        }
      }

      // Update progress
      this.updateProgress(taskId, {
        currentImages: images.length,
        totalImages: Math.max(images.length, this.scrapingTasks.get(taskId)?.totalImages || 0),
        message: `Found ${images.length} images...`
      });
      onProgress?.(this.scrapingTasks.get(taskId)!);

      // Scroll down
      previousHeight = await page.evaluate(() => document.body.scrollHeight);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      
      // Wait for new content to load
      await page.waitForTimeout(2000);
      
      // Check if we've reached the bottom
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) {
        scrollAttempts++;
        // Try clicking "Load more" buttons if they exist
        const loadMoreClicked = await page.evaluate(() => {
          const loadButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
            btn.textContent?.toLowerCase().includes('load') || 
            btn.textContent?.toLowerCase().includes('more')
          );
          if (loadButtons.length > 0) {
            (loadButtons[0] as HTMLElement).click();
            return true;
          }
          return false;
        });
        
        if (!loadMoreClicked) {
          break; // No more content to load
        }
      } else {
        scrollAttempts = 0; // Reset counter if content loaded
      }
    }

    return images;
  }

  /**
   * Extract image URLs and information from current page view
   */
  private async extractImagesFromPage(page: Page): Promise<PinImage[]> {
    return await page.evaluate(() => {
      const images: any[] = [];
      const pinWrappers = document.querySelectorAll('div[data-test-id="pinWrapper"]');
      
      pinWrappers.forEach(wrapper => {
        try {
          // Find the image element
          const imgElement = wrapper.querySelector('img');
          if (!imgElement) return;
          
          // Get image URLs
          const src = imgElement.src || imgElement.getAttribute('data-src');
          if (!src) return;
          
          // Convert to high resolution URL
          let highResUrl = src;
          if (src.includes('236x')) {
            highResUrl = src.replace(/236x[^\/]*/, 'originals');
          } else if (src.includes('474x')) {
            highResUrl = src.replace(/474x[^\/]*/, 'originals');
          }
          
          // Get pin ID from data attributes or URL
          const pinId = wrapper.getAttribute('data-test-id')?.replace('pinWrapper-', '') || 
                       btoa(src).slice(0, 10);
          
          // Get title/description
          const titleElement = wrapper.querySelector('div[data-test-id="pinTitle"]');
          const title = titleElement?.textContent?.trim() || 'Pinterest Image';
          
          images.push({
            id: pinId,
            url: highResUrl,
            thumbnail: src,
            title: title,
            source: window.location.href
          });
        } catch (error) {
          // Skip problematic pins
          console.warn('Error extracting pin:', error);
        }
      });
      
      return images;
    });
  }

  /**
   * Update progress for a scraping task
   */
  private updateProgress(taskId: string, updates: Partial<ScrapingProgress>): void {
    const currentProgress = this.scrapingTasks.get(taskId) || {
      currentImages: 0,
      totalImages: 0,
      status: 'initializing',
      message: ''
    };
    
    this.scrapingTasks.set(taskId, { ...currentProgress, ...updates });
  }

  /**
   * Get progress for a specific task
   */
  public getScrapingProgress(taskId: string): ScrapingProgress | undefined {
    return this.scrapingTasks.get(taskId);
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.scrapingTasks.clear();
  }
}